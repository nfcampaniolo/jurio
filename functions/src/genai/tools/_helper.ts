import { OpenAI } from 'openai';
import { CFG } from "../_config";
import { getKeywordStems, calculateMatchScore, applyHighlight } from "../../research/_utils";
import { incrementRagCounter } from "../_utils";
import { validateUserPlanAndLimits } from "../../_utils";

export async function safeIncrementRagCounter(
  collection: string,
  ids: string[]
): Promise<void> {
  if (!ids.length) {
    return;
  }
  try {
    await incrementRagCounter(collection, ids);
  } catch (error) {
    console.error(`[RAG] Errore incrementRagCounter(${collection}):`, error);
  }
}

export async function createResearchEmbedding(
  userId: string,
  query: string
): Promise<number[]> {
  if (!userId) {
    throw new Error("UNAUTHORIZED");
  }
  await validateUserPlanAndLimits(userId, "research");
  return createEmbedding(query);
}

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
    model: CFG.embedding.model,
    input: text.trim(),
    dimensions: CFG.embedding.dimensions,
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

export function mapToObject(doc: FirebaseFirestore.QueryDocumentSnapshot, keywords: string[]) {
  const data = doc.data();
  const kwObjects = getKeywordStems(keywords.join(" "));
  const stemsList = kwObjects.map(k => k.stem);
  const originalKws = kwObjects.map(k => k.original);

  const primaryText = data.summary || data.massima || "";
  const secondaryText = data.summary ? (data.massima || "") : (data.fattispecie || "");
  const contentForScore = `${primaryText} ${secondaryText}`.toLowerCase();
  
  const scores = calculateMatchScore(contentForScore, kwObjects, data);
  const MAX_CHARS = CFG.maxChars.field || 3000;

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