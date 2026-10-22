import { Request, Response } from "express";
import { withSecureApiEndpoint } from "../_utils";
import { getDb, getAdminAuth, getAdmin } from "../_deps";
import { FieldValue } from "firebase-admin/firestore";
import { AssignTeamSeatRequestBody, AssignTeamSeatResponse,  RemoveTeamMemberRequestBody, RemoveTeamMemberResponse } from "./_interfaces";
import { enqueueWelcomeTeamEmail, enqueueRemoveTeamEmail } from "../email/team/logic";
import { updateUserDocuments, removeUserVisibilityFromDocuments, validateTeamUser } from "./_utils";
import { logSafeError } from "../_logging";

const db = getDb();
const admin = getAdmin();

export async function executeAssignTeamSeat(req: Request, res: Response): Promise<any> {
  return withSecureApiEndpoint(req, res, async (callerUid): Promise<void> => {
    if (!(await validateTeamUser(callerUid, res))) return;

    // 2. Sanitizzazione e Type-Safety Input
    const body = (req.body ?? {}) as AssignTeamSeatRequestBody;
    
    const teamIdRaw = typeof body.teamId === "string" ? body.teamId : "";
    const emailRaw = typeof body.email === "string" ? body.email : "";
    const voucherRaw = typeof body.voucher === "string" ? body.voucher : "";

    const teamId = teamIdRaw.trim().replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 100);

    if (!teamId) {
      res.status(400).json({ error: "Bad Request: Missing or invalid 'teamId'" });
      return;
    }

    if (!emailRaw && !voucherRaw) {
      res.status(400).json({ error: "Bad Request: Devi fornire 'email' o 'voucher'" });
      return;
    }

    const cleanVoucher = voucherRaw ? voucherRaw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").substring(0, 50) : "";
    const isInviteFlow = !!emailRaw.trim();
    let targetUid: string;
    let targetEmail: string;

    // 3. Determinazione UID ed Email (Con controllo preventivo su Firebase Auth)
    if (isInviteFlow) {
      targetEmail = emailRaw.trim().toLowerCase().substring(0, 254);
      try {
        const userRecord = await getAdminAuth().getUserByEmail(targetEmail);
        targetUid = userRecord.uid;
      } catch (err: any) {
        if (err?.code === 'auth/user-not-found') {
          res.status(404).json({ errorCode: "user-not-found", error: "L'utente non è ancora registrato." });
          return;
        }
        throw err;
      }
    } else {
      targetUid = callerUid;
      const userRecord = await getAdminAuth().getUser(callerUid);
      targetEmail = typeof userRecord.email === "string" ? userRecord.email : ""; 
    }

    // 4. Transazione Atomica su Firestore
    const out = await db.runTransaction(async (tx) => {
      const teamRef = db.collection("teams").doc(teamId);
      const registerRef = db.collection("register").doc(targetUid);

      const [teamSnap, registerSnap] = await Promise.all([
        tx.get(teamRef),
        tx.get(registerRef)
      ]);

      if (!teamSnap.exists) {
        throw new Error("NOT_FOUND: Team non trovato");
      }
      
      const teamData = teamSnap.data() as Record<string, any>;
      const registerData = registerSnap.exists ? registerSnap.data() : {};

      // Controllo permessi se è un flusso di invito
      if (isInviteFlow) {
        const owners = Array.isArray(teamData.owners) ? teamData.owners : [];
        const coOwners = Array.isArray(teamData.co_owners) ? teamData.co_owners : [];
        
        const isOwner = owners.includes(callerUid);
        const isCoOwner = coOwners.includes(callerUid);
        
        if (!isOwner && !isCoOwner) {
          throw new Error("FORBIDDEN: Solo i proprietari o co-proprietari possono assegnare i posti");
        }
      }

      const memberIds = Array.isArray(teamData.member_ids) ? teamData.member_ids : [];
      if (memberIds.includes(targetUid)) {
        throw new Error("CONFLICT: L'utente fa già parte del Workspace");
      }

      const isAlreadyBusiness = registerData?.planId === "business";
      const vouchers = Array.isArray(teamData.vouchers) ? teamData.vouchers : [];
      const updatedVouchers = [...vouchers];
      
      let grantBusiness = false;
      let expireTimestamp: any;
      const now = admin.firestore.Timestamp.now();

      if (isAlreadyBusiness) {
        expireTimestamp = registerData?.expire ?? admin.firestore.Timestamp.fromMillis(now.toMillis() + (365 * 24 * 60 * 60 * 1000));
        if (!isInviteFlow) {
          const vIndex = vouchers.findIndex((v: any) => v && v.id === cleanVoucher);
          if (vIndex === -1) {
            throw new Error("EXHAUSTED: Il voucher fornito non è valido o non appartiene a questo team");
          }
        }
      } else {
        let voucherIndex = -1;
        if (isInviteFlow) {
          voucherIndex = vouchers.findIndex((v: any) => v && v.used === false);
        } else {
          voucherIndex = vouchers.findIndex((v: any) => v && v.id === cleanVoucher && v.used === false); 
        }

        if (voucherIndex === -1) {
          if (isInviteFlow) {
            throw new Error("EXHAUSTED: Nessun posto disponibile nel team");
          } else {
            throw new Error("EXHAUSTED: Il voucher fornito è già stato utilizzato o non è valido");
          }
        }

        const usedVoucher = vouchers[voucherIndex];
        const durationDays = typeof usedVoucher.duration === "number" ? usedVoucher.duration : 365;

        updatedVouchers[voucherIndex] = {
          ...usedVoucher,
          used: true,
          assignedTo: targetUid,
          assignedAt: now
        };
        
        grantBusiness = true;
        expireTimestamp = admin.firestore.Timestamp.fromMillis(now.toMillis() + (durationDays * 24 * 60 * 60 * 1000));
      }

      // Scritture atomiche nel batch della transazione
      tx.update(teamRef, {
        vouchers: updatedVouchers,
        member_ids: admin.firestore.FieldValue.arrayUnion(targetUid) 
      });

      tx.set(teamRef.collection("members").doc(targetUid), {
        role: "editor",
        date_start: now,
        expire: expireTimestamp,
        email: targetEmail
      });

      const expireSec = Math.floor(expireTimestamp.toMillis() / 1000);
      
      tx.set(db.collection("users").doc(targetUid), { 
        status: "business",
        assignedTeamId: teamId 
      }, { merge: true });
      
      tx.set(registerRef, { 
        planId: "business",
        status: "active",
        provider: "team_invite",
        assignedTeamId: teamId,
        start: now,
        expire: expireTimestamp,
        expireSec,
        update: now
      }, { merge: true });

      const teamNameStr = typeof teamData.name === "string" ? teamData.name : "Workspace";

      return { 
        success: true, 
        targetUid, 
        targetEmail,
        teamName: teamNameStr,
        voucherUsed: grantBusiness 
      } as AssignTeamSeatResponse;
    });

    // 5. Effetti collaterali fuori transazione (Email di benvenuto team)
    if (out && out.targetEmail) {
      void enqueueWelcomeTeamEmail({ 
        email: out.targetEmail, 
        teamName: out.teamName 
      }).catch(mailErr => {
        logSafeError("TEAM_WELCOME_EMAIL_FAILED", mailErr);
      });
    }

    // 6. Risposta al Client
    res.status(200).json(out);
  });
}

export async function executeRemoveTeamMember(req: Request, res: Response): Promise<any> {
  return withSecureApiEndpoint(req, res, async (requesterUid): Promise<void> => {
    if (!(await validateTeamUser(requesterUid, res))) return;

    // 2. Sanitizzazione e Type-Safety Input
    const body = (req.body ?? {}) as RemoveTeamMemberRequestBody;
    
    const teamIdRaw = typeof body.teamId === "string" ? body.teamId : "";
    const uidDeleteRaw = typeof body.uidDelete === "string" ? body.uidDelete : "";
    const revokeDocumentAccess = typeof body.revokeDocumentAccess === "boolean" ? body.revokeDocumentAccess : false;

    const teamId = teamIdRaw.trim().replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 100);
    const uidDelete = uidDeleteRaw.trim().replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 100);

    if (!teamId || !uidDelete) {
      res.status(400).json({ error: "Bad Request: Missing or invalid 'teamId' or 'uidDelete'" });
      return;
    }

    // 3. Verifica Team e Permessi
    const teamRef = db.collection("teams").doc(teamId);
    const teamSnap = await teamRef.get();
    if (!teamSnap.exists) {
      res.status(404).json({ error: "Not Found: Team non trovato" });
      return;
    }

    const teamData = teamSnap.data() as Record<string, any>;
    const owners = Array.isArray(teamData.owners) ? teamData.owners : [];

    const isOwner = owners.includes(requesterUid); 
    const isSelfLeave = requesterUid === uidDelete;

    if (!isOwner && !isSelfLeave) {
      res.status(403).json({ error: "Forbidden: You don't have permission to remove this member" });
      return;
    }

    // Blocco di sicurezza fondamentale contro l'orphaning dei workspace
    if (isSelfLeave && owners.includes(uidDelete) && owners.length <= 1) {
      res.status(400).json({ error: "Bad Request: You cannot leave the workspace because you are the only owner left." });
      return;
    }

    // 4. Recupero dati membro (Email)
    const teamMemberRef = teamRef.collection("members").doc(uidDelete);
    const memberSnap = await teamMemberRef.get();
    const targetEmail = memberSnap.exists && typeof memberSnap.data()?.email === "string" 
      ? memberSnap.data()!.email 
      : undefined;

    // 5. Gestione accesso documenti
    if (revokeDocumentAccess === true) {
      const targetOwnerUid = isSelfLeave ? owners.find((id: string) => id !== uidDelete) : requesterUid;
      if (targetOwnerUid) {
        await updateUserDocuments(uidDelete, targetOwnerUid);
      }
    }
    await removeUserVisibilityFromDocuments(uidDelete);

    // 6. Commit del batch di cancellazione / aggiornamento
    const batch = db.batch();
    
    const userRef = db.collection("users").doc(uidDelete);
    batch.update(userRef, { 
      assignedTeamId: FieldValue.delete() 
    });
    
    const regRef = db.collection("register").doc(uidDelete);
    batch.update(regRef, { 
      assignedTeamId: FieldValue.delete(),
      provider: FieldValue.delete()
    });

    batch.update(teamRef, {
      member_ids: FieldValue.arrayRemove(uidDelete),
      owners: FieldValue.arrayRemove(uidDelete),
      co_owners: FieldValue.arrayRemove(uidDelete)
    });
    
    batch.delete(teamMemberRef);
    await batch.commit();

    // 7. Effetti collaterali (Invio email di rimozione se non è auto-uscita)
    if (targetEmail && !isSelfLeave) {
      const teamNameStr = typeof teamData.name === "string" ? teamData.name : "Workspace";
      void enqueueRemoveTeamEmail({ 
        email: targetEmail, 
        teamName: teamNameStr 
      }).catch(mailErr => {
        logSafeError("TEAM_MEMBER_REMOVAL_EMAIL_FAILED", mailErr);
      });
    }

    // 8. Risposta al Client
    const responsePayload: RemoveTeamMemberResponse = { 
      success: true, 
      message: "Team member removed successfully" 
    };

    res.status(200).json(responsePayload);
  });
}