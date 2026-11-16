export interface McpFetchOptions {
  /** Tempo massimo complessivo (ms), condiviso fra tutti i tentativi. */
  timeoutMs?: number;
  /** Numero massimo di tentativi (1 = nessun retry). Si ritenta solo su errori immediati, mai dopo un timeout. */
  attempts?: number;
  /** Attesa prima del retry (ms). */
  retryDelayMs?: number;
}

// Firebase Hosting interrompe le rewrite verso Cloud Run dopo ~60s e risponde al client con un 502.
// Budget: avvio a freddo del server MCP (10-14s misurati a nov. 2026) + 40s di attesa del backend ≈ 54s.
// La ricerca vettoriale impiega 13-16s a caldo e fino a ~55s a freddo (findNearest flat su ~412k documenti):
// per questo il budget è unico e non si ritenta dopo un timeout. Una richiesta abortita continua a girare
// nel backend, raddoppiando il carico e consumando due volte il rate limit dell'utente.
const DEFAULT_OPTIONS: Required<McpFetchOptions> = {
  timeoutMs: 40_000,
  attempts: 2,
  retryDelayMs: 750,
};

// Sotto questa soglia di tempo residuo un nuovo tentativo non ha possibilità di completarsi.
const MIN_RETRY_BUDGET_MS = 5_000;

// Errori tipici di cold start / gateway del backend: sono transitori e vale la pena ritentare.
const RETRYABLE_STATUS = new Set([502, 503, 504]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

function endpointName(url: string): string {
  try {
    return new URL(url).hostname.split("-")[0];
  } catch {
    return "unknown";
  }
}

// I risultati con errore dei tool non generano eccezioni: senza questo log non comparirebbero in Cloud Logging.
function logFailure(url: string, startedAt: number, attempt: number, reason: string, status?: number): void {
  console.warn("MCP_BACKEND_CALL_FAILED", {
    endpoint: endpointName(url),
    reason,
    status,
    attempt,
    durationMs: Date.now() - startedAt,
  });
}

export async function mcpFetch<T>(
  url: string,
  authHeader: string,
  body: object,
  options: McpFetchOptions = {}
): Promise<{ data?: T; errorText?: string; isError?: boolean }> {
  const { timeoutMs, attempts, retryDelayMs } = { ...DEFAULT_OPTIONS, ...options };
  const startedAt = Date.now();
  const deadline = startedAt + timeoutMs;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const canRetry = () =>
      attempt < attempts && deadline - Date.now() - retryDelayMs >= Math.min(MIN_RETRY_BUDGET_MS, timeoutMs);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(Math.max(1, deadline - Date.now())),
      });

      if (RETRYABLE_STATUS.has(response.status) && canRetry()) {
        logFailure(url, startedAt, attempt, "gateway_retry", response.status);
        await sleep(retryDelayMs);
        continue;
      }

      if (response.status === 401) {
        logFailure(url, startedAt, attempt, "unauthorized", 401);
        return {
          errorText: "Sessione Jurio non valida o scaduta. Ricollega il tuo account Jurio dalle impostazioni del client MCP.",
          isError: true,
        };
      }
      if (response.status === 403) {
        return {
          errorText: "Accesso non consentito: nessun piano attivo rilevato. Attiva o rinnova il tuo piano su: https://jurio.it/prezzi",
          isError: false,
        };
      }
      if (response.status === 404) {
        logFailure(url, startedAt, attempt, "not_found", 404);
        return {
          errorText: "Errore: Risorsa o documento non trovato nello storage.",
          isError: true,
        };
      }
      if (response.status === 429) {
        logFailure(url, startedAt, attempt, "rate_limited", 429);
        return {
          errorText: "Hai raggiunto il limite di richieste disponibili per il tuo piano. Riprova più tardi.",
          isError: false,
        };
      }

      const data = await response.json().catch(async () => ({ error: await response.text() }));

      if (!response.ok) {
        logFailure(url, startedAt, attempt, "backend_error", response.status);
        if (RETRYABLE_STATUS.has(response.status)) {
          return {
            errorText: `Il servizio Jurio è temporaneamente non disponibile (${response.status}). Riprova tra qualche secondo.`,
            isError: true,
          };
        }
        return {
          errorText: `Errore dal backend Jurio (${response.status}): ${data.error ?? response.statusText}`,
          isError: true,
        };
      }

      return { data: data as T };
    } catch (error) {
      if (isTimeoutError(error)) {
        // Niente retry: il backend sta ancora elaborando la richiesta, ritentare duplicherebbe il lavoro.
        logFailure(url, startedAt, attempt, "timeout");
        return {
          errorText: "Il servizio Jurio non ha risposto in tempo (probabile avvio a freddo). Riprova tra qualche secondo.",
          isError: true,
        };
      }
      if (canRetry()) {
        logFailure(url, startedAt, attempt, "network_retry");
        await sleep(retryDelayMs);
        continue;
      }
      logFailure(url, startedAt, attempt, "network_error");
      return {
        errorText: `Errore di rete o timeout: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }

  // Irraggiungibile: l'ultimo tentativo restituisce sempre un risultato.
  return { errorText: "Errore sconosciuto.", isError: true };
}
