import { useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import type { DocumentoGiurisprudenziale } from "@/interfaces/interfaces";
import { useAuth } from "@/context/useAuth";
import { trackEvent } from "@/infrastructure/analytics";
import { withTrace } from "@/infrastructure/perf";
import { fetchWithSecurity } from "@/config/apiClient";
import { extractTextFromFile, getFileType, type DocumentFileType, ocrFileWithTesseract, extractTextFromMedia } from "@/shared/services/extractors";  

/* ===========================
   COSTANTI
=========================== */

const MAX_CHARS = 1_000_000;
const REASON_ENDPOINT = import.meta.env.VITE_REASON_ENDPOINT;

if (!REASON_ENDPOINT) {
  throw new Error("Missing VITE_REASON_ENDPOINT");
}

/* ============================================================
   1) HOOK ESISTENTE: SINGLE-FILE 
============================================================ */

export const usePdfAnalyzer = () => {
  const { user } = useAuth();

  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [extractedText, setExtractedText] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [denyOpen, setDenyOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);

  const validateFile = (files: FileList) => {
    if (!files || files.length === 0) return false;
    if (files.length > 1) {
      toast.error("Puoi caricare un solo documento per volta.");
      return false;
    }
    
    setFileError(null);
    handleFiles(files);
    return true;
  };

  const uploadAndAnalyze = async (selectedFile: File) => {
    setLoading(true);
    setProgress(null);
    setExtractedText(null);
    setAnalysisResult(null);
    setFile(selectedFile);

    if (!user) {
      setLoading(false);
      trackEvent("analytics_error", { name: "uploadAndAnalyze", reason: "unauthenticated" });
      return;
    }

    const docType: DocumentFileType = getFileType(selectedFile);
    const fileSizeKb = Math.round(selectedFile.size / 1024);

    try {
      let finalExtractedText = "";

      // 1. PATH AUDIO/VIDEO
      if (docType === "audio" || docType === "video" || selectedFile.name.match(/\.(mp3|mp4|wav|webm|mkv|mov|m4a)$/i)) {
        setProgress("Estrazione e trascrizione in corso...");
        finalExtractedText = await extractTextFromMedia(selectedFile);
      }
          
      // 2. PATH IMMAGINI
      else if (docType === "image") {
        setProgress("Immagine rilevata: OCR in corso...");
        finalExtractedText = await processWithTesseract(selectedFile, fileSizeKb);
      } 
      
      // 3. PATH DOCUMENTI E ALTRI FORMATI
      else {
        setProgress("Estrazione testo dal documento...");
        const text = await withTrace(
          "doc_extract_text",
          { kind: docType, size_kb: fileSizeKb },
          () => extractTextFromFile(selectedFile)
        );

        if (text.trim().length < 50 && docType === "pdf") {
          setProgress("Documento scannerizzato rilevato: avvio OCR...");
          finalExtractedText = await processWithTesseract(selectedFile, fileSizeKb);
        } else if (text.trim().length < 50) {
           throw new Error("Impossibile estrarre testo sufficiente da questo formato.");
        } else {
          finalExtractedText = text;
        }
      }

      if (finalExtractedText.length > MAX_CHARS) {
        toast.error(
          `Il documento è troppo lungo (${finalExtractedText.length.toLocaleString()} caratteri).\n` +
          `Il limite massimo è ${MAX_CHARS.toLocaleString()} caratteri.`,
          { duration: 6000 }
        );
        trackEvent("document_uploaded", {
          file_type: docType,
          file_size_kb: fileSizeKb,
          source: dragActive ? "dragdrop" : "desktop",
          success: false,
          error_type: "max_chars_exceeded",
        });
        return;
      }

      setExtractedText(finalExtractedText);
      setProgress(null);

      trackEvent("document_uploaded", {
        file_type: docType,
        file_size_kb: fileSizeKb,
        source: dragActive ? "dragdrop" : "desktop",
        success: true,
      });

    } catch (err) {
      console.error("Errore analisi file/OCR:", err);
      toast.error(`Errore nell'analisi del file: ${err instanceof Error ? err.message : "Errore sconosciuto"}`);
      setProgress(null);

      trackEvent("document_uploaded", {
        file_type: docType,
        file_size_kb: fileSizeKb,
        source: dragActive ? "dragdrop" : "desktop",
        success: false,
        error_type: err instanceof Error ? err.message : "unknown_error",
      });
      trackEvent("analytics_error", {
        name: "uploadAndAnalyze",
        reason: err instanceof Error ? err.message : "unknown_error",
      });
    } finally {
      setLoading(false);
    }
  };

  const processWithTesseract = async (selectedFile: File, fileSizeKb: number): Promise<string> => {
    const ocrStart = performance.now();
    const { createWorker, PSM } = await import("tesseract.js");
    const worker = await createWorker("ita");
    
    await worker.setParameters({
      tessedit_pageseg_mode: PSM.AUTO,
      preserve_interword_spaces: "1",
    });

    const ocrText = await withTrace(
      "doc_ocr_file",
      { size_kb: fileSizeKb },
      () => ocrFileWithTesseract(selectedFile, worker, (i, tot) => {
        setProgress(`Elaborazione pagina ${i}/${tot}...`);
      })
    );

    await worker.terminate();
    const ocrMs = Math.round(performance.now() - ocrStart);
    trackEvent("sentenze_ocr", { success: true, processing_time_ms: ocrMs });
    
    return ocrText;
  };

  const analyzeReason = async (promptId: string) => {
    if (!extractedText || !user) return;

    if (extractedText.length > MAX_CHARS) {
      toast.error(
        `Il testo supera il limite massimo di ${MAX_CHARS.toLocaleString()} caratteri.\n` +
          `Riduci il documento o dividilo in parti.`,
        { duration: 6000 }
      );
      return;
    }

    try {
      if (file && file.name) {
        const { checkDuplicateDocument } = await import("@/shared/services/document");
        // ATTENZIONE: checkDuplicateDocument ora deve restituire l'ID (stringa) o null/false
        const existingDocId = await checkDuplicateDocument(user.uid, file.name);
        if (existingDocId) {
          // Salviamo l'id nello stato!
          setDuplicateId(existingDocId);
          setIsDuplicateModalOpen(true);
          return; 
        }
      }
      
      // Se non è un duplicato, passa direttamente all'analisi senza ID
      await executeAnalysis(promptId);
      
    } catch (error) {
      toast.error("Errore durante la verifica del documento.");
      console.error("Errore checkDuplicateDocument:", error);
    }
  };
  
  const executeAnalysis = async (promptId?:string, overwriteId?: string, ) => {
    if (!extractedText || !user) return;
    const { loadMaxima } = await import("@/shared/services/document");
    const { loadSentence } = await import("@/shared/services/storage");

    const startedAt = performance.now();
    
    // TYPE CASTING AGGIORNATO E CORRETTO
    const docType: DocumentFileType = file ? getFileType(file) : "other";

    setLoading(true);
    setProgress("Analisi in corso…");
    setAnalysisResult(null);

    try {
      const { res, payload } = await withTrace(
        "reason_analyze",
        {
          input_len: extractedText.length,
        },
        async () => {
          const requestBody: Record<string, string> = { question: extractedText };
          console.log(promptId);
          if (promptId && promptId!=="default") {
            requestBody.promptId = promptId;
          }

          const res = await fetchWithSecurity(REASON_ENDPOINT, requestBody);
          const contentType = res.headers.get("content-type") || "";

          if (contentType.includes("application/json")) {
            const payload = await res.json().catch(() => null);
            return { res, payload };
          } else {
            const rawText = await res.text().catch(() => null);
            return { res, rawText };
          }
        }
      );

      if (!res.ok) {
        let serverError: unknown = null;
        const contentType = res.headers.get("content-type") || "";
        try {
          if (contentType.includes("application/json")) serverError = await res.json();
          else serverError = { error: await res.text() };
        } catch {
          serverError = null;
        }

        const errorObj =
          typeof serverError === "object" && serverError !== null
            ? (serverError as { error?: string })
            : null;

        if (res.status === 401) {
          toast.error("Sessione scaduta. Effettua di nuovo l’accesso.");
          trackEvent("sentence_processed", {
            input_type: docType,
            success: false,
            processing_time_ms: Math.round(performance.now() - startedAt),
            error_type: "unauthorized_401",
          });
          return;
        }

        if (res.status === 403) {
          // 1. NUOVA GESTIONE: Limite dei 100 documenti
          if (errorObj?.error === "document_limit_reached") {
            toast.error(
              "Hai raggiunto il limite massimo di 100 documenti.\nElimina vecchi documenti o aggiorna il piano per continuare.", 
              {
                duration: 6000,
                style: { whiteSpace: "pre-line", maxWidth: "350px", lineHeight: "1.5" },
              }
            );
            trackEvent("sentence_processed", {
              input_type: docType,
              success: false,
              processing_time_ms: Math.round(performance.now() - startedAt),
              error_type: "document_limit_reached_403",
            });
            return;
          }

          // 2. GESTIONE ESISTENTE: Piano non autorizzato (es. utente free)
          if (errorObj?.error === "Access denied") {
            setDenyOpen(true);
            trackEvent("sentence_processed", {
              input_type: docType,
              success: false,
              processing_time_ms: Math.round(performance.now() - startedAt),
              error_type: "access_denied_403",
            });
          } 
          // 3. GESTIONE ESISTENTE: Altri errori 403 sconosciuti
          else {
            console.log("Access denied error from server:", errorObj?.error);
            setDenyOpen(true);
            trackEvent("sentence_processed", {
              input_type: docType,
              success: false,
              processing_time_ms: Math.round(performance.now() - startedAt),
              error_type: "forbidden_403",
            });
          }
          return;
        } 
        if (res.status === 400) {
          toast.error("Richiesta non valida. Riprova.");
          trackEvent("sentence_processed", {
            input_type: docType,
            success: false,
            processing_time_ms: Math.round(performance.now() - startedAt),
            error_type: "bad_request_400",
          });
          return;
        }

        if (res.status === 413) {
          toast.error("Documento troppo grande. Riduci il file e riprova.");
          trackEvent("sentence_processed", {
            input_type: docType,
            success: false,
            processing_time_ms: Math.round(performance.now() - startedAt),
            error_type: "payload_too_large_413",
          });
          return;
        }

        console.error("reason API error", res.status, serverError);
        toast.error("Analisi fallita.");

        trackEvent("sentence_processed", {
          input_type: docType,
          success: false,
          processing_time_ms: Math.round(performance.now() - startedAt),
          error_type: `http_${res.status}`,
        });

        trackEvent("analytics_error", { name: "reason_api", reason: `HTTP ${res.status}` });
        return;
      }

      // ===== SUCCESS PATH =====
      let messageStr: string;
      let messageObj: { warning?: string } & Record<string, unknown>;

      if (typeof payload.message === "string") {
        messageStr = payload.message;

        let parsed: unknown;
        try {
          parsed = JSON.parse(messageStr);
        } catch {
          toast.error("Errore nell'analisi del file. Si prega di riprovare.");
          trackEvent("sentence_processed", {
            input_type: docType,
            success: false,
            processing_time_ms: Math.round(performance.now() - startedAt),
            error_type: "message_json_parse_failed",
          });
          return;
        }

        if (typeof parsed !== "object" || parsed === null) {
          toast.error("Risposta non valida dal server.");
          trackEvent("sentence_processed", {
            input_type: docType,
            success: false,
            processing_time_ms: Math.round(performance.now() - startedAt),
            error_type: "invalid_message_shape",
          });
          return;
        }

        messageObj = parsed as { warning?: string } & Record<string, unknown>;
      } else if (typeof payload.message === "object" && payload.message !== null) {
        messageObj = payload.message as { warning?: string } & Record<string, unknown>;
        try {
          messageStr = JSON.stringify(messageObj);
        } catch {
          toast.error("Risposta non valida dal server.");
          trackEvent("sentence_processed", {
            input_type: docType,
            success: false,
            processing_time_ms: Math.round(performance.now() - startedAt),
            error_type: "message_json_stringify_failed",
          });
          return;
        }
      } else {
        toast.error("Risposta non valida dal server.");
        trackEvent("sentence_processed", {
          input_type: docType,
          success: false,
          processing_time_ms: Math.round(performance.now() - startedAt),
          error_type: "invalid_response_message",
        });
        return;
      }

      if (messageObj.warning === "input_non_sentenza") {
        toast.error("Il testo caricato non sembra un documento giurisprudenziale.\nControlla il file e riprova.", {
          duration: 5000,
          style: { whiteSpace: "pre-line", maxWidth: "350px", lineHeight: "1.5" },
        });

        trackEvent("sentence_processed", {
          input_type: docType,
          success: false,
          processing_time_ms: Math.round(performance.now() - startedAt),
          error_type: "input_non_sentenza",
        });
        return;
      }

      setAnalysisResult(messageStr);

      let parsedResult: DocumentoGiurisprudenziale;
      try {
        const raw = messageObj as Partial<DocumentoGiurisprudenziale>;
        parsedResult = {
          ...raw,
          nome_file: file?.name || "documento_senza_nome",
        } as DocumentoGiurisprudenziale;
      } catch {
        toast.error("Errore nell'analisi del file. Si prega di riprovare.");
        trackEvent("sentence_processed", {
          input_type: docType,
          success: false,
          processing_time_ms: Math.round(performance.now() - startedAt),
          error_type: "parsed_result_build_failed",
        });
        return;
      }

      const newId = uuidv4();
      if (!file) return;

      const uid = user.uid;
      const documentToSave = {
        ...parsedResult,
        ...(promptId && promptId !== "default" ? { promptId: promptId } : {}),
      };
      
      // 1. SALVATAGGIO DEL NUOVO DOCUMENTO
      await withTrace(
        "doc_save_firestore_storage",
        { input_type: docType },
        async () => {
          await loadMaxima(newId, documentToSave, uid, "documents", extractedText || "");
          await loadSentence(file, newId, `users/${uid}/documents`);
        }
      );

      // 2. SOVRASCRITTURA: ELIMINAZIONE DEL VECCHIO DOCUMENTO (Se richiesto)
      if (overwriteId) {
        try {
          const { deleteDocument } = await import("@/shared/services/document"); 
          // Assicurati che "deleteDocument" accetti l'ID del documento da eliminare.
          await deleteDocument("documents",overwriteId);
          
          setDuplicateId(null); // Puliamo lo stato del duplicato
          toast.success("Documento precedente sovrascritto con successo.");
        } catch (delErr) {
          console.error("Errore durante l'eliminazione del vecchio documento:", delErr);
          toast.error("Il nuovo documento è stato analizzato, ma si è verificato un errore nell'eliminare il duplicato.");
        }
      }

      trackEvent("sentence_processed", {
        input_type: docType,
        success: true,
        processing_time_ms: Math.round(performance.now() - startedAt),
      });

    } catch (err) {
      console.error(err);
      toast.error("Errore nell'analisi del file. Si prega di riprovare.");

      trackEvent("sentence_processed", {
        input_type: docType,
        success: false,
        processing_time_ms: Math.round(performance.now() - startedAt),
        error_type: err instanceof Error ? err.message : "unknown_error",
      });

      trackEvent("analytics_error", {
        name: "analyzeReason",
        reason: err instanceof Error ? err.message : "unknown_error",
      });
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const handleFiles = (files: FileList) => {
    if (files.length) uploadAndAnalyze(files[0]);
  };
  
  const handleDrag = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFiles(e.dataTransfer.files);
  };

  return {
    file,
    dragActive,
    loading,
    progress,
    extractedText,
    analysisResult,
    inputRef,
    uploadAndAnalyze,
    analyzeReason,
    handleFiles,
    handleDrag,
    handleDrop,
    setFile,
    setExtractedText,
    setAnalysisResult,
    fileError,
    setFileError,
    validateFile, 
    validatePdf: validateFile,
    denyOpen,
    isDuplicateModalOpen, 
    setIsDuplicateModalOpen,
    executeAnalysis,
    duplicateId
  };
};
