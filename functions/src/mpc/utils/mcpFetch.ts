export interface McpFetchOptions {
  /** Timeout per singolo tentativo (ms). */
  timeoutMs?: number;
  /** Numero totale di tentativi (1 = nessun retry). */
  attempts?: number;
  /** Attesa prima del retry (ms). */
  retryDelayMs?: number;
}

// Firebase Hosting interrompe le rewrite verso Cloud Run dopo ~60s e risponde al client
// con un 502/504. Budget: avvio a freddo del server MCP (10-14s misurati a nov. 2026)
// + 2 tentativi da 20s + attesa ≈ 55s, sotto il limite.
const DEFAULT_OPTIONS: Required<McpFetchOptions> = {
  timeoutMs: 20_000,
  attempts: 2,
  retryDelayMs: 750,
};

// Errori tipici di cold start / gateway del backend: sono transitori e vale la pena ritentare.
const RETRYABLE_STATUS = new Set([502, 503, 504]);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isTimeoutError(error: unknown): boolean {
  return error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError");
}

export async function mcpFetch<T>(
  url: string,
  authHeader: string,
  body: object,
  options: McpFetchOptions = {}
): Promise<{ data?: T; errorText?: string; isError?: boolean }> {
  const { timeoutMs, attempts, retryDelayMs } = { ...DEFAULT_OPTIONS, ...options };

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const isLastAttempt = attempt === attempts;
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (RETRYABLE_STATUS.has(response.status) && !isLastAttempt) {
        await sleep(retryDelayMs);
        continue;
      }

      if (response.status === 401) {
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
        return {
          errorText: "Errore: Risorsa o documento non trovato nello storage.",
          isError: true,
        };
      }
      if (response.status === 429) {
        return {
          errorText: "Hai raggiunto il limite di richieste disponibili per il tuo piano. Riprova più tardi.",
          isError: false,
        };
      }

      const data = await response.json().catch(async () => ({ error: await response.text() }));

      if (!response.ok) {
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
      if (!isLastAttempt) {
        await sleep(retryDelayMs);
        continue;
      }
      if (isTimeoutError(error)) {
        return {
          errorText: "Il servizio Jurio non ha risposto in tempo (probabile avvio a freddo). Riprova tra qualche secondo.",
          isError: true,
        };
      }
      return {
        errorText: `Errore di rete o timeout: ${error instanceof Error ? error.message : String(error)}`,
        isError: true,
      };
    }
  }

  // Irraggiungibile: l'ultimo tentativo restituisce sempre un risultato.
  return { errorText: "Errore sconosciuto.", isError: true };
}
