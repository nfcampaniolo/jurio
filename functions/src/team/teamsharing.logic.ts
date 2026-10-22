import { Request, Response } from "express";
import { withSecureApiEndpoint } from "../_utils";
import { getDb } from "../_deps";
import { VerifyVoucherRequestBody, VerifyVoucherResponse, SendTeamInviteEmailRequestBody, SendTeamInviteEmailResponse } from "./_interfaces";
import { enqueueVoucherEmail } from "../email/team/logic";
import { validateTeamUser } from "./_utils";

const db = getDb();

export async function executeVerifyVoucher(req: Request, res: Response): Promise<any> {
  return withSecureApiEndpoint(req, res, async (uid): Promise<void> => {
    if (!(await validateTeamUser(uid, res))) return;

    // 2. Sanitizzazione e Type-Safety Input
    const body = (req.body ?? {}) as VerifyVoucherRequestBody;
    const voucherRaw = typeof body.voucher === "string" ? body.voucher : "";

    // Normalizzazione e sanitizzazione rigorosa del voucher
    const cleanVoucher = voucherRaw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").substring(0, 50);

    if (!cleanVoucher) {
      res.status(400).json({ error: "Bad Request: Missing or invalid 'voucher'" });
      return;
    }

    // 3. Ricerca nella collection 'teams'
    const teamsSnap = await db.collection("teams").get();
    
    const matchedTeams: Array<{ id: string; name: string }> = [];

    teamsSnap.forEach((doc) => {
      const data = doc.data() ?? {};
      const teamVouchers = Array.isArray(data.vouchers) ? data.vouchers : [];
      
      const hasFreeVoucher = teamVouchers.some(
        (v: any) => v && typeof v === "object" && v.id === cleanVoucher && v.used === false
      );

      if (hasFreeVoucher) {
        const teamName = typeof data.name === "string" && data.name.trim() ? data.name.trim() : "Workspace senza nome";
        matchedTeams.push({
          id: doc.id,
          name: teamName
        });
      }
    });

    // 4. Risposta al Client
    const responsePayload: VerifyVoucherResponse = { 
      success: true, 
      teams: matchedTeams 
    };

    res.status(200).json(responsePayload);
  });
}

export async function executeSendTeamInviteEmail(req: Request, res: Response): Promise<any> {
  return withSecureApiEndpoint(req, res, async (callerUid): Promise<void> => {
    if (!(await validateTeamUser(callerUid, res))) return;

    // 2. Sanitizzazione e Type-Safety Input
    const body = (req.body ?? {}) as SendTeamInviteEmailRequestBody;
    
    const teamIdRaw = typeof body.teamId === "string" ? body.teamId : "";
    const emailRaw = typeof body.email === "string" ? body.email : "";
    const voucherRaw = typeof body.voucher === "string" ? body.voucher : "";

    const teamId = teamIdRaw.trim().replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 100);
    const voucher = voucherRaw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").substring(0, 50);

    if (!teamId) {
      res.status(400).json({ error: "Bad Request: Missing or invalid 'teamId'" });
      return;
    }
    if (!emailRaw.trim()) {
      res.status(400).json({ error: "Bad Request: Missing or invalid 'email'" });
      return;
    }
    if (!voucher) {
      res.status(400).json({ error: "Bad Request: Missing or invalid 'voucher'" });
      return;
    }

    const targetEmail = emailRaw.trim().toLowerCase().substring(0, 254);

    // 3. Lettura Team e Controlli di Accesso
    const teamRef = db.collection("teams").doc(teamId);
    const teamSnap = await teamRef.get();

    if (!teamSnap.exists) {
      res.status(404).json({ error: "Not Found: Team non trovato" });
      return;
    }

    const teamData = teamSnap.data() as Record<string, any>;

    // A. Verifica permessi (Owner o Co-owner)
    const owners = Array.isArray(teamData.owners) ? teamData.owners : [];
    const coOwners = Array.isArray(teamData.co_owners) ? teamData.co_owners : [];
    
    const isOwner = owners.includes(callerUid);
    const isCoOwner = coOwners.includes(callerUid);
    
    if (!isOwner && !isCoOwner) {
      res.status(403).json({ error: "Forbidden: Solo i proprietari o co-proprietari possono inviare inviti" });
      return;
    }

    // B. Controllo validità e disponibilità del voucher nel team
    const vouchers = Array.isArray(teamData.vouchers) ? teamData.vouchers : [];
    const voucherIndex = vouchers.findIndex((v: any) => v && v.id === voucher && v.used === false);

    if (voucherIndex === -1) {
      res.status(409).json({ error: "Conflict: Il codice invito fornito non è valido o è già stato utilizzato" });
      return;
    }

    const teamNameStr = typeof teamData.name === "string" ? teamData.name : "un Workspace";

    // 4. Accodamento Email
    await enqueueVoucherEmail({
      email: targetEmail,
      voucherCode: voucher,
      teamName: teamNameStr
    });

    // 5. Risposta al Client
    const responsePayload: SendTeamInviteEmailResponse = { 
      success: true, 
      message: "Email di invito accodata con successo",
      email: targetEmail
    };

    res.status(200).json(responsePayload);
  });
}