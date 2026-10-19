import { Request, Response } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { getOpenAIClient, authenticateRequest, applyFirestoreFilters, safeTruncateText, parseLimitParam } from "./_helper";
import { corsHandlerDomain, validateUserPlanAndLimits } from "../_utils";
import { getDb } from "../_deps";

const db = getDb();

export async function executeVectorSearchDoctrine(req: Request, res: Response): Promise<any> {
  return corsHandlerDomain(req, res, async () => {
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    try {
      const client = getOpenAIClient();
      const body = (req.body ?? {}) as any; 
      const queryText = typeof body.query === "string" ? body.query.trim() : "";

      if (!queryText || queryText.length > 1500) {
        return res.status(400).json({ error: "Bad Request: Invalid 'query'" });
      }

      const limit = parseLimitParam(body.limit);
      const filters: any[] = Array.isArray(body.filters) ? body.filters : [];
      const collectionName = "doctrine";

      // Autenticazione e Verifica Piano/Limiti in Parallelo con l'Embedding
      const { uid } = await authenticateRequest(req);

      const [, embeddingPromiseResult] = await Promise.all([
        validateUserPlanAndLimits(uid, "research"),
        client.embeddings.create({
          model: "text-embedding-3-small",
          input: `Contesto giuridico italiano dottrinale: ${queryText}`,
          dimensions: 1536,
        }),
      ]);

      const queryVector = embeddingPromiseResult.data[0].embedding;

      let baseQuery = db.collection(collectionName).select(
        "tipo_documento", "origine", "numero_anno", "data_documento", 
        "tematica", "questione_di_diritto", "orientamento", "tipo_orientamento", 
        "materia", "norme_citate", "precedenti_citati", "sintesi", "url_pdf", "document_base_id"
      );

      const appliedFilters = applyFirestoreFilters(baseQuery, filters);

      const sSnap = await appliedFilters
        .findNearest({
          vectorField: "embedding",
          queryVector: FieldValue.vector(queryVector),
          limit: limit,
          distanceMeasure: "COSINE",
          distanceResultField: "distance"
        })
        .get();

      const results = sSnap.docs.map((doc: any) => {
        const data = doc.data();
        return {
          id: doc.id,
          document_base_id: data.document_base_id || null,
          url_pdf: data.url_pdf || null,
          tipo_documento: data.tipo_documento || "dottrina",
          origine: data.origine || null,
          numero_anno: data.numero_anno || null,
          data_documento: data.data_documento || null,
          tematica: data.tematica || null,
          questione_di_diritto: data.questione_di_diritto || null,
          orientamento: data.orientamento || null,
          tipo_orientamento: data.tipo_orientamento || null,
          materia: data.materia || null,
          norme_citate: data.norme_citate || [],
          precedenti_citati: data.precedenti_citati || [],
          sintesi: safeTruncateText(data.sintesi),
          _distance: typeof data.distance === "number" ? data.distance : null,
        };
      });

      return res.status(200).json({ results });

    } catch (err: any) {
      if (err.message === "UNAUTHORIZED") return res.status(401).json({ error: "Unauthorized" });
      if (err.message === "NOT_FOUND") return res.status(404).json({ error: "Not Found" });
      if (err.message === "FORBIDDEN") return res.status(403).json({ error: "Forbidden", message: "Piano non abilitato." });
      if (err.message === "TOO_MANY_REQUESTS") return res.status(429).json({ error: "Too Many Requests", details: "Limite di utilizzo superato." });

      console.error("[JURIO-SEARCH-DOCTRINE] Errore non gestito:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  });
}