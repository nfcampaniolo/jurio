import { randomInt } from "node:crypto";
import { ai } from "../_config";

//DOCTRINE

export function chunkText(text: string, maxChunkSize = 70000): string[] {
  const chunks: string[] = [];
  let index = 0;

  while (index < text.length) {
    let end = Math.min(index + maxChunkSize, text.length);

    if (end < text.length) {
      const paragraphBreak = text.lastIndexOf("\n\n", end);
      if (paragraphBreak > index + maxChunkSize * 0.7) {
        end = paragraphBreak;
      }
    }

    chunks.push(text.slice(index, end).trim());
    index = end;
  }

  return chunks;
}

export function safeParseJson(rawText: string): unknown | null {
  const clean = rawText
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(clean);
  } catch (error) {
    console.warn("[doctrineFlow] JSON non valido ricevuto dal modello.");
    return null;
  }
}

export function isResourceExhaustedError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const value = error as Record<string, unknown>;

  return (
    value.code === 429 ||
    value.code === "429" ||
    value.code === "RESOURCE_EXHAUSTED" ||
    value.status === 429 ||
    value.status === "429" ||
    value.status === "RESOURCE_EXHAUSTED"
  );
}

function isTransientGenerationError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const value = error as Record<string, unknown>;
  const detail = value.detail && typeof value.detail === "object"
    ? value.detail as Record<string, unknown>
    : {};
  const detailError = detail.error && typeof detail.error === "object"
    ? detail.error as Record<string, unknown>
    : {};
  const message = [value.message, value.originalMessage, detailError.message]
    .filter((part): part is string => typeof part === "string")
    .join(" ");

  // Genkit can wrap permanent upstream 400/403 responses as status 500.
  // Inspect the original message first so these failures are not retried.
  if (/\[400\b|\[403\b|INVALID_ARGUMENT|PERMISSION_DENIED|UNAUTHENTICATED|Spend cap breached|Schema validation failed/i.test(message)) {
    return false;
  }

  const codes = [value.code, value.status, detailError.code, detailError.status];

  if (codes.some((code) =>
    code === 429 || code === 500 || code === 502 || code === 503 || code === 504 ||
    code === "RESOURCE_EXHAUSTED" || code === "UNAVAILABLE" || code === "DEADLINE_EXCEEDED" || code === "INTERNAL"
  )) {
    return true;
  }

  return /\b(429|500|502|503|504)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|DEADLINE_EXCEEDED|fetch failed|VERTEX_CALL_TIMEOUT/i.test(message);
}

export async function generateWithRetry(
  request: Parameters<typeof ai.generate>[0],
  maxRetries = 5
) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await ai.generate(request);
    } catch (error) {
      lastError = error;

      if (!isTransientGenerationError(error)) {
        throw error;
      }

      if (attempt === maxRetries) {
        break;
      }

      const baseDelay = 3000 * Math.pow(2, attempt);
      const jitter = randomInt(1000);
      const delay = baseDelay + jitter;

      console.warn(
        `[doctrineFlow] Errore temporaneo Vertex AI. Retry ${attempt + 1}/${maxRetries} tra ${delay}ms...`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}
