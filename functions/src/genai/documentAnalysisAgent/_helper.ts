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
  if (!error || typeof error !== "object") {
    return false;
  }

  const e = error as any;
  return (
    e.code === 429 ||
    e.status === "RESOURCE_EXHAUSTED" ||
    e.status === 429 ||
    e.detail?.error?.code === 429
  );
}

export async function generateWithRetry(
  request: Parameters<typeof ai.generate>[0],
  maxRetries = 3
) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await ai.generate(request);
    } catch (error) {
      lastError = error;

      if (!isResourceExhaustedError(error)) {
        throw error;
      }

      if (attempt === maxRetries) {
        break;
      }

      const baseDelay = 2000 * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * 1000);
      const delay = baseDelay + jitter;

      console.warn(
        `[doctrineFlow] 429 RESOURCE_EXHAUSTED. Retry ${attempt + 1}/${maxRetries} tra ${delay}ms...`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}