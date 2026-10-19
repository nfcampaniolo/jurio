import {  generateWelcomeEmail, generateTrialEmail, generateRequestEmail } from "./html"; 
import { getAdminAuth, getDb } from "../../_deps";
import { dispatchMailAndNotification } from "../_helper"
import { EnqueueEmailArgs, EnqueueEmailArgsContact } from "../_interfaces";

const db = getDb();

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
  const html = generateWelcomeEmail(nome);

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
  const html = generateTrialEmail(nome);

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

export async function enqueueContactEmail({ nome, id, subject, message, email }: EnqueueEmailArgsContact): Promise<void> {
  const oggetto = "Richiesta Jurio: "+id;
  const html = generateRequestEmail(nome, id, subject, message);
  
  await dispatchMailAndNotification({
    to: email,
    cc: "nicolo.flavio.campaniolo@gmail.com",
    subject: oggetto,
    html
  });
}