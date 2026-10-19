import { z } from "zod";
import { ai, CFG } from "../_config";
import { normalizeQuery, getDistance } from "./_utils";
import { createEmbedding } from "./_helper";
import { getDb } from "../../_deps";

const db = getDb();
const MAX_VECTOR_FETCH = Math.max(CFG.limits.vectorFetchLimit, 10);

export const userManualSearch = ai.defineTool(
  {
    name: "userManualSearch",
    description:
      "Use this tool EXCLUSIVELY for questions about Jurio platform features, " +
      "user guides, capabilities, system limits, pricing plans, privacy policy, " +
      "GDPR compliance, and internal system documentation. " +
      "DO NOT use for legal case law, statutes, or court rulings.",
    inputSchema: z.object({
      query: z
        .string()
        .min(3)
        .max(3000)
        .describe("The search query in Italian to look up inside Jurio's platform documentation."),
    }),
    outputSchema: z.any(),
  },
  async (input) => {
    try {
      const finalQuery = normalizeQuery(input.query);

      if (!finalQuery) {
        return [
          {
            message: "Query manuale vuota.",
          },
        ];
      }

      const queryVector = await createEmbedding(finalQuery);

      const manualRef = db.collection("manual");
      const vectorQuery = (manualRef as any).findNearest({
        vectorField: "embedding",
        queryVector,
        limit: MAX_VECTOR_FETCH,
        distanceMeasure: "COSINE",
        distanceThreshold: CFG.ragDistance.manual,
        distanceResultField: "__ragDistance",
      });

      const snapshot = await vectorQuery.get();

      if (snapshot.empty) {
        return [
          {
            message: "Nessuna informazione pertinente trovata nel manuale.",
          },
        ];
      }

      const results = snapshot.docs
        .map((doc: any) => {
          const data = doc.data();
          const distance = getDistance(doc, queryVector);

          return {
            id: doc.id,
            text: data.text || "",
            links: Array.isArray(data.links) ? data.links : [],
            images: data.images || "",
            _distance: distance,
            _score: Math.max(0, 1 - distance),
            _type: "manual_documentation",
            sourceType: "manual",
          };
        })
        .filter((item: any) => item._distance <= CFG.ragDistance.manual)
        .sort((a: any, b: any) => a._distance - b._distance)
        .slice(0, CFG.limits.maxManualLimit);

      if (results.length === 0) {
        return [
          {
            message: `Nessuna informazione pertinente trovata nel manuale per "${finalQuery}".`,
          },
        ];
      }

      return results;
    } catch (error) {
      console.error("[Tool userManualSearch]", error);
      return [
        {
          error: "Errore durante la ricerca nel manuale di Jurio.",
        },
      ];
    }
  }
);