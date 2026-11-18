import cors from "cors";
import * as admin from "firebase-admin";
import { getAppCheck } from "firebase-admin/app-check";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, getAdminAuth} from "./_deps";
import { Request, Response } from "express";
import {
  JurioFeatureType,
  ALLOWED_ORIGINS,
  ALLOWED_PLANS,
  JURIO_USAGE_LIMITS,
  WORD_ADDIN_PROD_ORIGIN,
  WORD_ADDIN_DEV_ORIGIN,
  WORD_ADDIN_STAGING_ORIGIN,
  DEV_PROJECT_IDS,
} from "./_constants";
import { logSafeError } from "./_logging";
import { withPseudonymization } from "./privacy/pseudonymization";

const db = getDb();
const auth = getAdminAuth();

// ============================================================================
// CORS E APP CHECK
// ============================================================================

function createCorsHandler(getOrigins: () => readonly string[]) {
  return cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, false);
      if (getOrigins().includes(origin)) {
        return callback(null, true);
      }
      console.error("[CORS] Origine non autorizzata");
      return callback(new Error(`Not allowed by CORS: ${origin}`));
    },
    methods: ["POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Firebase-AppCheck"],
  });
}

export const corsHandlerDomain = createCorsHandler(() => ALLOWED_ORIGINS);

function currentProjectId(): string {
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  try {
    return String(JSON.parse(process.env.FIREBASE_CONFIG ?? "{}").projectId ?? "");
  } catch {
    return "";
  }
}

/** true nell'emulatore locale o nel progetto Firebase di sviluppo; mai in produzione. */
export function isDevEnvironment(): boolean {
  return process.env.FUNCTIONS_EMULATOR === "true" || DEV_PROJECT_IDS.includes(currentProjectId());
}

/**
 * Origini ammesse dagli endpoint dell'add-in Word: quelle della web app + il sottodominio
 * di produzione dell'add-in; in ambiente dev anche il dev server locale e il sito Hosting di dev.
 */
export function getWordAddinOrigins(): string[] {
  const origins = [...ALLOWED_ORIGINS, WORD_ADDIN_PROD_ORIGIN];
  if (isDevEnvironment()) origins.push(WORD_ADDIN_DEV_ORIGIN, WORD_ADDIN_STAGING_ORIGIN);
  return origins;
}

export const corsHandlerWordAddin = createCorsHandler(getWordAddinOrigins);

export async function requireAppCheck(req: Request): Promise<void> {
  // Ignora il controllo se le funzioni girano nell'emulatore locale
  if (process.env.FUNCTIONS_EMULATOR === "true") return;
  const appCheckToken = req.headers["x-firebase-appcheck"];
  if (!appCheckToken || typeof appCheckToken !== "string") {
    throw new Error("Missing App Check token");
  }
  try {
    await getAppCheck().verifyToken(appCheckToken);
  } catch {
    throw new Error("Invalid App Check token");
  }
}

export async function requireUidFromAuthHeader(req: Request): Promise<string> {
  const h = req.headers?.authorization;
  if (!h || typeof h !== "string" || !h.startsWith("Bearer ")) {
    throw new Error("Missing Authorization Bearer token");
  }
  const token = h.slice("Bearer ".length);
  const decoded = await auth.verifyIdToken(token);
  return decoded.uid;
}

// ============================================================================
// UTILS
// ============================================================================


export function minuteKeyRome(d = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);

  const y = parts.find(p => p.type === "year")?.value ?? "1970";
  const m = parts.find(p => p.type === "month")?.value ?? "01";
  const day = parts.find(p => p.type === "day")?.value ?? "01";
  const h = parts.find(p => p.type === "hour")?.value ?? "00";
  const min = parts.find(p => p.type === "minute")?.value ?? "00";
  return `${y}-${m}-${day}T${h}:${min}`;
}

export function dayKeyRome(d = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);

  const y = parts.find(p => p.type === "year")?.value ?? "1970";
  const m = parts.find(p => p.type === "month")?.value ?? "01";
  const day = parts.find(p => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${day}`;
}

// ============================================================================
// USAGE TRAKING
// ============================================================================

function handleApiError(res: Response, err: unknown): void {
  const msg = err instanceof Error ? err.message : "Internal error";
  logSafeError("API_REQUEST_FAILED", err);

  if (res.headersSent && !res.writableEnded) {
    try {
      res.end();
    } catch {
      // La risposta potrebbe essere già stata chiusa dal client.
    }
    return;
  }

  if (msg === "NOT_FOUND" || msg.includes("not found")) {
    res.status(404).json({ error: "Not Found", details: msg });
    return;
  }
  if (msg === "FORBIDDEN" || msg.includes("Accesso alla") || msg.includes("negato")) {
    res.status(403).json({ error: "Forbidden", details: msg });
    return;
  }
  if (msg === "TOO_MANY_REQUESTS" || msg.includes("quota_exceeded") || msg === "rate_limited" || msg.includes("Limite")) {
    res.status(429).json({ error: "Too Many Requests", details: "Limite di utilizzo superato." });
    return;
  }
  if (msg.includes("AI_TEMPORARILY_UNAVAILABLE")) {
    res.set("Retry-After", "10");
    res.status(503).json({
      error: "AI temporarily unavailable",
      details:
        "Il servizio IA è temporaneamente sovraccarico. Analisi e fonti sono salvate; riprova a generare la sintesi tra poco.",
    });
    return;
  }
  if (msg.includes("ToolLoop")) {
    res.status(422).json({ error: "ToolLoop", details: msg });
    return;
  }

  res.status(500).json({ error: "Process failed", details: msg });
}

export async function withSecureApiEndpoint(
  req: Request,
  res: Response,
  handler: (uid: string) => Promise<void>,
  corsHandler: typeof corsHandlerDomain = corsHandlerDomain
): Promise<void> {
  return corsHandler(req, res, async (): Promise<void> => {
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    try {
      await requireAppCheck(req);
      const uid = await requireUidFromAuthHeader(req);
      await withPseudonymization(req.body, () => handler(uid));
    } catch (err) {
      handleApiError(res, err);
    }
  });
}

export async function validateUserPlanAndLimits(
  uid: string, 
  type: JurioFeatureType, 
  preloadedUserSnap?: admin.firestore.DocumentSnapshot
): Promise<void> {
  // Evita una lettura duplicata se lo snapshot è già disponibile
  const userSnap = preloadedUserSnap ?? await db.collection("register").doc(uid).get();

  if (!userSnap.exists) {
    throw new Error("NOT_FOUND");
  }

  const planId = String(userSnap.data()?.planId ?? "");
  if (!ALLOWED_PLANS.has(planId)) {
    throw new Error("FORBIDDEN");
  }

  // Usa la chiave dinamica basata sul feature type (es. "legal_agent") anziché "research"
  // Le feature trasversali definiscono solo il limite "global"; per le altre, un piano senza limite esplicito resta bloccato
  const featureLimits = JURIO_USAGE_LIMITS?.[type] as Record<string, { perMinute: number; perDay: number }> | undefined;
  const limits = featureLimits?.[planId] ?? featureLimits?.global ?? { perMinute: 0, perDay: 0 };

  try {
    await Promise.all([
      consumePerMinuteFeature(uid, type, limits.perMinute),
      consumeDailyFeature(uid, type, limits.perDay),
    ]);
  } catch {
    console.warn(`[${type}] Rate limit superato`);
    throw new Error("TOO_MANY_REQUESTS");
  }
}

/** Mese corrente nel fuso di Roma, es. "2026-11". */
export function monthKeyRome(d = new Date()): string {
  return dayKeyRome(d).slice(0, 7);
}

function monthlyUsageRef(uid: string, feature: string, d = new Date()) {
  return db.collection("usage").doc(uid).collection("months").doc(`${monthKeyRome(d)}_${feature}`);
}

/** Utilizzi del mese corrente per una feature (sola lettura, non consuma quota). */
export async function readMonthlyFeatureCount(uid: string, feature: string): Promise<number> {
  const snap = await monthlyUsageRef(uid, feature).get();
  return snap.exists ? Number(snap.data()?.count ?? 0) : 0;
}

/**
 * Consuma una unità del contatore mensile. Lancia `monthly_quota_exceeded` oltre il limite.
 * Il documento ha la stessa forma dei contatori giornalieri (count, updatedAt).
 */
export async function consumeMonthlyFeature(uid: string, feature: string, limit: number): Promise<{ used: number; remaining: number }> {
  const ref = monthlyUsageRef(uid, feature);
  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const prev = snap.exists ? Number(snap.data()?.count ?? 0) : 0;
    const next = prev + 1;
    if (next > limit) {
      throw Object.assign(new Error("monthly_quota_exceeded"), { code: "monthly_quota_exceeded", feature, prev });
    }
    tx.set(ref, { count: next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { used: next, remaining: limit - next };
  });
}

export async function consumePerMinuteFeature(uid: string, feature: JurioFeatureType, limit: number): Promise<void> {
  // Isoliamo il contatore dei minuti unendo la chiave temporale alla feature
  const key = `${minuteKeyRome()}_${feature}`;
  const ref = db.collection("rate").doc(uid).collection("minutes").doc(key);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const prev = snap.exists ? Number(snap.data()?.count ?? 0) : 0;
    const next = prev + 1;

    if (next > limit) {
      throw Object.assign(new Error("rate_limited"), { code: "rate_limited", feature, prev });
    }

    tx.set(ref, { count: next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
}

export async function consumeDailyFeature(uid: string, feature: JurioFeatureType, limit: number): Promise<{ remaining: number }> {
  // Isoliamo il contatore giornaliero unendo la chiave temporale alla feature
  const key = `${dayKeyRome()}_${feature}`;
  const ref = db.collection("usage").doc(uid).collection("days").doc(key);

  return await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const prev = snap.exists ? Number(snap.data()?.count ?? 0) : 0;
    const next = prev + 1;

    if (next > limit) {
      throw Object.assign(new Error("quota_exceeded"), { code: "quota_exceeded", feature, prev });
    }

    tx.set(ref, { count: next, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { remaining: limit - next };
  });
}
