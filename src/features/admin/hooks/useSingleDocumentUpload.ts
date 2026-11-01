import { useState, useRef, useCallback } from "react";
import { toast } from "react-hot-toast";
import { useAuth } from "@/context/useAuth";
import { trackEvent } from "@/infrastructure/analytics";
import { withTrace } from "@/infrastructure/perf";
import { fetchWithSecurity } from "@/config/apiClient";
import { extractTextFromFile } from "@/shared/services/extractors";

/* ===========================
   ERROR PARSING ROBUSTO
=========================== */
type ErrorPayload = {
  error?: unknown;
  message?: unknown;
  details?: unknown;
};

function extractServerMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const p = payload as ErrorPayload;

    if (typeof p.details === "string" && p.details.trim()) {
      return p.details;
    }

    if (typeof p.error === "string" && p.error.trim()) {
      return p.error;
    }

    if (typeof p.message === "string" && p.message.trim()) {
      return p.message;
    }
  }

  return `Errore HTTP ${status}`;
}

/* ===========================
   HOOK
=========================== */
export const useSingleDocumentUpload = () => {
  const { user } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState<string>("");
  const [extractedText, setExtractedText] = useState<string>("");

  const [dragActive, setDragActive] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);

  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (selectedFile: File) => {
    if (selectedFile.type !== "application/pdf") {
      toast.error("Formato non valido. Carica solo file .pdf");
      return;
    }

    setFile(selectedFile);
    setExtractedText("");
    setIsExtracting(true);

    const toastId = toast.loading("Lettura del documento in corso...");

    try {
      const text = await extractTextFromFile(selectedFile);

      if (text && text.trim().length > 10) {
        setExtractedText(text);
        toast.success("Testo estratto con successo!", { id: toastId });
      } else {
        throw new Error("Testo non rilevato o troppo corto");
      }
    } catch (err) {
      console.error("Errore estrazione PDF:", err);

      toast.error("Nessun testo rilevato. Puoi incollarlo manualmente.", {
        id: toastId,
        duration: 4000,
      });
    } finally {
      setIsExtracting(false);
    }
  }, []);

  const removeFile = useCallback(() => {
    setFile(null);
    setExtractedText("");

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }, []);

  const resetForm = useCallback(() => {
    removeFile();
    setUrl("");
    setExtractedText("");
    setDragActive(false);
  }, [removeFile]);

  const validateAndSubmit = async () => {
    if (!user) {
      toast.error("Devi essere autenticato.");
      return;
    }

    if (!file) {
      toast.error("Devi caricare un documento PDF.");
      return;
    }

    if (!url.trim()) {
      toast.error("L'URL della fonte è obbligatorio.");
      return;
    }

    if (!extractedText.trim()) {
      toast.error("Il testo estratto è obbligatorio.");
      return;
    }

    // Legge l'endpoint al momento dell'invio, non durante l'import del modulo.
    const endpoint = import.meta.env.VITE_DOCTRINE_ADMIN_ENDPOINT;

    if (!endpoint) {
      toast.error("Configurazione endpoint mancante.");
      return;
    }

    setLoading(true);
    const startedAt = performance.now();

    try {
      const payloadRequest = {
        sourceUrl: url,
        extractedText,
      };

      const { res, payload } = await withTrace(
        "doctrine_admin_upload",
        { input_len: extractedText.length },
        async () => {
          let attempt = 0;
          const maxAttempts = 3;

          while (attempt < maxAttempts) {
            try {
              const res = await fetchWithSecurity(endpoint, payloadRequest);

              // Legge il JSON anche quando la risposta HTTP non è positiva.
              const payload = await res.json().catch(() => null);

              // Ritenta esclusivamente in caso di gateway error 503 o 504.
              if (res.status !== 503 && res.status !== 504) {
                return { res, payload };
              }

              throw new Error(`Gateway Error ${res.status}`);
            } catch (err) {
              attempt++;

              if (attempt >= maxAttempts) {
                throw err;
              }

              const tId = toast.loading(
                `Rete instabile. Tentativo ${attempt + 1} di ${maxAttempts}...`,
              );

              try {
                await new Promise((resolve) =>
                  setTimeout(resolve, attempt * 2000),
                );
              } finally {
                toast.dismiss(tId);
              }
            }
          }

          throw new Error(
            "Impossibile contattare il server dopo ripetuti tentativi.",
          );
        },
      );

      if (!res.ok) {
        const serverMsg = extractServerMessage(payload, res.status);
        throw new Error(serverMsg);
      }

      void trackEvent("doctrine_processed", {
        success: true,
        processing_time_ms: Math.round(performance.now() - startedAt),
      });

      toast.success("Documento indicizzato con successo!");
      resetForm();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      toast.error(`Errore analisi: ${msg}`, { duration: 6000 });

      void trackEvent("doctrine_processed", {
        success: false,
        processing_time_ms: Math.round(performance.now() - startedAt),
        error_type: msg,
      });

      void trackEvent("analytics_error", {
        name: "admin_doctrine_upload",
        reason: msg,
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    file,
    url,
    setUrl,
    extractedText,
    setExtractedText,
    dragActive,
    setDragActive,
    loading,
    isExtracting,
    inputRef,
    handleFileSelect,
    removeFile,
    resetForm,
    validateAndSubmit,
  };
};