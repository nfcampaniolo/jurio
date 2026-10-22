import {  generateVoucherInviteEmail, generateWelcomeEmailTeam, generateTeamClosureEmail, generateTeamRemovalEmail } from "./html"; 
import { getAdminAuth } from "../../_deps";
import { dispatchMailAndNotification } from "../_helper"
import { EnqueueTeamEmailArgs, NotificationPayload, EnqueueCloseTeamEmailArgs, EnqueueVoucherEmailArgs } from "../_interfaces";
import { logSafeInfo } from "../../_logging";

export async function enqueueVoucherEmail({ 
  email, 
  voucherCode, 
  teamName = "un Workspace" 
}: EnqueueVoucherEmailArgs): Promise<void> {
  
  if (!email || !voucherCode) {
    console.warn("VOUCHER_EMAIL_DATA_MISSING");
    return;
  }

  const subject = teamName && teamName !== "un Workspace"
    ? `Invito a unirti a ${teamName} su Jurio`
    : `Invito a unirti a un Workspace su Jurio`;

  const html = generateVoucherInviteEmail(voucherCode, teamName);

  const notifications: NotificationPayload[] = [];
  try {
    const userRecord = await getAdminAuth().getUserByEmail(email);
    notifications.push({
      uid: userRecord.uid,
      title: "Nuovo Invito",
      message: `Sei stato invitato a unirti a ${teamName}. Usa il codice ${voucherCode}.`,
      type: "team",
      link: "/profilo/team" // Aggiusta se hai una rotta specifica per il voucher
    });
  } catch (error) {
    logSafeInfo("TEAM_EMAIL_ENQUEUE_FAILED", error);
  }

  await dispatchMailAndNotification({
    to: email,
    subject,
    html,
    notifications: notifications.length > 0 ? notifications : undefined
  });
}

export async function enqueueWelcomeTeamEmail({ 
  email, 
  teamName = "Workspace" 
}: EnqueueTeamEmailArgs): Promise<void> {
  
  if (!email) return;

  const subject = teamName !== "Workspace"
    ? `Benvenuto in ${teamName} su Jurio`
    : `Benvenuto nel tuo nuovo Workspace su Jurio`;

  const html = generateWelcomeEmailTeam(teamName);

  const notifications: NotificationPayload[] = [];
  try {
    const userRecord = await getAdminAuth().getUserByEmail(email);
    notifications.push({
      uid: userRecord.uid,
      title: "Benvenuto nel Workspace!",
      message: `Ora fai parte del workspace ${teamName}.`,
      type: "team",
      link: "/profilo"
    });
  } catch (error) {}

  await dispatchMailAndNotification({
    to: email,
    subject,
    html,
    notifications: notifications.length > 0 ? notifications : undefined
  });
}

export async function enqueueRemoveTeamEmail({ 
  email, 
  teamName = "Workspace" 
}: EnqueueTeamEmailArgs): Promise<void> {
  
  if (!email) return;

  const subject = teamName !== "Workspace"
    ? `Aggiornamento sul tuo accesso a ${teamName}`
    : `Aggiornamento sul tuo accesso al Workspace`;

  const html = generateTeamRemovalEmail(teamName);

  const notifications: NotificationPayload[] = [];
  try {
    const userRecord = await getAdminAuth().getUserByEmail(email);
    notifications.push({
      uid: userRecord.uid,
      title: "Accesso revocato",
      message: `Non hai più accesso al workspace ${teamName}.`,
      type: "team"
    });
  } catch (error) {}

  await dispatchMailAndNotification({
    to: email,
    subject,
    html,
    notifications: notifications.length > 0 ? notifications : undefined
  });
}

export async function enqueueCloseTeamEmail({ 
  email, 
  teamName = "Workspace" 
}: EnqueueCloseTeamEmailArgs): Promise<void> {
  
  if (!email || (Array.isArray(email) && email.length === 0)) return;

  const emailsArray = Array.isArray(email) ? email : [email];

  const subject = teamName !== "Workspace"
    ? `Chiusura del workspace ${teamName}`
    : `Chiusura del Workspace su Jurio`;

  const html = generateTeamClosureEmail(teamName);

  // Recupera gli UID in parallelo ignorando chi non è registrato
  const notifications: NotificationPayload[] = [];
  await Promise.all(emailsArray.map(async (em) => {
    try {
      const userRecord = await getAdminAuth().getUserByEmail(em);
      notifications.push({
        uid: userRecord.uid,
        title: "Workspace Chiuso",
        message: `Il workspace ${teamName} è stato chiuso dall'amministratore.`,
        type: "team"
      });
    } catch (e) { /* ignore */ }
  }));

  await dispatchMailAndNotification({
    bcc: emailsArray,
    subject,
    html,
    notifications: notifications.length > 0 ? notifications : undefined
  });
}