import { ai } from "./config";
import { z } from "genkit";
import { getDb } from "../deps";
import { enableFirebaseTelemetry } from "@genkit-ai/firebase";
import { CFG } from "./config";
import {
  makeRiferimentiNormativiKeys,
  incrementRagCounter,
  consumeDailyFeature,
  consumePerMinuteFeature,
} from "../utils";
import {
  mapToObject,
  createEmbedding,
  getSafeDistance,
} from "./helper";
import {
  WhereFilterOp,
} from "firebase-admin/firestore";

const db = getDb();

enableFirebaseTelemetry();

const RESEARCH_LIMITS = {
  perMinute: 20,
  perDay: 200,
};

const MAX_DB_LIMIT = 12;
const MAX_DOCTRINE_LIMIT = 8;
const MAX_DISTINGUISH_LIMIT = 3;
const MAX_MANUAL_LIMIT = 2;

const MAX_VECTOR_FETCH = Math.max(
  Number(CFG.VECTOR_FETCH_LIMIT ?? 20),
  10
);

const MAX_DOCS_PER_IN_QUERY = 30;

const RAG_DISTANCE = {
  sentence: Number(CFG.MAX_ALLOWED_DISTANCE ?? 0.45),
  document: Number(CFG.MAX_DOCUMENT_DISTANCE ?? CFG.MAX_ALLOWED_DISTANCE ?? 0.50),
  doctrine: Number(CFG.MAX_DOCTRINE_DISTANCE ?? CFG.MAX_ALLOWED_DISTANCE ?? 0.45),
  distinguish: Number(CFG.MAX_DISTINGUISH_DISTANCE ?? CFG.MAX_ALLOWED_DISTANCE ?? 0.50),
  manual: Number(CFG.MAX_MANUAL_DISTANCE ?? CFG.MAX_ALLOWED_DISTANCE ?? 0.50),
};

function getSafeLimit(
  value: unknown,
  fallback: number,
  max: number
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(Math.floor(parsed), 1), max);
}

async function checkResearchQuota(
  userId: string,
  feature: "research" | "web_search"
): Promise<void> {
  if (!userId) {
    throw new Error("userId mancante.");
  }
  const limits = RESEARCH_LIMITS;
  await Promise.all([
    consumePerMinuteFeature(userId, feature as any, limits.perMinute),
    consumeDailyFeature(userId, feature as any, limits.perDay),
  ]);
}

async function createResearchEmbedding(
  userId: string,
  query: string
): Promise<number[]> {
  await checkResearchQuota(userId, "research");
  return createEmbedding(query);
}

async function safeIncrementRagCounter(
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

function chunkArray<T>(items: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size));
  }
  return result;
}

function isSafeHttpUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !!url.hostname;
  } catch {
    return false;
  }
}

function getHostname(value: unknown): string {
  if (!isSafeHttpUrl(value)) {
    return "Fonte web";
  }
  try {
    return new URL(value).hostname;
  } catch {
    return "Fonte web";
  }
}

function normalizeQuery(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function getDistance(doc: any, queryVector: number[]): number {
  const docDistance = doc?.distance;
  if (typeof docDistance === "number" && Number.isFinite(docDistance)) {
    return docDistance;
  }
  return getSafeDistance(queryVector, doc?.data?.()?.embedding);
}

function applyUiFilters(
  baseQuery: FirebaseFirestore.Query,
  filters: unknown
): FirebaseFirestore.Query {
  if (!Array.isArray(filters)) {
    return baseQuery;
  }

  let query = baseQuery;

  for (const filter of filters.slice(0, 10)) {
    if (!filter || typeof filter !== "object") {
      continue;
    }

    const { field, operator, value } = filter as {
      field?: unknown;
      operator?: unknown;
      value?: unknown;
    };

    if (
      typeof field !== "string" ||
      typeof operator !== "string" ||
      value === undefined
    ) {
      continue;
    }

    let normalizedValue = value;

    if (field === "dataSentenza" && typeof value === "string") {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        normalizedValue = parsed;
      }
    }

    const allowedOperators: WhereFilterOp[] = [
      "==",
      "!=",
      "<",
      "<=",
      ">",
      ">=",
      "array-contains",
      "in",
      "array-contains-any",
      "not-in",
    ];

    if (!allowedOperators.includes(operator as WhereFilterOp)) {
      continue;
    }

    query = query.where(
      field,
      operator as WhereFilterOp,
      normalizedValue
    );
  }

  return query;
}

export const ricercaDatabaseInterno = ai.defineTool(
  {
    name: "ricercaDatabaseInterno",
    description:
      "Cerca nel database interno di giurisprudenza. " +
      "Usa 'puntuale' per numero/ECLI/URN di sentenza, " +
      "'normativa' per riferimenti normativi e " +
      "'semantica' per concetti, principi, fattispecie e precedenti simili.",
    inputSchema: z.object({
      tipo_ricerca: z.enum(["semantica", "puntuale", "normativa"]),
      query: z.string().max(3000).optional(),
      numero_sentenza: z.string().max(100).optional(),
    }),
    outputSchema: z.any(),
  },
  async (input, { context }) => {
    try {
      const { tipo_ricerca, query, numero_sentenza } = input;
      const userId = context?.userId;
      const safeLimit = getSafeLimit(context?.dbLimit, 10, MAX_DB_LIMIT);
      const finalQuery = normalizeQuery(query || numero_sentenza);

      if (!finalQuery) {
        return [
          {
            messaggio:
              "È necessario specificare una query o il numero della sentenza.",
          },
        ];
      }

      const uiFilters = context?.uiFilters ?? [];

      if (tipo_ricerca === "puntuale") {
        const identificativo = finalQuery;
        const match = identificativo.match(/\d+\s*\/\s*\d{4}/);
        const sanitizedNumero = match
          ? match[0].replace(/\s+/g, "")
          : identificativo;

        const sentencesRef = db.collection("sentences");

        const [snapNumero, snapEcli, snapUrn] = await Promise.all([
          sentencesRef
            .where("numero_sentenza", "==", sanitizedNumero)
            .limit(5)
            .get(),
          sentencesRef
            .where("ecli", "==", identificativo)
            .limit(5)
            .get(),
          sentencesRef
            .where("urn", "==", identificativo)
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
              messaggio: `Nessuna sentenza trovata nel database interno per "${identificativo}".`,
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
            numero_sentenza: data.numero_sentenza ?? "",
            organo_giudicante: data.organo_giudicante ?? "",
            ecli: data.ecli ?? "",
            urn: data.urn ?? "",
            massima: data.summary || data.massima || "",
            sourceUrl: isSafeHttpUrl(data.sourceUrl) ? data.sourceUrl : null,
            _distance: 0,
            _score: 1,
            _type: "giurisprudenza_puntuale",
            sourceType: "case_law",
          };
        });
      }

      if (tipo_ricerca === "normativa") {
        const keys = makeRiferimentiNormativiKeys(finalQuery);

        if (keys.length === 0) {
          return [
            {
              messaggio: `Non è stato possibile estrarre un riferimento normativo valido da "${finalQuery}".`,
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
              messaggio: `Nessun provvedimento trovato per il riferimento normativo: ${keys.join(", ")}.`,
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
            numero_sentenza: data.numero_sentenza ?? "",
            organo_giudicante: data.organo_giudicante ?? "",
            massima: data.summary || data.massima || "",
            sourceUrl: isSafeHttpUrl(data.sourceUrl) ? data.sourceUrl : null,
            _distance: 0,
            _score: 1,
            _type: "giurisprudenza_normativa",
            sourceType: "case_law",
          };
        });
      }

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
        distanceThreshold: RAG_DISTANCE.sentence,
        distanceResultField: "__ragDistance",
      });

      const snapshot = await vectorQuery.get();

      if (snapshot.empty) {
        return [
          {
            messaggio: "Nessun precedente semanticamente rilevante trovato.",
          },
        ];
      }

      const results = snapshot.docs
        .map((doc: any) => {
          const data = doc.data();
          const rawDistance = getDistance(doc, queryVector);

          return {
            id: doc.id,
            numero_sentenza: data.numero_sentenza ?? "",
            organo_giudicante: data.organo_giudicante ?? "",
            massima: data.summary || data.massima || "",
            sourceUrl: isSafeHttpUrl(data.sourceUrl) ? data.sourceUrl : null,
            _distance: rawDistance,
            _score: Math.max(0, 1 - rawDistance),
            _type: "giurisprudenza_semantica",
            sourceType: "case_law",
          };
        })
        .filter((item: any) => item._distance <= RAG_DISTANCE.sentence)
        .slice(0, safeLimit);

      await safeIncrementRagCounter(
        "sentences",
        results.map((item: any) => item.id)
      );

      return results;
    } catch (error) {
      console.error("[Tool ricercaDatabaseInterno]", error);
      return [
        {
          error:
            "Errore temporaneo durante la ricerca nel database giurisprudenziale.",
        },
      ];
    }
  }
);

export const ricercaFascicoloUtente = ai.defineTool(
  {
    name: "ricercaFascicoloUtente",
    description:
      "Cerca semanticamente nei documenti dell'utente. " +
      "TASSATIVO quando la domanda riguarda documenti propri, " +
      "il fascicolo corrente o documenti appena allegati.",
    inputSchema: z.object({
      query: z.string().min(3).max(4000),
      documentId_specifico: z.string().max(200).optional(),
    }),
    outputSchema: z.any(),
  },
  async (input, { context }) => {
    try {
      const userId = context?.userId;
      const fascicoloId = context?.fascicoloId;
      const attachedDocs = Array.isArray(context?.docs)
        ? context.docs
            .filter(
              (value): value is string =>
                typeof value === "string" && value.trim().length > 0
            )
            .slice(0, 50)
        : [];

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
            messaggio: "Query documento vuota.",
          },
        ];
      }

      const queryVector = await createResearchEmbedding(userId, finalQuery);
      const safeLimit = getSafeLimit(context?.dbLimit, 10, MAX_DB_LIMIT);

      const ownerQueries: FirebaseFirestore.Query[] = [];
      const ownerBase = db
        .collection("document_chunks")
        .where("user", "==", userId);

      if (attachedDocs.length > 0) {
        const chunks = chunkArray(attachedDocs, MAX_DOCS_PER_IN_QUERY);
        for (const docIds of chunks) {
          ownerQueries.push(
            ownerBase.where("parentId", "in", docIds) as FirebaseFirestore.Query
          );
        }
      } else if (input.documentId_specifico) {
        ownerQueries.push(
          ownerBase.where(
            "parentId",
            "==",
            input.documentId_specifico
          ) as FirebaseFirestore.Query
        );
      } else if (fascicoloId) {
        ownerQueries.push(
          ownerBase.where(
            "fascicoloIds",
            "array-contains",
            fascicoloId
          ) as FirebaseFirestore.Query
        );
      } else {
        ownerQueries.push(ownerBase as FirebaseFirestore.Query);
      }

      const sharedQueries: FirebaseFirestore.Query[] = [];
      const sharedBase = db
        .collection("document_chunks")
        .where("visibleTo", "array-contains", userId);

      if (attachedDocs.length > 0) {
        const chunks = chunkArray(attachedDocs, MAX_DOCS_PER_IN_QUERY);
        for (const docIds of chunks) {
          sharedQueries.push(
            sharedBase.where("parentId", "in", docIds) as FirebaseFirestore.Query
          );
        }
      } else if (input.documentId_specifico) {
        sharedQueries.push(
          sharedBase.where(
            "parentId",
            "==",
            input.documentId_specifico
          ) as FirebaseFirestore.Query
        );
      } else if (fascicoloId) {
        sharedQueries.push(
          sharedBase.where(
            "fascicoloIds",
            "array-contains",
            fascicoloId
          ) as FirebaseFirestore.Query
        );
      } else {
        sharedQueries.push(sharedBase as FirebaseFirestore.Query);
      }

      const searches = [...ownerQueries, ...sharedQueries].map((query) =>
        (query as any)
          .findNearest({
            vectorField: "embedding",
            queryVector,
            limit: Math.min(safeLimit * 2, 30),
            distanceMeasure: "COSINE",
            distanceThreshold: RAG_DISTANCE.document,
            distanceResultField: "__ragDistance",
          })
          .get()
      );

      const snapshots = await Promise.all(searches);

      const uniqueDocs = new Map<
        string,
        {
          data: FirebaseFirestore.DocumentData;
          distance: number;
        }
      >();

      for (const snapshot of snapshots) {
        for (const doc of snapshot.docs) {
          const data = doc.data();
          const distance = getDistance(doc, queryVector);

          if (distance > RAG_DISTANCE.document) {
            continue;
          }

          if (
            fascicoloId &&
            attachedDocs.length === 0 &&
            input.documentId_specifico === undefined
          ) {
            const fascicoli = Array.isArray(data.fascicoloIds)
              ? data.fascicoloIds
              : [];
            if (!fascicoli.includes(fascicoloId)) {
              continue;
            }
          }

          const current = uniqueDocs.get(doc.id);
          if (!current || distance < current.distance) {
            uniqueDocs.set(doc.id, { data, distance });
          }
        }
      }

      if (uniqueDocs.size === 0) {
        return [
          {
            messaggio:
              "Nessun paragrafo rilevante trovato nei documenti accessibili.",
          },
        ];
      }

      const ordered = Array.from(uniqueDocs.entries())
        .sort((a, b) => {
          const distanceDiff = a[1].distance - b[1].distance;
          if (Math.abs(distanceDiff) > 0.00001) {
            return distanceDiff;
          }
          return (
            Number(a[1].data.index ?? 0) - Number(b[1].data.index ?? 0)
          );
        })
        .slice(0, safeLimit);

      const ids = ordered.map(([id]) => id);

      await safeIncrementRagCounter("document_chunks", ids);

      return ordered.map(([id, item]) => ({
        id,
        documento_id: item.data.parentId ?? "",
        nome_file: item.data.nome_file || item.data.titolo || "Documento utente",
        testo_paragrafo: item.data.text || "",
        posizione_originale: item.data.index ?? 0,
        _distance: item.distance,
        _score: Math.max(0, 1 - item.distance),
        _type: "document_chunk",
        sourceType: "document",
      }));
    } catch (error) {
      console.error("[Tool ricercaFascicoloUtente]", error);
      return [
        {
          error:
            "Errore temporaneo durante la consultazione dell'archivio utente.",
        },
      ];
    }
  }
);

export const webSearchTool = ai.defineTool(
  {
    name: "webSearchTool",
    description:
      "Cerca online su fonti certificate informazioni aggiornate " +
      "su leggi, norme, articoli, decreti, provvedimenti e prassi. " +
      "OBBLIGATORIO per verificare contenuti normativi aggiornabili.",
    inputSchema: z.object({
      query: z.string().min(3).max(3000),
      focus: z
        .enum(["istituzionale", "editoriale", "tutto"])
        .default("tutto"),
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
        await checkResearchQuota(userId, "web_search");
      }

      let domains = [
        ...CFG.DOMAINS_ISTITUZIONALE,
        ...CFG.DOMAINS_EDITORIALE,
      ];

      if (input.focus === "istituzionale") {
        domains = [...CFG.DOMAINS_ISTITUZIONALE];
      }

      if (input.focus === "editoriale") {
        domains = [...CFG.DOMAINS_EDITORIALE];
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
          titolo: result.title || "Risultato web",
          link: result.url!,
          url: result.url!,
          contenuto: (
            result.content || "Contenuto non disponibile"
          ).slice(0, CFG.MAX_WEB_CHARS),
          fonte: getHostname(result.url),
          _type: "web_search",
          sourceType: "web",
        }));

      if (results.length === 0) {
        return [
          {
            messaggio: "Nessun risultato trovato nelle fonti web configurate.",
          },
        ];
      }

      return results;
    } catch (error) {
      console.error("[Tool webSearchTool]", error);
      return [
        {
          error: "Servizio di ricerca web non raggiungibile.",
        },
      ];
    }
  }
);

export const ricercaDottrina = ai.defineTool(
  {
    name: "ricercaDottrina",
    description:
      "Ricerca semanticamente nella banca dati Doctrine. " +
      "Usala per relazioni, orientamenti, novità normative, " +
      "approfondimenti e documenti interpretativi. " +
      "I risultati sono fonti interpretative e non norme vincolanti. " +
      "Se è presente sourceUrl, il risultato deve essere trattato " +
      "anche dal frontend come una fonte web.",
    inputSchema: z.object({
      query: z.string().min(3).max(4000),
      materia: z.string().max(100).optional(),
      tipo_orientamento: z.string().max(100).optional(),
      limit: z.number().int().min(1).max(10).optional(),
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
            messaggio: "Query Doctrine vuota.",
          },
        ];
      }

      const queryVector = await createResearchEmbedding(userId, finalQuery);
      const safeLimit = getSafeLimit(input.limit, 5, MAX_DOCTRINE_LIMIT);

      let doctrineQuery = db.collection("doctrine") as FirebaseFirestore.Query;

      if (input.materia?.trim()) {
        doctrineQuery = doctrineQuery.where(
          "materia",
          "==",
          input.materia.trim().toLowerCase()
        );
      }

      if (input.tipo_orientamento?.trim()) {
        doctrineQuery = doctrineQuery.where(
          "tipo_orientamento",
          "==",
          input.tipo_orientamento.trim()
        );
      }

      const vectorQuery = (doctrineQuery as any).findNearest({
        vectorField: "embedding",
        queryVector,
        limit: Math.min(safeLimit * 2, 20),
        distanceMeasure: "COSINE",
        distanceThreshold: RAG_DISTANCE.doctrine,
        distanceResultField: "__ragDistance",
      });

      const snapshot = await vectorQuery.get();

      if (snapshot.empty) {
        return [
          {
            messaggio:
              "Nessun documento dottrinale semanticamente rilevante trovato.",
          },
        ];
      }

      const results = snapshot.docs
        .map((doc: any) => {
          const data = doc.data();
          const distance = getDistance(doc, queryVector);

          if (distance > RAG_DISTANCE.doctrine) {
            return null;
          }

          const sourceUrl = isSafeHttpUrl(data.sourceUrl)
            ? data.sourceUrl
            : null;

          const summary = String(data.summary ?? "").slice(0, 2500);
          const orientamento = String(data.orientamento ?? "").slice(0, 2500);
          const testo = String(data.testo ?? "").slice(0, 6000);

          const contenuto = [summary, orientamento, testo]
            .filter(Boolean)
            .join("\n\n")
            .slice(0, CFG.MAX_WEB_CHARS);

          return {
            id: doc.id,
            titolo:
              data.tematica ||
              data.tipo_orientamento ||
              "Documento dottrinale",
            tematica: data.tematica || "",
            materia: data.materia || "",
            tipo_documento: data.tipo_documento || "",
            tipo_orientamento: data.tipo_orientamento || "",
            data_documento: serializeFirestoreDate(data.data_documento),
            pagine: data.pagine || "",
            numero_anno: data.numero_anno || "",
            origine: data.origine || "",
            norme_citate: Array.isArray(data.norme_citate)
              ? data.norme_citate.slice(0, 30)
              : [],
            precedenti_citati: normalizePrecedenti(data.precedenti_citati),
            summary,
            orientamento,
            testo,
            contenuto,
            link: sourceUrl,
            url: sourceUrl,
            sourceUrl,
            fonte: getHostname(sourceUrl),
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
      console.error("[Tool ricercaDottrina]", error);
      return [
        {
          error:
            "Errore temporaneo durante la ricerca nella banca dati Doctrine.",
        },
      ];
    }
  }
);

export const analizzaDistinguishFattispecie = ai.defineTool(
  {
    name: "analizzaDistinguishFattispecie",
    description:
      "Cerca precedenti fattualmente simili per il distinguishing. " +
      "Usalo quando devi confrontare i fatti concreti dell'utente " +
      "con fattispecie già esaminate dalla giurisprudenza.",
    inputSchema: z.object({
      query: z
        .string()
        .min(10)
        .max(5000)
        .describe("Descrizione dettagliata dei fatti del caso concreto."),
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
        limit: MAX_DISTINGUISH_LIMIT,
        distanceMeasure: "COSINE",
        distanceThreshold: RAG_DISTANCE.distinguish,
        distanceResultField: "__ragDistance",
      });

      const snapshot = await vectorQuery.get();

      if (snapshot.empty) {
        return [
          {
            messaggio: "Nessun precedente fattualmente simile trovato.",
          },
        ];
      }

      const results = snapshot.docs
        .map((doc: any) => {
          const data = doc.data();
          const distance = getDistance(doc, queryVector);

          return {
            id: doc.id,
            numero_sentenza: data.numero_sentenza ?? "",
            organo_giudicante: data.organo_giudicante ?? "",
            fatti_della_sentenza_trovata:
              data.fattispecie_rilevante ||
              "Fatti non separati - deducibili dalla massima",
            principio_di_diritto: data.massima || data.summary || "",
            sourceUrl: isSafeHttpUrl(data.sourceUrl) ? data.sourceUrl : null,
            _distance: distance,
            _score: Math.max(0, 1 - distance),
            _type: "giurisprudenza_distinguish",
            sourceType: "case_law",
          };
        })
        .filter((item: any) => item._distance <= RAG_DISTANCE.distinguish);

      return results;
    } catch (error) {
      console.error("[Tool analizzaDistinguishFattispecie]", error);
      return [
        {
          error:
            "Errore temporaneo durante l'analisi della fattispecie.",
        },
      ];
    }
  }
);

export const ricercaManualeTool = ai.defineTool(
  {
    name: "ricercaManualeTool",
    description:
      "Usa questo tool ESCLUSIVAMENTE per domande sul funzionamento " +
      "della piattaforma Jurio, guide all'uso, funzionalità, limiti, " +
      "piani, privacy, GDPR e documentazione interna. " +
      "NON usare per giurisprudenza o norme.",
    inputSchema: z.object({
      query: z
        .string()
        .min(3)
        .max(3000)
        .describe("Domanda da cercare nella documentazione di Jurio."),
    }),
    outputSchema: z.any(),
  },
  async (input) => {
    try {
      const finalQuery = normalizeQuery(input.query);

      if (!finalQuery) {
        return [
          {
            messaggio: "Query manuale vuota.",
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
        distanceThreshold: RAG_DISTANCE.manual,
        distanceResultField: "__ragDistance",
      });

      const snapshot = await vectorQuery.get();

      if (snapshot.empty) {
        return [
          {
            messaggio: "Nessuna informazione pertinente trovata nel manuale.",
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
            _type: "documentazione_manuale",
            sourceType: "manual",
          };
        })
        .filter((item: any) => item._distance <= RAG_DISTANCE.manual)
        .sort((a: any, b: any) => a._distance - b._distance)
        .slice(0, MAX_MANUAL_LIMIT);

      if (results.length === 0) {
        return [
          {
            messaggio: `Nessuna informazione pertinente trovata nel manuale per "${finalQuery}".`,
          },
        ];
      }

      return results;
    } catch (error) {
      console.error("[Tool ricercaManualeTool]", error);
      return [
        {
          error: "Errore durante la ricerca nel manuale di Jurio.",
        },
      ];
    }
  }
);

function passesUiFilters(
  data: FirebaseFirestore.DocumentData,
  filters: unknown
): boolean {
  if (!Array.isArray(filters)) {
    return true;
  }

  for (const filter of filters.slice(0, 10)) {
    if (!filter || typeof filter !== "object") {
      continue;
    }

    const { field, operator, value } = filter as any;

    if (typeof field !== "string" || typeof operator !== "string") {
      continue;
    }

    const actual = data[field];

    switch (operator) {
      case "==":
        if (actual !== value) return false;
        break;
      case "!=":
        if (actual === value) return false;
        break;
      case ">":
        if (!(actual > value)) return false;
        break;
      case ">=":
        if (!(actual >= value)) return false;
        break;
      case "<":
        if (!(actual < value)) return false;
        break;
      case "<=":
        if (!(actual <= value)) return false;
        break;
      case "array-contains":
        if (!Array.isArray(actual) || !actual.includes(value)) return false;
        break;
      case "in":
        if (!Array.isArray(value) || !value.includes(actual)) return false;
        break;
      case "array-contains-any":
        if (
          !Array.isArray(actual) ||
          !Array.isArray(value) ||
          !actual.some((item: any) => value.includes(item))
        ) {
          return false;
        }
        break;
      default:
        break;
    }
  }

  return true;
}

function serializeFirestoreDate(value: any): string {
  if (!value) {
    return "";
  }
  if (typeof value?.toDate === "function") {
    try {
      return value.toDate().toISOString();
    } catch {
      return "";
    }
  }
  if (typeof value === "string") {
    return value;
  }
  return "";
}

function normalizePrecedenti(value: unknown): any[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.slice(0, 10).map((item) => {
    if (!item || typeof item !== "object") {
      return {
        valore: String(item ?? ""),
      };
    }
    const data = item as Record<string, any>;
    return {
      anno: data.anno ?? null,
      numero: data.numero ?? "",
      sezione: data.sezione ?? "",
      questione_di_diritto: String(data.questione_di_diritto ?? "").slice(
        0,
        1000
      ),
    };
  });
}

export const dynamicTools = [
  ricercaDatabaseInterno,
  ricercaFascicoloUtente,
  webSearchTool,
  ricercaDottrina,
  analizzaDistinguishFattispecie,
  ricercaManualeTool,
];