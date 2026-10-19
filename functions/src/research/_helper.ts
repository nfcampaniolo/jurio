import { Request } from "express";
import { OpenAI } from "openai";
import { Timestamp } from "firebase-admin/firestore";
import { requireAppCheck, requireUidFromAuthHeader } from "../_utils";
import { getDb } from "../_deps";

const db = getDb();
let oaClient: OpenAI | null = null;

/**
 * Inizializza o restituisce il client OpenAI (Lazy Loading).
 */
export function getOpenAIClient(): OpenAI {
  if (!oaClient) {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY_MISSING");
    }
    oaClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return oaClient;
}

export interface AuthResult {
  uid: string;
  isOAuthRequest: boolean;
}

/**
 * Autentica la richiesta gestendo sia token B2B OAuth opachi sia header Firebase Auth + App Check.
 */
export async function authenticateRequest(req: Request): Promise<AuthResult> {
  const authHeader = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";

  const isOpaqueOAuthToken = /^[a-f0-9]{64}\$/i.test(token);

  if (isOpaqueOAuthToken) {
    const tokenSnap = await db.collection("oauth_tokens").doc(token).get();
    if (!tokenSnap.exists) throw new Error("UNAUTHORIZED");

    const tokenData = tokenSnap.data();
    const expiresAt = tokenData?.expiresAt;

    if (
      typeof tokenData?.uid !== "string" ||
      !tokenData.uid ||
      !expiresAt ||
      typeof expiresAt.toDate !== "function" ||
      expiresAt.toDate() <= new Date()
    ) {
      if (tokenSnap.exists && expiresAt?.toDate() <= new Date()) {
        await tokenSnap.ref.delete().catch(() => {});
      }
      throw new Error("UNAUTHORIZED");
    }

    return { uid: tokenData.uid, isOAuthRequest: true };
  }

  try {
    await requireAppCheck(req);
    const uid = await requireUidFromAuthHeader(req);
    if (!uid) throw new Error("UNAUTHORIZED");
    return { uid, isOAuthRequest: false };
  } catch {
    throw new Error("UNAUTHORIZED");
  }
}

/**
 * Verifica l'abilitazione del piano utente e consuma i rate limit.
 */

/**
 * Applica filtri dinamici a una query Firestore gestendo oggetti Timestamp serializzati.
 */
export function applyFirestoreFilters(baseQuery: any, filters: any[]): any {
  return filters.reduce((q: any, f: any) => {
    if (f && typeof f.field === "string" && typeof f.operator === "string" && f.value !== undefined) {
      let queryValue = f.value;

      if (
        f.value &&
        typeof f.value === "object" &&
        f.value !== null &&
        (("type" in f.value && (f.value as any).type === "firestore/timestamp/1.0") || "seconds" in f.value)
      ) {
        const valAsObj = f.value as { seconds?: number; nanoseconds?: number };
        if (typeof valAsObj.seconds === "number") {
          queryValue = new Timestamp(valAsObj.seconds, valAsObj.nanoseconds || 0);
        }
      }
      return q.where(f.field, f.operator, queryValue);
    }
    return q;
  }, baseQuery);
}

/**
 * Tronca in modo sicuro una stringa.
 */
export function safeTruncateText(text: unknown, maxLength: number = 10000): string | null {
  return typeof text === "string" && text.length > 0 ? text.substring(0, maxLength) : null;
}

/**
 * Normalizza e valida il parametro limit.
 */
export function parseLimitParam(requestedLimit: unknown, defaultLimit: number = 50, maxLimit: number = 100): number {
  const num = Number(requestedLimit);
  return Number.isFinite(num) ? Math.min(Math.max(Math.floor(num), 1), maxLimit) : defaultLimit;
}