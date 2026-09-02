import { toast } from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import { getReasonUrl } from "@/config/env";
import { trackEvent } from "@/services/analytics";
import { withTrace } from "@/services/perf";
import type { DocumentoGiurisprudenziale, AttachedDocument } from "@/interfaces/interfaces";
import type { User } from "firebase/auth";

export interface FileProcessorProps {
  user: User | null;
  setIsProcessingFiles: React.Dispatch<React.SetStateAction<boolean>>;
  setAttachedDocs: React.Dispatch<React.SetStateAction<AttachedDocument[]>>;
  setArchiveDocs: React.Dispatch<React.SetStateAction<AttachedDocument[]>>;
  setDenyOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const REASON_ENDPOINT = getReasonUrl();
const MAX_CHARS = 1_000_000;

export const useFileProcessor = ({ user, setIsProcessingFiles, setAttachedDocs, setArchiveDocs, setDenyOpen }: FileProcessorProps) => {

  const processFilesParallel = async (files: File[], promptId: string, targetFascicoloId?: string) => {
    if (!REASON_ENDPOINT || !user || files.length === 0) return;
    setIsProcessingFiles(true);
    const toastId = toast.loading(`Elaborazione di ${files.length} documenti in corso...`);
    
    try {
      const { fetchWithSecurity } = await import("@/config/apiClient");
      const { loadMaxima, checkDuplicateDocument } = await import("@/services/document");
      const { loadSentence } = await import("@/services/storage");
      const { extractTextFromMedia, extractTextFromFile } = await import("@/hooks/extractors"); 

      interface ParsedMessage extends Record<string, unknown> { warning?: string; tipo_documento?: string; sottotipo_documento?: string; massima?: string; dataSentenza?: string; }

      const processedDocs = await Promise.all(files.map(async (file) => {
        const lowerName = file.name.toLowerCase();
        const isMedia = file.type.startsWith("audio/") || file.type.startsWith("video/") || /\.(mp3|wav|ogg|opus|webm|mp4|mov|avi|mkv|m4v)$/i.test(file.name);
        const docType = isMedia ? "other" : lowerName.endsWith('.pdf') ? "pdf" : lowerName.endsWith('.docx') ? "docx" : file.type.startsWith('image/') ? "image" : "other";
        const fileSizeKb = Math.round(file.size / 1024);
        const newId = uuidv4();    
        let startedAt = performance.now(); 

        try {
          const isDuplicate = await checkDuplicateDocument(user.uid, file.name);
          if (isDuplicate) { toast.error(`Il file "${file.name}" è già presente nell'archivio. Verrà ignorato.`); return null; }

          let text = "";
          if (isMedia) {
            text = await extractTextFromMedia(file);
          } else {
            text = await withTrace("doc_extract_text", { kind: file.type || "unknown", size_kb: fileSizeKb }, () => extractTextFromFile(file));
            if (text.trim().length <= 50) {
              const ocrStart = performance.now();
              const { createWorker, PSM } = await import("tesseract.js");
              const worker = await createWorker("ita");
              await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO, preserve_interword_spaces: "1" });
              const { data } = await worker.recognize(file);
              text = data.text || "";
              await worker.terminate();
              trackEvent("sentenze_ocr", { success: true, processing_time_ms: Math.round(performance.now() - ocrStart) });
            }
          }

          if (text.length > MAX_CHARS) {
            toast.error(`Il file "${file.name}" supera il limite di caratteri.`, { duration: 6000 });
            trackEvent("document_uploaded", { file_type: docType, file_size_kb: fileSizeKb, source: "desktop", success: false, error_type: "max_chars_exceeded" });
            return null; 
          }

          trackEvent("document_uploaded", { file_type: docType, file_size_kb: fileSizeKb, source: "desktop", success: true });
          startedAt = performance.now(); 

          const { res, payload } = await withTrace("reason_analyze", { input_len: text.length }, async () => {
            const requestBody: Record<string, string> = { question: text };
            if (promptId && promptId !== "default") requestBody.promptId = promptId;
            const res = await fetchWithSecurity(REASON_ENDPOINT, requestBody);
            const contentType = res.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
              const jsonPayload = await res.json().catch(() => null);
              return { res, payload: jsonPayload };
            } else {
              const rawText = await res.text().catch(() => null);
              return { res, payload: { message: rawText } };
            }
          });

          if (!res.ok) {
            let errorType = `http_${res.status}`;
            if (res.status === 401) errorType = "unauthorized_401"; else if (res.status === 403) errorType = "forbidden_403"; else if (res.status === 400) errorType = "bad_request_400"; else if (res.status === 413) errorType = "payload_too_large_413";
            trackEvent("sentence_processed", { input_type: docType, success: false, processing_time_ms: Math.round(performance.now() - startedAt), error_type: errorType });
            if (res.status === 403 || res.status === 404) { setDenyOpen(true); toast.error("Mancata autorizzazione.", { id: toastId }); throw new Error("Accesso negato."); } 
            else { toast.error("Errore critico durante l'elaborazione.", { id: toastId }); throw new Error(`API error ${res.status}`); }
          }

          let messageObj: ParsedMessage = {};
          if (typeof payload?.message === "string") {
            try { messageObj = JSON.parse(payload.message); } catch { messageObj = { massima: payload.message }; }
          } else if (typeof payload?.message === "object" && payload.message !== null) { messageObj = payload.message as ParsedMessage; }

          if (messageObj.warning === "input_non_sentenza") { trackEvent("sentence_processed", { input_type: docType, success: false, processing_time_ms: Math.round(performance.now() - startedAt), error_type: "input_non_sentenza" }); return null; }

          const finalResult = { ...messageObj, tipo_documento: messageObj.tipo_documento || "documento_giurisprudenza_generico", nome_file: file.name, fascicoloIds: targetFascicoloId ? [targetFascicoloId] : [] } as DocumentoGiurisprudenziale;

          await withTrace("doc_save_firestore_storage", { input_type: docType }, async () => {
              await loadMaxima(newId, finalResult, user.uid, "documents", text);
              await loadSentence(file, newId, `users/${user.uid}/documents`);
          });

          trackEvent("sentence_processed", { input_type: docType, success: true, processing_time_ms: Math.round(performance.now() - startedAt) });

          return {
            id: String(newId), name: file.name,
            metadata: finalResult.tipo_documento === "documento_giurisprudenza_generico" ? (messageObj.sottotipo_documento || "Documento generico") : (finalResult.massima || ""),
            type: docType, size: `${(file.size / 1024).toFixed(1)} KB`,
            dataSentenza: finalResult.dataSentenza || undefined,
            fascicoloIds: targetFascicoloId ? [targetFascicoloId] : [], user: user?.uid
          } as AttachedDocument;

        } catch (fileError) {
          trackEvent("sentence_processed", { input_type: docType, success: false, processing_time_ms: Math.round(performance.now() - startedAt), error_type: fileError instanceof Error ? fileError.message : "unknown_error" });
          return null; 
        }
      }));

      const validProcessedDocs = processedDocs.filter((doc): doc is AttachedDocument => doc !== null);
      if (validProcessedDocs.length > 0) {
        setAttachedDocs(prev => [...prev, ...validProcessedDocs]);
        setArchiveDocs(prev => [...prev, ...validProcessedDocs]);
        toast.success(`${validProcessedDocs.length} documenti aggiunti!`, { id: toastId });
      } else { toast.dismiss(toastId); }

    } catch (error) { toast.error("Errore critico durante l'elaborazione.", { id: toastId }); console.error(error); } 
    finally { setIsProcessingFiles(false); }
  };

  return { processFilesParallel };
};