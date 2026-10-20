const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [2_000, 5_000];

export class VertexAiTemporarilyUnavailableError extends Error {
  constructor() {
    super(
      "AI_TEMPORARILY_UNAVAILABLE: Vertex AI è temporaneamente sovraccarico. Riprova tra poco."
    );
    this.name = "VertexAiTemporarilyUnavailableError";
  }
}

function hasRetryableStatus(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const value = error as Record<string, unknown>;
  const detail =
    value.detail && typeof value.detail === "object"
      ? (value.detail as Record<string, unknown>)
      : {};
  const detailError =
    detail.error && typeof detail.error === "object"
      ? (detail.error as Record<string, unknown>)
      : {};

  const codes = [
    value.status,
    value.code,
    detailError.status,
    detailError.code,
  ];
  if (
    codes.some(
      (code) =>
        code === 429 ||
        code === 500 ||
        code === 502 ||
        code === 503 ||
        code === 504 ||
        code === "RESOURCE_EXHAUSTED" ||
        code === "UNAVAILABLE" ||
        code === "DEADLINE_EXCEEDED" ||
        code === "INTERNAL"
    )
  ) {
    return true;
  }

  const message = [
    value.message,
    value.originalMessage,
    detailError.message,
  ]
    .filter((part): part is string => typeof part === "string")
    .join(" ");
  return /\b(429|500|502|503|504)\b|RESOURCE_EXHAUSTED|UNAVAILABLE|DEADLINE_EXCEEDED/i.test(
    message
  );
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function generateWithVertexRetry<T>(
  generate: () => Promise<T>,
  onRetry: (retryNumber: number, delayMs: number) => Promise<void>
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      return await generate();
    } catch (error) {
      if (!hasRetryableStatus(error)) throw error;
      if (attempt === MAX_ATTEMPTS) {
        throw new VertexAiTemporarilyUnavailableError();
      }

      const delayMs = RETRY_DELAYS_MS[attempt - 1];
      await onRetry(attempt, delayMs);
      await wait(delayMs);
    }
  }

  throw new VertexAiTemporarilyUnavailableError();
}
