import { createHash } from "node:crypto";
import { ALLOWED_ORIGINS } from "../_constants";
import { SITE_URL } from "../email/_layout";

export const PROD_PROJECT_ID = "jurio-it";

/**
 * Converte un link d'azione generato da Firebase (verifyEmail, resetPassword...) in un
 * link verso una nostra pagina: si riusa solo l'oobCode, così l'utente non passa mai
 * dalla pagina standard __/auth/action. L'origine segue il frontend chiamante
 * (prod/dev) se è tra quelle ammesse, altrimenti si usa il sito di produzione.
 */
export function buildActionUrl(
  firebaseLink: string,
  origin: string | undefined,
  path: string,
  mode: "verifyEmail" | "resetPassword"
): string {
  const oobCode = new URL(firebaseLink).searchParams.get("oobCode");
  if (!oobCode) throw new Error("OOB_CODE_MISSING");

  const base = origin && ALLOWED_ORIGINS.includes(origin) ? origin : SITE_URL;
  const url = new URL(path, base);
  url.searchParams.set("mode", mode);
  url.searchParams.set("oobCode", oobCode);
  return url.toString();
}

/** In dev l'invio email non è attivo: il link finisce nei log per poter testare il flusso. */
export function logActionLinkOutsideProd(label: string, subject: string, url: string): void {
  if (process.env.GCLOUD_PROJECT && process.env.GCLOUD_PROJECT !== PROD_PROJECT_ID) {
    console.info(`[DEV] ${label} ${subject} url=${url}`);
  }
}

/** Chiave di rate limit per indirizzo email senza salvare l'indirizzo in chiaro. */
export function emailRateKey(email: string): string {
  return `email_${createHash("sha256").update(email).digest("hex").slice(0, 32)}`;
}
