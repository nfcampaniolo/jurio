import { Request, Response } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { withSecureApiEndpoint } from "../_utils";
import { requireAdminUser, runCleanupDuplicates, runUpdateFonte, runUpdateMetadata } from "./_helper";
import { MaintenanceTaskBody, ProgressCallback, MergeCategoryRequestBody, ManualContentRequestBody, AdminNotificationRequestBody } from "./_interfaces";
import { dispatchMailAndNotification } from "../email/_helper";
import { NotificationType } from "../email/_interfaces";
import { getDb } from "../_deps";
import { logSafeError } from "../_logging";

const db = getDb();

export async function executeAdminMaintenanceTask(req: Request, res: Response): Promise<void> {
  return withSecureApiEndpoint(req, res, async (uid): Promise<void> => {
    if (!(await requireAdminUser(uid, res, "JURIO-ADMIN"))) return;

    // 3. Preparazione Server-Sent Events (SSE)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    // Callback SSE Tipizzata e Sicura
    const sendSseProgress: ProgressCallback = (msg, data) => {
      try {
        if (!res.writableEnded) {
          res.write(`data: ${JSON.stringify({ message: msg, ...data })}\n\n`);
        }
      } catch (e) {
        logSafeError("ADMIN_PROGRESS_SERIALIZATION_FAILED", e);
      }
    };

    const body = (req.body ?? {}) as MaintenanceTaskBody;

    sendSseProgress("Avvio procedura di manutenzione generale", { status: "started" });

    // 4. Esecuzione Task (Prima fase: Aggiornamento)
    sendSseProgress("Avvio aggiornamento fonti e metadati in corso...", { status: "updating" });

    const [resultFonte, resultMetadata] = await Promise.all([
      runUpdateFonte(body, sendSseProgress),
      runUpdateMetadata(sendSseProgress)
    ]);

    sendSseProgress("Aggiornamento completato. Avvio verifica duplicati...", { status: "updating_completed" });

    // 5. Rilevamento ed eliminazione duplicati dal DB (Seconda fase: Pulizia)
    const resultCleanup = await runCleanupDuplicates(sendSseProgress);

    // 6. Chiusura stream con statistiche trasmesse al client
    sendSseProgress("Tutte le operazioni completate con successo", { 
      status: "completed", 
      finalStats: { 
        fontiAggiornate: resultFonte?.updatedSentences || 0, 
        documentiScansionati: resultMetadata?.scanned || 0,
        recordDuplicatiEliminatiDalDb: resultCleanup?.deletedCount || 0
      }
    });

    if (!res.writableEnded) {
      res.write(`data: [DONE]\n\n`);
      res.end();
    }
  });
}

export async function executeAdminMergeCategoryTask(req: Request, res: Response): Promise<void> {
  return withSecureApiEndpoint(req, res, async (uid): Promise<void> => {
    if (!(await requireAdminUser(uid, res, "JURIO-MERGE"))) return;

    // 3. Sanitizzazione e Type-Safety Input
    const body = (req.body ?? {}) as MergeCategoryRequestBody;
    
    const inputVecchia = typeof body.vecchiaCategoria === "string" ? body.vecchiaCategoria : "";
    const inputNuova = typeof body.nuovaCategoria === "string" ? body.nuovaCategoria : "";

    if (!inputVecchia.trim()) {
      res.status(400).json({ error: "Bad Request: 'vecchiaCategoria' obbligatoria." });
      return;
    }

    // Prevenzione saturazione e iniezioni di stringhe kilometriche come categorie
    const vecchiaOriginale = inputVecchia.trim().substring(0, 100);
    const nuovaOriginale = inputNuova.trim().substring(0, 100);
    const isSostituzione = nuovaOriginale.length > 0;
    
    const bulkWriter = db.bulkWriter();
    let updatedCount = 0;

    // 4. Query Bulk Sentenze
    const sentenzeQuery = db.collection("sentences").where("sottocategoria", "array-contains", vecchiaOriginale);
    const snap = await sentenzeQuery.get();

    for (const d of snap.docs) {
      const data = d.data();
      const arrayAttuale = Array.isArray(data.sottocategoria) ? data.sottocategoria : [];
      
      // Rimuoviamo la vecchia categoria
      const nuovoArray = arrayAttuale.filter(c => typeof c === 'string' && c.trim() !== vecchiaOriginale);
      
      // Se stiamo unificando, aggiungiamo la nuova categoria senza duplicare
      if (isSostituzione) {
        const giaPresente = nuovoArray.some(c => typeof c === 'string' && c.trim() === nuovaOriginale);
        if (!giaPresente) {
          nuovoArray.push(nuovaOriginale);
        }
      }

      void bulkWriter.update(d.ref, { sottocategoria: nuovoArray });
      updatedCount++;
    }

    // 5. Aggiornamento Taxonomy (Sottoraccolte)
    const taxSubcatsRef = db.collection('meta').doc('taxonomy').collection('sottocategorie');
    
    // A) Eliminiamo SEMPRE la vecchia categoria dalla taxonomy
    const checkVecchia = await taxSubcatsRef.where('nome', '==', vecchiaOriginale).limit(1).get();
    if (!checkVecchia.empty) {
      checkVecchia.docs.forEach(doc => bulkWriter.delete(doc.ref));
    }

    // B) Gestiamo la nuova categoria (solo se c'è stata una sostituzione E se abbiamo aggiornato sentenze)
    if (isSostituzione && updatedCount > 0) {
      const checkNuova = await taxSubcatsRef.where('nome', '==', nuovaOriginale).limit(1).get();
      if (checkNuova.empty) {
        void bulkWriter.set(taxSubcatsRef.doc(), { nome: nuovaOriginale, sentences: updatedCount });
      } else {
        void bulkWriter.update(checkNuova.docs[0].ref, { sentences: FieldValue.increment(updatedCount) });
      }
    }

    // 6. Pulizia UI e Chiusura Writer
    void bulkWriter.update(db.collection('meta').doc('taxonomy'), {
      sottocategorie_superflue: FieldValue.arrayRemove(vecchiaOriginale)
    });

    await bulkWriter.close();
    
    // 7. Risposta sicura al client
    const azioneMsg = isSostituzione ? "Sostituzione e unificazione" : "Eliminazione";
    res.status(200).json({ 
      success: true, 
      message: `${azioneMsg} completata. Modificate ${updatedCount} sentenze.` 
    });
  });
}

export async function executeAdminUploadManualContentTask(req: Request, res: Response): Promise<void> {
  return withSecureApiEndpoint(req, res, async (uid): Promise<void> => {
    if (!(await requireAdminUser(uid, res, "JURIO-MANUAL"))) return;

    // 3. Estrazione e sanitizzazione payload
    const body = (req.body ?? {}) as ManualContentRequestBody;
    
    const idRaw = typeof body.id === "string" ? body.id : "";
    const textRaw = typeof body.text === "string" ? body.text : "";
    const imagesRaw = typeof body.images === "string" ? body.images : "";
    const linksRaw = Array.isArray(body.links) ? body.links : [];

    // Validazione formale
    if (!idRaw.trim()) {
      res.status(400).json({ error: "Bad Request: Il parametro 'id' è obbligatorio." });
      return;
    }
    if (!textRaw.trim()) {
      res.status(400).json({ error: "Bad Request: Il parametro 'text' è obbligatorio." });
      return;
    }
    if (linksRaw.length === 0) {
      res.status(400).json({ error: "Bad Request: Il parametro 'links' deve contenere almeno un link." });
      return;
    }
    if (!imagesRaw.trim()) {
      res.status(400).json({ error: "Bad Request: Il parametro 'images' è obbligatorio." });
      return;
    }

    // Troncamento di sicurezza e pulizia
    const cleanId = idRaw.replace(/[^a-zA-Z0-9_-]/g, "").trim().substring(0, 100);
    const cleanText = textRaw.trim().substring(0, 30000);
    const cleanImages = imagesRaw.trim().substring(0, 1000); 
    
    const cleanLinks = linksRaw
      .filter(l => typeof l === "string" && l.trim().length > 0)
      .slice(0, 50)
      .map(l => (l as string).trim().substring(0, 500));

    if (!cleanId) {
      res.status(400).json({ error: "Bad Request: Formato 'id' non valido." });
      return;
    }

    // 4. Scrittura su Firestore
    const docRef = db.collection("manual").doc(cleanId);
    
    await docRef.set({
      text: cleanText,
      links: cleanLinks,
      images: cleanImages,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      authorId: uid 
    });

    // 5. Risposta al client
    res.status(200).json({ 
      success: true, 
      message: `Documento '${cleanId}' salvato correttamente.` 
    });
  });
}

export async function executeSendAdminNotification(req: Request, res: Response): Promise<void> {
  return withSecureApiEndpoint(req, res, async (adminUid): Promise<void> => {
    if (!(await requireAdminUser(adminUid, res, "JURIO-NOTIF"))) return;

    // 3. Sanitizzazione e Type-Safety del payload
    const body = (req.body ?? {}) as AdminNotificationRequestBody;

    const targetMode = typeof body.targetMode === "string" ? body.targetMode.trim() : "";
    const consentFilter = typeof body.consentFilter === "string" ? body.consentFilter.trim() : "";
    const targetUid = typeof body.uid === "string" ? body.uid.trim().substring(0, 100) : "";
    
    const sendInApp = typeof body.sendInApp === "boolean" ? body.sendInApp : false;
    const sendEmail = typeof body.sendEmail === "boolean" ? body.sendEmail : false;

    // Limiti rigidi sui contenuti per evitare Memory Exhaustion
    const title = typeof body.title === "string" ? body.title.trim().substring(0, 150) : "";
    const message = typeof body.message === "string" ? body.message.trim().substring(0, 2000) : "";
    const emailHtml = typeof body.emailHtml === "string" ? body.emailHtml.trim().substring(0, 100000) : "";
    const link = typeof body.link === "string" ? body.link.trim().substring(0, 500) : "";
    const type = typeof body.type === "string" ? body.type.trim().substring(0, 50) : "info";

    // Validazioni base
    if (!targetMode || !title) {
      res.status(400).json({ error: "Bad Request: Parametri 'targetMode' o 'title' mancanti." });
      return;
    }

    if (!sendInApp && !sendEmail) {
      res.status(400).json({ error: "Bad Request: Nessun canale di invio selezionato." });
      return;
    }

    const targetEmails: string[] = [];
    let targetUids: string[] = [];
    let useGlobalBroadcast = false;

    // 4. Identificazione destinatari (Collection "users")
    if (targetMode === "single") {
      if (!targetUid) {
        res.status(400).json({ error: "Bad Request: UID mancante per target singolo." });
        return;
      }
      targetUids.push(targetUid);
      
      if (sendEmail) {
        const uDoc = await db.collection("users").doc(targetUid).get();
        if (uDoc.exists && uDoc.data()?.email) {
          targetEmails.push(uDoc.data()!.email);
        }
      }
    } else if (targetMode === "broadcast") {
      let usersQuery: FirebaseFirestore.Query = db.collection("users");
      
      if (consentFilter === "comms") {
        usersQuery = usersQuery.where("consents.comms", "==", true);
      } else if (consentFilter === "marketing") {
        usersQuery = usersQuery.where("consents.marketing", "==", true);
      } else {
        useGlobalBroadcast = true;
      }

      const usersSnap = await usersQuery.get();
      usersSnap.forEach(doc => {
        const data = doc.data();
        targetUids.push(doc.id);
        if (sendEmail && data.email && typeof data.email === "string") {
          targetEmails.push(data.email);
        }
      });
    }

    // 5. Esecuzione Scritture e Invio a Chunk
    
    // Ottimizzazione Broadcast Globale per In-App
    if (sendInApp && useGlobalBroadcast && targetMode === "broadcast") {
      await db.collection("broadcast").add({
        title,
        message,
        type,
        link,
        createdAt: FieldValue.serverTimestamp(),
      });
      // Svuotiamo gli UID per evitare di creare N documenti inutili in "notification"
      targetUids = []; 
    }

    // Gestione a CHUNK (max 300 per rispettare i limiti delle batch ops)
    const CHUNK_SIZE = 300; 
    const maxLen = Math.max(targetEmails.length, targetUids.length);

    for (let i = 0; i < maxLen; i += CHUNK_SIZE) {
      const chunkEmails = targetEmails.slice(i, i + CHUNK_SIZE);
      const chunkUids = targetUids.slice(i, i + CHUNK_SIZE);

      const notifications = sendInApp && chunkUids.length > 0
        ? chunkUids.map(u => ({
            user: u,
            title,
            message,
            type: type as NotificationType,
            link,
          }))
        : undefined;

      const toAddress = sendEmail && chunkEmails.length === 1 ? chunkEmails[0] : undefined;
      const bccAddresses = sendEmail && chunkEmails.length > 1 ? chunkEmails : undefined;

      await dispatchMailAndNotification({
        to: toAddress,
        bcc: bccAddresses,
        subject: title,
        html: sendEmail ? emailHtml : "", 
        notifications: notifications,
      });
    }

    // 6. Risposta al Client
    res.status(200).json({ 
      success: true, 
      message: `Elaborazione completata. Destinatari identificati: ${Math.max(targetEmails.length, targetUids.length)}.` 
    });
  });
}
