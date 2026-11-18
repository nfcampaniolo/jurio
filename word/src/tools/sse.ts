/* global Response, TextDecoder */
/**
 * Lettura degli stream SSE di wordAgent, condivisa da Ricerca, Analisi e Riscrittura.
 *
 * Eventi del server (functions/src/genai/wordAgent/logic.ts):
 *   data: {"message": <chunk del flow>}
 *   data: {"result": <output finale>}
 *   data: {"error": {"message": "..."}}
 *   data: [DONE]
 */

export interface SseHandlers<R> {
  onStatus?: (status: string) => void;
  onResult: (result: R) => void;
}

export const INCOMPLETE_STREAM_MESSAGE = "La risposta del server si è interrotta. Riprova.";

/** Estrae lo stato dai diversi formati usati dai flow ({status}, {message:{status}}). */
function extractStatus(parsed: Record<string, any>): string | undefined {
  return parsed.status || parsed.message?.status || parsed.message?.message?.status || undefined;
}

/** Messaggio leggibile da una risposta HTTP di errore (JSON {details} o status). */
export async function httpErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    if (body?.details && typeof body.details === "string") return body.details;
  } catch {
    // corpo non JSON
  }
  if (response.status === 429) return "Limite di utilizzo raggiunto. Riprova più tardi.";
  if (response.status === 403) return "Il tuo piano non include questa funzione.";
  return `Errore server: ${response.status}`;
}

/**
 * Consuma lo stream; ritorna quando arriva [DONE] o lo stream termina.
 * Lancia un Error con messaggio per l'utente se la risposta è un errore, contiene un evento di errore
 * o si chiude senza risultato.
 */
export async function readSseStream<R>(
  response: Response,
  handlers: SseHandlers<R>
): Promise<void> {
  if (!response.ok) throw new Error(await httpErrorMessage(response));
  if (!response.body) throw new Error("Stream non supportato.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let gotResult = false;
  let streamError: string | null = null;

  const handleEvent = (raw: string): boolean => {
    const line = raw.split("\n").find((l) => l.startsWith("data: "));
    if (!line) return false;
    const data = line.slice("data: ".length).trim();
    if (data === "[DONE]") return true;

    let parsed: Record<string, any>;
    try {
      parsed = JSON.parse(data);
    } catch {
      return false;
    }

    const status = extractStatus(parsed);
    if (status) handlers.onStatus?.(status);

    const errorText = parsed.error?.message || parsed.message?.error?.message;
    if (errorText) streamError = errorText;

    if (parsed.result !== undefined) {
      gotResult = true;
      handlers.onResult(parsed.result as R);
    }
    return false;
  };

  let done = false;
  while (!done) {
    const { value, done: readerDone } = await reader.read();
    if (value) buffer += decoder.decode(value, { stream: true });
    if (readerDone) {
      buffer += decoder.decode();
      done = true;
    }

    const parts = buffer.split("\n\n");
    buffer = done ? "" : (parts.pop() ?? "");
    for (const part of parts) {
      if (handleEvent(part)) {
        done = true;
        break;
      }
    }
  }

  if (streamError) throw new Error(streamError);
  if (!gotResult) throw new Error(INCOMPLETE_STREAM_MESSAGE);
}
