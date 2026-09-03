import { useMemo, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import type { DocumentoGiurisprudenziale } from "@/interfaces/interfaces";
import { useAuth } from "@/context/useAuth";
import { trackEvent } from "@/infrastructure/analytics";
import { withTrace } from "@/infrastructure/perf";
import { fetchWithSecurity } from "@/config/apiClient";
import { extractTextFromFile, getFileType, ocrFileWithTesseract, SUPPORTED_FORMATS_MSG } from "@/shared/services/extractors";  

type TipoDocumento =
  | "sentenza"
  | "ordinanza"
  | "decreto"
  | "documento_giurisprudenza_generico";

const MAX_FILES = 100;
const MAX_CHARS = 1_000_000;
const REASON_ADMIN_ENDPOINT = import.meta.env.VITE_REASON_ADMIN_ENDPOINT;

if (!REASON_ADMIN_ENDPOINT) {
throw new Error("Missing VITE_REASON_ADMIN_ENDPOINT");
}

/* ===========================
   ERROR PARSING (condiviso)
=========================== */

type ErrorPayload = { error?: unknown; message?: unknown };

function extractServerMessage(payload: unknown, status: number): string {
  if (payload && typeof payload === "object") {
    const p = payload as ErrorPayload;
    if (typeof p.error === "string") return p.error;
    if (typeof p.message === "string") return p.message;
  }
  return `HTTP ${status}`;
}

/* ============================================================
   2) HOOK NUOVO: ADMIN BATCH (fino a 100, sequenziale)
============================================================ */
type BatchStatus = "queued" | "extracting" | "ocr" | "analyzing" | "saving" | "done" | "error" | "skipped";
type SkipReason = "max_chars_exceeded" | "input_non_sentenza" | "no_text_extracted" | "user_cancelled" | "oscuramento_in_corso";

type BatchItem = {
  id: string;
  file: File;
  status: BatchStatus;
  progress?: string;
  error?: string;
  skipReason?: SkipReason;
  extractedText?: string;
  result?: DocumentoGiurisprudenziale;
  tipo_documento?: TipoDocumento;
  fileUrl?: string;
};

function normalizeTipoDocumento(v: unknown): TipoDocumento {
  if (
    v === "sentenza" ||
    v === "ordinanza" ||
    v === "decreto" ||
    v === "documento_giurisprudenza_generico"
  ) return v;

  return "documento_giurisprudenza_generico";
}

export const usePdfAnalyzerAdminBatch = () => {
  const { user } = useAuth();

  const [items, setItems] = useState<BatchItem[]>([]);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const cancelRef = useRef(false);

  const totals = useMemo(() => {
    const total = items.length;
    const done = items.filter(i => i.status === "done").length;
    const error = items.filter(i => i.status === "error").length;
    const skipped = items.filter(i => i.status === "skipped").length;
    return { total, done, error, skipped };
  }, [items]);

  const updateItem = (id: string, patch: Partial<BatchItem>) => {
    setItems(prev => prev.map(it => (it.id === id ? { ...it, ...patch } : it)));
  };

  const reset = () => {
    setItems(prev => {
      prev.forEach(it => {
        if (it.fileUrl) URL.revokeObjectURL(it.fileUrl);
      });
      return [];
    });
    cancelRef.current = false;
    setCurrentIndex(-1);
    setLoading(false);
    setProgress(null);
    setDragActive(false);
  };

  const cancel = () => {
    cancelRef.current = true;
    setProgress("Interruzione richiesta…");
  };

  const removeItem = (id: string) => {
    setItems(prev => {
      const it = prev.find(x => x.id === id);
      if (it?.fileUrl) URL.revokeObjectURL(it.fileUrl);
      return prev.filter(x => x.id !== id);
    });
  };

  const clearFailedAndSkipped = () => {
    setItems(prev => {
      prev.forEach(it => {
        if ((it.status === "error" || it.status === "skipped") && it.fileUrl) {
          URL.revokeObjectURL(it.fileUrl);
        }
      });
      return prev.filter(it => !(it.status === "error" || it.status === "skipped"));
    });
  };

  const validateAndQueue = (files: FileList) => {
    if (!files || files.length === 0) return false;

    if (files.length > MAX_FILES) {
      toast.error(`Puoi caricare massimo ${MAX_FILES} documenti per volta.`);
      return false;
    }

    const arr = Array.from(files);

    const unsupported = arr.find(f => getFileType(f) === "unsupported");
    if (unsupported) {
      toast.error(SUPPORTED_FORMATS_MSG);
      return false;
    }

    const newItems: BatchItem[] = arr.map(file => ({
      id: uuidv4(),
      file,
      status: "queued",
      fileUrl: URL.createObjectURL(file),
    }));

    setItems(newItems);
    setCurrentIndex(-1);
    setProgress(null);
    cancelRef.current = false;
    return true;
  };

  const getFileUrlFor = (id: string) => items.find(it => it.id === id)?.fileUrl || null;

  type NormalizedReason = {
    messageStr: string;
    messageObj: { warning?: string } & Record<string, unknown>;
  };

  function normalizeReasonMessage(payload: unknown): NormalizedReason {
    const msg = (payload as { message?: unknown })?.message;

    if (typeof msg === "string") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(msg);
      } catch {
        throw new Error("message_json_parse_failed");
      }
      if (typeof parsed !== "object" || parsed === null) throw new Error("invalid_message_shape");
      return { messageStr: msg, messageObj: parsed as { warning?: string } & Record<string, unknown> };
    }

    if (typeof msg === "object" && msg !== null) {
      let s: string;
      try {
        s = JSON.stringify(msg);
      } catch {
        throw new Error("message_json_stringify_failed");
      }
      return { messageStr: s, messageObj: msg as { warning?: string } & Record<string, unknown> };
    }

    throw new Error("invalid_response_message");
  }

  const startBatch = async () => {
    if (!user) {
      toast.error("Devi essere autenticato.");
      return;
    }
    if (items.length === 0) {
      toast.error("Nessun documento in coda.");
      return;
    }
    if (loading) return;

    cancelRef.current = false;
    setLoading(true);
    setProgress("Avvio batch…");

    const { loadMaxima } = await import("@/shared/services/document");
    const { loadSentence } = await import("@/shared/services/storage");

    const { createWorker, PSM } = await import("tesseract.js");
    const worker = await createWorker("ita");
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: "1",
    });

    let doneCount = 0;
    let errorCount = 0;
    let skippedCount = 0;

    try {
      for (let idx = 0; idx < items.length; idx++) {
        if (cancelRef.current) {
          setItems(prev =>
            prev.map((it, i) =>
              i >= idx && it.status === "queued"
                ? {
                    ...it,
                    status: "skipped",
                    skipReason: "user_cancelled",
                    error: "Interrotto dall’utente.",
                  }
                : it
            )
          );
          toast("Batch interrotto.");
          break;
        }

        setCurrentIndex(idx);
        const it = items[idx];
        const startedAt = performance.now();
        const docType = getFileType(it.file);

        try {
          // 1) Estrazione
          updateItem(it.id, { status: "extracting", progress: "Estrazione testo…" });
          setProgress(`Estrazione: ${it.file.name}`);

          const text = await withTrace(
            "doc_extract_text",
            { kind: it.file.type || "unknown", size_kb: Math.round(it.file.size / 1024) },
            () => extractTextFromFile(it.file)
          );
          
          let finalText = text;

          // 1b) OCR se serve
          if (text.trim().length <= 50) {
            updateItem(it.id, { status: "ocr", progress: "OCR in corso…" });
            setProgress(`OCR: ${it.file.name}`);

            finalText = await ocrFileWithTesseract(it.file, worker, (p, tot) => {
              updateItem(it.id, { progress: `OCR in corso… pagina ${p}/${tot}` });
            });

            trackEvent("sentenze_ocr", {
              success: true,
              processing_time_ms: Math.round(performance.now() - startedAt),
            });
          }

          // --- INIZIO CONTROLLO OSCURAMENTO ---
          const normalizedText = finalText.replace(/\s+/g, ' ').toLowerCase();

          if (
            normalizedText.includes("la sentenza richiesta è in fase di valutazione per oscuramento") ||
            normalizedText.includes("la sentenza richiesta è in fase di oscuramento")
          ) {
            skippedCount++;
            updateItem(it.id, {
              status: "skipped",
              skipReason: "oscuramento_in_corso",
              error: "La sentenza è in fase di valutazione per oscuramento.",
            });
            continue; 
          }
          
          // 1c) Scarti “tecnici”
          if (finalText.trim().length < 50) {
            skippedCount++;
            updateItem(it.id, {
              status: "skipped",
              skipReason: "no_text_extracted",
              error: "Testo non estratto (Documento vuoto o OCR insufficiente).",
            });
            continue;
          }

          if (finalText.length > MAX_CHARS) {
            skippedCount++;
            updateItem(it.id, {
              status: "skipped",
              skipReason: "max_chars_exceeded",
              error: `Documento troppo lungo (${finalText.length.toLocaleString()} caratteri).`,
            });
            continue;
          }

          updateItem(it.id, { extractedText: finalText });

          // 2) Analisi
          updateItem(it.id, { status: "analyzing", progress: "Analisi della sentenza…" });
          setProgress(`Analisi: ${it.file.name}`);

          const { res, payload } = await withTrace(
            "reason_analyze",
            {
              input_len: finalText.length,
            },
            async () => {
              let attempt = 0;
              const maxAttempts = 3;

              while (attempt < maxAttempts) {
                try {
                  const res = await fetchWithSecurity(REASON_ADMIN_ENDPOINT, { question: finalText });
                  
                  // Se riceviamo 429 (Too Many Requests) o errori server (5xx), forziamo il retry
                  if (!res.ok && (res.status === 429 || res.status >= 500)) {
                     throw new Error(`HTTP_TEMP_ERROR_${res.status}`);
                  }

                  const payload = await res.json().catch(() => null);
                  return { res, payload };
                } catch (err) {
                  attempt++;
                  if (attempt >= maxAttempts) throw err;
                  
                  updateItem(it.id, { 
                    progress: `Rete instabile. Tentativo ${attempt + 1} di ${maxAttempts}...` 
                  });
                  // Attesa progressiva: 2s, poi 4s prima di riprovare
                  await new Promise(resolve => setTimeout(resolve, attempt * 2000));
                }
              }
              throw new Error("Failed to fetch dopo ripetuti tentativi");
            }
          );

          if (!res.ok) {
            const serverMsg = extractServerMessage(payload, res.status);
            throw new Error(`ANALYSIS_FAILED: ${serverMsg}`);
          }

          const { messageObj } = normalizeReasonMessage(payload);

          // 2b) Scarto “semantico”: non sentenza
          if (messageObj.warning === "input_non_sentenza") {
            skippedCount++;
            updateItem(it.id, {
              status: "skipped",
              skipReason: "input_non_sentenza",
              error: "Il testo non sembra un documento giurisprudenziale.",
            });
            trackEvent("sentence_processed", {
              input_type: docType,
              success: false,
              processing_time_ms: Math.round(performance.now() - startedAt),
              error_type: "input_non_sentenza",
            });
            continue;
          }

          let parsedResult: DocumentoGiurisprudenziale;

          try {
            const raw = messageObj as Partial<DocumentoGiurisprudenziale>;
            const tipo = normalizeTipoDocumento(raw.tipo_documento);

            parsedResult = {
              ...raw,
              tipo_documento: tipo,
            } as DocumentoGiurisprudenziale;
          } catch {
            throw new Error("parsed_result_build_failed");
          }

          // 3) Salvataggio
          updateItem(it.id, { status: "saving", progress: "Salvataggio su database/storage…" });
          setProgress(`Salvataggio: ${it.file.name}`);

          const newId = uuidv4();
          const uid = user.uid;

          await loadMaxima(newId, parsedResult, uid, "sentences", finalText);
          await loadSentence(it.file, newId, "sentences");

          doneCount++;
          updateItem(it.id, { status: "done", progress: "Completato.", result: parsedResult });

          trackEvent("sentence_processed", {
            input_type: docType,
            success: true,
            processing_time_ms: Math.round(performance.now() - startedAt),
          });
        } catch (err) {
          errorCount++;
          const msg = err instanceof Error ? err.message : String(err);

          updateItem(it.id, {
            status: "error",
            error: msg.startsWith("ANALYSIS_FAILED:")
              ? `Analisi fallita: ${msg.replace("ANALYSIS_FAILED:", "").trim()}`
              : msg,
            progress: undefined,
          });

          trackEvent("sentence_processed", {
            input_type: docType,
            success: false,
            processing_time_ms: Math.round(performance.now() - startedAt),
            error_type: msg,
          });

          trackEvent("analytics_error", { name: "admin_batch_item", reason: msg });

          continue;
        }
      }
    } finally {
      await worker.terminate();

      setLoading(false);
      setProgress(null);
      setCurrentIndex(-1);
      toast.success(`Batch completato. OK: ${doneCount} • Errori: ${errorCount} • Scarti: ${skippedCount}`);
    }
  };

  const handleDrag = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length) validateAndQueue(e.dataTransfer.files);
  };

  return {
    items,
    dragActive,
    loading,
    progress,
    currentIndex,
    totals,
    inputRef,
    validateAndQueue,
    startBatch,
    cancel,
    reset,
    removeItem,
    clearFailedAndSkipped,
    getFileUrlFor,
    handleDrag,
    handleDrop,
  };
};