import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { JURIO_DOCTRINE_SEARCH_URL } from "../constants";
import { mcpFetch } from "../utils/mcpFetch";
import { formatDoctrineDocument, DoctrineDocument } from "../helpers";

export function registerdoctrineSearch(server: McpServer, authHeader: string): void {
  server.registerTool(
    "doctrineSearch",
    {
      title: "Ricerca Semantica Dottrina, Relazioni e Novità Legislative",
      description:
        "Cerca nella dottrina ufficiale (Relazioni dell'Ufficio del Massimario, Quaderni, approfondimenti sulle novità normative).\n" +
        "- QUANDO USARLO: Per ottenere un inquadramento teorico e dogmatico, spiegazioni su contrasti giurisprudenziali, analisi di nuove leggi o per comprendere la 'ratio' di un istituto.\n" +
        "- DIFFERENZA CON LA GIURISPRUDENZA: Usa questo tool per la TEORIA, usa 'ricercaSemantica' per la PRATICA e i casi concreti.",
      inputSchema: {
        query: z
          .string()
          .min(5)
          .describe("Concetto giuridico, istituto o questione di diritto da approfondire nella dottrina."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(10)
          .optional()
          .describe("Numero massimo di tematiche da estrarre (default: 5)."),
      },
    },
    async ({ query, limit }) => {
      const safeLimit = Math.min(limit ?? 5, 10);
      const res = await mcpFetch<{ results?: DoctrineDocument[] }>(
        JURIO_DOCTRINE_SEARCH_URL,
        authHeader,
        { query, limit: safeLimit }
      );

      if (res.errorText) {
        return { content: [{ type: "text", text: res.errorText }], isError: res.isError };
      }

      const matches = res.data?.results ?? [];
      if (matches.length === 0) {
        return { content: [{ type: "text", text: "Nessun approfondimento dottrinale pertinente trovato per questo quesito." }] };
      }

      const formatted = matches.map((m) => formatDoctrineDocument(m)).join("\n\n---\n\n");
      return { content: [{ type: "text", text: formatted }] };
    }
  );
}