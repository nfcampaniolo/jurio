import cors from "cors";
import * as admin from "firebase-admin";
import { getAppCheck } from "firebase-admin/app-check";
import { FieldValue } from "firebase-admin/firestore";
import { getDb, getAdminAuth} from "./_deps";
import { Request, Response } from "express";
import { JurioFeatureType, ALLOWED_ORIGINS, ALLOWED_PLANS, JURIO_USAGE_LIMITS } from "./_constants";

const db = getDb();
const auth = getAdminAuth();

// ============================================================================
// CORS E APP CHECK
// ============================================================================

export const corsHandlerDomain = cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, false);
    if (ALLOWED_ORIGINS.includes(origin)) {
      return callback(null, true);
    }
    console.error(`[CORS] Bloccato origin non autorizzato: ${origin}`);
    return callback(new Error(`Not allowed by CORS: ${origin}`));
  },
  methods: ["POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Firebase-AppCheck"], 
});

export async function requireAppCheck(req: any): Promise<void> {
  // Ignora il controllo se le funzioni girano nell'emulatore locale
  if (process.env.FUNCTIONS_EMULATOR === "true") return;
  const appCheckToken = req.headers["x-firebase-appcheck"];
  if (!appCheckToken || typeof appCheckToken !== "string") {
    throw new Error("Missing App Check token");
  }
  try {
    await getAppCheck().verifyToken(appCheckToken);
  } catch (err) {
    throw new Error("Invalid App Check token");
  }
}

export async function requireUidFromAuthHeader(req: any): Promise<string> {
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
  console.error("[API Error] ERRORE CRITICO:", err);

  if (res.headersSent && !res.writableEnded) {
    try {
      res.end();
    } catch (_) {}
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
  if (msg === "TOO_MANY_REQUESTS" || msg.includes("quota_exceeded") || msg.includes("Limite")) {
    res.status(429).json({ error: "Too Many Requests", details: "Limite di utilizzo superato." });
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
  handler: (uid: string) => Promise<void>
): Promise<any> {
  return corsHandlerDomain(req, res, async (): Promise<void> => {
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
      await handler(uid);
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
  const limits = (
    JURIO_USAGE_LIMITS?.[type] as Record<string, { perMinute: number; perDay: number }>
  )?.[planId] ?? { perMinute: 0, perDay: 0 };

  try {
    await Promise.all([
      consumePerMinuteFeature(uid, type, limits.perMinute),
      consumeDailyFeature(uid, type, limits.perDay),
    ]);
  } catch (error) {
    console.warn(`[${type}] Rate limit superato per utente ${uid}`);
    throw new Error("TOO_MANY_REQUESTS");
  }
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