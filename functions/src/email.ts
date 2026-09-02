import { 
  generaEmailAcquisto, generaEmailDowngrade, generaEmailProva, generaEmailBenvenuto, 
  generaEmailRichiesta, generaEmailInvitoVoucher, generaEmailBenvenutoTeam, 
  generaEmailChiusuraTeam, generaEmailRimozioneTeam, generaEmailReportMensile 
} from "./email/emails"; // aggiusta path
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { getDb, getAdminAuth } from "./deps";
import { fmtRome } from "./utils";

const db = getDb();

// ==========================================
// TIPI E FUNZIONE CENTRALIZZATA
// ==========================================

export type NotificationType = 
  | "billing"
  | "team"
  | "account"
  | "report"
  | "support"
  | "system";

export interface NotificationPayload {
  uid: string;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
}

export interface DispatchMailArgs {
  to?: string | string[];
  bcc?: string | string[];
  cc?: string | string[];
  from?: string;
  subject: string;
  html: string;
  notifications?: NotificationPayload | NotificationPayload[]; // Supporta notifica singola o multipla
}

export async function dispatchMailAndNotification({
  to,
  bcc,
  cc,
  from = "Jurio Support <info@jurio.it>",
  subject,
  html,
  notifications
}: DispatchMailArgs): Promise<void> {
  const batch = db.batch();

  // 1. Preparazione Documento Email
  const mailRef = db.collection("mail").doc();
  const mailData: any = {
    message: { subject, html },
    from,
  };
  
  if (to) mailData.to = to;
  if (bcc) mailData.bcc = bcc;
  if (cc) mailData.cc = cc;

  batch.set(mailRef, mailData);

  // 2. Preparazione Documenti Notifica (singola o multiple)
  if (notifications) {
    const notifsArray = Array.isArray(notifications) ? notifications : [notifications];
    
    for (const notif of notifsArray) {
      const notifRef = db.collection("notification").doc();
      batch.set(notifRef, {
        uid: notif.uid,
        title: notif.title,
        message: notif.message,
        type: notif.type || "system",
        link: notif.link || "",
        isRead: false,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }

  await batch.commit();
}

// ==========================================
// FUNZIONI DI ACCODO EMAIL
// ==========================================

type EnqueuePurchaseEmailArgs = {
  uid: string;
  provider: "paypal" | "stripe";
  orderId: string;          
  paidValue: number;
  paidCurrency: string;
};

export async function enqueuePurchaseEmailGeneric(args: EnqueuePurchaseEmailArgs): Promise<void> {
  const userRecord = await getAdminAuth().getUser(args.uid);
  const email = userRecord.email ?? null;
  if (!email) return;

  const regSnap = await db.collection("register").doc(args.uid).get();
  const reg = regSnap.exists ? (regSnap.data() as any) : null;

  const planId = String(reg?.planId ?? "");
  const startTs: Timestamp | null = reg?.start instanceof Timestamp ? reg.start : null;
  const expireTs: Timestamp | null = reg?.expire instanceof Timestamp ? reg.expire : null;

  const dataAcquisto = startTs ? fmtRome(startTs) : "";
  const dataScadenza = expireTs ? fmtRome(expireTs) : "";

  const amountLabel = `${args.paidValue.toFixed(2)} ${args.paidCurrency}`;
  const subject = `Conferma Ordine Jurio - ${args.orderId}`;
  const html = generaEmailAcquisto(email, planId, amountLabel, dataAcquisto, dataScadenza, args.orderId);

  await dispatchMailAndNotification({
    to: email,
    subject,
    html,
    notifications: {
      uid: args.uid,
      title: "Acquisto Confermato",
      message: `Grazie! Il tuo ordine ${args.orderId} è andato a buon fine.`,
      type: "billing",
      link: "/profilo/piani"
    }
  });
}

type QueuePurchasePayPalArgs = {
  requestId: string;
  uid: string;
  orderId: string; 
  paidValue: number;
  paidCurrency: string;
};

export async function queuePurchaseEmailOncePayPal(args: QueuePurchasePayPalArgs): Promise<void> {
  try {
    const orderRef = db.collection("paypalOrders").doc(args.orderId);

    const claimed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef);
      if (!snap.exists) return false;
      const data = snap.data() as any;
      if (data?.purchaseEmailQueuedAt) return false;

      tx.update(orderRef, { purchaseEmailQueuedAt: FieldValue.serverTimestamp() });
      return true;
    });

    if (!claimed) return;

    await enqueuePurchaseEmailGeneric({
      uid: args.uid,
      provider: "paypal",
      orderId: args.orderId,
      paidValue: args.paidValue,
      paidCurrency: args.paidCurrency,
    });

    await orderRef.update({ purchaseEmailSentAt: FieldValue.serverTimestamp() });
  } catch (e) {
    console.error("[PAYPAL] queuePurchaseEmailOncePayPal failed", {
      requestId: args.requestId,
      uid: args.uid,
      orderId: args.orderId,
      err: e,
    });
  }
}

type QueuePurchaseStripeArgs = {
  requestId: string;
  uid: string;
  sessionId: string; 
  paidValue: number;
  paidCurrency: string;
};

export async function queuePurchaseEmailOnceStripe(args: QueuePurchaseStripeArgs): Promise<void> {
  try {
    const sessionRef = db.collection("stripeSessions").doc(args.sessionId);

    const claimed = await db.runTransaction(async (tx) => {
      const snap = await tx.get(sessionRef);
      if (!snap.exists) return false; 
      const data = snap.data() as any;
      if (data?.purchaseEmailQueuedAt) return false;

      tx.set(sessionRef, { purchaseEmailQueuedAt: FieldValue.serverTimestamp() }, { merge: true });
      return true;
    });

    if (!claimed) return;

    await enqueuePurchaseEmailGeneric({
      uid: args.uid,
      provider: "stripe",
      orderId: args.sessionId,
      paidValue: args.paidValue,
      paidCurrency: args.paidCurrency,
    });

    await sessionRef.set({ purchaseEmailSentAt: FieldValue.serverTimestamp() }, { merge: true });
  } catch (e) {
    console.error("[STRIPE] queuePurchaseEmailOnceStripe failed", {
      requestId: args.requestId,
      uid: args.uid,
      sessionId: args.sessionId,
      err: e,
    });
  }
}

type EnqueueEmailArgs = {
  uid: string;
};

export async function enqueueDowngradeEmail({ uid }: EnqueueEmailArgs): Promise<void> {
  let email: string | null = null;
  try {
    const userRecord = await getAdminAuth().getUser(uid);
    email = userRecord.email ?? null;
  } catch (e) {
    console.warn("[DOWNGRADE] cannot fetch auth email", { uid, err: e });
    return;
  }
  if (!email) return;

  const userSnap = await db.collection("users").doc(uid).get();
  const data = userSnap.exists ? (userSnap.data() as any) : null;
  const nome = typeof data?.name === "string" && data.name.trim() ? data.name.trim() : "utente";

  const subject = "Piano Jurio scaduto";
  const html = generaEmailDowngrade(nome);

  await dispatchMailAndNotification({
    to: email,
    subject,
    html,
    notifications: {
      uid,
      title: "Piano Scaduto",
      message: "Il tuo abbonamento è scaduto. Controlla il tuo piano per continuare a utilizzare le funzionalità avanzate.",
      type: "billing",
      link: "/profilo/piani"
    }
  });
}

export async function enqueueWelcomeEmail({ uid }: EnqueueEmailArgs): Promise<void> {
  let email: string | null = null;
  try {
    const userRecord = await getAdminAuth().getUser(uid);
    email = userRecord.email ?? null;
  } catch (e) {
    console.warn("[WELCOME] cannot fetch auth email", { uid, err: e });
    return;
  }
  if (!email) return;

  const userSnap = await db.collection("users").doc(uid).get();
  const data = userSnap.exists ? (userSnap.data() as any) : null;
  const nome = typeof data?.name === "string" && data.name.trim() ? data.name.trim() : "utente";

  const subject = "Benvenuto su Jurio";
  const html = generaEmailBenvenuto(nome);

  await dispatchMailAndNotification({
    to: email,
    subject,
    html,
    notifications: {
      uid,
      title: "Benvenuto su Jurio!",
      message: "Siamo felici di averti a bordo. Inizia subito a esplorare la piattaforma.",
      type: "account",
      link: "/profilo"
    }
  });
}

export async function enqueueTrialEmail({ uid }: EnqueueEmailArgs): Promise<void> {
  let email: string | null = null;
  try {
    const userRecord = await getAdminAuth().getUser(uid);
    email = userRecord.email ?? null;
  } catch (e) {
    console.warn("[TRIAL] cannot fetch auth email", { uid, err: e });
    return;
  }
  if (!email) return;

  const userSnap = await db.collection("users").doc(uid).get();
  const data = userSnap.exists ? (userSnap.data() as any) : null;
  const nome = typeof data?.name === "string" && data.name.trim() ? data.name.trim() : "utente";

  const subject = "Periodo di Prova Jurio";
  const html = generaEmailProva(nome);

  await dispatchMailAndNotification({
    to: email,
    subject,
    html,
    notifications: {
      uid,
      title: "Periodo di Prova Attivo",
      message: "Hai iniziato il tuo periodo di prova gratuito. Goditi tutte le funzionalità premium!",
      type: "billing",
      link: "/profilo"
    }
  });
}

type EnqueueEmailArgsContact = {
  nome: string, 
  id: string, 
  subject: string, 
  message: string,
  email: string
};

export async function enqueueContactEmail({ nome, id, subject, message, email }: EnqueueEmailArgsContact): Promise<void> {
  const oggetto = "Richiesta Jurio: "+id;
  const html = generaEmailRichiesta(nome, id, subject, message);
  
  await dispatchMailAndNotification({
    to: email,
    cc: "nicolo.flavio.campaniolo@gmail.com",
    subject: oggetto,
    html
  });
}

interface EnqueueVoucherEmailArgs {
  email: string;
  voucherCode: string;
  teamName?: string;
}

export async function enqueueVoucherEmail({ 
  email, 
  voucherCode, 
  teamName = "un Workspace" 
}: EnqueueVoucherEmailArgs): Promise<void> {
  
  if (!email || !voucherCode) {
    console.warn("[MAIL] Impossibile accodare l'email del voucher: email o voucherCode mancanti", { email, voucherCode });
    return;
  }

  const subject = teamName && teamName !== "un Workspace"
    ? `Invito a unirti a ${teamName} su Jurio`
    : `Invito a unirti a un Workspace su Jurio`;

  const html = generaEmailInvitoVoucher(voucherCode, teamName);

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
    // L'utente non ha ancora un account, riceverà solo l'email
  }

  await dispatchMailAndNotification({
    to: email,
    subject,
    html,
    notifications: notifications.length > 0 ? notifications : undefined
  });
}

export interface EnqueueTeamEmailArgs {
  email: string;
  teamName?: string;
}

export interface EnqueueCloseTeamEmailArgs {
  email: string | string[]; 
  teamName?: string;
}

export async function enqueueWelcomeTeamEmail({ 
  email, 
  teamName = "Workspace" 
}: EnqueueTeamEmailArgs): Promise<void> {
  
  if (!email) return;

  const subject = teamName !== "Workspace"
    ? `Benvenuto in ${teamName} su Jurio`
    : `Benvenuto nel tuo nuovo Workspace su Jurio`;

  const html = generaEmailBenvenutoTeam(teamName);

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

  const html = generaEmailRimozioneTeam(teamName);

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

  const html = generaEmailChiusuraTeam(teamName);

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

export interface MonthlyUsageReportData {
  mese: string; 
  haFattoPrompting: boolean; 
  interazioniCount: number; 
  ricerca: { count: number; timeSavedMinutes: number }; 
  analisi: { count: number; timeSavedMinutes: number }; 
  sintesi: { count: number; timeSavedMinutes: number }; 
  totalTimeSavedMinutes: number;
}

export interface EnqueueMonthlyUsageEmailArgs {
  email: string | string[];
  reportData: MonthlyUsageReportData;
}

export function calculateReportData(rawUsage: Record<string, number>, targetMonthStr: string): MonthlyUsageReportData {
  const haFattoPrompting = (rawUsage['prompting'] || 0) > 0;
  const interazioniCount = rawUsage['legal_agent'] || 0;
  
  const analisiCount = (rawUsage['review_agent'] || 0) + 
                       (rawUsage['reasoning'] || 0) + 
                       (rawUsage['speech_to_text'] || 0);
  const analisiTime = analisiCount * 30;
  
  const ricercaCount = (rawUsage['research_agent'] || 0) + 
                       (rawUsage['research'] || 0);
  const ricercaTime = ricercaCount * 10;
  
  const sintesiCount = rawUsage['drafting_agent'] || 0;
  const sintesiTime = sintesiCount * 15;

  return {
    mese: targetMonthStr,
    haFattoPrompting,
    interazioniCount, 
    ricerca: { count: ricercaCount, timeSavedMinutes: ricercaTime },
    analisi: { count: analisiCount, timeSavedMinutes: analisiTime },
    sintesi: { count: sintesiCount, timeSavedMinutes: sintesiTime },
    totalTimeSavedMinutes: analisiTime + ricercaTime + sintesiTime
  };
}

export async function enqueueMonthlyUsageEmail({ 
  email, 
  reportData 
}: EnqueueMonthlyUsageEmailArgs): Promise<void> {
  
  if (!email || (Array.isArray(email) && email.length === 0)) return;

  const emailsArray = Array.isArray(email) ? email : [email];

  const subject = reportData.totalTimeSavedMinutes > 0
    ? `Il tuo resoconto mensile su Jurio: hai risparmiato ${reportData.totalTimeSavedMinutes} minuti!`
    : `Il tuo resoconto mensile su Jurio`;

  const html = generaEmailReportMensile(reportData);

  // Recupera gli UID in parallelo per mandare anche la notifica in-app
  const notifications: NotificationPayload[] = [];
  await Promise.all(emailsArray.map(async (em) => {
    try {
      const userRecord = await getAdminAuth().getUserByEmail(em);
      notifications.push({
        uid: userRecord.uid,
        title: "Nuovo Report Mensile",
        message: `Il resoconto sull'utilizzo di Jurio di ${reportData.mese} è disponibile.`,
        type: "report",
        link: "/profilo/utilizzi" // Aggiusta la route se applicabile
      });
    } catch (e) { /* ignore */ }
  }));

  await dispatchMailAndNotification({
    to: emailsArray, // O usare bcc se sono molti per non esporre le email
    subject,
    html,
    notifications: notifications.length > 0 ? notifications : undefined
  });
}