import { Request, Response } from "express";
import { withSecureApiEndpoint, consumePerMinuteFeature, consumeDailyFeature } from "../_utils";
import { getAdminAuth } from "../_deps";
import { JURIO_USAGE_LIMITS } from "../_constants";
import { buildActionUrl, logActionLinkOutsideProd } from "./_utils";
import { enqueueEmailVerificationEmail } from "../email/auth/logic";
import { logSafeWarning } from "../_logging";

export const EMAIL_VERIFICATION_PATH = "/verifica-email";

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
      verificationUrl = buildActionUrl(firebaseLink, req.headers.origin, EMAIL_VERIFICATION_PATH, "verifyEmail");
    } catch (err) {
      logSafeWarning("EMAIL_VERIFICATION_LINK_FAILED", err);
      throw err;
    }

    await enqueueEmailVerificationEmail({ email, verificationUrl });

    logActionLinkOutsideProd("EMAIL_VERIFICATION_LINK", `uid=${uid}`, verificationUrl);

    res.status(200).json({ success: true, alreadyVerified: false });
  });
}
