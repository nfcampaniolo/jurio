import {  generateWelcomeEmail, generateTrialEmail, generateRequestEmail } from "./html"; 
import { dispatchMailAndNotification, getAuthEmailAndName } from "../_helper"
import { EnqueueEmailArgs, EnqueueEmailArgsContact } from "../_interfaces";

export async function enqueueWelcomeEmail({ uid }: EnqueueEmailArgs): Promise<void> {
  const user = await getAuthEmailAndName(uid, "WELCOME");
  if (!user) return;

  const subject = "Benvenuto su Jurio";
  const html = generateWelcomeEmail(user.name);

  await dispatchMailAndNotification({
    to: user.email,
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
  const user = await getAuthEmailAndName(uid, "TRIAL");
  if (!user) return;

  const subject = "Periodo di Prova Jurio";
  const html = generateTrialEmail(user.name);

  await dispatchMailAndNotification({
    to: user.email,
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