
import { useCallback } from "react";
import { toast } from "react-hot-toast";
import { v4 as uuidv4 } from "uuid";
import { getReasonUrl } from "@/config/env";
import { trackEvent } from "@/infrastructure/analytics";
import { withTrace } from "@/infrastructure/perf";
import type {
  DocumentoGiurisprudenziale,
  AttachedDocument,
} from "@/interfaces/interfaces";
import type { User } from "firebase/auth";

export interface FileProcessorProps {
  user: User | null;
  setIsProcessingFiles: React.Dispatch<React.SetStateAction<boolean>>;
  setAttachedDocs: React.Dispatch<React.SetStateAction<AttachedDocument[]>>;
  setArchiveDocs: React.Dispatch<React.SetStateAction<AttachedDocument[]>>;
  setDenyOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const MAX_CHARS = 1_000_000;

type ParsedMessage = Record<string, unknown> & {
  warning?: string;
  tipo_documento?: string;
  sottotipo_documento?: string;
  massima?: string;
  dataSentenza?: string;
};

type FileSuccess = {
  success: true;
  doc: AttachedDocument;
};

type FileFailure = {
  success: false;
  fileName: string;
  reason: string;
  kind: "duplicate" | "too_large" | "warning" | "http" | "error";
  status?: number;
};

type ProcessingResult = FileSuccess | FileFailure;

export const useFileProcessor = ({
  user,
  setIsProcessingFiles,
  setAttachedDocs,
  setArchiveDocs,
  setDenyOpen,
}: FileProcessorProps) => {
  const processFilesParallel = useCallback(
    async (
      files: File[],
      promptId: string,
      targetFascicoloId?: string
    ): Promise<void> => {
      const endpoint = getReasonUrl();

      if (!endpoint || !user || files.length === 0) {
        return;
      }

      setIsProcessingFiles(true);

      const toastId = toast.loading(
        `Elaborazione di ${files.length} documenti in corso...`
      );

      try {
        const [
          { fetchWithSecurity },
          { loadMaxima, checkDuplicateDocument },
          { loadSentence },
          { extractTextFromMedia, extractTextFromFile },
        ] = await Promise.all([
          import("@/config/apiClient"),
          import("@/shared/services/document"),
          import("@/shared/services/storage"),
          import("@/shared/services/extractors"),
        ]);

        const results = await Promise.all(
          files.map(async (file): Promise<ProcessingResult> => {
            const lowerName = file.name.toLowerCase();

            const isMedia =
              file.type.startsWith("audio/") ||
              file.type.startsWith("video/") ||
              /\.(mp3|wav|ogg|opus|webm|mp4|mov|avi|mkv|m4v)$/i.test(
                file.name
              );

            const docType = isMedia
              ? "other"
              : lowerName.endsWith(".pdf")
                ? "pdf"
                : lowerName.endsWith(".docx")
                  ? "docx"
                  : file.type.startsWith("image/")
                    ? "image"
                    : "other";

            const fileSizeKb = Math.round(file.size / 1024);
            const newId = uuidv4();
            let startedAt = performance.now();

            try {
              // 1. Duplicati
              const isDuplicate = await checkDuplicateDocument(
                user.uid,
                file.name
              );

              if (isDuplicate) {
                return {
                  success: false,
                  fileName: file.name,
                  reason: `Il file "${file.name}" è già presente nell'archivio. Verrà ignorato.`,
                  kind: "duplicate",
                };
              }

              // 2. Estrazione del testo
              let text: string;

              if (isMedia) {
                text = await extractTextFromMedia(file);
              } else {
                text = await withTrace(
                  "doc_extract_text",
                  {
                    kind: file.type || "unknown",
                    size_kb: fileSizeKb,
                  },
                  () => extractTextFromFile(file)
                );

                // OCR per documenti con poco testo estratto
                if (text.trim().length <= 50) {
                  const ocrStart = performance.now();
                  const { createWorker, PSM } = await import("tesseract.js");
                  const worker = await createWorker("ita");

                  try {
                    await worker.setParameters({
                      tessedit_pageseg_mode: PSM.AUTO,
                      preserve_interword_spaces: "1",
                    });

                    const { data } = await worker.recognize(file);
                    text = data.text || "";
                  } finally {
                    await worker.terminate();
                  }

                  void trackEvent("sentenze_ocr", {
                    success: true,
                    processing_time_ms: Math.round(
                      performance.now() - ocrStart
                    ),
                  });
                }
              }

              // 3. Limite dimensionale del testo
              if (text.length > MAX_CHARS) {
                void trackEvent("document_uploaded", {
                  file_type: docType,
                  file_size_kb: fileSizeKb,
                  source: "desktop",
                  success: false,
                  error_type: "max_chars_exceeded",
                });

                return {
                  success: false,
                  fileName: file.name,
                  reason: `Il file "${file.name}" supera il limite di caratteri.`,
                  kind: "too_large",
                };
              }

              void trackEvent("document_uploaded", {
                file_type: docType,
                file_size_kb: fileSizeKb,
                source: "desktop",
                success: true,
              });

              // 4. Analisi tramite Reason
              startedAt = performance.now();

              const { res, payload } = await withTrace(
                "reason_analyze",
                { input_len: text.length },
                async () => {
                  const requestBody: Record<string, string> = {
                    question: text,
                  };

                  if (promptId && promptId !== "default") {
                    requestBody.promptId = promptId;
                  }

                  const response = await fetchWithSecurity(
                    endpoint,
                    requestBody
                  );

                  const contentType =
                    response.headers.get("content-type") || "";

                  if (contentType.includes("application/json")) {
                    const jsonPayload = await response
                      .json()
                      .catch(() => null);

                    return {
                      res: response,
                      payload: jsonPayload,
                    };
                  }

                  const rawText = await response
                    .text()
                    .catch(() => null);

                  return {
                    res: response,
                    payload: { message: rawText },
                  };
                }
              );

              if (!res.ok) {
                const errorType =
                  res.status === 401
                    ? "unauthorized_401"
                    : res.status === 403
                      ? "forbidden_403"
                      : res.status === 400
                        ? "bad_request_400"
                        : res.status === 413
                          ? "payload_too_large_413"
                          : `http_${res.status}`;

                void trackEvent("sentence_processed", {
                  input_type: docType,
                  success: false,
                  processing_time_ms: Math.round(
                    performance.now() - startedAt
                  ),
                  error_type: errorType,
                });

                return {
                  success: false,
                  fileName: file.name,
                  reason:
                    res.status === 403 || res.status === 404
                      ? "Mancata autorizzazione."
                      : res.status === 500
                        ? "Errore critico durante l'elaborazione."
                        : `Errore API (${res.status})`,
                  kind: "http",
                  status: res.status,
                };
              }

              // 5. Interpretazione della risposta
              let messageObj: ParsedMessage = {};

              if (typeof payload?.message === "string") {
                try {
                  messageObj = JSON.parse(payload.message) as ParsedMessage;
                } catch {
                  messageObj = {
                    massima: payload.message,
                  };
                }
              } else if (
                typeof payload?.message === "object" &&
                payload.message !== null
              ) {
                messageObj = payload.message as ParsedMessage;
              }

              if (messageObj.warning === "input_non_sentenza") {
                void trackEvent("sentence_processed", {
                  input_type: docType,
                  success: false,
                  processing_time_ms: Math.round(
                    performance.now() - startedAt
                  ),
                  error_type: "input_non_sentenza",
                });

                return {
                  success: false,
                  fileName: file.name,
                  reason:
                    "Il file non sembra essere un documento giurisprudenziale valido.",
                  kind: "warning",
                };
              }

              // 6. Persistenza
              const finalResult = {
                ...messageObj,
                tipo_documento:
                  messageObj.tipo_documento ||
                  "documento_giurisprudenza_generico",
                nome_file: file.name,
                fascicoloIds: targetFascicoloId
                  ? [targetFascicoloId]
                  : [],
              } as DocumentoGiurisprudenziale;

              await withTrace(
                "doc_save_firestore_storage",
                { input_type: docType },
                async () => {
                  await loadMaxima(
                    newId,
                    finalResult,
                    user.uid,
                    "documents",
                    text
                  );

                  await loadSentence(
                    file,
                    newId,
                    `users/${user.uid}/documents`
                  );
                }
              );

              void trackEvent("sentence_processed", {
                input_type: docType,
                success: true,
                processing_time_ms: Math.round(
                  performance.now() - startedAt
                ),
              });

              return {
                success: true,
                doc: {
                  id: String(newId),
                  name: file.name,
                  metadata:
                    finalResult.tipo_documento ===
                    "documento_giurisprudenza_generico"
                      ? messageObj.sottotipo_documento ||
                        "Documento generico"
                      : finalResult.massima || "",
                  type: docType,
                  size: `${(file.size / 1024).toFixed(1)} KB`,
                  dataSentenza: finalResult.dataSentenza || undefined,
                  fascicoloIds: targetFascicoloId
                    ? [targetFascicoloId]
                    : [],
                  user: user.uid,
                } as AttachedDocument,
              };
            } catch (error) {
              const reason =
                error instanceof Error
                  ? error.message
                  : "Errore sconosciuto durante l'elaborazione.";

              void trackEvent("sentence_processed", {
                input_type: docType,
                success: false,
                processing_time_ms: Math.round(
                  performance.now() - startedAt
                ),
                error_type: reason,
              });

              return {
                success: false,
                fileName: file.name,
                reason,
                kind: "error",
              };
            }
          })
        );

        const validDocs = results
          .filter(
            (result): result is FileSuccess => result.success
          )
          .map((result) => result.doc);

        const failedDocs = results.filter(
          (result): result is FileFailure => !result.success
        );

        // Gli errori HTTP hanno messaggi e azioni specifici.
        const authorizationFailure = failedDocs.find(
          (failure) =>
            failure.kind === "http" &&
            (failure.status === 403 || failure.status === 404)
        );

        if (authorizationFailure) {
          setDenyOpen(true);
          toast.error("Mancata autorizzazione.", { id: toastId });
        } else if (
          failedDocs.some(
            (failure) =>
              failure.kind === "http" && failure.status === 500
          )
        ) {
          toast.error("Errore critico durante l'elaborazione.", {
            id: toastId,
          });
        } else {
          const duplicate = failedDocs.find(
            (failure) => failure.kind === "duplicate"
          );

          const tooLarge = failedDocs.find(
            (failure) => failure.kind === "too_large"
          );

          if (duplicate) {
            toast.error(duplicate.reason);
          }

          if (tooLarge) {
            toast.error(tooLarge.reason, { duration: 6000 });
          }

          if (validDocs.length > 0) {
            if (failedDocs.length > 0) {
              toast.success(
                `${validDocs.length} di ${files.length} documenti aggiunti.`,
                { id: toastId }
              );

              const otherFailures = failedDocs.filter(
                (failure) =>
                  failure.kind !== "duplicate" &&
                  failure.kind !== "too_large"
              );

              if (otherFailures.length > 0) {
                toast.error(
                  `Alcuni file non sono stati elaborati: ${otherFailures
                    .map((failure) => failure.fileName)
                    .join(", ")}`
                );
              }
            } else {
              toast.success(
                `${validDocs.length} documenti aggiunti!`,
                { id: toastId }
              );
            }
          } else if (!duplicate && !tooLarge) {
            const firstFailure = failedDocs[0];

            if (firstFailure) {
              toast.error(firstFailure.reason, { id: toastId });
            } else {
              toast.error(
                "Errore critico durante l'elaborazione.",
                { id: toastId }
              );
            }
          }
        }

        if (validDocs.length > 0) {
          setAttachedDocs((previous) => [
            ...previous,
            ...validDocs,
          ]);

          setArchiveDocs((previous) => [
            ...previous,
            ...validDocs,
          ]);
        }

        // Un file scartato non provoca un'eccezione al chiamante.
      } catch (error) {
        console.error("Errore processFilesParallel:", error);

        toast.error("Errore critico durante l'elaborazione.", {
          id: toastId,
        });
      } finally {
        setIsProcessingFiles(false);
        toast.dismiss(toastId);
      }
    },
    [
      user,
      setIsProcessingFiles,
      setAttachedDocs,
      setArchiveDocs,
      setDenyOpen,
    ]
  );

  return { processFilesParallel };
};