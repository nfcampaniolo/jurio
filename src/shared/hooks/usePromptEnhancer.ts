import { useState } from "react";
import { fetchWithSecurity } from "@/config/apiClient";
import { toast } from "react-hot-toast";

export interface HistoryMessage {
  role: 'user' | 'model' | 'system' | 'assistant';
  content: string;
}

export const usePromptEnhancer = () => {
  const [isEnhancing, setIsEnhancing] = useState(false);

  const enhancePrompt = async (prompt: string, type: "chat" | "approfondimento", history?: HistoryMessage[]) => {
    setIsEnhancing(true);

    try {
      const payload = { prompt, type, history: history || [] };
      
      // Adegua con il nome della tua variabile d'ambiente
      const ENHANCE_URL = import.meta.env.VITE_PROMPT_ENHANCER_URL;
      
      if (!ENHANCE_URL) {
        throw new Error("Endpoint non configurato");
      }

      const r = await fetchWithSecurity(ENHANCE_URL, payload);
      const text = await r.text();

      if (!r.ok) {
        let errData: { error?: string } = {};

        try {
          const parsed = JSON.parse(text) as unknown;
          if (typeof parsed === "object" && parsed !== null) {
            errData = parsed as { error?: string };
          }
        } catch (err: unknown) {
          console.warn("Impossibile parsare l'errore API come JSON", err);
        }

        if (r.status === 403) {
          toast.error("Accesso negato.");
          return null;
        }

        if (r.status === 429) {
          toast.error("Limite di richieste superato. Riprova più tardi.");
          return null;
        }

        throw new Error(`Invio fallito (${r.status}): ${errData.error || text}`);
      }

      let successData: { enhancedPrompt?: string } = {};
      try {
        const parsed = JSON.parse(text) as unknown;
        if (typeof parsed === "object" && parsed !== null) {
          successData = parsed as { enhancedPrompt?: string };
        }
      } catch (err: unknown) {
        console.warn("Impossibile parsare la risposta API come JSON", err);
      }

      if (successData.enhancedPrompt) {
        return successData.enhancedPrompt;
      } else {
        throw new Error("La risposta non contiene il prompt ottimizzato.");
      }

    } catch (error: unknown) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "Si è verificato un errore di rete.";
      toast.error(`Si è verificato un errore: ${msg}`);
      return null;
    } finally {
      setIsEnhancing(false);
    }
  };

  return { enhancePrompt, isEnhancing };
};