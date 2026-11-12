import { z } from "zod";
import { ai, CFG } from "../_config";
import { safeIncrementRagCounter, createResearchEmbedding } from "./_helper";
import { getSafeLimit, normalizeQuery, getDistance, chunkArray } from "./_utils";
import { getDb } from "../../_deps";
import { logSafeError } from "../../_logging";

const db = getDb();
const LEADING_CHUNKS_PER_DOC = 3;
const MAX_LEADING_CHUNKS = 6;

function canAccess(data: FirebaseFirestore.DocumentData | undefined, userId: string): boolean {
  if (!data) return false;
  return data.user === userId || (Array.isArray(data.visibleTo) && data.visibleTo.includes(userId));
}

function toChunkResult(id: string, data: FirebaseFirestore.DocumentData, distance: number) {
  return {
    id,
    documentId: data.parentId ?? "",
    fileName: data.nome_file || data.titolo || "Documento utente",
    paragraphText: data.text || "",
    originalPosition: data.index ?? 0,
    _distance: distance,
    _score: Math.max(0, 1 - distance),
    _type: "document_chunk",
    sourceType: "document",
  };
}

/**
 * Fallback per documenti indicati esplicitamente: quando la query è generica
 * ("riesci a leggere l'allegato?") la ricerca vettoriale non supera la soglia,
 * quindi si leggono i primi chunk di ciascun documento (ID deterministici
 * `${parentId}_chunk_${i}`). Se un documento non ha chunk se ne riporta lo stato.
 */
async function readLeadingChunks(docIds: string[], userId: string) {
  const targets = docIds.slice(0, MAX_LEADING_CHUNKS);
  const perDoc = Math.max(1, Math.min(LEADING_CHUNKS_PER_DOC, Math.floor(MAX_LEADING_CHUNKS / targets.length)));
  const refs = targets.flatMap((docId) =>
    Array.from({ length: perDoc }, (_, i) => db.collection("document_chunks").doc(`${docId}_chunk_${i}`))
  );
  const snaps = await db.getAll(...refs);

  const results = snaps
    .filter((snap) => snap.exists && canAccess(snap.data(), userId))
    .map((snap) => toChunkResult(snap.id, snap.data() ?? {}, CFG.ragDistance.document));

  const docsWithChunks = new Set(results.map((r) => r.documentId));
  const missing = targets.filter((docId) => !docsWithChunks.has(docId));
  const notices: { message: string }[] = [];

  if (missing.length > 0) {
    const parents = await db.getAll(...missing.map((docId) => db.collection("documents").doc(docId)));
    for (const parent of parents) {
      const data = parent.data();
      if (!parent.exists || !canAccess(data, userId)) continue;
      const name = data?.nome_file || data?.titolo || "Il documento allegato";
      const message = data?.isEmbeddingFailed
        ? `${name}: l'elaborazione del documento non è andata a buon fine. Si consiglia di ricaricarlo.`
        : !data?.isEmbeddingFinished
          ? `${name}: il documento è ancora in fase di elaborazione. Riprova tra qualche istante.`
          : `${name}: il documento non contiene testo leggibile (ad esempio una scansione senza testo selezionabile).`;
      notices.push({ message });
    }
  }

  return { results, notices };
}

export const userFileSearch = ai.defineTool(
  {
    name: "userFileSearch",
    description:
      "Semantically searches through the user's documents and file archives. " +
      "MANDATORY when the user's query refers to personal documents, " +
      "the current case file (fascicolo), or newly attached files.",
    inputSchema: z.object({
      query: z
        .string()
        .min(3)
        .max(4000)
        .describe("The semantic search query for looking up text inside user documents."),
      specificDocumentId: z
        .string()
        .max(200)
        .optional()
        .describe("Optional specific document ID to restrict the search to a single file."),
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
            message: "Query documento vuota.",
          },
        ];
      }

      const queryVector = await createResearchEmbedding(userId, finalQuery);
      
      const safeLimit = getSafeLimit(context?.dbLimit, 3, CFG.limits.maxDbLimit);

      const ownerQueries: FirebaseFirestore.Query[] = [];
      const ownerBase = db
        .collection("document_chunks")
        .where("user", "==", userId);

      if (attachedDocs.length > 0) {
        const chunks = chunkArray(attachedDocs, CFG.limits.maxDocsPerInQuery);
        for (const docIds of chunks) {
          ownerQueries.push(
            ownerBase.where("parentId", "in", docIds) as FirebaseFirestore.Query
          );
        }
      } else if (input.specificDocumentId) {
        ownerQueries.push(
          ownerBase.where(
            "parentId",
            "==",
            input.specificDocumentId
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
        const chunks = chunkArray(attachedDocs, CFG.limits.maxDocsPerInQuery);
        for (const docIds of chunks) {
          sharedQueries.push(
            sharedBase.where("parentId", "in", docIds) as FirebaseFirestore.Query
          );
        }
      } else if (input.specificDocumentId) {
        sharedQueries.push(
          sharedBase.where(
            "parentId",
            "==",
            input.specificDocumentId
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
            distanceThreshold: CFG.ragDistance.document,
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

          if (distance > CFG.ragDistance.document) {
            continue;
          }

          if (
            fascicoloId &&
            attachedDocs.length === 0 &&
            input.specificDocumentId === undefined
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
        const explicitDocs = attachedDocs.length > 0
          ? attachedDocs
          : input.specificDocumentId ? [input.specificDocumentId] : [];
        if (explicitDocs.length > 0) {
          const { results, notices } = await readLeadingChunks(explicitDocs, userId);
          if (results.length > 0 || notices.length > 0) {
            await safeIncrementRagCounter("document_chunks", results.map((r) => r.id));
            return [...results, ...notices];
          }
        }
        return [
          {
            message:
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

      return ordered.map(([id, item]) => toChunkResult(id, item.data, item.distance));
    } catch (error) {
      logSafeError("USER_FILE_SEARCH_FAILED", error);
      return [
        {
          error:
            "Errore temporaneo durante la consultazione dell'archivio utente.",
        },
      ];
    }
  }
);