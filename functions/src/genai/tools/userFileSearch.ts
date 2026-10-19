import { z } from "zod";
import { ai, CFG } from "../_config";
import { safeIncrementRagCounter, createResearchEmbedding } from "./_helper";
import { getSafeLimit, normalizeQuery, getDistance, chunkArray } from "./_utils";
import { getDb } from "../../_deps";

const db = getDb();

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

      return ordered.map(([id, item]) => ({
        id,
        documentId: item.data.parentId ?? "",
        fileName: item.data.nome_file || item.data.titolo || "Documento utente",
        paragraphText: item.data.text || "",
        originalPosition: item.data.index ?? 0,
        _distance: item.distance,
        _score: Math.max(0, 1 - item.distance),
        _type: "document_chunk",
        sourceType: "document",
      }));
    } catch (error) {
      console.error("[Tool userFileSearch]", error);
      return [
        {
          error:
            "Errore temporaneo durante la consultazione dell'archivio utente.",
        },
      ];
    }
  }
);