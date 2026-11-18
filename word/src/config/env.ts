/**
 * Configurazione iniettata da webpack.DefinePlugin (vedi webpack.config.js).
 * I valori arrivano da ../.env.development (npm start / dev-server) o ../.env.production (npm run build).
 */
import type { FirebaseOptions } from "firebase/app";

declare const __FIREBASE_CONFIG__: FirebaseOptions;
declare const __WORD_AGENT_URL__: string;
declare const __WORD_AUTH_URL__: string;
declare const __WEB_APP_URL__: string;
declare const __RECAPTCHA_SITE_KEY__: string;
declare const __APPCHECK_DEBUG_TOKEN__: string;

export const FIREBASE_CONFIG: FirebaseOptions = __FIREBASE_CONFIG__;
export const WORD_AGENT_URL: string = __WORD_AGENT_URL__;
/** Funzione wordAuth: accesso al pannello tramite jurio.it. */
export const WORD_AUTH_URL: string = __WORD_AUTH_URL__;
/** Web app dello stesso progetto, dove l'utente autorizza Word (/word-login). */
export const WEB_APP_URL: string = __WEB_APP_URL__;
export const RECAPTCHA_SITE_KEY: string = __RECAPTCHA_SITE_KEY__;
/** Vuoto nelle build di produzione. */
export const APPCHECK_DEBUG_TOKEN: string = __APPCHECK_DEBUG_TOKEN__;

/** Link pubblico alla scheda di un provvedimento su jurio.it. */
export const giurisprudenzaUrl = (id: string) =>
  `https://jurio.it/giurisprudenza/${encodeURIComponent(id)}`;

/** Icona Jurio servita dall'add-in (copiata da webpack in /assets). */
export const LOGO_URL = "assets/icon-64.png";
