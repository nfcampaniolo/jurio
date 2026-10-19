import { Request, Response } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { getOpenAIClient, authenticateRequest, applyFirestoreFilters, safeTruncateText, parseLimitParam } from "./_helper";
import { corsHandlerDomain, validateUserPlanAndLimits,  } from "../_utils";
import { incrementRagCounter } from "../genai/_utils";
import { SearchRequestBody, FilterInput, ScoredJurioItem, JurioSentenceDoc} from "./_interfaces";
import { getKeywordStems, calculateMatchScore, applyHighlightWithRegex, generateHighlightRegex } from "./_utils";
import { getDb } from "../_deps";
import { legalGeminiFallbackFlow } from '../genai/supportAgent/flow';

const db = getDb();

export async function executeVectorSearchJurio(req: Request, res: Response): Promise<any> {
  return corsHandlerDomain(req, res, async () => {
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    try {
      const client = getOpenAIClient();
      const body = (req.body ?? {}) as SearchRequestBody;
      const queryText = typeof body.query === "string" ? body.query.trim() : "";

      if (!queryText || queryText.length > 1500) {
        return res.status(400).json({ error: "Bad Request: Invalid or excessively long 'query'" });
      }

      const limit = parseLimitParam(body.limit);
      const filters: FilterInput[] = Array.isArray(body.filters) ? body.filters : [];
      const collectionName = "sentences";

      let kwObjects = getKeywordStems(queryText);
      let originalKws = kwObjects.map((k: { original: string }) => k.original);
      let stemsList = kwObjects.map((k: { stem: string }) => k.stem);

      const totalKeywords = kwObjects.length;
      let minRequiredKeywords = Math.max(1, Math.ceil(totalKeywords * 0.8));

      // Autenticazione e Verifica Piano/Limiti in Parallelo con l'Embedding
      const { uid, isOAuthRequest } = await authenticateRequest(req);

      const [, embeddingPromiseResult] = await Promise.all([
        validateUserPlanAndLimits(uid, "research"),
        client.embeddings.create({
          model: "text-embedding-3-small",
          input: `Contesto giuridico italiano dottrinale: ${queryText}`,
          dimensions: 1536,
        }),
      ]);

      const queryVector = embeddingPromiseResult.data[0].embedding;

      let baseQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection(collectionName).select(
        "tipo_documento", "fonte", "logo_fonte", "organo_giudicante", "sezione", 
        "numero_sentenza", "dataSentenza", "data_sentenza", "ecli", "urn",
        "tipo_ordinanza", "efficacia_temporale", "misura_disposta", "fumus_boni_iuris", "periculum_in_mora",
        "tipo_decreto", "contraddittorio", "autorita_monocratica", "contenuto_precettivo",
        "massima", "summary", "fattispecie_rilevante"
      );

      const appliedFilters = applyFirestoreFilters(baseQuery, filters);

      const performSearchAndScoring = async (vector: number[], currentKwObjects: any[]): Promise<ScoredJurioItem[]> => {
        const candidateLimit = Math.min(Math.max(limit * 2, 50), 100);
      
        const sSnap = await appliedFilters
          .findNearest({
            vectorField: "embedding",
            queryVector: FieldValue.vector(vector),
            limit: candidateLimit,
            distanceMeasure: "COSINE",
            distanceResultField: "distance"
          })
          .get();

        const maxScoringCandidates = Math.min(limit * 2, 40); 
        const candidateDocs = sSnap.docs.slice(0, maxScoringCandidates);

        return candidateDocs
          .map((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
            const data = doc.data() as JurioSentenceDoc;
            const content = [data.summary, data.massima, data.fattispecie_rilevante]
              .filter(Boolean)
              .join(" ");

            const scores = calculateMatchScore(content, currentKwObjects, data);
            
            const distanceData = doc.data() as { distance?: number };
            const baseDistance = typeof distanceData.distance === "number" ? distanceData.distance : 0.8;

            let rankingDistance = scores.textMatchScore === 0
                ? baseDistance * 1.25
                : baseDistance * Math.pow(0.96, scores.textMatchScore);

            rankingDistance -= (scores.authorityBonus ?? 0) + (scores.recencyBonus ?? 0);
            rankingDistance = Math.max(0.001, rankingDistance);

            return {
              id: doc.id,
              url: `https://jurio.it/giurisprudenza/${doc.id}`,
              tipo_documento: data.tipo_documento || "sentenza",
              fonte: data.fonte || null,
              logo_fonte: data.logo_fonte || null,
              organo_giudicante: data.organo_giudicante || null,
              sezione: data.sezione || null,
              numero_sentenza: data.numero_sentenza || null,
              dataSentenza: data.dataSentenza || data.data_sentenza || null,
              data_sentenza: data.data_sentenza || data.dataSentenza || null,
              ecli: data.ecli || null,
              urn: data.urn || null,
              tipo_ordinanza: data.tipo_ordinanza || null,
              efficacia_temporale: data.efficacia_temporale || null,
              misura_disposta: data.misura_disposta || null,
              fumus_boni_iuris: data.fumus_boni_iuris || null,
              periculum_in_mora: data.periculum_in_mora || null,
              tipo_decreto: data.tipo_decreto || null,
              contraddittorio: data.contraddittorio ?? null,
              autorita_monocratica: data.autorita_monocratica ?? null,
              contenuto_precettivo: data.contenuto_precettivo || null,
              massima: safeTruncateText(data.massima),
              summary: safeTruncateText(data.summary),
              fattispecie_rilevante: safeTruncateText(data.fattispecie_rilevante),
              _matchCount: Math.floor(scores.textMatchScore ?? 0),
              _distance: baseDistance,
              _rankingDistance: rankingDistance,
              _source: "direct" as const,
            };
          })
          .filter((item: ScoredJurioItem) => item._matchCount > 0 || item._distance <= 0.75)
          .sort((a: ScoredJurioItem, b: ScoredJurioItem) => a._rankingDistance - b._rankingDistance);
      };

      let scoredItems = await performSearchAndScoring(queryVector, kwObjects);

      let geminiResponsePayload: { sintesi: string, queryAlternativa: string } | null = null;
      const FALLBACK_THRESHOLD = 0.7; 
      const needsFallback = scoredItems.length === 0 || scoredItems[0]._rankingDistance > FALLBACK_THRESHOLD;

      if (needsFallback && !isOAuthRequest) {
        try {
          const fallbackResult = await legalGeminiFallbackFlow({ query: queryText });
          
          if (fallbackResult && typeof fallbackResult.sintesi === "string" && typeof fallbackResult.queryAlternativa === "string") {
            geminiResponsePayload = {
              sintesi: fallbackResult.sintesi,
              queryAlternativa: fallbackResult.queryAlternativa,
            };

            const altQueryText = fallbackResult.queryAlternativa;
            kwObjects = getKeywordStems(altQueryText); 
            originalKws = kwObjects.map((k: { original: string }) => k.original);
            stemsList = kwObjects.map((k: { stem: string }) => k.stem);
            minRequiredKeywords = Math.max(1, Math.ceil(kwObjects.length * 0.8));

            const altEmbeddingRes = await client.embeddings.create({
              model: "text-embedding-3-small",
              input: `Contesto giuridico italiano: ${altQueryText}`,
              dimensions: 1536,
            });
            
            const altScoredItems = await performSearchAndScoring(altEmbeddingRes.data[0].embedding, kwObjects);

            if (altScoredItems.length > 0) {
              scoredItems = altScoredItems.map((item) => ({
                ...item,
                _source: "gemini_fallback",
              }));
            }
          }
        } catch (geminiErr) {
          console.error(`[JURIO-SEARCH] Errore fallback Genkit per UID ${uid}:`, geminiErr);
        }
      }

      const highlightRegex = generateHighlightRegex(originalKws, stemsList);
      const limitedItems = scoredItems.slice(0, limit);

      const finalItems = limitedItems.map((item) => ({
        ...item,
        highlighted_massima: item.massima ? applyHighlightWithRegex(item.massima, highlightRegex) : null,
        highlighted_fattispecie: item.fattispecie_rilevante ? applyHighlightWithRegex(item.fattispecie_rilevante, highlightRegex) : null,
        highlighted_preview: item.summary ? applyHighlightWithRegex(item.summary, highlightRegex) : null,
      }));

      const topMatches = finalItems.filter((item) => item._matchCount >= minRequiredKeywords);
      const regularMatches = finalItems.filter((item) => item._matchCount < minRequiredKeywords);
      const extractedIds = finalItems.map((d) => d.id);
      
      if (extractedIds.length > 0) {
        incrementRagCounter(collectionName, extractedIds).catch(err => 
          console.error("[JURIO-SEARCH] Errore incremento contatore RAG:", err)
        );
      }

      return res.status(200).json({
        ids: extractedIds,
        topMatches,
        allMatches: regularMatches,
        status: geminiResponsePayload ? "GEMINI_FALLBACK" : "SUCCESS",
        webFallback: geminiResponsePayload,
        metadata: {
          total: scoredItems.length,
          keywords: originalKws,
          threshold: minRequiredKeywords,
          bestDistance: scoredItems.length > 0 ? scoredItems[0]._rankingDistance : null,
        },
      });

    } catch (err: any) {
      if (err.message === "UNAUTHORIZED") return res.status(401).json({ error: "Unauthorized" });
      if (err.message === "NOT_FOUND") return res.status(404).json({ error: "Not Found" });
      if (err.message === "FORBIDDEN") return res.status(403).json({ error: "Forbidden", message: "Piano non abilitato." });
      if (err.message === "TOO_MANY_REQUESTS") return res.status(429).json({ error: "Too Many Requests", details: "Limite di utilizzo superato." });

      console.error("[JURIO-SEARCH] Errore non gestito:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });
}