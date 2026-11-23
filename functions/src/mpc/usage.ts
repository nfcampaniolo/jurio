import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../_deps";
import { logSafeWarning } from "../_logging";

/**
 * Tracciamento d'uso del server MCP.
 *
 * Firebase Analytics vive solo nel browser e non vede le chiamate MCP: qui contiamo le
 * chiamate ai tool lato server, come dato di servizio aggregato per giorno.
 * Non salviamo mai gli argomenti dei tool (query, testi), solo nome del tool, esito, durata e client.
 *
 *  - mcp_usage/{uid}/days/{YYYY-MM-DD}  → utilizzo per utente (base per eventuali limiti di piano)
 *  - mcp_usage_daily/{YYYY-MM-DD}       → totali di piattaforma per la dashboard admin
 */

export type McpUsageContext = {
  uid: string;
  /** Nome del client dichiarato alla Dynamic Client Registration (es. "claude"), già normalizzato. */
  client: string;
};

export type McpToolCall = McpUsageContext & {
  tool: string;
  ok: boolean;
  durationMs: number;
};

export const UNKNOWN_CLIENT = "unknown";
const MAX_KEY_LENGTH = 40;

/** Rende una stringa sicura come chiave di mappa Firestore (niente punti, spazi o caratteri speciali). */
export function normalizeUsageKey(value: unknown): string {
  if (typeof value !== "string") return UNKNOWN_CLIENT;
  const key = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_KEY_LENGTH);
  return key || UNKNOWN_CLIENT;
}

/** Giorno corrente nel fuso di Roma, es. "2026-11-23" (stesso criterio dei contatori `usage`). */
export function mcpDayKey(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function usageIncrements(call: McpToolCall) {
  const durationMs = Math.max(0, Math.round(call.durationMs));
  return {
    calls: FieldValue.increment(1),
    errors: FieldValue.increment(call.ok ? 0 : 1),
    durationMsTotal: FieldValue.increment(durationMs),
    tools: { [normalizeUsageKey(call.tool)]: FieldValue.increment(1) },
    clients: { [call.client]: FieldValue.increment(1) },
    updatedAt: FieldValue.serverTimestamp(),
  };
}

/**
 * Registra una chiamata a un tool. Non lancia mai: un errore di tracciamento
 * non deve far fallire la risposta all'utente.
 */
export async function recordMcpToolCall(call: McpToolCall): Promise<void> {
  try {
    const db = getDb();
    const day = mcpDayKey();
    const data = usageIncrements(call);
    const batch = db.batch();
    batch.set(db.collection("mcp_usage").doc(call.uid).collection("days").doc(day), data, { merge: true });
    batch.set(db.collection("mcp_usage_daily").doc(day), data, { merge: true });
    await batch.commit();
  } catch (error) {
    logSafeWarning("MCP_USAGE_RECORD_FAILED", error);
  }
}
