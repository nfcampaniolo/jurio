import { applicationDefault } from "firebase-admin/app";
import type { PiiCategory, PseudonymizationVault } from "./pseudonymization";

/**
 * Rilevamento dei dati personali con Cloud DLP (Sensitive Data Protection), in aggiunta alle regex.
 *
 * - Attivo solo con PSEUDONYMIZATION_DLP=true; in caso di errore o timeout si prosegue con le sole regex.
 * - Riceve solo il testo che viene dall'utente (prompt, messaggi user/model, documenti del fascicolo
 *   restituiti da userFileSearch), non i prompt di sistema né le fonti giuridiche.
 * - Usa l'endpoint regionale (default europe-west1), così il testo resta nell'UE.
 * - Ogni testo viene analizzato una sola volta per richiesta, anche se compare in più chiamate al modello.
 */

const DLP_INFO_TYPES: Record<string, PiiCategory> = {
  PERSON_NAME: "NOME",
  FIRST_NAME: "NOME",
  LAST_NAME: "NOME",
  EMAIL_ADDRESS: "EMAIL",
  PHONE_NUMBER: "TELEFONO",
  ITALY_FISCAL_CODE: "CODICE_FISCALE",
  IBAN_CODE: "IBAN",
  STREET_ADDRESS: "INDIRIZZO",
  DATE_OF_BIRTH: "DATA_NASCITA",
};

/** Strumenti i cui risultati contengono documenti dell'utente. */
const USER_DATA_TOOLS = new Set(["userFileSearch"]);

/** Limite di DLP per richiesta: 0,5 MB. Si resta sotto con margine. */
const MAX_CHUNK_CHARS = 200_000;
const CHUNK_OVERLAP = 200;
const MAX_PARALLEL_REQUESTS = 4;

export interface DlpFinding {
  value: string;
  category: PiiCategory;
}

export function isDlpEnabled(): boolean {
  return process.env.PSEUDONYMIZATION_DLP === "true";
}

const inspectedByVault = new WeakMap<PseudonymizationVault, Set<string>>();

let cachedToken: { value: string; expiresAt: number } | undefined;

async function getApplicationDefaultToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.value;
  const token = await applicationDefault().getAccessToken();
  cachedToken = { value: token.access_token, expiresAt: Date.now() + token.expires_in * 1000 };
  return token.access_token;
}

/** Credenziali usate per chiamare DLP; sostituibili nei test. */
export const dlpAuth = { getAccessToken: getApplicationDefaultToken };

function projectId(): string {
  if (process.env.GCLOUD_PROJECT) return process.env.GCLOUD_PROJECT;
  try {
    return String(JSON.parse(process.env.FIREBASE_CONFIG ?? "{}").projectId ?? "");
  } catch {
    return "";
  }
}

function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    out.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectStrings(item, out));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStrings(item, out));
  }
}

function collectTextParts(content: unknown, out: string[]): void {
  if (typeof content === "string") {
    out.push(content);
    return;
  }
  if (!Array.isArray(content)) return;
  for (const part of content) {
    if (typeof part?.text === "string") out.push(part.text);
  }
}

/** Testi di una richiesta Genkit che provengono dall'utente. */
export function collectUserTexts(request: unknown): string[] {
  if (!request || typeof request !== "object") return [];
  const { prompt, messages } = request as { prompt?: unknown; messages?: unknown };
  const out: string[] = [];
  collectTextParts(prompt, out);
  if (Array.isArray(messages)) {
    for (const message of messages) {
      const role = message?.role;
      if (role === "user" || role === "model") {
        collectTextParts(message.content, out);
      } else if (role === "tool" && Array.isArray(message.content)) {
        for (const part of message.content) {
          const response = part?.toolResponse;
          if (response && USER_DATA_TOOLS.has(response.name)) collectStrings(response.output, out);
        }
      }
    }
  }
  return out.filter((text) => text.trim().length >= 3);
}

/** Raggruppa i testi in blocchi sotto il limite di DLP; i testi troppo lunghi si spezzano con sovrapposizione. */
export function chunkTexts(texts: string[], maxChars = MAX_CHUNK_CHARS): string[] {
  const chunks: string[] = [];
  let current = "";
  const flush = () => {
    if (current) chunks.push(current);
    current = "";
  };
  for (const text of texts) {
    if (text.length > maxChars) {
      flush();
      const step = maxChars - Math.min(CHUNK_OVERLAP, Math.floor(maxChars / 4));
      for (let start = 0; start < text.length; start += step) {
        chunks.push(text.slice(start, start + maxChars));
      }
      continue;
    }
    if (current.length + text.length + 2 > maxChars) flush();
    current = current ? `${current}\n\n${text}` : text;
  }
  flush();
  return chunks;
}

interface DlpResponse {
  result?: { findings?: Array<{ quote?: string; infoType?: { name?: string } }> };
}

async function inspectChunk(text: string, token: string, signal: AbortSignal): Promise<DlpFinding[]> {
  const location = process.env.PSEUDONYMIZATION_DLP_LOCATION || "europe-west1";
  const url = `https://dlp.googleapis.com/v2/projects/${projectId()}/locations/${location}/content:inspect`;
  const response = await fetch(url, {
    method: "POST",
    signal,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      item: { value: text },
      inspectConfig: {
        infoTypes: Object.keys(DLP_INFO_TYPES).map((name) => ({ name })),
        minLikelihood: "LIKELY",
        includeQuote: true,
      },
    }),
  });
  if (!response.ok) throw new Error(`DLP_HTTP_${response.status}`);
  const body = (await response.json()) as DlpResponse;
  const findings: DlpFinding[] = [];
  for (const finding of body.result?.findings ?? []) {
    const category = DLP_INFO_TYPES[finding.infoType?.name ?? ""];
    const value = finding.quote?.trim();
    if (category && value) findings.push({ value, category });
  }
  return findings;
}

async function inspectAll(chunks: string[], signal: AbortSignal): Promise<DlpFinding[]> {
  const token = await dlpAuth.getAccessToken();
  const findings: DlpFinding[] = [];
  for (let i = 0; i < chunks.length; i += MAX_PARALLEL_REQUESTS) {
    const batch = chunks.slice(i, i + MAX_PARALLEL_REQUESTS);
    const results = await Promise.all(batch.map((chunk) => inspectChunk(chunk, token, signal)));
    results.forEach((result) => findings.push(...result));
  }
  return findings;
}

/**
 * Analizza con DLP i testi dell'utente non ancora visti in questa richiesta e registra nel vault
 * i dati trovati. Non lancia mai: se DLP non risponde, restano le regex.
 */
export async function enrichVaultWithDlp(vault: PseudonymizationVault, request: unknown): Promise<void> {
  if (!isDlpEnabled()) return;
  const inspected = inspectedByVault.get(vault) ?? new Set<string>();
  inspectedByVault.set(vault, inspected);

  const texts = collectUserTexts(request).filter((text) => !inspected.has(text));
  if (texts.length === 0) return;
  texts.forEach((text) => inspected.add(text));

  const timeoutMs = Number(process.env.PSEUDONYMIZATION_DLP_TIMEOUT_MS) || 2_000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  try {
    const findings = await inspectAll(chunkTexts(texts), controller.signal);
    vault.registerExternalFindings(findings);
    console.info(`[PRIVACY] DLP_OK ms=${Date.now() - startedAt} chars=${texts.reduce((n, t) => n + t.length, 0)} findings=${findings.length}`);
  } catch (error) {
    // Nessun contenuto nei log: solo il tipo di errore.
    const reason = controller.signal.aborted ? "TIMEOUT" : error instanceof Error ? error.message : "UNKNOWN";
    console.warn(`[PRIVACY] DLP_UNAVAILABLE reason=${reason} ms=${Date.now() - startedAt}`);
  } finally {
    clearTimeout(timer);
  }
}
