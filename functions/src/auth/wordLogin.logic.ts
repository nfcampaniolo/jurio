/**
 * Accesso all'add-in Word tramite jurio.it (flusso "autorizza dispositivo" con verifica PKCE).
 *
 * 1. Il pannello genera un segreto (verifier), invia solo il suo hash (challenge) → `start`
 *    e riceve sessionId + codice di conferma; apre jurio.it/word-login?s=<sessionId> nel browser.
 * 2. Sulla web app l'utente, già autenticato, vede lo stesso codice → `describe`, poi `approve`/`deny`.
 * 3. Il pannello interroga `exchange` con sessionId + verifier: ad approvazione avvenuta riceve
 *    un token personalizzato Firebase (una sola volta) e la sessione viene cancellata.
 *
 * Chi vedesse il link non può completare l'accesso: serve il verifier, che non lascia mai il pannello.
 * Il codice mostrato in entrambe le schermate protegge dall'approvazione di richieste altrui (phishing).
 */
import { Request, Response } from "express";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  consumePerMinuteFeature,
  corsHandlerWordAddin,
  requireAppCheck,
  requireUidFromAuthHeader,
} from "../_utils";
import { getAdminAuth, getDb } from "../_deps";
import { logSafeError } from "../_logging";

export const WORD_LOGIN = {
  collection: "word_login_sessions",
  ttlSeconds: 10 * 60,
  pollIntervalSeconds: 2,
  startsPerMinutePerIp: 10,
} as const;

const SESSION_ID = /^[A-Za-z0-9_-]{43}$/; // 32 byte in base64url
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/; // SHA-256 in base64url
const VERIFIER = /^[A-Za-z0-9_-]{43,128}$/; // come RFC 7636
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // senza caratteri ambigui (0/O, 1/I/L)

type Status = "pending" | "approved" | "denied";

interface SessionDoc {
  challenge: string;
  code: string;
  status: Status;
  uid: string | null;
  createdAt: FirebaseFirestore.FieldValue | Timestamp;
  /** Usato anche dalla policy TTL di Firestore per cancellare le sessioni scadute. */
  expireAt: Timestamp;
}

/**
 * Errori previsti: la risposta usa SOLO questi testi fissi, mai il messaggio di un'eccezione
 * (nessun dato interno o di terzi può finire nella risposta).
 */
const ERRORS = {
  INVALID_SESSION: [400, "Sessione non valida."],
  INVALID_REQUEST: [400, "Richiesta di accesso non valida."],
  INVALID_ACTION: [400, "Azione non valida."],
  APP_CHECK_FAILED: [401, "Verifica dell'app non riuscita. Ricarica e riprova."],
  UNAUTHENTICATED: [401, "Accedi a Jurio per continuare."],
  VERIFIER_MISMATCH: [403, "Richiesta di accesso non valida."],
  NOT_REGISTERED: [403, "Completa la registrazione su jurio.it prima di collegare Word."],
  ALREADY_HANDLED: [409, "Questa richiesta è già stata gestita."],
  EXPIRED: [410, "La richiesta è scaduta: riavvia l'accesso da Word."],
  TOO_MANY_STARTS: [429, "Troppe richieste di accesso. Riprova tra un minuto."],
} as const satisfies Record<string, readonly [number, string]>;

type ErrorCode = keyof typeof ERRORS;

class HttpError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code);
  }
}

export const challengeFor = (verifier: string): string => createHash("sha256").update(verifier).digest("base64url");

function safeEqual(a: string, b: string): boolean {
  const A = Buffer.from(a);
  const B = Buffer.from(b);
  return A.length === B.length && timingSafeEqual(A, B);
}

export function newConfirmationCode(): string {
  const chars = Array.from(randomBytes(6), (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]);
  return `${chars.slice(0, 3).join("")}-${chars.slice(3).join("")}`;
}

function clientIpKey(req: Request): string {
  const forwarded = String(req.headers["x-forwarded-for"] ?? "").split(",")[0].trim();
  const ip = forwarded || req.ip || "unknown";
  return `ip_${createHash("sha256").update(ip).digest("hex").slice(0, 32)}`;
}

const sessions = () => getDb().collection(WORD_LOGIN.collection);

function readSessionId(body: Record<string, unknown>): string {
  const id = body.sessionId;
  if (typeof id !== "string" || !SESSION_ID.test(id)) throw new HttpError("INVALID_SESSION");
  return id;
}

const isExpired = (doc: SessionDoc) => doc.expireAt.toMillis() <= Date.now();

// ─────────────────────────────────────────────
// Azioni del pannello (senza utente, con App Check)
// ─────────────────────────────────────────────

async function start(req: Request, body: Record<string, unknown>) {
  const challenge = body.challenge;
  if (typeof challenge !== "string" || !CHALLENGE.test(challenge)) {
    throw new HttpError("INVALID_REQUEST");
  }
  try {
    await consumePerMinuteFeature(clientIpKey(req), "word_login", WORD_LOGIN.startsPerMinutePerIp);
  } catch {
    throw new HttpError("TOO_MANY_STARTS");
  }

  const sessionId = randomBytes(32).toString("base64url");
  const code = newConfirmationCode();
  const doc: SessionDoc = {
    challenge,
    code,
    status: "pending",
    uid: null,
    createdAt: FieldValue.serverTimestamp(),
    expireAt: Timestamp.fromMillis(Date.now() + WORD_LOGIN.ttlSeconds * 1000),
  };
  await sessions().doc(sessionId).set(doc);
  return { sessionId, code, expiresIn: WORD_LOGIN.ttlSeconds, interval: WORD_LOGIN.pollIntervalSeconds };
}

async function exchange(body: Record<string, unknown>) {
  const sessionId = readSessionId(body);
  const verifier = body.verifier;
  if (typeof verifier !== "string" || !VERIFIER.test(verifier)) throw new HttpError("INVALID_REQUEST");

  const ref = sessions().doc(sessionId);
  const outcome = await getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return { status: "expired" as const };
    const doc = snap.data() as SessionDoc;
    if (!safeEqual(challengeFor(verifier), doc.challenge)) throw new HttpError("VERIFIER_MISMATCH");
    if (isExpired(doc)) {
      tx.delete(ref);
      return { status: "expired" as const };
    }
    if (doc.status === "pending") return { status: "pending" as const };
    // Esito definitivo: la sessione si consuma una sola volta.
    tx.delete(ref);
    return doc.status === "approved" && doc.uid
      ? { status: "approved" as const, uid: doc.uid }
      : { status: "denied" as const };
  });

  if (outcome.status !== "approved") return { status: outcome.status };
  const token = await getAdminAuth().createCustomToken(outcome.uid);
  return { status: "approved", token };
}

// ─────────────────────────────────────────────
// Azioni della web app (utente autenticato)
// ─────────────────────────────────────────────

async function loadPending(sessionId: string): Promise<SessionDoc> {
  const snap = await sessions().doc(sessionId).get();
  const doc = snap.exists ? (snap.data() as SessionDoc) : undefined;
  if (!doc || isExpired(doc)) throw new HttpError("EXPIRED");
  if (doc.status !== "pending") throw new HttpError("ALREADY_HANDLED");
  return doc;
}

async function describe(body: Record<string, unknown>) {
  const doc = await loadPending(readSessionId(body));
  return { code: doc.code, expiresAt: doc.expireAt.toMillis() };
}

async function decide(body: Record<string, unknown>, uid: string, status: "approved" | "denied") {
  const sessionId = readSessionId(body);
  if (status === "approved") {
    const registered = await getDb().collection("register").doc(uid).get();
    if (!registered.exists) {
      throw new HttpError("NOT_REGISTERED");
    }
  }
  const ref = sessions().doc(sessionId);
  await getDb().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const doc = snap.exists ? (snap.data() as SessionDoc) : undefined;
    if (!doc || isExpired(doc)) throw new HttpError("EXPIRED");
    if (doc.status !== "pending") throw new HttpError("ALREADY_HANDLED");
    tx.update(ref, { status, uid: status === "approved" ? uid : null, decidedAt: FieldValue.serverTimestamp() });
  });
  return { status };
}

// ─────────────────────────────────────────────
// Endpoint
// ─────────────────────────────────────────────

const PUBLIC_ACTIONS = ["start", "exchange"] as const;
const USER_ACTIONS = ["describe", "approve", "deny"] as const;

export async function executeWordAuth(req: Request, res: Response): Promise<void> {
  return corsHandlerWordAddin(req, res, async () => {
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }
    res.set("Cache-Control", "no-store");

    const body = (req.body ?? {}) as Record<string, unknown>;
    const action = body.action;
    try {
      if (typeof action !== "string" || ![...PUBLIC_ACTIONS, ...USER_ACTIONS].includes(action as never)) {
        throw new HttpError("INVALID_ACTION");
      }
      try {
        await requireAppCheck(req);
      } catch {
        throw new HttpError("APP_CHECK_FAILED");
      }

      let result: Record<string, unknown>;
      if (action === "start") result = await start(req, body);
      else if (action === "exchange") result = await exchange(body);
      else {
        let uid: string;
        try {
          uid = await requireUidFromAuthHeader(req);
        } catch {
          throw new HttpError("UNAUTHENTICATED");
        }
        if (action === "describe") result = await describe(body);
        else result = await decide(body, uid, action === "approve" ? "approved" : "denied");
      }
      res.status(200).json(result);
    } catch (err) {
      if (err instanceof HttpError) {
        const [status, details] = ERRORS[err.code];
        res.status(status).json({ error: err.code, details });
        return;
      }
      logSafeError("WORD_AUTH_FAILED", err);
      res.status(500).json({ error: "Errore interno", details: "Si è verificato un errore. Riprova." });
    }
  });
}
