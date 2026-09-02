import JSZip from "jszip";
import * as XLSX from "xlsx";
import PostalMime from "postal-mime";
import { withTrace } from "@/services/perf";
import { fetchWithoutContent } from "@/config/apiClient";
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

/* ===========================
   FILE SUPPORT HELPERS
=========================== */

export const SUPPORTED_FORMATS_MSG = "Sono accettati file PDF, Word, Excel, PowerPoint, Testo, Immagini, Email (EML), Audio, Video e file Apple iWork.";
const TRANSCRIBE_ENDPOINT = import.meta.env.VITE_TRANSCRIBE_ENDPOINT;
/* ===========================
   FFMPEG SINGLETON (Lazy Load)
=========================== */
let ffmpegInstance: FFmpeg | null = null;

async function getFFmpegInstance(): Promise<FFmpeg> {
  if (ffmpegInstance) return ffmpegInstance;
  
  const ffmpeg = new FFmpeg();
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
  
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });
  
  ffmpegInstance = ffmpeg;
  return ffmpeg;
}

/* ===========================
   PDF.JS HELPERS (condivisi)
=========================== */
type PdfJs = typeof import("pdfjs-dist");

async function getPdfJs(): Promise<PdfJs> {
  const pdfjsLib = await import("pdfjs-dist");
  const pdfWorker = (await import("pdfjs-dist/build/pdf.worker?url")).default;

  if (pdfjsLib.GlobalWorkerOptions.workerSrc !== pdfWorker) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
  }
  return pdfjsLib;
}

export type DocumentFileType = 
  | "pdf" | "doc" | "docx" | "txt" | "rtf" | "text" 
  | "image" | "xlsx" | "pptx" | "ppt" | "eml" | "csv"
  | "audio" | "video" | "unsupported" | "other";

export function getFileType(f: File): DocumentFileType {
  const name = f.name.toLowerCase();
  const type = f.type;

  if (type === "application/pdf" || name.endsWith(".pdf")) return "pdf";
  if (type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
      type === "application/msword" || name.match(/\.(docx?)$/)) return "docx";
  if (type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || 
      type === "application/vnd.ms-excel" || name.match(/\.(xlsx?)$/)) return "xlsx";
  
  if (type === "application/vnd.openxmlformats-officedocument.presentationml.presentation" || 
      name.endsWith(".pptx")) return "pptx";
  if (type === "application/vnd.ms-powerpoint" || name.endsWith(".ppt")) return "ppt";
  
  if (type === "message/rfc822" || name.endsWith(".eml")) return "eml";
  
  if (type.startsWith("audio/") || name.match(/\.(mp3|wav|m4a)$/)) return "audio";
  if (type.startsWith("video/") || name.match(/\.(mp4|mov|avi|mkv)$/)) return "video";
  
  if (type.startsWith("text/") || name.match(/\.(txt|md|csv|rtf)$/)) return "text";
  if (type.startsWith("image/") || name.match(/\.(png|jpe?g|webp)$/)) return "image";
  
  // I formati Mac (.pages, .numbers, .key) e altri formati non standard finiranno qui
  return "unsupported";
}

/* ===========================
   FUNZIONE DI ROUTING PRINCIPALE
=========================== */

export async function extractTextFromFile(f: File): Promise<string> {
  const name = f.name.toLowerCase();
  
  // 1. Intercettiamo i file Mac (iWork) tramite estensione
  if (name.match(/\.(pages|numbers|key)$/)) {
    return extractTextFromIWork(f);
  }

  const fileType = getFileType(f);

  // 2. Routing standard
  if (fileType === "pdf") return extractTextFromPdf(f);
  if (fileType === "docx") return extractTextFromDocx(f);
  if (fileType === "xlsx") return extractTextFromXlsx(f);
  if (fileType === "pptx") return extractTextFromPptx(f);
  if (fileType === "eml") return extractTextFromEml(f);
  
  if (fileType === "ppt") {
    throw new Error("Il formato .ppt (pre-2007) è obsoleto e non supportato. Apri il file e salvalo come .pptx.");
  }
  
  if (fileType === "text" || fileType === "csv") return await f.text();
  
  if (fileType === "image") {
    // Restituiamo una stringa vuota per forzare il passaggio all'OCR nel main thread
    return "";
  }
  
  if (fileType === "audio" || fileType === "video") {
    return extractTextFromMedia(f);
  }

  throw new Error(`Formato file non supportato: ${fileType || f.type || 'sconosciuto'}`);
}


export async function extractTextFromMedia(f: File): Promise<string> {
  if (!f || f.size === 0) {
    throw new Error("Il file multimediale è vuoto o non valido.");
  }

  const originalSizeKb = Math.round(f.size / 1024);
  const isVideo = f.type.startsWith("video/") || /\.(mp4|mov|avi|mkv|webm|m4v)$/i.test(f.name);

  let fileToSend: Blob = f;
  let finalFileName = f.name;
  let sentMimeType = f.type || "application/octet-stream";

  try {
    // 1. CONVERSIONE VIDEO → MP3 16 kHz MONO
    if (isVideo) {
      const ffmpeg = await getFFmpegInstance();
      const inputName = `input_${Date.now()}.media`;
      const outputName = "extracted_audio.mp3";

      try {
        await ffmpeg.writeFile(inputName, await fetchFile(f));
        await ffmpeg.exec([
          "-i", inputName,
          "-vn",
          "-ar", "16000",
          "-ac", "1",
          "-codec:a", "libmp3lame",
          "-q:a", "4",
          outputName,
        ]);

        const fileData = await ffmpeg.readFile(outputName);
        const audioBytes = new Uint8Array(fileData as Uint8Array);

        if (audioBytes.byteLength === 0) {
          throw new Error("FFmpeg non ha prodotto una traccia audio valida.");
        }

        fileToSend = new Blob([audioBytes], { type: "audio/mpeg" });
        finalFileName = outputName;
        sentMimeType = "audio/mpeg";
      } finally {
        await ffmpeg.deleteFile(inputName).catch(() => {});
        await ffmpeg.deleteFile(outputName).catch(() => {});
      }
    }

    const currentSizeKb = Math.round(fileToSend.size / 1024);
    if (fileToSend.size === 0) {
      throw new Error("Il file audio generato è vuoto. Impossibile procedere con la trascrizione.");
    }
    if (fileToSend.size > 25 * 1024 * 1024) {
      throw new Error("File multimediale troppo grande. Il limite massimo per la trascrizione è 25MB.");
    }

    // 2. INVIO AL BACKEND
    const formData = new FormData();
    formData.append("file", fileToSend, finalFileName);

    const { res, payload, rawText } = await withTrace(
      "media_extract_audio",
      {
        original_size_kb: originalSizeKb,
        sent_size_kb: currentSizeKb,
        original_file_type: f.type || null,
        original_file_name: f.name,
        sent_file_type: sentMimeType,
        sent_file_name: finalFileName,
        is_video: isVideo,
      },
      async () => {
        const res = await fetchWithoutContent(TRANSCRIBE_ENDPOINT, {
          method: "POST",
          body: formData,
        });

        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const payload = await res.json().catch(() => null);
          return { res, payload, rawText: null };
        }

        const rawText = await res.text().catch(() => "");
        return { res, payload: null, rawText };
      }
    );

    // 3. GESTIONE ERRORI HTTP
    if (!res.ok) {
      const serverResponse = payload ?? (rawText ? { error: rawText } : null);
      const serverError = serverResponse && typeof serverResponse === "object" 
        ? (serverResponse as { error?: string; details?: string }) 
        : null;
      const errorMessage = serverError?.details || serverError?.error;

      const errorMessages: Record<number, string> = {
        401: "Sessione scaduta. Effettua di nuovo l’accesso per trascrivere l'audio.",
        403: errorMessage || "Accesso negato. Il tuo piano non consente di utilizzare la trascrizione.",
        400: errorMessage || "Richiesta non valida. Controlla il formato del file audio/video e riprova.",
        413: "File multimediale troppo grande. Il limite massimo per la trascrizione è 25MB.",
        429: "Hai raggiunto temporaneamente il limite di trascrizioni. Riprova tra poco.",
      };

      throw new Error(errorMessages[res.status] || errorMessage || `Analisi fallita. Errore server (${res.status}).`);
    }

    // 4. ESTRAZIONE TESTO
    let transcription = "";

    interface SpeechAlternative {
      transcript?: string;
    }

    interface SpeechResult {
      alternatives?: SpeechAlternative[];
    }

    interface TranscriptionPayload {
      text?: string;
      results?: SpeechResult[];
    }

    const typedPayload = payload as TranscriptionPayload | null;

    if (typedPayload && typeof typedPayload.text === "string") {
      transcription = typedPayload.text;
    } else if (typedPayload && Array.isArray(typedPayload.results)) {
      transcription = typedPayload.results
        .map((r: SpeechResult) => r?.alternatives?.[0]?.transcript || "")
        .filter(Boolean)
        .join(" ");
    } else if (typeof rawText === "string") {
      transcription = rawText;
    }

    transcription = transcription.trim();

    if (!transcription) {
      throw new Error("Il file è stato elaborato ma non è stato rilevato alcun parlato al suo interno.");
    }

    return transcription;
  } catch (error) {
    console.error("Errore durante la trascrizione media:", {
      error,
      fileName: f?.name,
      fileType: f?.type,
      fileSize: f?.size,
    });

    if (error instanceof Error) throw error;
    throw new Error("Impossibile completare la trascrizione.");
  }
}



/* ===========================
   ESTRATTORI SPECIFICI
=========================== */

async function extractTextFromPdf(f: File): Promise<string> {
  const pdfjsLib = await getPdfJs();
  const buffer = await f.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(getTextItemStr).join(" ");
    fullText += pageText + "\n";
  }
  return fullText;
}

async function extractTextFromDocx(f: File): Promise<string> {
  const { extractRawText } = await import("mammoth");
  const buffer = await f.arrayBuffer();
  const result = await extractRawText({ arrayBuffer: buffer });
  return result.value || "";
}

async function extractTextFromXlsx(f: File): Promise<string> {
  try {
    const arrayBuffer = await f.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: "array" });
    let text = "";

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const sheetText = XLSX.utils.sheet_to_csv(sheet);
      
      if (sheetText.trim()) {
        text += `--- FOGLIO: ${sheetName} ---\n${sheetText}\n\n`;
      }
    }
    
    return text;
  } catch (error) {
    console.error("Errore estrazione XLSX:", error);
    throw new Error("Impossibile leggere il file Excel.");
  }
}

async function extractTextFromPptx(f: File): Promise<string> {
  try {
    const arrayBuffer = await f.arrayBuffer();
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(arrayBuffer);
    let text = "";

    const slideRegex = /^ppt\/slides\/slide\d+\.xml$/;
    const slideFiles = Object.keys(loadedZip.files).filter(fileName => slideRegex.test(fileName));

    slideFiles.sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || "0", 10);
      const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || "0", 10);
      return numA - numB;
    });

    for (let i = 0; i < slideFiles.length; i++) {
      const slideName = slideFiles[i];
      const slideXml = await loadedZip.file(slideName)?.async("text");
      
      if (slideXml) {
        const matches = slideXml.match(/<a:t>([\s\S]*?)<\/a:t>/g);
        if (matches && matches.length > 0) {
           text += `--- SLIDE ${i + 1} ---\n`;
           const slideText = matches.map(m => m.replace(/<\/?a:t>/g, '')).join(' ');
           text += slideText + "\n\n";
        }
      }
    }

    return text;
  } catch (error) {
    console.error("Errore estrazione PPTX:", error);
    throw new Error("Impossibile leggere la presentazione PPTX.");
  }
}

async function extractTextFromEml(f: File): Promise<string> {
  try {
    const arrayBuffer = await f.arrayBuffer();
    const parser = new PostalMime();
    const email = await parser.parse(arrayBuffer);

    let text = `Oggetto: ${email.subject || "Nessun oggetto"}\n`;
    text += `Da: ${email.from?.address || "Sconosciuto"}\n`;
    
    const recipients = email.to?.map(t => t.address).join(', ');
    if (recipients) text += `A: ${recipients}\n`;
    
    text += `Data: ${email.date || "Sconosciuta"}\n\n--- CORPO DEL MESSAGGIO ---\n`;

    if (email.text) {
      text += email.text;
    } else if (email.html) {
      text += email.html
        .replace(/<style[^>]*>.*<\/style>/gi, '')
        .replace(/<script[^>]*>.*<\/script>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    return text;
  } catch (error) {
    console.error("Errore estrazione EML:", error);
    throw new Error("Impossibile leggere il file EML.");
  }
}

async function extractTextFromIWork(f: File): Promise<string> {
  try {
    const arrayBuffer = await f.arrayBuffer();
    const zip = new JSZip();
    const loadedZip = await zip.loadAsync(arrayBuffer);

    // Cerchiamo l'anteprima PDF che macOS genera automaticamente dentro il file zip proprietario
    const previewPdfFile = loadedZip.file("QuickLook/Preview.pdf") || loadedZip.file("preview.pdf");

    if (previewPdfFile) {
      const pdfBlob = await previewPdfFile.async("blob");
      const pdfFile = new File([pdfBlob], "iwork_preview.pdf", { type: "application/pdf" });
      
      // Sfruttiamo l'estrattore PDF che abbiamo già!
      return await extractTextFromPdf(pdfFile);
    }

    throw new Error("Anteprima PDF non trovata.");
  } catch (error) {
    console.error("Errore estrazione iWork:", error);
    throw new Error(`Impossibile leggere il file Apple. Aprilo su Mac e fai "File > Esporta in > PDF" per continuare.`);
  }
}

function getTextItemStr(item: unknown): string {
  if (item && typeof item === "object" && "str" in item) {
    const v = item as { str?: unknown };
    return typeof v.str === "string" ? v.str : "";
  }
  return "";
}

/* ===========================
   TESSERACT HELPERS (condivisi)
=========================== */
type TesseractWorker = Awaited<ReturnType<(typeof import("tesseract.js"))["createWorker"]>>;

export async function ocrFileWithTesseract(
  selectedFile: File,
  worker: TesseractWorker,
  onPage?: (current: number, total: number) => void
): Promise<string> {
  const fileType = getFileType(selectedFile);

  if (fileType === "pdf") {
    const pdfjsLib = await getPdfJs();
    const buffer = await selectedFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      onPage?.(i, pdf.numPages);

      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 2 });

      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas context non disponibile");

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvas, canvasContext: context, viewport }).promise;

      const { data } = await worker.recognize(canvas);
      fullText += (data.text || "") + "\n";

      context.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
    }
    return fullText;
  }

  if (fileType === "image") {
    onPage?.(1, 1);
    const { data } = await worker.recognize(selectedFile);
    return data.text || "";
  }

  return "";
}