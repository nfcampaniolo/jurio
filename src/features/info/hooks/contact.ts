import { getDb } from "@/infrastructure/db";
import type {
  CreateContactInput,
} from "@/interfaces/interfaces";
import { FirebaseError } from "firebase/app";
// --- CONTACT & REGISTER ---

export async function createContact(input: CreateContactInput): Promise<string> {
  const name = input.name?.trim();
  const email = input.email?.trim().toLowerCase();
  const subject = input.subject?.trim();
  const message = input.message?.trim();

  if (!name) throw new Error("Nome mancante");
  if (!email) throw new Error("Email mancante");
  if (!subject) throw new Error("Oggetto mancante");
  if (!message) throw new Error("Messaggio mancante");
  if (!input.consent) throw new Error("Consenso mancante");

  const db = await getDb();
  const { addDoc, collection, serverTimestamp } = await import("firebase/firestore");

  const payload = {
    name,
    email,
    subject,
    message,
    consent: true,
    page: input.page ?? null,
    userAgent: input.userAgent ?? null,
    createdAt: serverTimestamp(),
  };

  try {
    const ref = await addDoc(collection(db, "contacts"), payload);
    // Ritorna solo l'ID. Nessun toast qui.
    return ref.id; 
  } catch (error: unknown) {
    console.error("Errore invio contatto:", error);

    if (error instanceof FirebaseError) {
      switch (error.code) {
        case "permission-denied":
          throw new Error("Permessi insufficienti per inviare il messaggio.");
        case "unavailable":
          throw new Error("Servizio non disponibile. Riprova.");
        default:
          throw new Error("Errore del server durante l'invio.");
      }
    }

    if (error instanceof Error) {
      throw error;
    }

    throw new Error("Errore imprevisto nell’invio del messaggio.");
  }
}