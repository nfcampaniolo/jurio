import { OpenAI } from 'openai';
import { CFG } from "../_config";
import { getKeywordStems, calculateMatchScore, applyHighlight } from "../../research/_utils";
import { incrementRagCounter } from "../_utils";
import { validateUserPlanAndLimits } from "../../_utils";
import { logSafeError } from "../../_logging";

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
    logSafeError("RAG_COUNTER_UPDATE_FAILED", error);
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
const embeddingRequests = new Map<string, Promise<number[]>>();
let openAIClient: OpenAI | undefined;

export async function createEmbedding(text: string): Promise<number[]> {
  const cacheKey = text.trim().toLowerCase();
  const cached = embeddingCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const pending = embeddingRequests.get(cacheKey);
  if (pending) {
    return pending;
  }

  const request = (async () => {
    openAIClient ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const response = await openAIClient.embeddings.create({
      model: CFG.embedding.model,
      input: text.trim(),
      dimensions: CFG.embedding.dimensions,
    });

    const vector = response.data[0].embedding;
    if (embeddingCache.size >= 1000) {
      const oldestKey = embeddingCache.keys().next().value;
      if (oldestKey) embeddingCache.delete(oldestKey);
    }
    embeddingCache.set(cacheKey, vector);
    return vector;
  })();

  embeddingRequests.set(cacheKey, request);
  try {
    return await request;
  } finally {
    embeddingRequests.delete(cacheKey);
  }
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