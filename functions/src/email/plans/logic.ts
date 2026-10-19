import {  generatePurchaseEmail, generateDowngradeEmail, generateMonthlyReportEmail } from "./html"; 
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { getDb, getAdminAuth } from "../../_deps";
import { EnqueuePurchaseEmailArgs, NotificationPayload, QueuePurchaseStripeArgs, EnqueueEmailArgs, EnqueueMonthlyUsageEmailArgs } from "../_interfaces"
import { dispatchMailAndNotification, fmtRome } from "../_helper";

const db = getDb();

async function enqueuePurchaseEmailGeneric(args: EnqueuePurchaseEmailArgs): Promise<void> {
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
  const html = generatePurchaseEmail(email, planId, amountLabel, dataAcquisto, dataScadenza, args.orderId);

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
  const html = generateDowngradeEmail(nome);

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

export async function enqueueMonthlyUsageEmail({ 
  email, 
  reportData 
}: EnqueueMonthlyUsageEmailArgs): Promise<void> {
  
  if (!email || (Array.isArray(email) && email.length === 0)) return;

  const emailsArray = Array.isArray(email) ? email : [email];

  const subject = reportData.totalTimeSavedMinutes > 0
    ? `Il tuo resoconto mensile su Jurio: hai risparmiato ${reportData.totalTimeSavedMinutes} minuti!`
    : `Il tuo resoconto mensile su Jurio`;

  const html = generateMonthlyReportEmail(reportData);

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