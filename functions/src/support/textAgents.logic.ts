import { Request, Response } from "express";
import Busboy from "busboy";
import { SpeechClient } from "@google-cloud/speech";
import { corsHandlerDomain, withSecureApiEndpoint, validateUserPlanAndLimits, requireAppCheck, requireUidFromAuthHeader } from "../_utils";
import { getDb, getAdminStorage } from "../_deps";
import { logSafeError } from "../_logging";
// @ts-ignore
import pdfExtract from "pdf-extraction";

const db = getDb();
let speechClientInstance: SpeechClient | null = null;

export interface ExtractDocumentRequestBody {
  storagePath?: string;
}

export async function executeSpeechToTextAgent(req: Request, res: Response): Promise<any> {
  return withSecureApiEndpoint(req, res, async (uid): Promise<void> => {
    // 1. Controllo utente e validazione unificata piano/limiti (feature "speech_to_text")
    const userSnap = await db.collection("register").doc(uid).get();
    if (!userSnap.exists) {
      throw new Error("NOT_FOUND");
    }

    await validateUserPlanAndLimits(uid, "speech_to_text", userSnap);

    // 2. Multipart Parsing Sicuro
    const reqContentType = req.headers["content-type"] || req.header("content-type");
    const contentType = String(reqContentType ?? "");

    if (!contentType.includes("multipart/form-data")) {
      res.status(400).json({ error: "Bad Request", details: "Invalid content-type." });
      return;
    }

    const rawBody = (req as any).rawBody;

    if (!rawBody || !Buffer.isBuffer(rawBody)) {
      res.status(400).json({ error: "Bad Request", details: "Manca il payload." });
      return;
    }

    let fileBuffer: Buffer | undefined;
    let filename = "";
    let mimeType = "";

    await new Promise<void>((resolve, reject) => {
      const busboyHeaders = Object.fromEntries(
        Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : v])
      ) as Record<string, string>;

      const busboy = Busboy({
        headers: busboyHeaders,
        limits: {
          fileSize: 25 * 1024 * 1024, 
          files: 1, 
        },
      });

      busboy.on("file", (fieldname, file, info) => {
        if (fieldname !== "file") {
          file.resume(); 
          return;
        }

        filename = info.filename.replace(/[^a-zA-Z0-9.\-_]/g, '');
        mimeType = info.mimeType.toLowerCase();

        const chunks: Buffer[] = [];

        file.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });

        file.on("limit", () => {
          file.resume(); 
          reject(new Error("FILE_TOO_LARGE"));
        });

        file.on("end", () => {
          fileBuffer = Buffer.concat(chunks);
        });
      });

      busboy.on("finish", resolve);
      busboy.on("error", (err) => reject(err));

      busboy.end(rawBody);
    });

    // 3. Validazione File
    if (!fileBuffer || fileBuffer.length === 0) {
      res.status(400).json({ error: "Bad Request", details: "Nessun file audio." });
      return;
    }

    if (fileBuffer.length > 25 * 1024 * 1024) {
      res.status(413).json({ error: "Payload Too Large", details: "Il file supera il limite di 25 MB." });
      return;
    }

    // 4. Mappatura Formato Audio
    const extension = filename.split(".").pop()?.toLowerCase() ?? "";
    
    type AudioEncoding = 'MP3' | 'LINEAR16' | 'OGG_OPUS' | 'WEBM_OPUS' | null;

    const encoding: AudioEncoding =
      mimeType === "audio/mpeg" || mimeType === "audio/mp3" || extension === "mp3"
        ? "MP3"
        : mimeType.includes("wav") || extension === "wav"
          ? "LINEAR16"
          : mimeType === "audio/ogg" || mimeType === "audio/opus" || extension === "ogg" || extension === "opus"
            ? "OGG_OPUS"
            : mimeType === "audio/webm" || extension === "webm"
              ? "WEBM_OPUS"
              : null;

    if (!encoding) {
      res.status(400).json({
        error: "Bad Request",
        details: "Formato audio non supportato (Richiesti: mp3, wav, ogg, webm).",
      });
      return;
    }

    // 5. Google Speech API
    if (!speechClientInstance) {
      speechClientInstance = new SpeechClient();
    }

    const [response] = await speechClientInstance.recognize({
      audio: {
        content: fileBuffer.toString("base64"),
      },
      config: {
        encoding: encoding as any, 
        sampleRateHertz: 16000,
        languageCode: "it-IT",
        enableAutomaticPunctuation: true,
      },
    });

    const text =
      response.results
        ?.map((result: any) => result.alternatives?.[0]?.transcript ?? "")
        .filter(Boolean)
        .join(" ")
        .trim() ?? "";

    console.log("[JURIO-STT] Trascrizione completata");

    res.status(200).json({
      success: true,
      text,
    });
  });
}

export async function executeExtractDocumentText(req: Request, res: Response): Promise<any> {
  return corsHandlerDomain(req, res, () => extractDocumentTextHandler(req, res));
}

async function extractDocumentTextHandler(req: Request, res: Response): Promise<void> {
  // 1. Validazione Metodo HTTP (il preflight CORS è gestito dal wrapper corsHandlerDomain)
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method Not Allowed" });
    return;
  }

  try {
    // 2. Sanitizzazione e Type-Safety Input
    const body = (req.body ?? {}) as ExtractDocumentRequestBody;
    const storagePathRaw = typeof body.storagePath === "string" ? body.storagePath.trim() : "";
    
    if (!storagePathRaw) {
      res.status(400).json({ error: "Bad Request: Percorso del file (storagePath) mancante o invalido." });
      return;
    }

    // 3. Logica Auth Condivisa (OAuth token o Bearer standard)
    let uid = "";
    const authHeader = typeof req.headers.authorization === "string" ? req.headers.authorization : "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
    const isOpaqueOAuthToken = /^[a-f0-9]{64}$/.test(token);

    if (isOpaqueOAuthToken) {
      const tokenSnap = await db.collection("oauth_tokens").doc(token).get();

      if (!tokenSnap.exists) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const tokenData = tokenSnap.data();
      const expiresAt = tokenData?.expiresAt;

      if (
        typeof tokenData?.user !== "string" ||
        !tokenData.user ||
        !expiresAt ||
        typeof expiresAt.toDate !== "function"
      ) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      if (expiresAt.toDate() <= new Date()) {
        await tokenSnap.ref.delete().catch(() => {});
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      uid = tokenData.user;
    } else {
      try {
        await requireAppCheck(req);
        uid = await requireUidFromAuthHeader(req);
      } catch {
        console.warn("[JURIO-EXTRACT] Fallimento Auth/AppCheck");
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
    }

    if (!uid) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    // 4. Path Traversal Protection
    const safeStoragePath = storagePathRaw.replace(/\.\./g, "");

    // 5. Controllo utente e validazione unificata piano/limiti (feature "extract_document")
    const userSnap = await db.collection("register").doc(uid).get();
    if (!userSnap.exists) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    await validateUserPlanAndLimits(uid, "extract_document", userSnap);

    // 6. Estrazione Documento da Storage
    const storage = getAdminStorage();
    const bucket = storage.bucket();
    const file = bucket.file(safeStoragePath);

    const [exists] = await file.exists();
    if (!exists) {
      res.status(404).json({ error: "Not Found: Il file non esiste nello storage." });
      return;
    }

    const [metadata] = await file.getMetadata();
    const fileSize = Number(metadata.size || 0);
    
    if (fileSize > 30 * 1024 * 1024) {
      res.status(413).json({ error: "Payload Too Large: Il file supera la dimensione massima consentita di 30MB." });
      return;
    }

    const [buffer] = await file.download();
    
    // Estrazione testo tramite pdf-extraction
    const pdfData = await pdfExtract(buffer);
    let cleanedText = typeof pdfData?.text === "string" ? pdfData.text : "";

    // Pulizia testuale standardizzata
    cleanedText = cleanedText
      .replace(/([^\n])\n(?=[^\n])/g, "\$1 ")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s*\n\s*\n/g, "\n\n")
      .trim();

    // 7. Risposta al Client
    res.status(200).json({ 
      success: true,
      text: cleanedText,
      pages: typeof pdfData?.numpages === "number" ? pdfData.numpages : 1
    });

  } catch (err: unknown) {
    logSafeError("DOCUMENT_TEXT_EXTRACTION_FAILED", err);
    
    res.status(500).json({ 
      error: "Internal Server Error"
    });
  }
}