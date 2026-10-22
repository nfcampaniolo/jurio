import type{ MonthlyUsageReportData } from "./_interfaces";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { DispatchMailArgs } from "./_interfaces";
import { getAdminAuth, getDb } from "../_deps";
import { logSafeWarning } from "../_logging";

const db = getDb();

export async function getAuthEmailAndName(
  uid: string,
  context: string
): Promise<{ email: string; name: string } | null> {
  let email: string | null;
  try {
    email = (await getAdminAuth().getUser(uid)).email ?? null;
  } catch (error) {
    logSafeWarning(`${context}_AUTH_EMAIL_LOOKUP_FAILED`, error);
    return null;
  }
  if (!email) return null;

  const userSnap = await db.collection("users").doc(uid).get();
  const name = userSnap.exists ? userSnap.data()?.name : undefined;
  return {
    email,
    name: typeof name === "string" && name.trim() ? name.trim() : "utente",
  };
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
        user: notif.user,
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

  const deepAnalysisCount = rawUsage['deep_analysis'] || 0;
  const deepAnalysisTime = deepAnalysisCount * 60;

  return {
    mese: targetMonthStr,
    haFattoPrompting,
    interazioniCount, 
    ricerca: { count: ricercaCount, timeSavedMinutes: ricercaTime },
    analisi: { count: analisiCount, timeSavedMinutes: analisiTime },
    sintesi: { count: sintesiCount, timeSavedMinutes: sintesiTime },
    deepAnalysis: { count: deepAnalysisCount, timeSavedMinutes: deepAnalysisTime },
    totalTimeSavedMinutes: analisiTime + ricercaTime + sintesiTime + deepAnalysisTime
  };
}

export function fmtRome(ts: Timestamp): string {
  return ts.toDate().toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "long",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}