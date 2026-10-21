import { createHash } from "crypto";
import { getDb } from "../_deps";
import { FieldValue } from "firebase-admin/firestore";

const db = getDb();

export function assertResourceOwner(
  resourceData: any,
  uid: string,
  customMessage = "Accesso alla risorsa negato."
): void {
  const owner = resourceData?.user;
  if (!owner || owner !== uid) {
    throw new Error(customMessage);
  }
}

export const hashIpForRateLimiting = (ip: string): string => {
  const dateSalt = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return createHash("sha256").update(`${ip}-${dateSalt}`).digest("hex");
};

export async function incrementRagCounter(collectionName: string, documentIds: string[]): Promise<void> {
  if (!documentIds || documentIds.length === 0) return;

  try {
    const batch = db.batch();
    const collectionRef = db.collection(collectionName);

    documentIds.forEach((id) => {
      const docRef = collectionRef.doc(id);
      batch.update(docRef, { rag: FieldValue.increment(1) });
    });

    await batch.commit();
    console.log(`[JURIO-RAG-UPDATE] Aggiornati ${documentIds.length} documenti nella collection '${collectionName}'.`);
  } catch (error) {
    console.error(`[JURIO-RAG-UPDATE] Errore durante l'incremento del campo rag:`, error);
  }
}