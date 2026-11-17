import { Request, Response } from "express";
import { withSecureApiEndpoint, consumePerMinuteFeature, consumeDailyFeature } from "../_utils";
import { getAdminAuth } from "../_deps";
import { ALLOWED_ORIGINS, JURIO_USAGE_LIMITS } from "../_constants";
import { SITE_URL } from "../email/_layout";
import { enqueueEmailVerificationEmail } from "../email/auth/logic";
import { logSafeWarning } from "../_logging";

export const EMAIL_VERIFICATION_PATH = "/verifica-email";
const PROD_PROJECT_ID = "jurio-it";

/**
 * Link verso la nostra pagina di verifica: riusiamo solo l'oobCode generato da
 * Firebase, così l'utente non passa mai dalla pagina standard __/auth/action.
 * L'origine segue il frontend chiamante (prod/dev), già validato dal CORS.
 */
function buildVerificationUrl(firebaseLink: string, origin: string | undefined): string {
  const oobCode = new URL(firebaseLink).searchParams.get("oobCode");
  if (!oobCode) throw new Error("OOB_CODE_MISSING");

  const base = origin && ALLOWED_ORIGINS.includes(origin) ? origin : SITE_URL;
  const url = new URL(EMAIL_VERIFICATION_PATH, base);
  url.searchParams.set("mode", "verifyEmail");
  url.searchParams.set("oobCode", oobCode);
  return url.toString();
}

export async function executeSendVerificationEmail(req: Request, res: Response): Promise<any> {
  return withSecureApiEndpoint(req, res, async (uid): Promise<void> => {
    const userRecord = await getAdminAuth().getUser(uid);
    const email = userRecord.email;

    if (!email) {
      res.status(400).json({ error: "Bad Request: l'account non ha un indirizzo email" });
      return;
    }
    if (userRecord.emailVerified) {
      res.status(200).json({ success: true, alreadyVerified: true });
      return;
    }

    const limits = JURIO_USAGE_LIMITS.email_verification?.global ?? { perMinute: 1, perDay: 8 };
    await Promise.all([
      consumePerMinuteFeature(uid, "email_verification", limits.perMinute),
      consumeDailyFeature(uid, "email_verification", limits.perDay),
    ]);

    let verificationUrl: string;
    try {
      const firebaseLink = await getAdminAuth().generateEmailVerificationLink(email);
      verificationUrl = buildVerificationUrl(firebaseLink, req.headers.origin);
    } catch (err) {
      logSafeWarning("EMAIL_VERIFICATION_LINK_FAILED", err);
      throw err;
    }

    await enqueueEmailVerificationEmail({ email, verificationUrl });

    // In dev l'invio email non è attivo: il link finisce nei log per poter testare il flusso.
    if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== PROD_PROJECT_ID) {
      console.info(`[DEV] EMAIL_VERIFICATION_LINK uid=${uid} url=${verificationUrl}`);
    }

    res.status(200).json({ success: true, alreadyVerified: false });
  });
}
