/* global console, fetch */
import { getToken } from "firebase/app-check";
import { appCheckInstance } from "./config";
import { auth } from "./auth";
import { firebaseApp } from "./config";

export interface PastFascicolo {
  id: string;
  title: string;
  /** Data formattata it-IT (gg/mm/aaaa), solo per la visualizzazione. */
  createdAt: string;
  updatedAt: string;
}

async function appCheckToken(): Promise<string> {
  if (!appCheckInstance) return "";
  try {
    return (await getToken(appCheckInstance, false)).token;
  } catch (err) {
    console.warn("App Check fallito. Proseguo senza token (il server potrebbe rifiutare).", err);
    return "";
  }
}

export async function fetchWithSecurity<T = Record<string, unknown>>(url: string, body: T) {
  const user = auth.currentUser;
  if (!user) throw new Error("Utente non autenticato");

  const [idToken, appCheck] = await Promise.all([user.getIdToken(), appCheckToken()]);

  return fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`,
      "X-Firebase-AppCheck": appCheck,
    },
    body: JSON.stringify(body),
  });
}

/** Chiamata prima del login (accesso tramite jurio.it): solo App Check, nessun utente. */
export async function fetchPublic<T = Record<string, unknown>>(url: string, body: T) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Firebase-AppCheck": await appCheckToken() },
    body: JSON.stringify(body),
  });
}

const formatDate = (value: { toDate?: () => Date } | undefined) =>
  (value?.toDate?.() ?? new Date()).toLocaleDateString("it-IT");

/** Fascicoli propri o condivisi, dal più recente (ordinamento di Firestore su updatedAt). */
export async function listFascicoliByUser(userId: string): Promise<PastFascicolo[]> {
  // Firestore "lite" (sola lettura via REST) si scarica solo quando si apre l'elenco dei fascicoli.
  const { getFirestore, collection, getDocs, query, where, orderBy, or } =
    await import("firebase/firestore/lite");
  const db = getFirestore(firebaseApp);
  const q = query(
    collection(db, "fascicoli"),
    or(where("user", "==", userId), where("visibleTo", "array-contains", userId)),
    orderBy("updatedAt", "desc")
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title || "Nuovo Fascicolo",
      createdAt: formatDate(data.createdAt),
      updatedAt: formatDate(data.updatedAt),
    };
  });
}
