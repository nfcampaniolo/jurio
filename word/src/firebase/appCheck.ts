/* global window */
import type { FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaEnterpriseProvider, type AppCheck } from "firebase/app-check";
import { RECAPTCHA_SITE_KEY } from "../config/env";

declare global {
  interface Window {
    FIREBASE_APPCHECK_DEBUG_TOKEN?: string | boolean;
  }
}

/**
 * App Check con reCAPTCHA Enterprise (stessa chiave della web app).
 * Va attivato su ogni istanza Firebase che parla con servizi protetti: Firebase Authentication
 * richiede App Check, e senza token le chiamate falliscono (spesso come auth/internal-error).
 */
export function setupAppCheck(app: FirebaseApp): AppCheck | undefined {
  if (typeof window === "undefined" || !RECAPTCHA_SITE_KEY) return undefined;
  // In locale il token debug lo imposta lo script del dev server (vedi webpack.config.js), mai il bundle.
  return initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  });
}
