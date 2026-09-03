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
  onStatus?: (statusText: string) => void
): Promise<{ botReply: string; fonti: readonly SourceItem[] }> => {
  if (!SUPPORT_ENDPOINT) {
    throw new Error("Servizio non disponibile");
  }
  
  const response = await fetchWithAppCheckOnly(SUPPORT_ENDPOINT, { messages });
  if (!response.ok) {
    throw new Error(`Errore server: ${response.status}`);
  }

  const reader = response.body?.getReader();
  const decoder = new TextDecoder();
  let fullContent = "";
  let extractedFonti: readonly SourceItem[] = [];

  if (!reader) {
    throw new Error("Impossibile leggere lo stream.");
  }

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunkStr = decoder.decode(value, { stream: true });
    const lines = chunkStr.split("\n");

    for (const line of lines) {
      const cleanedLine = line.trim();
      if (!cleanedLine || cleanedLine === "data: [DONE]") continue;

      if (cleanedLine.startsWith("data: ")) {
        try {
          const jsonString = cleanedLine.replace("data: ", "").trim();
          const parsed = JSON.parse(jsonString) as StreamDataChunk;
          
          // 1. Gestione dei messaggi di testo in streaming
          if (parsed.message?.text) {
            const text = parsed.message.text;
            fullContent += text;
          } 
          // 2. Gestione degli stati di avanzamento (es. "Consultazione del manuale Jurio...")
          else if (parsed.message?.status) {
            if (onStatus) {
              onStatus(parsed.message.status);
            }
          }
          // 3. Gestione del risultato finale inviato dal backend (contiene risposta e fonti)
          else if (parsed.result?.risposta) {
            const finalText = parsed.result.risposta;
            if (!fullContent) {
              fullContent = finalText;
            }
            if (parsed.result.fonti) {
              extractedFonti = parsed.result.fonti;
            }
          }
          // 4. Gestione di eventuali errori restituiti dallo stream
          else if (parsed.error) {
            throw new Error(parsed.error);
          }
        } catch (e: unknown) {
          if (e instanceof Error) {
            console.warn("Errore parsing chunk JSON:", e.message);
          } else {
            console.warn("Errore parsing chunk JSON sconosciuto");
          }
        }
      }
    }
  }

  return {
    botReply: fullContent,
    fonti: extractedFonti
  };
};