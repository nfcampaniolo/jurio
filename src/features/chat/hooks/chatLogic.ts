// chatLogic.ts
import { fetchWithAppCheckOnly } from '@/config/apiClient'; // Aggiusta il percorso
import { getSupportUrl } from "@/config/env";

const SUPPORT_ENDPOINT = getSupportUrl();
 
export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  readonly role: ChatRole;
  readonly content: string;
  readonly sources?: readonly SourceItem[];
}
export interface SourceItem {
  readonly id: string;
  readonly text: string;
  readonly links: readonly string[];
  readonly images?: string;
  readonly _type: string;
}
interface StreamMessagePayload {
  readonly text?: string;
  readonly status?: string;
}

interface StreamResultPayload {
  readonly risposta: string;
  readonly fonti: readonly SourceItem[];
}

interface StreamDataChunk {
  readonly message?: StreamMessagePayload;
  readonly result?: StreamResultPayload;
  readonly error?: string;
}

const CACHE_KEY = "jurio_support_chat_cache";
const MAX_HISTORY_LENGTH = 10; // Allineato con il limite del backend

export const chatCache = {
  /** Recupera la cronologia dalla cache */
  get: (): ChatMessage[] => {
    if (typeof window === "undefined") return [];
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch (e) {
      console.error("Errore lettura cache chat:", e);
      return [];
    }
  },

  /** Salva la cronologia in cache (mantenendo solo gli ultimi N messaggi) */
  set: (messages: ChatMessage[]) => {
    if (typeof window === "undefined") return;
    // Teniamo solo gli ultimi messaggi per non far esplodere il payload
    const trimmedMessages = messages.slice(-MAX_HISTORY_LENGTH);
    localStorage.setItem(CACHE_KEY, JSON.stringify(trimmedMessages));
  },

  /** Pulisce la cache e resetta la chat */
  clear: () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(CACHE_KEY);
    }
  }
};

/**
 * Invia la cronologia all'endpoint Cloud Function.
 */

export const sendSupportMessage = async (
  messages: readonly ChatMessage[], 
  onStatus?: (statusText: string) => void,
  onText?: (text: string) => void
): Promise<{ botReply: string; fonti: readonly SourceItem[] }> => {
  if (!SUPPORT_ENDPOINT) {
    throw new Error("Servizio non disponibile");
  }
  
  const response = await fetchWithAppCheckOnly(SUPPORT_ENDPOINT, { messages });
  if (!response.ok) {
    if (response.status === 401) {
      throw new Error("Verifica di sicurezza non riuscita. Ricarica la pagina e riprova.");
    }
    if (response.status === 429) {
      throw new Error("Hai inviato troppe richieste. Attendi qualche minuto e riprova.");
    }
    if (response.status >= 500) {
      throw new Error("Il servizio di supporto è temporaneamente non disponibile. Riprova tra poco.");
    }
    throw new Error(`Richiesta non riuscita (HTTP ${response.status}).`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullContent = "";
  let extractedFonti: readonly SourceItem[] = [];
  let lineBuffer = "";
  let eventData: string[] = [];
  let streamCompleted = false;

  if (!reader) {
    throw new Error("Impossibile leggere lo stream.");
  }

  const dispatchEvent = (): void => {
    if (eventData.length === 0) return;

    const data = eventData.join("\n");
    eventData = [];
    if (data === "[DONE]") {
      streamCompleted = true;
      return;
    }

    let parsed: StreamDataChunk;
    try {
      parsed = JSON.parse(data) as StreamDataChunk;
    } catch (parseError: unknown) {
      console.warn(
        "Errore parsing chunk JSON:",
        parseError instanceof Error ? parseError.message : "JSON non valido"
      );
      return;
    }

    if (parsed.error) {
      throw new Error(parsed.error);
    }
    if (parsed.message?.text) {
      fullContent += parsed.message.text;
      onText?.(fullContent);
    } else if (parsed.message?.status) {
      onStatus?.(parsed.message.status);
    } else if (parsed.result) {
      fullContent = parsed.result.risposta;
      if (fullContent) {
        onText?.(fullContent);
      }
      extractedFonti = parsed.result.fonti ?? [];
    }
  };

  const processLine = (line: string): void => {
    if (line === "") {
      dispatchEvent();
    } else if (line.startsWith("data:")) {
      eventData.push(line.slice(5).replace(/^ /, ""));
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    lineBuffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    let newlineIndex = lineBuffer.indexOf("\n");
    while (newlineIndex !== -1) {
      processLine(lineBuffer.slice(0, newlineIndex).replace(/\r$/, ""));
      lineBuffer = lineBuffer.slice(newlineIndex + 1);
      newlineIndex = lineBuffer.indexOf("\n");
    }
    if (done) break;
  }

  if (lineBuffer) processLine(lineBuffer.replace(/\r$/, ""));
  dispatchEvent();
  if (!streamCompleted) {
    throw new Error("La connessione al servizio si è interrotta prima del completamento. Riprova.");
  }
  if (!fullContent.trim()) {
    throw new Error("Il servizio non ha restituito una risposta. Riprova.");
  }

  return {
    botReply: fullContent,
    fonti: extractedFonti
  };
};