import type {
  DocumentoGiurisprudenziale,
  RawSaved,
  SavedRef,
} from "@/interfaces/interfaces";
import { getDb } from "./db";
import { _mapFirestoreDocToMassima, toDateSafe } from "./document";


export async function savedSentenzaRef(userId: string, sentenzaId: string) {
  const db = await getDb();
  const { doc } = await import("firebase/firestore");
  return doc(db, "users", userId, "savedSentenze", sentenzaId);
}

export async function isSentenzaSaved(userId: string, sentenzaId: string) {
  const ref = await savedSentenzaRef(userId, sentenzaId);
  const { getDoc } = await import("firebase/firestore");
  const snap = await getDoc(ref);
  return snap.exists();
}

export async function saveSentenza(userId: string, sentenzaId: string) {
  const ref = await savedSentenzaRef(userId, sentenzaId);
  const { setDoc, serverTimestamp } = await import("firebase/firestore");
  await setDoc(
    ref,
    {
      sentenzaId,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function removeSentenza(userId: string, sentenzaId: string) {
  const ref = await savedSentenzaRef(userId, sentenzaId);
  const { deleteDoc } = await import("firebase/firestore");
  await deleteDoc(ref);
}

export async function deleteSaveSentence(
  uid: string,
  sentenceId: string
): Promise<void> {
  const db = await getDb();
  const { doc, deleteDoc } = await import("firebase/firestore");
  if (!uid) throw new Error("Utente non autenticato");
  const ref = doc(db, "users", uid, "savedSentenze", sentenceId);
  await deleteDoc(ref);
}

export async function listSavedSentenzeByUser(
  uid: string
): Promise<DocumentoGiurisprudenziale[]> {
  const db = await getDb();
  const { collection, doc, getDoc, getDocs, orderBy, query } = await import(
    "firebase/firestore"
  );

  const savedCol = collection(db, "users", uid, "savedSentenze");
  const savedQ = query(savedCol, orderBy("createdAt", "desc"));
  const savedSnap = await getDocs(savedQ);

  const refs: SavedRef[] = savedSnap.docs
    .map((d) => {
      const raw = d.data() as RawSaved;
      const sentenzaId = String(raw.sentenzaId ?? "");
      const createdAt = toDateSafe(raw.createdAt);
      return { sentenzaId, createdAt };
    })
    .filter((r) => r.sentenzaId.length > 0);

  if (refs.length === 0) return [];

  const resultsById = new Map<string, DocumentoGiurisprudenziale>();

  for (const group of chunk(refs, 30)) {
    const docs = await Promise.all(
      group.map(async ({ sentenzaId }) => {
        const snap = await getDoc(doc(db, "sentences", sentenzaId));
        if (!snap.exists()) return null;
        // REFACTOR: Uso helper _mapFirestoreDocToMassima
        return _mapFirestoreDocToMassima(snap.id, snap.data());
      })
    );

    for (const d of docs) {
      if (d) resultsById.set(String(d.id), d);
    }
  }

  return refs
    .map((r) => resultsById.get(String(r.sentenzaId)))
    .filter(Boolean) as DocumentoGiurisprudenziale[];
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
