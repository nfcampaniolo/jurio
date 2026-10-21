import { Request, Response } from "express";
import { FieldValue, WriteBatch, Query } from "firebase-admin/firestore";
import { withSecureApiEndpoint, validateUserPlanAndLimits } from "../_utils";
import { updateUserDocuments, removeUserVisibilityFromDocuments } from "./_utils";
import { getDb } from "../_deps";
import { DeleteTeamRequestBody, DeleteTeamResponse, ShareAllTeamDocumentsRequestBody, ShareAllTeamDocumentsResponse } from "./_interfaces";
import { enqueueCloseTeamEmail } from "../email/team/logic";

const db = getDb();

export async function executeDeleteTeam(req: Request, res: Response): Promise<any> {
  return withSecureApiEndpoint(req, res, async (requesterUid): Promise<void> => {
    // 1. Verifica utente nel DB e validazione unificata piano/limiti (feature "teams")
    const userSnap = await db.collection("register").doc(requesterUid).get();
    if (!userSnap.exists) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    await validateUserPlanAndLimits(requesterUid, "teams", userSnap);

    // 2. Sanitizzazione e Type-Safety Input
    const body = (req.body ?? {}) as DeleteTeamRequestBody;
    
    const teamIdRaw = typeof body.teamId === "string" ? body.teamId : "";
    const revokeDocumentAccess = typeof body.revokeDocumentAccess === "boolean" ? body.revokeDocumentAccess : false;

    const teamId = teamIdRaw.trim().replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 100);

    if (!teamId) {
      res.status(400).json({ error: "Bad Request: Missing or invalid 'teamId'" });
      return;
    }

    // 3. Verifica Team e Permessi (Solo gli owner possono cancellare il team)
    const teamRef = db.collection("teams").doc(teamId);
    const teamSnap = await teamRef.get();

    if (!teamSnap.exists) {
      res.status(404).json({ error: "Not Found: Team non trovato" });
      return;
    }

    const teamData = teamSnap.data() as Record<string, any>;
    const owners = Array.isArray(teamData.owners) ? teamData.owners : [];

    if (!owners.includes(requesterUid)) {
      res.status(403).json({ error: "Forbidden: Only team owners can delete the team" });
      return;
    }

    // 4. Recupero membri ed email
    const membersSnap = await teamRef.collection("members").get();
    const allMemberIds = membersSnap.docs
      .map(doc => doc.id)
      .filter(id => typeof id === "string" && id.trim().length > 0);
      
    const allMemberEmails = membersSnap.docs
      .map(doc => doc.data()?.email)
      .filter((email): email is string => typeof email === "string" && email.trim().length > 0);

    const membersToReassign = allMemberIds.filter(id => id !== requesterUid);
    
    // 5. Riassegnazione o rimozione visibilità documenti
    const reassignPromises = membersToReassign.map(async (memberId) => {
      if (revokeDocumentAccess === true) {
         await updateUserDocuments(memberId, requesterUid);
      }
      await removeUserVisibilityFromDocuments(memberId); 
    });
    await Promise.all(reassignPromises);

    // 6. Costruzione Batch Multipli (Gestione limite 500 operazioni per batch di Firestore)
    const batches: WriteBatch[] = [];
    let currentBatch = db.batch();
    let operationCount = 0;

    const incrementBatch = () => {
      operationCount++;
      if (operationCount === 500) {
        batches.push(currentBatch);
        currentBatch = db.batch();
        operationCount = 0;
      }
    };

    // A) Pulizia profili utente e register dei membri
    for (const memberId of allMemberIds) {
      const userRef = db.collection("users").doc(memberId);
      currentBatch.update(userRef, {
        assignedTeamId: FieldValue.delete()
      });
      
      const regRef = db.collection("register").doc(memberId);
      currentBatch.update(regRef, { 
        assignedTeamId: FieldValue.delete(),
        provider: FieldValue.delete()
      });
      
      incrementBatch();
    }

    // B) Cancellazione documenti sub-collection members
    membersSnap.docs.forEach(docSnap => {
      currentBatch.delete(docSnap.ref);
      incrementBatch();
    });

    // C) Cancellazione documento principale del team
    currentBatch.delete(teamRef);
    incrementBatch();

    if (operationCount > 0) {
      batches.push(currentBatch);
    }

    // Esecuzione parallela dei batch di Firestore
    await Promise.all(batches.map(batch => batch.commit()));

    // 7. Notifica massiva di chiusura team
    if (allMemberEmails.length > 0) {
      const teamNameStr = typeof teamData.name === "string" ? teamData.name : "Workspace";
      void enqueueCloseTeamEmail({ 
        email: allMemberEmails, 
        teamName: teamNameStr 
      }).catch(mailErr => {
        console.error(`[JURIO-DELETE-TEAM] Errore nell'invio delle email di chiusura team:`, mailErr);
      });
    }

    // 8. Risposta al Client
    const responsePayload: DeleteTeamResponse = { 
      success: true, 
      message: "Team deleted successfully and documents reassigned" 
    };

    res.status(200).json(responsePayload);
  });
}

export async function executeShareAllTeamDocuments(req: Request, res: Response): Promise<any> {
  return withSecureApiEndpoint(req, res, async (callerUid): Promise<void> => {
    // 1. Verifica utente nel DB e validazione unificata piano/limiti (feature "teams")
    const userSnap = await db.collection("register").doc(callerUid).get();
    if (!userSnap.exists) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    await validateUserPlanAndLimits(callerUid, "teams", userSnap);

    // 2. Sanitizzazione e Type-Safety Input
    const body = (req.body ?? {}) as ShareAllTeamDocumentsRequestBody;
    const teamIdRaw = typeof body.teamId === "string" ? body.teamId : "";
    
    const teamId = teamIdRaw.trim().replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 100);

    if (!teamId) {
      res.status(400).json({ error: "Bad Request: Missing or invalid 'teamId'" });
      return;
    }

    // 3. Lettura Team e Controlli di Accesso
    const teamRef = db.collection("teams").doc(teamId);
    const teamSnap = await teamRef.get();

    if (!teamSnap.exists) {
      res.status(404).json({ error: "Not Found: Team non trovato" });
      return;
    }

    const teamData = teamSnap.data() as Record<string, any>;
    const owners = Array.isArray(teamData.owners) ? teamData.owners : [];
    const coOwners = Array.isArray(teamData.co_owners) ? teamData.co_owners : [];

    const isOwner = owners.includes(callerUid);
    const isCoOwner = coOwners.includes(callerUid);
    
    if (!isOwner && !isCoOwner) {
      res.status(403).json({ error: "Forbidden: Solo i manager possono forzare la condivisione dello storico" });
      return;
    }

    // 4. Recupero Membri del Team
    const membersSnap = await teamRef.collection("members").get();
    const memberIds = membersSnap.docs
      .map(doc => doc.id)
      .filter(id => typeof id === "string" && id.trim().length > 0);

    if (memberIds.length === 0) {
      const emptyPayload: ShareAllTeamDocumentsResponse = { 
        success: true, 
        updatedCount: 0, 
        message: "Nessun membro nel team" 
      };
      res.status(200).json(emptyPayload);
      return;
    }

    const bulkWriter = db.bulkWriter();
    let updatedCount = 0;

    const updateData = {
      visibleTo: FieldValue.arrayUnion(...memberIds)
    };

    const queueUpdates = async (query: Query) => {
      const snap = await query.get();
      snap.docs.forEach((doc) => {
        void bulkWriter.update(doc.ref, updateData);
        updatedCount++;
      });
    };

    // 5. Esecuzione Query Multiple e Aggiornamento Bulk
    for (const uid of memberIds) {
      await Promise.all([
        queueUpdates(db.collection("documents").where("user", "==", uid)),
        queueUpdates(db.collection("document_chunks").where("user", "==", uid)),
        queueUpdates(db.collection("fascicoli").where("user", "==", uid))
      ]);
    }

    await bulkWriter.close();

    // 6. Risposta al Client
    const responsePayload: ShareAllTeamDocumentsResponse = { 
      success: true, 
      updatedCount,
      message: "Storico condiviso con successo" 
    };

    res.status(200).json(responsePayload);
  });
}