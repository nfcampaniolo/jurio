import { makeRiferimentiNormativiKeys } from '@/services/riferimentiTranslator'; 

// --- 1. METODI DI NORMALIZZAZIONE ---
function normalizzaSezioneCassazione(citazione: string, isPenale: boolean): string {
  const upper = citazione.toUpperCase();
  
  if (upper.includes("SEZ. UN") || upper.includes("SEZIONI UNITE")) {
    return isPenale ? "SEZIONI UNITE PENALI" : "SEZIONI UNITE CIVILI";
  }
  if (isPenale && upper.includes("FERIALE")) {
    return "SEZIONE FERIALE PENALE";
  }

  const map: Record<string, string> = {
    "1": "PRIMA", "I": "PRIMA",
    "2": "SECONDA", "II": "SECONDA",
    "3": "TERZA", "III": "TERZA",
    "4": "QUARTA", "IV": "QUARTA",
    "5": "QUINTA", "V": "QUINTA",
    "6": "SESTA", "VI": "SESTA",
    "7": "SETTIMA", "VII": "SETTIMA" 
  };

  // Romani ordinati per lunghezza decrescente + \b
  const match = upper.match(/SEZ\.?\s*([1-7]|VII|VI|V|IV|III|II|I)\b/);
  if (match && map[match[1]]) {
    return `${map[match[1]]} SEZIONE ${isPenale ? 'PENALE' : 'CIVILE'}`;
  }
  
  return ""; 
}

function normalizzaSezioneCDS(citazione: string): string {
  const upper = citazione.toUpperCase();
  
  if (upper.includes("PLENARIA") || upper.includes("AD. PLEN")) {
    return "PLENARIA";
  }

  const map: Record<string, string> = {
    "2": "II", "II": "II",
    "3": "III", "III": "III",
    "4": "IV", "IV": "IV",
    "5": "V", "V": "V",
    "6": "VI", "VI": "VI",
    "7": "VII", "VII": "VII"
  };

  // Romani ordinati per lunghezza decrescente + \b
  const match = upper.match(/SEZ\.?\s*([2-7]|VII|VI|V|IV|III|II)\b/);
  if (match && map[match[1]]) {
    return `SEZIONE ${map[match[1]]}`;
  }

  return "";
}

// --- 2. FUNZIONE PRINCIPALE (Con Dynamic Imports) ---

export async function cercaPrecedente(citazione: string) {
  // 1. Estrazione sincrona e veloce (nessun import necessario qui)
  const yearMatches = citazione.match(/\b(19\d{2}|20\d{2})\b/g);
  const numMatch = citazione.match(/(?:n\.|num\.|n)\s*(\d+)/i);
  if (!yearMatches || !numMatch) return null;

  const anno = yearMatches[yearMatches.length - 1];
  const numeroPuro = parseInt(numMatch[1], 10).toString(); 

  const variantiNumero = new Set<string>();
  variantiNumero.add(`${numeroPuro}/${anno}`);
  for (let i = numeroPuro.length + 1; i <= 5; i++) {
    variantiNumero.add(`${numeroPuro.padStart(i, '0')}/${anno}`);
  }
  const arrayNumeri = Array.from(variantiNumero);

  // 2. Normalizzazione Organo e Sezione
  const upperCit = citazione.toUpperCase();
  let organoTarget = "";
  let sezioneTarget = "";

  if (upperCit.includes("CASS")) {
    organoTarget = "CORTE DI CASSAZIONE";
    sezioneTarget = normalizzaSezioneCassazione(upperCit, upperCit.includes("PEN"));
  } else if (upperCit.includes("CONS") && (upperCit.includes("STATO") || upperCit.includes("ST."))) {
    organoTarget = "CONSIGLIO DI STATO";
    sezioneTarget = normalizzaSezioneCDS(upperCit);
  } else if (upperCit.includes("COST")) {
    organoTarget = "CORTE COSTITUZIONALE";
  } else {
    return null; // Se l'organo non è gestito, fermati prima di importare Firebase
  }

  // 3. Importazione Dinamica di Firebase e Esecuzione Query
  try {
    // Il browser scaricherà/eseguirà questi moduli solo arrivato a questo punto
    const { collection, query, where, limit, getDocs } = await import('firebase/firestore');
    const { getDb } = await import('@/services/db');
    const db = await getDb();
    const sentenzeRef = collection(db, 'sentences');
    
    let q = query(
      sentenzeRef,
      where('numero_sentenza', 'in', arrayNumeri),
      where('organo_giudicante', '==', organoTarget)
    );

    if (sezioneTarget !== "") {
      q = query(q, where('sezione', '==', sezioneTarget));
    }
    
    q = query(q, limit(1));

    const snapshot = await getDocs(q);

    if (snapshot.empty) return null;
    return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    
  } catch (error) {
    console.error("Errore ricerca precedente:", error);
    return null;
  }
}

export async function cercaPrecedentiPerNorme(norme: string[], maxResults: number = 41) {
  // 1. Traduci e deduplica le norme in chiavi di ricerca (es. ["cpc:a1"])
  const keys = makeRiferimentiNormativiKeys(norme);

  // Se nessuna chiave è stata generata in modo valido, ritorniamo vuoto
  if (!keys || keys.length === 0) return [];

  // Firestore supporta array-contains-any per un massimo di 10 elementi
  const safeKeys = keys.slice(0, 10);

  try {
    // 2. Importazione Dinamica di Firebase (stesso pattern di cercaPrecedente)
    const { collection, query, where, limit, getDocs, orderBy } = await import('firebase/firestore');
    const { getDb } = await import('@/services/db'); // Assicurati che il path sia corretto
    const db = await getDb();
    
    // NOTA: Sostituisci 'sentences' o 'giurisprudenza' col nome reale della tua collection
    const sentenzeRef = collection(db, 'sentences');
    
    // 3. Esecuzione Query
    const q = query(
      sentenzeRef,
      where('riferimenti_normativi_key', 'array-contains-any', safeKeys),
      orderBy('dataSentenza', 'desc'),
      limit(maxResults)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) return [];

    // Mappiamo i risultati includendo un finto "score" se devi renderli
    // compatibili con l'interfaccia della ricerca vettoriale (SentenceMatch)
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      score: 1 // Aggiunto per parità di interfaccia con la ricerca semantica
    }));
    
  } catch (error) {
    console.error("Errore ricerca precedenti per norme:", error);
    return [];
  }
}