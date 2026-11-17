import { generateEmailVerificationEmail } from "./html";
import { dispatchMailAndNotification } from "../_helper";
import { EnqueueEmailVerificationArgs } from "../_interfaces";

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
