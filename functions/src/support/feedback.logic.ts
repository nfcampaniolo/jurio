import { Request, Response } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { withSecureApiEndpoint, validateUserPlanAndLimits } from "../_utils";
import { getDb } from "../_deps";

const db = getDb();

interface SubmitFeedbackRequestBody {
  isThumbsUp?: unknown;
  notes?: unknown;
  ids?: unknown;
}

const MAX_NOTES_CHARS = 2000;

export async function executeSubmitFeedback(req: Request, res: Response): Promise<any> {
  return withSecureApiEndpoint(req, res, async (uid): Promise<void> => {
    // 1. Verifica utente nel DB e validazione unificata piano/limiti (feature "feedback")
    const userSnap = await db.collection("register").doc(uid).get();
    if (!userSnap.exists) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    await validateUserPlanAndLimits(uid, "feedback", userSnap);
    
    // 2. Sanitizzazione e Type-Safety Input
    const body = (req.body ?? {}) as SubmitFeedbackRequestBody;
    
    const isThumbsUp = typeof body.isThumbsUp === "boolean" ? body.isThumbsUp : null;
    if (isThumbsUp === null) {
      res.status(400).json({ error: "Bad Request: Missing or invalid 'isThumbsUp'" });
      return;
    }

    // Troncamento delle note per evitare storage abuse nei reclami
    const rawNotes = typeof body.notes === "string" ? body.notes.trim() : "";
    const MAX_SAFE_NOTES = typeof MAX_NOTES_CHARS === "number" ? MAX_NOTES_CHARS : 2000;
    
    if (rawNotes.length > MAX_SAFE_NOTES) {
      res.status(413).json({ error: "Payload Too Large: Notes length exceeds maximum limit" });
      return;
    }

    const notes = rawNotes.substring(0, MAX_SAFE_NOTES); 
    
    // Pulizia degli ID in arrivo
    const rawIds = Array.isArray(body.ids) ? body.ids : [];
    
    // Protezione DB: max 30 ID processabili in una singola richiesta
    if (rawIds.length > 30) {
      res.status(400).json({ error: "Bad Request: Too many IDs provided in a single request (Max 30)." });
      return;
    }

    // Sanitizziamo gli ID (max 300 caratteri in caso siano URL completi)
    const ids = rawIds
      .filter(id => typeof id === "string")
      .map(id => (id as string).trim().substring(0, 300))
      .filter(id => id.length > 0);
    
    if (ids.length === 0) {
      res.status(200).json({ success: true, message: "Nessun ID valido fornito." });
      return;
    }

    // 3. Logica Feedback Positivo
    if (isThumbsUp) {
      const validDbIds = ids.filter(id => !id.includes("/") && /^[a-zA-Z0-9_-]+\$/.test(id));
      
      if (validDbIds.length === 0) {
        res.status(200).json({ success: true, message: "Feedback ignorato: IDs non validi o link esterni." });
        return;
      }

      const refs = validDbIds.map(id => db.collection("sentences").doc(id));
      const snaps = await db.getAll(...refs);
      const batch = db.batch();
      
      let updatedCount = 0;
      snaps.forEach(snap => {
        if (snap.exists) {
          batch.update(snap.ref, { feedbacks: FieldValue.increment(1) });
          updatedCount++;
        }
      });

      if (updatedCount > 0) {
        await batch.commit();
      }

      res.status(200).json({ success: true, message: `Feedback positivo registrato per ${updatedCount} documenti.` });
      return;
    } 
    
    // 4. Logica Feedback Negativo (Reclamo)
    else {
      await db.collection("complaints").add({
        uid: uid,
        urls: ids, 
        reason: notes,    
        status: "pending",  
        createdAt: FieldValue.serverTimestamp()
      });

      res.status(200).json({ success: true, message: "Reclamo registrato con successo." });
      return;
    }
  });
}