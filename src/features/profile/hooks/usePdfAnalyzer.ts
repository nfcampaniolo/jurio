import { useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import type { DocumentoGiurisprudenziale } from "@/interfaces/interfaces";
import { useAuth } from "@/context/useAuth";
import { trackEvent } from "@/infrastructure/analytics";
import { withTrace } from "@/infrastructure/perf";
import { fetchWithSecurity } from "@/config/apiClient";
import { extractTextFromFile, getFileType, type DocumentFileType, ocrFileWithTesseract, extractTextFromMedia } from "@/shared/services/extractors";  
import { checkDuplicateDocument, deleteDocument, loadMaxima } from "@/shared/services/document";
import { loadSentence } from "@/shared/services/storage";

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
  const [sourceFiles, setSourceFiles] = useState<File[]>([]);
  const [sourceTexts, setSourceTexts] = useState<Record<string, string>>({});
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
  const [duplicateIdsByName, setDuplicateIdsByName] = useState<Record<string, string>>({});

  const validateFile = (files: FileList) => {
    if (!files || files.length === 0) return false;
    if (files.length > 10) {
      toast.error("Puoi caricare al massimo 10 documenti per volta.");
      return false;
    }
    
    setFileError(null);
    handleFiles(files);
    return true;
  };

  const uploadAndAnalyze = async (selectedFilesInput: File | File[]) => {
    const selectedFiles = Array.isArray(selectedFilesInput) ? selectedFilesInput.slice(0, 10) : [selectedFilesInput];
    if (selectedFiles.length === 0) return;
    const selectedFile = selectedFiles[0];
    setLoading(true);
    setProgress(null);
    setExtractedText(null);
    setAnalysisResult(null);
    setFile(selectedFile);
    setSourceFiles(selectedFiles);
    setSourceTexts({});
    setDuplicateIdsByName({});

    if (!user) {
      setLoading(false);
      void trackEvent("analytics_error", { name: "uploadAndAnalyze", reason: "unauthenticated" });
      return;
    }

    setProgress(selectedFiles.length > 1 ? `Estrazione di ${selectedFiles.length} documenti in parallelo...` : null);
    const extractedParts = (await Promise.all(selectedFiles.map(async (currentFile) => {
      const docType: DocumentFileType = getFileType(currentFile);
      const fileSizeKb = Math.round(currentFile.size / 1024);
      try {
        let finalExtractedText = "";
        if (docType === "audio" || docType === "video" || currentFile.name.match(/\.(mp3|mp4|wav|webm|mkv|mov|m4a)$/i)) {
          if (selectedFiles.length === 1) setProgress("Estrazione e trascrizione in corso...");
          finalExtractedText = await extractTextFromMedia(currentFile);
        } else if (docType === "image") {
          if (selectedFiles.length === 1) setProgress("Immagine rilevata: OCR in corso...");
          finalExtractedText = await processWithTesseract(currentFile, fileSizeKb);
        } else {
          if (selectedFiles.length === 1) setProgress("Estrazione testo dal documento...");
          const text = await withTrace("doc_extract_text", { kind: docType, size_kb: fileSizeKb }, () => extractTextFromFile(currentFile));
          if (text.trim().length < 50 && docType === "pdf") {
            if (selectedFiles.length === 1) setProgress("Documento scannerizzato rilevato: avvio OCR...");
            finalExtractedText = await processWithTesseract(currentFile, fileSizeKb);
          } else if (text.trim().length < 50) {
            throw new Error("Impossibile estrarre testo sufficiente da questo formato.");
          } else {
            finalExtractedText = text;
          }
        }
        if (finalExtractedText.length > MAX_CHARS) {
          toast.error(`Il documento ${currentFile.name} supera il limite di ${MAX_CHARS.toLocaleString()} caratteri.`);
          void trackEvent("document_uploaded", { file_type: docType, file_size_kb: fileSizeKb, source: dragActive ? "dragdrop" : "desktop", success: false, error_type: "max_chars_exceeded" });
          return null;
        }
        void trackEvent("document_uploaded", { file_type: docType, file_size_kb: fileSizeKb, source: dragActive ? "dragdrop" : "desktop", success: true });
        return { name: currentFile.name, text: finalExtractedText };
      } catch (err) {
        console.error("Errore analisi file/OCR:", err);
        toast.error(`Errore nell'analisi di ${currentFile.name}: ${err instanceof Error ? err.message : "Errore sconosciuto"}`);
        void trackEvent("document_uploaded", { file_type: docType, file_size_kb: fileSizeKb, source: dragActive ? "dragdrop" : "desktop", success: false, error_type: err instanceof Error ? err.message : "unknown_error" });
        void trackEvent("analytics_error", { name: "uploadAndAnalyze", reason: err instanceof Error ? err.message : "unknown_error" });
        return null;
      }
    }))).filter((part): part is { name: string; text: string } => part !== null);
    if (extractedParts.length > 0) {
      const combinedText = extractedParts.length === 1
        ? extractedParts[0].text
        : extractedParts.map(({ name, text }) => `\n\n===== INIZIO DOCUMENTO: ${name} =====\n${text}\n===== FINE DOCUMENTO: ${name} =====`).join("\n");
      setSourceTexts(Object.fromEntries(extractedParts.map(({ name, text }) => [name, text])));
      if (combinedText.length > MAX_CHARS) {
        toast.error(`Il testo complessivo supera il limite di ${MAX_CHARS.toLocaleString()} caratteri. Carica meno documenti o file più brevi.`);
        setSourceFiles(extractedParts.map(({ name }) => selectedFiles.find((item) => item.name === name)).filter((item): item is File => !!item));
        setFile(extractedParts.map(({ name }) => selectedFiles.find((item) => item.name === name)).find((item): item is File => !!item) || null);
        setExtractedText(null);
      } else {
        setSourceFiles(extractedParts.map(({ name }) => selectedFiles.find((item) => item.name === name)).filter((item): item is File => !!item));
        setFile(extractedParts.map(({ name }) => selectedFiles.find((item) => item.name === name)).find((item): item is File => !!item) || null);
        setExtractedText(combinedText);
      }
    } else {
      setSourceFiles([]);
      setSourceTexts({});
      setFile(null);
    }
    setProgress(null);
    setLoading(false);
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
    void trackEvent("sentenze_ocr", { success: true, processing_time_ms: ocrMs });
    
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
      const duplicateIds: Record<string, string> = {};
      const filesToCheck = sourceFiles.length > 0 ? sourceFiles : file ? [file] : [];
      if (filesToCheck.length > 0) {
        for (const sourceFile of filesToCheck) {
          const existingDocId = await checkDuplicateDocument(user.uid, sourceFile.name);
          if (existingDocId) duplicateIds[sourceFile.name] = existingDocId;
        }
        if (Object.keys(duplicateIds).length > 0) {
          setDuplicateIdsByName(duplicateIds);
          setDuplicateId(Object.values(duplicateIds)[0]);
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
  
  const executeAnalysis = async (promptId?: string, overwriteId?: string) => {
    const filesToAnalyze = sourceFiles.length > 0 ? sourceFiles : file ? [file] : [];
    if (!extractedText || !user || filesToAnalyze.length === 0) return;

    setLoading(true);
    setProgress(filesToAnalyze.length > 1 ? `Analisi di ${filesToAnalyze.length} documenti in parallelo...` : "Analisi in corso…");
    setAnalysisResult(null);

    const baseLimit = Math.floor(10 / filesToAnalyze.length);
    const extraSlots = 10 % filesToAnalyze.length;
    try {
      const resultsByFile = await Promise.all(filesToAnalyze.map((sourceFile, index) => {
        const sourceText = sourceTexts[sourceFile.name] || (filesToAnalyze.length === 1 ? extractedText : "");
        const maxDocuments = baseLimit + (index < extraSlots ? 1 : 0);
        const duplicateForSource = duplicateIdsByName[sourceFile.name] || (filesToAnalyze.length === 1 ? overwriteId : undefined);
        return executeAnalysisForSource(promptId, duplicateForSource, sourceFile, sourceText, maxDocuments);
      }));

      const allResults = resultsByFile.flatMap((results) => results || []).slice(0, 10);
      setAnalysisResult(allResults.length > 0 ? JSON.stringify(allResults) : null);
      if (Object.keys(duplicateIdsByName).length > 0 || overwriteId) {
        setDuplicateIdsByName({});
        setDuplicateId(null);
      }
    } finally {
      setLoading(false);
      setProgress(null);
    }
  };

  const executeAnalysisForSource = async (
    promptId: string | undefined,
    overwriteId: string | undefined,
    analysisFile: File,
    analysisText: string,
    maxDocuments: number
  ): Promise<DocumentoGiurisprudenziale[] | undefined> => {
    if (!analysisText || !user) return;
    const startedAt = performance.now();
    
    // TYPE CASTING AGGIORNATO E CORRETTO
    const docType: DocumentFileType = getFileType(analysisFile);

    try {
      const { res, payload } = await withTrace(
        "reason_analyze",
        {
          input_len: analysisText.length,
        },
        async () => {
          const requestBody: Record<string, string | boolean | number> = { question: analysisText, extractMultiple: true, maxDocuments };
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
          void trackEvent("sentence_processed", {
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
            void trackEvent("sentence_processed", {
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
            void trackEvent("sentence_processed", {
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
            void trackEvent("sentence_processed", {
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
          void trackEvent("sentence_processed", {
            input_type: docType,
            success: false,
            processing_time_ms: Math.round(performance.now() - startedAt),
            error_type: "bad_request_400",
          });
          return;
        }

        if (res.status === 413) {
          toast.error("Documento troppo grande. Riduci il file e riprova.");
          void trackEvent("sentence_processed", {
            input_type: docType,
            success: false,
            processing_time_ms: Math.round(performance.now() - startedAt),
            error_type: "payload_too_large_413",
          });
          return;
        }

        console.error("reason API error", res.status, serverError);
        toast.error("Analisi fallita.");

        void trackEvent("sentence_processed", {
          input_type: docType,
          success: false,
          processing_time_ms: Math.round(performance.now() - startedAt),
          error_type: `http_${res.status}`,
        });

        void trackEvent("analytics_error", { name: "reason_api", reason: `HTTP ${res.status}` });
        return;
      }

      // ===== SUCCESS PATH =====
      let messageObj: { warning?: string } & Record<string, unknown>;

      if (typeof payload.message === "string") {
        let parsed: unknown;
        try {
          parsed = JSON.parse(payload.message);
        } catch {
          toast.error("Errore nell'analisi del file. Si prega di riprovare.");
          void trackEvent("sentence_processed", {
            input_type: docType,
            success: false,
            processing_time_ms: Math.round(performance.now() - startedAt),
            error_type: "message_json_parse_failed",
          });
          return;
        }

        if (typeof parsed !== "object" || parsed === null) {
          toast.error("Risposta non valida dal server.");
          void trackEvent("sentence_processed", {
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
      } else {
        toast.error("Risposta non valida dal server.");
        void trackEvent("sentence_processed", {
          input_type: docType,
          success: false,
          processing_time_ms: Math.round(performance.now() - startedAt),
          error_type: "invalid_response_message",
        });
        return;
      }

      const returnedDocuments = Array.isArray(messageObj.documents)
        ? messageObj.documents.slice(0, maxDocuments)
        : [messageObj];

      if (messageObj.warning === "input_non_sentenza" || returnedDocuments.some((doc) =>
        typeof doc === "object" && doc !== null && (doc as { warning?: string }).warning === "input_non_sentenza"
      )) {
        toast.error("Il testo caricato non sembra un documento giurisprudenziale.\nControlla il file e riprova.", {
          duration: 5000,
          style: { whiteSpace: "pre-line", maxWidth: "350px", lineHeight: "1.5" },
        });

        void trackEvent("sentence_processed", {
          input_type: docType,
          success: false,
          processing_time_ms: Math.round(performance.now() - startedAt),
          error_type: "input_non_sentenza",
        });
        return;
      }

      const validDocuments = returnedDocuments.filter((doc): doc is Record<string, unknown> =>
        typeof doc === "object" && doc !== null && !Array.isArray(doc)
      );
      if (validDocuments.length === 0) {
        toast.error("Non sono stati individuati documenti analizzabili nel file.");
        void trackEvent("sentence_processed", {
          input_type: docType,
          success: false,
          processing_time_ms: Math.round(performance.now() - startedAt),
          error_type: "no_documents_found",
        });
        return;
      }
      const uid = user.uid;
      const parsedResults = validDocuments.map((raw) => {
        const documentData = { ...raw };
        delete documentData.source_file;
        return {
          ...documentData,
          nome_file: analysisFile.name || "documento_senza_nome",
        } as DocumentoGiurisprudenziale;
      });

      await withTrace("doc_save_firestore_storage", { input_type: docType, document_count: parsedResults.length }, async () => {
        for (const parsedResult of parsedResults) {
          const newId = uuidv4();
          const documentToSave = {
            ...parsedResult,
            ...(promptId && promptId !== "default" ? { promptId } : {}),
          };
          await loadMaxima(newId, documentToSave, uid, "documents", analysisText);
          await loadSentence(analysisFile, newId, `users/${uid}/documents`);
        }
      });

      if (overwriteId) {
        try {
          await deleteDocument("documents", overwriteId);
          toast.success("Documento precedente sovrascritto con successo.");
        } catch (delErr) {
          console.error("Errore durante l'eliminazione del documento duplicato:", delErr);
          toast.error("Documento salvato, ma non è stato possibile eliminare il duplicato precedente.");
        }
      }

      void trackEvent("sentence_processed", {
        input_type: docType,
        success: true,
        processing_time_ms: Math.round(performance.now() - startedAt),
      });

      return parsedResults;

    } catch (err) {
      console.error(err);
      toast.error("Errore nell'analisi del file. Si prega di riprovare.");

      void trackEvent("sentence_processed", {
        input_type: docType,
        success: false,
        processing_time_ms: Math.round(performance.now() - startedAt),
        error_type: err instanceof Error ? err.message : "unknown_error",
      });

      void trackEvent("analytics_error", {
        name: "analyzeReason",
        reason: err instanceof Error ? err.message : "unknown_error",
      });
    }
  };

  const handleFiles = (files: FileList) => {
    if (files.length) void uploadAndAnalyze(Array.from(files).slice(0, 10));
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
    sourceFiles,
    setSourceFiles,
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
