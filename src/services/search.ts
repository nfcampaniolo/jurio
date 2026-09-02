import type {
  DocumentoGiurisprudenziale,
  SearchTermDoc,
} from "@/interfaces/interfaces";
import { getDb } from "./db";
import { _mapFirestoreDocToMassima } from "./document";
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { makeRiferimentiNormativiKeys } from "./riferimentiTranslator";
import { FirebaseError } from "firebase/app";

export async function loadUserSearchTerms(
  uid: string,
  max = 50
): Promise<string[]> {
  const db = await getDb();
  const { collection, getDocs, query, orderBy, limit } = await import(
    "firebase/firestore"
  );

  const q = query(
    collection(db, "users", uid, "search_terms"),
    orderBy("updatedAt", "desc"),
    limit(max)
  );

  const snap = await getDocs(q);
  return snap.docs
    .map((d) => (d.data() as SearchTermDoc).term)
    .filter((t): t is string => typeof t === "string" && t.trim().length > 0);
}

export async function saveUserSearchTerm(
  uid: string,
  term: string
): Promise<void> {
  const normalized = term.trim();
  if (!normalized) return;

  const docId = encodeURIComponent(normalized.toLowerCase());

  const db = await getDb();
  const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");

  const ref = doc(db, "users", uid, "search_terms", docId);
  await setDoc(
    ref,
    { term: normalized, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

export async function findByNumeroSentenza(
  identificativo: string
): Promise<DocumentoGiurisprudenziale[]> {
  const { collection, getDocs, query, where } = await import("firebase/firestore");
  const db = await getDb();
  const sentencesRef = collection(db, "sentences");
  // 1. Estrazione di numero e anno catturandoli in gruppi separati
  const match = identificativo.match(/(\d+)\/(\d+)/);
  let variazioniNumero: string[] = [];

  if (match) {
    const numeroBase = parseInt(match[1], 10);
    const anno = match[2];
    const combinazioni = new Set<string>();
    combinazioni.add(`${numeroBase}/${anno}`);                            // 2/2026
    combinazioni.add(`${String(numeroBase).padStart(2, '0')}/${anno}`);   // 02/2026
    combinazioni.add(`${String(numeroBase).padStart(3, '0')}/${anno}`);   // 002/2026
    combinazioni.add(`${String(numeroBase).padStart(4, '0')}/${anno}`);   // 0002/2026
    combinazioni.add(`${String(numeroBase).padStart(5, '0')}/${anno}`);   // 00002/2026
    combinazioni.add(match[0]);                                           // Il pattern esatto digitato

    variazioniNumero = Array.from(combinazioni);
  }
  // 2. Costruzione delle Query
  const numeroQ = variazioniNumero.length > 0 
    ? query(sentencesRef, where("numero_sentenza", "in", variazioniNumero))
    : null;

  const ecliQ = query(sentencesRef, where("ecli", "==", identificativo.trim()));
  const urnQ  = query(sentencesRef, where("urn", "==", identificativo.trim()));

  // 3. Esecuzione simultanea (con un fallback risolto per numeroQ se null)
  const [snapNumero, snapEcli, snapUrn] = await Promise.all([
    numeroQ ? getDocs(numeroQ) : Promise.resolve({ docs: [] }),
    getDocs(ecliQ),
    getDocs(urnQ)
  ]);

  const uniqueDocs = new Map();

  // 4. Unione risultati (evitando duplicati tra le query)
  [...snapNumero.docs, ...snapEcli.docs, ...snapUrn.docs].forEach((d) => {
    uniqueDocs.set(d.id, d);
  });

  if (uniqueDocs.size === 0) return [];

  return Array.from(uniqueDocs.values()).map((d) => 
    _mapFirestoreDocToMassima(d.id, d.data())
  );
}

export async function fetchSentencesByIdsOrdered(
  ids: string[]
): Promise<DocumentoGiurisprudenziale[]> {
  const db = await getDb();
  const { doc, getDoc } = await import("firebase/firestore");

  const out: DocumentoGiurisprudenziale[] = [];

  for (const id of ids) {
    const snap = await getDoc(doc(db, "sentences", id));
    if (!snap.exists()) continue;

    // REFACTOR: Uso helper _mapFirestoreDocToMassima
    out.push(_mapFirestoreDocToMassima(snap.id, snap.data()));
  }

  return out;
}

export async function findNormativaFromUserQuery(
  userQuery: string,
  max = 50
): Promise<{ keys: string[]; docs: DocumentoGiurisprudenziale[] }> {
  const trimmed = userQuery.trim();
  if (!trimmed) return { keys: [], docs: [] };

  const keys = makeRiferimentiNormativiKeys(trimmed);
  if (keys.length === 0) return { keys: [], docs: [] };

  const db = await getDb();
  const { collection, getDocs, query, where, limit } = await import(
    "firebase/firestore"
  );

  const keys10 = keys.slice(0, 10);
  const col = collection(db, "sentences");

  const q =
    keys10.length === 1
      ? query(
          col,
          where("riferimenti_normativi_key", "array-contains", keys10[0]),
          limit(max)
        )
      : query(
          col,
          where("riferimenti_normativi_key", "array-contains-any", keys10),
          limit(max)
        );

  const snap = await getDocs(q);
  if (snap.empty) return { keys: keys10, docs: [] };

  // REFACTOR: Uso helper _mapFirestoreDocToMassima
  const docs = snap.docs.map((d) =>
    _mapFirestoreDocToMassima(d.id, d.data())
  );

  return { keys: keys10, docs };
}

export async function findBySottocategoria(
  valueLower: string,
  max = 50
): Promise<DocumentoGiurisprudenziale[]> {
  const trimmed = valueLower.trim().toLowerCase();
  if (!trimmed) return [];

  const db = await getDb();
  const { collection, getDocs, query, where, limit, or } = await import(
    "firebase/firestore"
  );

  const q = query(
    collection(db, "sentences"),
    or(
      where("sottocategoria", "array-contains", trimmed),
      where("area", "==", trimmed)
    ),
    limit(max)
  );

  const snap = await getDocs(q);
  if (snap.empty) return [];

  // REFACTOR: Uso helper _mapFirestoreDocToMassima
  return snap.docs.map((d) => _mapFirestoreDocToMassima(d.id, d.data()));
}

export async function loadDistinctSottocategorie(): Promise<string[]> {
  const db = await getDb();
  // Importiamo collection, query, getDocs e orderBy
  const { collection, getDocs, query, orderBy } = await import("firebase/firestore");
  // Riferimento alla nuova sottoraccolta
  const subcatsRef = collection(db, "meta", "taxonomy", "sottocategorie");
  // Chiediamo a Firestore di restituirci i documenti già ordinati alfabeticamente
  const q = query(subcatsRef, orderBy("nome", "asc"));
  try {
    const snap = await getDocs(q);
    if (snap.empty) return [];

    // Mappiamo i documenti estraendo solo la stringa del campo 'nome'
    return snap.docs
      .map((doc) => doc.data().nome as string)
      .filter(Boolean); // Assicuriamoci che non ci siano valori vuoti o nulli
      
  } catch (error) {
    console.error("Errore durante il caricamento delle sottocategorie:", error);
    return [];
  }
}

export async function fetchCortePaginata(
  sezione: string | null,
  tipoMassima: string | null,
  tipoCorte: string | null,
  materia: string | null,
  tipologia: string | null,
  sortDirection: "asc" | "desc" | null,
  startDate: Date | null = null,
  endDate: Date | null = null, 
  lastDoc: QueryDocumentSnapshot<DocumentData> | null = null,
  pageSize = 10
) {

  const db = await getDb();
  const { collection, getDocs, query, where, orderBy, limit, startAfter } = await import(
    "firebase/firestore"
  );

  let qr = query(
    collection(db, "sentences"),
  );
  if (sortDirection) {
    qr = query(qr, orderBy("dataSentenza", sortDirection));
  }
  if (tipoCorte) {
    qr = query(qr, where("organo_giudicante", "==", tipoCorte));
  }
  if (startDate) {
    qr = query(qr, where("dataSentenza", ">=", startDate));
  }
  
  if (endDate) {
    qr = query(qr, where("dataSentenza", "<=", endDate));
  }

  if (materia) {
    qr = query(qr, where("materia", "==", materia));
  }
  
  if (sezione) {
    qr = query(qr, where("sezione", "==", sezione));
  }

  if (tipoMassima) {
    qr = query(qr, where("tipo_massima", "==", tipoMassima));
  }

  if (tipologia) {
    const parts = tipologia.toLowerCase().split(" ");
    if (parts.includes("ordinanza") && parts.includes("cautelare")) {
      qr = query(qr, 
        where("tipo_documento", "==", "ordinanza"),
        where("tipo_ordinanza", "==", "cautelare")
      );
    } else {
      qr = query(qr, where("tipo_documento", "==", tipologia.toLowerCase()));
    }
  }

  if (lastDoc) {
    qr = query(qr, startAfter(lastDoc));
  }

  qr = query(qr, limit(pageSize));

  const snap = await getDocs(qr);
  
  const docs = snap.docs.map((doc) => 
    _mapFirestoreDocToMassima(doc.id, doc.data())
  );

  return {
    docs,
    lastVisible: snap.docs.length > 0 ? snap.docs[snap.docs.length - 1] : null
  };
}

// --- ERROR HELPERS ---

export function isAuthzError(err: unknown): boolean {
  if (err instanceof FirebaseError) {
    return err.code === "permission-denied" || err.code === "unauthenticated";
  }
  if (err instanceof Error) {
    const m = err.message.toLowerCase();
    return (
      m.includes("permission") ||
      m.includes("permission-denied") ||
      m.includes("unauthorized") ||
      m.includes("forbidden") ||
      m.includes("401") ||
      m.includes("403")
    );
  }
  return false;
}

export function isUnavailableError(err: unknown): boolean {
  return err instanceof FirebaseError && err.code === "unavailable";
}

export function isNetworkError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const m = err.message.toLowerCase();
  return (
    m.includes("network") ||
    m.includes("failed to fetch") ||
    m.includes("timeout")
  );
}