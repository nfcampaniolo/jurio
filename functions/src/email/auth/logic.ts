import { generateEmailVerificationEmail, generatePasswordResetEmail } from "./html";
import { dispatchMailAndNotification } from "../_helper";
import { EnqueueEmailVerificationArgs, EnqueuePasswordResetArgs } from "../_interfaces";

export async function enqueueEmailVerificationEmail({
  email,
  verificationUrl,
}: EnqueueEmailVerificationArgs): Promise<void> {
  if (!email || !verificationUrl) return;

  await dispatchMailAndNotification({
    to: email,
    subject: "Conferma il tuo indirizzo email su Jurio",
    html: generateEmailVerificationEmail(verificationUrl, email),
  });
}

export async function enqueuePasswordResetEmail({
  email,
  resetUrl,
}: EnqueuePasswordResetArgs): Promise<void> {
  if (!email || !resetUrl) return;

  await dispatchMailAndNotification({
    to: email,
    subject: "Reimposta la tua password di Jurio",
    html: generatePasswordResetEmail(resetUrl, email),
  });
}
