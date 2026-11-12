import { getAdminStorage } from "../_deps";
// @ts-ignore
import pdfExtract from "pdf-extraction";

export const MAX_PDF_SIZE_BYTES = 30 * 1024 * 1024;

export interface ExtractedPdfText {
  text: string;
  pages: number;
}

/**
 * Scarica un PDF dallo Storage e ne estrae il testo ripulito.
 * Lancia "FILE_NOT_FOUND" se il file non esiste e "FILE_TOO_LARGE" oltre i 30MB.
 * Condivisa tra l'endpoint extractDocumentText (MCP/web) e il tool del consulente legale.
 */
export async function extractPdfTextFromStorage(storagePath: string): Promise<ExtractedPdfText> {
  // Path Traversal Protection
  const safeStoragePath = storagePath.trim().replace(/\.\./g, "");

  const file = getAdminStorage().bucket().file(safeStoragePath);

  const [exists] = await file.exists();
  if (!exists) {
    throw new Error("FILE_NOT_FOUND");
  }

  const [metadata] = await file.getMetadata();
  if (Number(metadata.size || 0) > MAX_PDF_SIZE_BYTES) {
    throw new Error("FILE_TOO_LARGE");
  }

  const [buffer] = await file.download();
  const pdfData = await pdfExtract(buffer);
  const rawText = typeof pdfData?.text === "string" ? pdfData.text : "";

  // Pulizia testuale standardizzata
  const text = rawText
    .replace(/([^\n])\n(?=[^\n])/g, "$1 ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n\s*\n/g, "\n\n")
    .trim();

  return {
    text,
    pages: typeof pdfData?.numpages === "number" ? pdfData.numpages : 1,
  };
}
