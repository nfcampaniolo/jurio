import { Request, Response } from "express";
import { corsHandlerDomain, requireAppCheck, consumePerMinuteFeature, consumeDailyFeature } from "../_utils";
import { getAdminAuth } from "../_deps";
import { JURIO_USAGE_LIMITS } from "../_constants";
import { buildActionUrl, emailRateKey, logActionLinkOutsideProd } from "./_utils";
import { enqueuePasswordResetEmail } from "../email/auth/logic";
import { logSafeError, logSafeInfo } from "../_logging";

export const PASSWORD_RESET_PATH = "/reimposta-password";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Risposta identica in tutti i casi "validi": non rivela se l'email è registrata. */
const GENERIC_OK = { success: true };

async function consumeLimit(
  key: string,
  feature: "password_reset" | "password_reset_email",
  fallback: { perMinute: number; perDay: number }
): Promise<boolean> {
  const { perMinute, perDay } = JURIO_USAGE_LIMITS[feature]?.global ?? fallback;
  try {
    await Promise.all([
      consumePerMinuteFeature(key, feature, perMinute),
      consumeDailyFeature(key, feature, perDay),
    ]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Endpoint pubblico (l'utente non è loggato): protetto da App Check e da rate limit
 * per IP e per indirizzo email.
 */
export async function executeSendPasswordResetEmail(req: Request, res: Response): Promise<void> {
  return corsHandlerDomain(req, res, async (): Promise<void> => {
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    try {
      try {
        await requireAppCheck(req);
      } catch {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }

      const rawEmail = typeof req.body?.email === "string" ? req.body.email : "";
      const email = rawEmail.trim().toLowerCase().substring(0, 254);
      if (!EMAIL_REGEX.test(email)) {
        res.status(400).json({ error: "Bad Request: indirizzo email non valido" });
        return;
      }

      const clientIp = (req.ip || req.socket?.remoteAddress || "unknown").replace(/[^a-fA-F0-9:.]/g, "");
      if (!(await consumeLimit(`ip_${clientIp}`, "password_reset", { perMinute: 5, perDay: 30 }))) {
        res.status(429).json({ error: "Too Many Requests", details: "Limite di utilizzo superato." });
        return;
      }
      // Oltre il limite per indirizzo non si invia nulla, ma la risposta resta generica.
      if (!(await consumeLimit(emailRateKey(email), "password_reset_email", { perMinute: 1, perDay: 5 }))) {
        res.status(200).json(GENERIC_OK);
        return;
      }

      let userRecord;
      try {
        userRecord = await getAdminAuth().getUserByEmail(email);
      } catch {
        res.status(200).json(GENERIC_OK);
        return;
      }

      // Solo account con password: per gli account Google un reset creerebbe una
      // password parallela al login social.
      const hasPassword = userRecord.providerData.some((p) => p.providerId === "password");
      if (userRecord.disabled || !hasPassword) {
        logSafeInfo("PASSWORD_RESET_SKIPPED", { reason: userRecord.disabled ? "disabled" : "no_password_provider" });
        res.status(200).json(GENERIC_OK);
        return;
      }

      const firebaseLink = await getAdminAuth().generatePasswordResetLink(email);
      const resetUrl = buildActionUrl(firebaseLink, req.headers.origin, PASSWORD_RESET_PATH, "resetPassword");

      await enqueuePasswordResetEmail({ email, resetUrl });
      logActionLinkOutsideProd("PASSWORD_RESET_LINK", `uid=${userRecord.uid}`, resetUrl);

      res.status(200).json(GENERIC_OK);
    } catch (err) {
      logSafeError("PASSWORD_RESET_FAILED", err);
      res.status(500).json({ error: "Process failed" });
    }
  });
}
