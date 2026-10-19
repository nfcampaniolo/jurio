import { onRequest } from "firebase-functions/v2/https";
import { Request, Response } from "express";
import { google } from "googleapis";
import { withSecureApiEndpoint, validateUserPlanAndLimits } from "../_utils";
import { getDb } from "../_deps";
import { CloudFilesListRequestBody, CloudFileDownloadRequestBody } from "./_interfaces";

const db = getDb();

// ============================================================================
// 1. LIST CLOUD FILES
// ============================================================================

export const listCloudFiles = onRequest(
  { 
    timeoutSeconds: 60, 
    memory: "1GiB",
  },
  async (req, res) => {
    return executeListCloudFiles(req, res);
  }
);

export async function executeListCloudFiles(req: Request, res: Response): Promise<any> {
  return withSecureApiEndpoint(req, res, async (uid): Promise<void> => {
    // A. Controllo utente e validazione unificata piano/limiti per feature "cloud_files"
    const userSnap = await db.collection("register").doc(uid).get();
    if (!userSnap.exists) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    await validateUserPlanAndLimits(uid, "cloud_files", userSnap);

    // B. Sanitizzazione e Type-Safety Input
    const body = (req.body ?? {}) as CloudFilesListRequestBody;
    const providerRaw = typeof body.provider === "string" ? body.provider.trim().toLowerCase() : "";
    const providerTokenRaw = typeof body.providerToken === "string" ? body.providerToken.trim() : "";

    if (!providerTokenRaw) {
      res.status(400).json({ error: "Bad Request: Token del cloud provider mancante o non valido." });
      return;
    }

    if (providerRaw !== "google" && providerRaw !== "microsoft") {
      res.status(400).json({ error: "Bad Request: Provider non supportato (usa 'google' o 'microsoft')." });
      return;
    }

    // C. Integrazione Google Drive
    if (providerRaw === "google") {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: providerTokenRaw });
      const drive = google.drive({ version: "v3", auth });

      const driveRes = await drive.files.list({
        q: "mimeType='application/pdf' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document'",
        pageSize: 50,
        fields: "files(id, name, mimeType, modifiedTime)",
      });

      res.status(200).json({ files: driveRes.data.files ?? [] });
      return;
    } 

    // D. Integrazione Microsoft OneDrive
    if (providerRaw === "microsoft") {
      const msRes = await fetch("https://graph.microsoft.com/v1.0/me/drive/root/search(q='.pdf')?select=id,name,file,lastModifiedDateTime,webUrl", {
        headers: { Authorization: `Bearer ${providerTokenRaw}` }
      });

      if (!msRes.ok) {
        console.warn(`[JURIO-CLOUD-LIST] Errore risposto da Microsoft Graph API: ${msRes.status}`);
        res.status(502).json({ error: "Bad Gateway: Errore durante la comunicazione con il provider Microsoft." });
        return;
      }

      const data = (await msRes.json()) as { value?: Array<any> };
      const files = (data.value || []).map((f: any) => ({
        id: typeof f.id === "string" ? f.id : "",
        name: typeof f.name === "string" ? f.name : "Senza nome",
        mimeType: f.file?.mimeType ?? "application/octet-stream",
        modifiedTime: f.lastModifiedDateTime ?? null,
        webUrl: typeof f.webUrl === "string" ? f.webUrl : ""
      }));

      res.status(200).json({ files });
      return;
    }
  });
}

// ============================================================================
// 2. DOWNLOAD CLOUD FILE
// ============================================================================

export const downloadCloudFile = onRequest(
  { 
    timeoutSeconds: 120, 
    memory: "1GiB",
  },
  async (req, res) => {
    return executeDownloadCloudFile(req, res);
  }
);

export async function executeDownloadCloudFile(req: Request, res: Response): Promise<any> {
  return withSecureApiEndpoint(req, res, async (uid): Promise<void> => {
    // A. Controllo utente e validazione unificata piano/limiti per feature "cloud_files"
    const userSnap = await db.collection("register").doc(uid).get();
    if (!userSnap.exists) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    await validateUserPlanAndLimits(uid, "cloud_files", userSnap);

    // B. Sanitizzazione e Type-Safety Input
    const body = (req.body ?? {}) as CloudFileDownloadRequestBody;
    const providerRaw = typeof body.provider === "string" ? body.provider.trim().toLowerCase() : "";
    const providerTokenRaw = typeof body.providerToken === "string" ? body.providerToken.trim() : "";
    const fileIdRaw = typeof body.fileId === "string" ? body.fileId.trim() : "";

    if (!providerTokenRaw || !fileIdRaw) {
      res.status(400).json({ error: "Bad Request: Parametri mancanti ('providerToken' o 'fileId')." });
      return;
    }

    if (providerRaw !== "google" && providerRaw !== "microsoft") {
      res.status(400).json({ error: "Bad Request: Provider non supportato (usa 'google' o 'microsoft')." });
      return;
    }

    const fileId = fileIdRaw.replace(/[^a-zA-Z0-9_.-]/g, "").substring(0, 250);
    if (!fileId) {
      res.status(400).json({ error: "Bad Request: Formato fileId non valido." });
      return;
    }

    // C. Download da Google Drive
    if (providerRaw === "google") {
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: providerTokenRaw });
      const drive = google.drive({ version: "v3", auth });

      const driveRes = await drive.files.get(
        { fileId, alt: "media" },
        { responseType: "arraybuffer" }
      );

      const contentType = typeof driveRes.headers["content-type"] === "string" 
        ? driveRes.headers["content-type"] 
        : "application/pdf";

      res.setHeader("Content-Type", contentType);
      res.send(Buffer.from(driveRes.data as ArrayBuffer));
      return;
    } 

    // D. Download da Microsoft OneDrive
    if (providerRaw === "microsoft") {
      const msRes = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`, {
        headers: { Authorization: `Bearer ${providerTokenRaw}` }
      });

      if (!msRes.ok) {
        console.warn(`[JURIO-CLOUD-DOWNLOAD] Errore risposto da Microsoft Graph API per file ${fileId}: ${msRes.status}`);
        res.status(502).json({ error: "Bad Gateway: Impossibile scaricare il file da Microsoft." });
        return;
      }

      const arrayBuffer = await msRes.arrayBuffer();
      const contentType = msRes.headers.get("content-type") || "application/pdf";

      res.setHeader("Content-Type", contentType);
      res.send(Buffer.from(arrayBuffer));
      return;
    }
  });
}