import { z } from "zod";
import { ai, CFG } from "../_config";
import { getSafeLimit, normalizeQuery, passesUiFilters, isSafeHttpUrl, getDistance, applyUiFilters } from "./_utils";
import { safeIncrementRagCounter, mapToObject, createResearchEmbedding} from "./_helper";
import { makeRiferimentiNormativiKeys } from "../../_riferimenti_normativi";
import { getDb } from "../../_deps";
import { logSafeError } from "../../_logging";

const db = getDb();
const MAX_VECTOR_FETCH = Math.max(CFG.limits.vectorFetchLimit, 10);

export const internalDatabaseSearch = ai.defineTool(
  {
    name: "internalDatabaseSearch",
    description:
      "Searches the internal database for Italian case law and legal precedents. " +
      "Use 'exact' for explicit sentence numbers, ECLI, or URN identifiers. " +
      "Use 'legal_reference' for statutory references (e.g., specific law articles or codes). " +
      "Use 'semantic' for broad legal concepts, factual scenarios, and general precedents.",
    inputSchema: z.object({
      searchType: z
        .enum(["semantic", "exact", "legal_reference"])
        .describe("The strategy to use for querying the database."),
      query: z
        .string()
        .max(3000)
        .optional()
        .describe("The search query or statutory reference in Italian."),
      caseNumber: z
        .string()
        .max(100)
        .optional()
        .describe("The exact case sentence number, ECLI, or URN."),
    }),
    outputSchema: z.any(),
  },
  async (input, { context }) => {
    try {
      const { searchType, query, caseNumber } = input;
      const userId = context?.userId;
      const safeLimit = getSafeLimit(context?.dbLimit, 10, CFG.limits.maxDbLimit);
      const finalQuery = normalizeQuery(query || caseNumber);

      if (!finalQuery) {
        return [
          {
            message:
              "È necessario specificare una query o il numero della sentenza.",
          },
        ];
      }

      const uiFilters = context?.uiFilters ?? [];

      // ----------------------------------------------------------------------
      // 1. RICERCA PUNTUALE (EXACT)
      // ----------------------------------------------------------------------
      if (searchType === "exact") {
        const identifier = finalQuery;
        const match = identifier.match(/\d+\s*\/\s*\d{4}/);
        const sanitizedNumero = match
          ? match[0].replace(/\s+/g, "")
          : identifier;

        const sentencesRef = db.collection("sentences");

        const [snapNumero, snapEcli, snapUrn] = await Promise.all([
          sentencesRef
            .where("numero_sentenza", "==", sanitizedNumero)
            .limit(5)
            .get(),
          sentencesRef
            .where("ecli", "==", identifier)
            .limit(5)
            .get(),
          sentencesRef
            .where("urn", "==", identifier)
            .limit(5)
            .get(),
        ]);

        const uniqueDocs = new Map<
          string,
          FirebaseFirestore.QueryDocumentSnapshot
        >();

        [...snapNumero.docs, ...snapEcli.docs, ...snapUrn.docs].forEach(
          (doc) => {
            uniqueDocs.set(doc.id, doc);
          }
        );

        if (uniqueDocs.size === 0) {
          return [
            {
              message: `Nessuna sentenza trovata nel database interno per "${identifier}".`,
            },
          ];
        }

        const filteredDocs = Array.from(uniqueDocs.values()).filter((doc) =>
          passesUiFilters(doc.data(), uiFilters)
        );

        const resultDocs = filteredDocs.slice(0, safeLimit);

        await safeIncrementRagCounter(
          "sentences",
          resultDocs.map((doc) => doc.id)
        );

        return resultDocs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            caseNumber: data.numero_sentenza ?? "",
            court: data.organo_giudicante ?? "",
            ecli: data.ecli ?? "",
            urn: data.urn ?? "",
            summary: data.summary || data.massima || "",
            sourceUrl: isSafeHttpUrl(data.sourceUrl) ? data.sourceUrl : null,
            _distance: 0,
            _score: 1,
            _type: "giurisprudenza_puntuale",
            sourceType: "case_law",
          };
        });
      }

      // ----------------------------------------------------------------------
      // 2. RICERCA NORMATIVA (LEGAL_REFERENCE)
      // ----------------------------------------------------------------------
      if (searchType === "legal_reference") {
        const keys = makeRiferimentiNormativiKeys(finalQuery);

        if (keys.length === 0) {
          return [
            {
              message: `Non è stato possibile estrarre un riferimento normativo valido da "${finalQuery}".`,
            },
          ];
        }

        let baseQuery = db
          .collection("sentences")
          .where("riferimenti_normativi_key", "array-contains-any", keys.slice(0, 5));

        baseQuery = applyUiFilters(
          baseQuery as FirebaseFirestore.Query,
          uiFilters
        );

        const snapshot = await baseQuery.limit(safeLimit).get();

        if (snapshot.empty) {
          return [
            {
              message: `Nessun provvedimento trovato per il riferimento normativo: ${keys.join(", ")}.`,
            },
          ];
        }

        await safeIncrementRagCounter(
          "sentences",
          snapshot.docs.map((doc) => doc.id)
        );

        return snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            ...mapToObject(doc, keys),
            id: doc.id,
            caseNumber: data.numero_sentenza ?? "",
            court: data.organo_giudicante ?? "",
            summary: data.summary || data.massima || "",
            sourceUrl: isSafeHttpUrl(data.sourceUrl) ? data.sourceUrl : null,
            _distance: 0,
            _score: 1,
            _type: "giurisprudenza_normativa",
            sourceType: "case_law",
          };
        });
      }

      // ----------------------------------------------------------------------
      // 3. RICERCA SEMANTICA (SEMANTIC)
      // ----------------------------------------------------------------------
      if (!userId) {
        return [
          {
            error: "Autenticazione mancante.",
          },
        ];
      }

      const queryVector = await createResearchEmbedding(userId, finalQuery);

      let baseQuery = db.collection("sentences") as FirebaseFirestore.Query;
      baseQuery = applyUiFilters(baseQuery, uiFilters);

      const vectorQuery = (baseQuery as any).findNearest({
        vectorField: "embedding",
        queryVector,
        limit: Math.min(Math.max(safeLimit * 2, MAX_VECTOR_FETCH), 50),
        distanceMeasure: "COSINE",
        distanceThreshold: CFG.ragDistance.sentence,
        distanceResultField: "__ragDistance",
      });

      const snapshot = await vectorQuery.get();

      if (snapshot.empty) {
        return [
          {
            message: "Nessun precedente semanticamente rilevante trovato.",
          },
        ];
      }

      const results = snapshot.docs
        .map((doc: any) => {
          const data = doc.data();
          const rawDistance = getDistance(doc, queryVector);

          return {
            id: doc.id,
            caseNumber: data.numero_sentenza ?? "",
            court: data.organo_giudicante ?? "",
            summary: data.summary || data.massima || "",
            sourceUrl: isSafeHttpUrl(data.sourceUrl) ? data.sourceUrl : null,
            _distance: rawDistance,
            _score: Math.max(0, 1 - rawDistance),
            _type: "giurisprudenza_semantica",
            sourceType: "case_law",
          };
        })
        .filter((item: any) => item._distance <= CFG.ragDistance.sentence)
        .slice(0, safeLimit);

      await safeIncrementRagCounter(
        "sentences",
        results.map((item: any) => item.id)
      );

      return results;
    } catch (error) {
      logSafeError("INTERNAL_DATABASE_SEARCH_FAILED", error);
      return [
        {
          error:
            "Errore temporaneo durante la ricerca nel database giurisprudenziale.",
        },
      ];
    }
  }
);

export const analyzeDistinguishingFacts = ai.defineTool(
  {
    name: "analyzeDistinguishingFacts",
    description:
      "Searches for factually similar legal precedents to perform legal distinguishing. " +
      "Use this when comparing the user's specific factual scenario " +
      "against cases previously analyzed by Italian jurisprudence.",
    inputSchema: z.object({
      query: z
        .string()
        .min(10)
        .max(5000)
        .describe(
          "Detailed description in Italian of the factual circumstances of the case."
        ),
    }),
    outputSchema: z.any(),
  },
  async (input, { context }) => {
    try {
      const userId = context?.userId;

      if (!userId) {
        return [
          {
            error: "Autenticazione mancante.",
          },
        ];
      }

      const finalQuery = normalizeQuery(input.query);
      const queryVector = await createResearchEmbedding(userId, finalQuery);

      const baseQuery = applyUiFilters(
        db.collection("sentences") as FirebaseFirestore.Query,
        context?.uiFilters ?? []
      );

      const vectorQuery = (baseQuery as any).findNearest({
        vectorField: "embedding",
        queryVector,
        limit: CFG.limits.maxDistinguishLimit,
        distanceMeasure: "COSINE",
        distanceThreshold: CFG.ragDistance.distinguish,
        distanceResultField: "__ragDistance",
      });

      const snapshot = await vectorQuery.get();

      if (snapshot.empty) {
        return [
          {
            message: "Nessun precedente fattualmente simile trovato.",
          },
        ];
      }

      const results = snapshot.docs
        .map((doc: any) => {
          const data = doc.data();
          const distance = getDistance(doc, queryVector);

          return {
            id: doc.id,
            caseNumber: data.numero_sentenza ?? "",
            court: data.organo_giudicante ?? "",
            caseFacts:
              data.fattispecie_rilevante ||
              "Fatti non separati - deducibili dalla massima",
            legalPrinciple: data.massima || data.summary || "",
            sourceUrl: isSafeHttpUrl(data.sourceUrl) ? data.sourceUrl : null,
            _distance: distance,
            _score: Math.max(0, 1 - distance),
            _type: "giurisprudenza_distinguish",
            sourceType: "case_law",
          };
        })
        .filter((item: any) => item._distance <= CFG.ragDistance.distinguish);

      return results;
    } catch (error) {
      logSafeError("DISTINGUISHING_FACTS_ANALYSIS_FAILED", error);
      return [
        {
          error:
            "Errore temporaneo durante l'analisi della fattispecie.",
        },
      ];
    }
  }
);