import type { DocumentoGiurisprudenziale } from "@/interfaces/interfaces";
import type { WithRiferimenti } from "./documentsHelpers";
import { getDb } from "./db";
import { toast } from "react-hot-toast";
import { FirebaseError } from "firebase/app";
import { makeRiferimentiNormativiKeys } from "./riferimentiTranslator";
import {
  buildNumeroSentenza,
  buildUrnFromMassima,
  lowerArrayOrString,
  _mapFirestoreDocToMassima,
} from "./documentsHelpers";

export async function loadMaxima(
  uid: string,
  data: DocumentoGiurisprudenziale & WithRiferimenti,
  user: string,
  collectionName: string,
  finalText: string
) {
  if (!uid) throw new Error("UID mancante");

  const db = await getDb();
  const { doc, setDoc, Timestamp, collection, query, where, limit, getDocs } =
    await import("firebase/firestore");

  const userRef = doc(db, collectionName, uid);

  const numeroSentenza = buildNumeroSentenza(data);
  data.numero_sentenza = numeroSentenza;

  let urn = data.urn;
  if (!urn) {
    const built = buildUrnFromMassima(data);
    if (built) urn = built;
  }

  if (collectionName === "sentences" && urn) {
    const q = query(
      collection(db, "sentences"),
      where("urn", "==", urn),
      limit(1)
    );
    const snap = await getDocs(q);
    const dup = snap.docs[0];
    if (dup && dup.id !== uid) {
      throw new Error(`Documento già presente con lo stesso URN: ${urn}`);
    }
  }

  const riferimenti_normativi_key = makeRiferimentiNormativiKeys(
    data.riferimenti_normativi ?? null
  );

  let dataSentenzaTimestamp: InstanceType<typeof Timestamp> | undefined;

  if (typeof data.data_sentenza === "string") {
    const d = new Date(data.data_sentenza);
    if (!Number.isNaN(d.getTime())) {
      dataSentenzaTimestamp = Timestamp.fromDate(d);
    }
  }

  const sottocategoriaLower = lowerArrayOrString(
    (data as DocumentoGiurisprudenziale).sottocategoria
  );

  const testo_integrale_chunks: string[] = [];
  if (finalText) {
    const { getEncoding } = await import("js-tiktoken");
    const enc = getEncoding("cl100k_base");

    const tokens = enc.encode(finalText);
    const targetChunkSize = 3072;
    const overlap = 200;

    let i = 0;
    while (i < tokens.length) {
      const end = Math.min(i + targetChunkSize, tokens.length);
      if (end < tokens.length) {
        const chunkText = enc.decode(tokens.slice(i, end));
        const lookbackArea = chunkText.slice(-500);
        let breakIndex = -1;
        const separators = ["\n\n", "\n", ". ", "; "];
        
        for (const sep of separators) {
          const found = lookbackArea.lastIndexOf(sep);
          if (found !== -1) {
            breakIndex = chunkText.length - 500 + found + sep.length;
            break;
          }
        }
        
        if (breakIndex !== -1) {
          const adjustedText = chunkText.slice(0, breakIndex);
          testo_integrale_chunks.push(adjustedText);
          const consumedTokens = enc.encode(adjustedText).length;
          i += consumedTokens - overlap;
          continue;
        }
      }
      const finalChunkText = enc.decode(tokens.slice(i, end));
      testo_integrale_chunks.push(finalChunkText);
      i += targetChunkSize - overlap;
    }
  }
  
  await setDoc(
    userRef,
    {
      ...data,
      ...(typeof data.presidente === "string"
        ? { presidente: data.presidente.toUpperCase() }
        : {}),
      ...(typeof data.relatore === "string"
        ? { relatore: data.relatore.toUpperCase() }
        : {}),
      ...(urn ? { urn } : {}),
      ...(sottocategoriaLower !== undefined
        ? { sottocategoria: sottocategoriaLower }
        : {}),
      ...(dataSentenzaTimestamp ? { dataSentenza: dataSentenzaTimestamp } : {}),
      ...(riferimenti_normativi_key.length > 0
        ? { riferimenti_normativi_key }
        : {}),
      ...(testo_integrale_chunks.length > 0
        ? { testo_integrale: testo_integrale_chunks }
        : {}),
      user,
      createdAt: new Date(),
    },
    { merge: true }
  );
}

export async function deleteDocument(
  collectionName: string,
  id: string
): Promise<void> {
  const db = await getDb();
  const { doc, deleteDoc, writeBatch, collection, query, where, getDocs } =
    await import("firebase/firestore");

  if (collectionName !== "documents") {
    await deleteDoc(doc(db, collectionName, id));
    return;
  }

  const batch = writeBatch(db);
  const mainDocRef = doc(db, "documents", id);
  batch.delete(mainDocRef);

  const auth = await import("firebase/auth");
  const currentUser = auth.getAuth().currentUser;

  const chunksQuery = query(
    collection(db, "document_chunks"),
    where("parentId", "==", id),
    where("user", "==", currentUser?.uid)
  );

  const chunksSnapshot = await getDocs(chunksQuery);
  chunksSnapshot.forEach((chunkDoc) => {
    batch.delete(chunkDoc.ref);
  });

  await batch.commit();
}

export async function renameDocument(id: string, name: string): Promise<void> {
  const db = await getDb();
  const { doc, updateDoc } = await import("firebase/firestore");
  const documentRef = doc(db, "documents", id);

  await updateDoc(documentRef, {
    nome_file: name,
  });
}

export async function getDocumentMassima(
  id: string,
  collectionName: string
): Promise<DocumentoGiurisprudenziale | string | null> {
  const db = await getDb();
  const { doc, getDoc } = await import("firebase/firestore");

  try {
    const docRef = doc(db, collectionName, id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) return null;

    const data = docSnap.data() as DocumentoGiurisprudenziale;
    return data;
  } catch (error: unknown) {
    console.error("Errore fetch documento:", error);

    if (error instanceof FirebaseError) {
      switch (error.code) {
        case "permission-denied":
          return "denied";
        case "unavailable":
          toast.error("Servizio momentaneamente non disponibile. Riprova.");
          return null;
        case "not-found":
          toast.error("Documento non trovato.");
          return null;
        default:
          toast.error("Errore Firebase nel caricamento del documento.");
          return null;
      }
    }
    if (error instanceof Error) {
      toast.error(error.message || "Errore imprevisto.");
      return null;
    }
    toast.error("Errore imprevisto nel caricamento del documento.");
    return null;
  }
}

export async function listDocumentsByUser(
  userId: string
): Promise<DocumentoGiurisprudenziale[]> {
  const db = await getDb();
  const { collection, getDocs, query, where, or } = await import(
    "firebase/firestore"
  );
  const q = query(
    collection(db, "documents"),
    or(
      where("user", "==", userId),
      where("visibleTo", "array-contains", userId)
    )
  );

  const snapshot = await getDocs(q);
  const data = snapshot.docs
    .map((d) => _mapFirestoreDocToMassima(d.id, d.data()))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  return data;
}

export const checkDuplicateDocument = async (
  uid: string,
  fileName: string
): Promise<string | null> => {
  if (!uid || !fileName) {
    return null;
  }

  const db = await getDb();
  const { collection, query, where, getDocs } = await import(
    "firebase/firestore"
  );

  console.log("Controllo duplicati per:", { uid, fileName });

  try {
    const q = query(
      collection(db, "documents"),
      where("user", "==", uid),
      where("nome_file", "==", fileName)
    );

    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      return snapshot.docs[0].id;
    }

    return null;
  } catch (error) {
    console.error(
      "Errore durante la verifica dei duplicati su Firestore:",
      error
    );
    return null;
  }
};