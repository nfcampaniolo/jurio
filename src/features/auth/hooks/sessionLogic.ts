import { getAuthClient } from "./auth";
import { getDb } from "@/infrastructure/db";
import { doc, updateDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";

/**
 * Ruba la sessione sovrascrivendo l'ID su Firestore
 */
export async function forceSessionTakeover() {
  const auth = await getAuthClient();
  const user = auth.currentUser;
  
  if (!user) {
    throw new Error("no_user"); // Diciamo all'interfaccia che non c'è utente
  }

  const db = await getDb();
  
  // Genera un nuovo ID (usa un fallback per sicurezza)
  const newSessionId = typeof crypto !== 'undefined' && crypto.randomUUID 
    ? crypto.randomUUID() 
    : Date.now().toString();
  
  // Salva in locale
  localStorage.setItem('active_session_id', newSessionId);
  
  // Aggiorna Firestore
  const userRef = doc(db, 'users', user.uid);
  await updateDoc(userRef, {
    currentSessionId: newSessionId,
  });
}

/**
 * Effettua il logout forzato e pulisce il dispositivo locale
 */
export async function clearLocalSession() {
  const auth = await getAuthClient();
  localStorage.removeItem('active_session_id');
  await signOut(auth);
}