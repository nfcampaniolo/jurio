import {
  getAuth,
  signInWithEmailAndPassword,
  signInWithCustomToken,
  onAuthStateChanged,
  signOut,
  type User,
} from "firebase/auth";

import { firebaseApp } from "./config";
import { clearMemoryState, purgeLegacyDocumentCache } from "../tools/memoryState";

export const auth = getAuth(firebaseApp);

/*
 * Nota: l'add-in NON scrive users/{uid}.currentSessionId. Quel campo governa la sessione unica
 * della web app (endpoint forceTakeoverSession): scriverlo da Word disconnetterebbe l'utente dal browser.
 */

export async function loginWithEmail(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

/** Completa l'accesso autorizzato su jurio.it (vedi auth/browserLogin.ts). */
export async function loginWithCustomToken(token: string) {
  const result = await signInWithCustomToken(auth, token);
  return result.user;
}

export function onAuthStateChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/** Esce e cancella dal pannello ogni contenuto dei documenti (riservatezza). */
export async function logout() {
  clearMemoryState();
  purgeLegacyDocumentCache();
  await signOut(auth);
}
