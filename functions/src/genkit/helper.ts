import { OpenAI } from 'openai';
import { CFG } from "./config";
import { getKeywordStems, calculateMatchScore, applyHighlight } from '../utils';

const embeddingCache = new Map<string, number[]>();

export async function createEmbedding(text: string): Promise<number[]> {
  const cacheKey = text.trim().toLowerCase();
  
  // 1. Controllo in RAM: se abbiamo già l'embedding, restituiscilo subito (0ms di latenza)
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey)!;
  }

  // 2. Esecuzione standard API OpenAI
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const res = await client.embeddings.create({
    model: CFG.EMBEDDING_MODEL,
    input: text.trim(),
    dimensions: CFG.EMBEDDING_DIMS,
  });
  
  const vector = res.data[0].embedding;

  // 3. Meccanismo di sicurezza: svuota la cache se supera i 1000 elementi 
  if (embeddingCache.size > 1000) {
    embeddingCache.clear();
  }
  
  // 4. Salva il nuovo embedding e restituiscilo
  embeddingCache.set(cacheKey, vector);
  return vector;
}

export function getSafeDistance(queryVec: number[], docVec: any, fallbackDist: number = 0.25): number {
  const vecArray = docVec?.toArray ? docVec.toArray() : docVec;
  if (!queryVec || !vecArray || queryVec.length !== vecArray.length) return fallbackDist;
  
  let dotProduct = 0;
  for (let i = 0; i < queryVec.length; i++) {
    dotProduct += queryVec[i] * vecArray[i];
  }
  return 1 - dotProduct; 
}

export function mapToObject(doc: FirebaseFirestore.QueryDocumentSnapshot, keywords: string[]) {
  const data = doc.data();
  const kwObjects = getKeywordStems(keywords.join(" "));
  const stemsList = kwObjects.map(k => k.stem);
  const originalKws = kwObjects.map(k => k.original);

  const primaryText = data.summary || data.massima || "";
  const secondaryText = data.summary ? (data.massima || "") : (data.fattispecie || "");
  const contentForScore = `${primaryText} ${secondaryText}`.toLowerCase();
  
  const scores = calculateMatchScore(contentForScore, kwObjects, data);
  const MAX_CHARS = CFG.MAX_FIELD_CHARS || 3000;

  return {
    id: doc.id, 
    numero_sentenza: data.numero_sentenza || null,
    organo_giudicante: data.organo_giudicante || null,
    sezione: data.sezione || null, 
    dataSentenza: data.dataSentenza || null,
    massima: data.massima ? data.massima.toString().substring(0, MAX_CHARS) : null,
    summary: data.summary ? data.summary.toString().substring(0, MAX_CHARS) : null,
    _matchCount: Math.floor(scores.textMatchScore), 
    _distance: 0,
    _effectiveDistance: 0,
    _source: "database_query",
    highlighted_massima: applyHighlight(primaryText.toString(), originalKws, stemsList)
  };
}
