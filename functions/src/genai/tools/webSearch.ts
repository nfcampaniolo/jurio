import { z } from "zod";
import { ai, CFG } from "../_config";
import { validateUserPlanAndLimits } from "../../_utils";
import { safeIncrementRagCounter, createResearchEmbedding } from "./_helper";
import { getSafeLimit, normalizeQuery, getHostname, isSafeHttpUrl, getDistance, normalizePrecedenti, serializeFirestoreDate } from "./_utils";
import { getDb } from "../../_deps";
import { logSafeError } from "../../_logging";

const db = getDb();

export const webSearch = ai.defineTool(
  {
    name: "webSearch",
    description:
      "Searches online across trusted legal and institutional sources for up-to-date " +
      "information regarding laws, regulations, statutes, decrees, administrative acts, " +
      "and legal commentary. MANDATORY when verifying updated legislative contents.",
    inputSchema: z.object({
      query: z
        .string()
        .min(3)
        .max(3000)
        .describe("The search query in Italian for legal and web research."),
      focus: z
        .enum(["institutional", "editorial", "all"])
        .default("all")
        .describe(
          "Filter domains: 'institutional' for official sources, 'editorial' for legal news/blogs, 'all' for both."
        ),
    }),
    outputSchema: z.any(),
  },
  async (input, options?: any) => {
    try {
      const apiKey = process.env.TAVILY_API_KEY;

      if (!apiKey) {
        return [
          {
            error: "TAVILY_API_KEY non configurata.",
          },
        ];
      }

      const userId = options?.context?.userId;

      if (userId) {
        await validateUserPlanAndLimits(userId, "web");
      }

      let domains = [
        ...CFG.domains.institutional,
        ...CFG.domains.practices,
        ...CFG.domains.editorial,
      ];

      if (input.focus === "institutional") {
        domains = [...CFG.domains.institutional];
      }

      if (input.focus === "editorial") {
        domains = [...CFG.domains.editorial];
      }

      const webLimit = getSafeLimit(options?.context?.webLimit, 5, 10);

      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: apiKey,
          query: normalizeQuery(input.query),
          search_depth: "basic",
          include_domains: domains,
          max_results: webLimit,
          include_answer: false,
          include_raw_content: false,
        }),
      });

      if (!response.ok) {
        console.error(`[Web] Tavily HTTP ${response.status}`);
        return [
          {
            error: "Il servizio di ricerca web ha restituito un errore.",
          },
        ];
      }

      const data = (await response.json()) as {
        results?: Array<{
          title?: string;
          url?: string;
          content?: string;
        }>;
      };

      const results = (data.results ?? [])
        .filter((result) => isSafeHttpUrl(result.url))
        .map((result) => ({
          title: result.title || "Risultato web",
          link: result.url!,
          url: result.url!,
          content: (
            result.content || "Contenuto non disponibile"
          ).slice(0, CFG.maxChars.web),
          source: getHostname(result.url),
          _type: "web_search",
          sourceType: "web",
        }));

      if (results.length === 0) {
        return [
          {
            message: "Nessun risultato trovato nelle fonti web configurate.",
          },
        ];
      }

      return results;
    } catch (error) {
      logSafeError("WEB_SEARCH_FAILED", error);
      return [
        {
          error: "Servizio di ricerca web non raggiungibile.",
        },
      ];
    }
  }
);

export const doctrineSearch = ai.defineTool(
  {
    name: "doctrineSearch",
    description:
      "Semantically searches the internal legal doctrine and scholarly database (Doctrine). " +
      "Use this for reports, legal opinions, regulatory developments, scholarly commentaries, " +
      "and interpretative legal documents. " +
      "Note: Results represent interpretative sources, not binding legislation.",
    inputSchema: z.object({
      query: z
        .string()
        .min(3)
        .max(4000)
        .describe("The semantic search query in Italian for scholarly legal analysis."),
      subject: z
        .string()
        .max(100)
        .optional()
        .describe("Optional legal domain/subject filter (materia)."),
      guidanceType: z
        .string()
        .max(100)
        .optional()
        .describe("Optional orientation or document type filter (tipo_orientamento)."),
      limit: z
        .number()
        .int()
        .min(1)
        .max(10)
        .optional()
        .describe("Maximum number of results to return (default is handled safely)."),
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

      if (!finalQuery) {
        return [
          {
            message: "Query Doctrine vuota.",
          },
        ];
      }

      const queryVector = await createResearchEmbedding(userId, finalQuery);
  
      const safeLimit = getSafeLimit(input.limit, 3, 5);

      let doctrineQuery = db.collection("doctrine") as FirebaseFirestore.Query;

      if (input.subject?.trim()) {
        doctrineQuery = doctrineQuery.where(
          "materia",
          "==",
          input.subject.trim().toLowerCase()
        );
      }

      if (input.guidanceType?.trim()) {
        doctrineQuery = doctrineQuery.where(
          "tipo_orientamento",
          "==",
          input.guidanceType.trim()
        );
      }

      const vectorQuery = (doctrineQuery as any).findNearest({
        vectorField: "embedding",
        queryVector,
        limit: Math.min(safeLimit * 2, 20),
        distanceMeasure: "COSINE",
        distanceThreshold: CFG.ragDistance.doctrine,
        distanceResultField: "__ragDistance",
      });

      const snapshot = await vectorQuery.get();

      if (snapshot.empty) {
        return [
          {
            message:
              "Nessun documento dottrinale semanticamente rilevante trovato.",
          },
        ];
      }

      const results = snapshot.docs
        .map((doc: any) => {
          const data = doc.data();
          const distance = getDistance(doc, queryVector);

          if (distance > CFG.ragDistance.doctrine) {
            return null;
          }

          const sourceUrl = isSafeHttpUrl(data.sourceUrl)
            ? data.sourceUrl
            : null;

          const summary = String(data.summary ?? "").slice(0, 1000);
          const orientation = String(data.orientamento ?? "").slice(0, 1000);

          const content = [summary, orientation]
            .filter(Boolean)
            .join("\n\n")
            .slice(0, 2000);

          return {
            id: doc.id,
            title:
              data.tematica ||
              data.tipo_orientamento ||
              "Documento dottrinale",
            topic: data.tematica || "",
            subject: data.materia || "",
            documentType: data.tipo_documento || "",
            guidanceType: data.tipo_orientamento || "",
            documentDate: serializeFirestoreDate(data.data_documento),
            pages: data.pagine || "",
            numberYear: data.numero_anno || "",
            origin: data.origine || "",
            citedNorms: Array.isArray(data.norme_citate)
              ? data.norme_citate.slice(0, 15)
              : [],
            citedPrecedents: normalizePrecedenti(data.precedenti_citati),
            summary,
            orientation,
            content,
            link: sourceUrl,
            url: sourceUrl,
            sourceUrl,
            source: getHostname(sourceUrl),
            _distance: distance,
            _score: Math.max(0, 1 - distance),
            _type: "web_search",
            sourceType: "doctrine",
          };
        })
        .filter(Boolean)
        .slice(0, safeLimit);

      await safeIncrementRagCounter(
        "doctrine",
        results.map((item: any) => item.id)
      );

      return results;
    } catch (error) {
      logSafeError("DOCTRINE_SEARCH_FAILED", error);
      return [
        {
          error:
            "Errore temporaneo durante la ricerca nella banca dati Doctrine.",
        },
      ];
    }
  }
);