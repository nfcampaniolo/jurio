import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { JURIO_VECTOR_SEARCH_URL } from "../constants";
import { mcpFetch } from "../utils/mcpFetch";
import { formatDocument, JurioDocument } from "../helpers";

export function registerRicercaSemantica(server: McpServer, authHeader: string): void {
  server.registerTool(
    "ricercaSemantica",
    {
      title: "Ricerca Semantica Precedenti Giurisprudenziali",
      description:
        "Cerca nella giurisprudenza italiana confrontando il quesito con un indice vettoriale composto da FATTISPECIE CONCRETA e MASSIMA.\n" +
        "- QUANDO USARLO: Per trovare orientamenti giurisprudenziali, casi analoghi e applicazioni pratiche.\n" +
        "- COME STRUTTURARE LA QUERY: Costruisci una frase densa che combini ELEMENTI DI FATTO e QUALIFICAZIONE GIURIDICA.\n" +
        "- DA EVITARE: Non inserire convenevoli, stop-word o soli articoli di legge.\n" +
        "- ESEMPIO OTTIMALE: 'caduta pedone dislivello marciapiede insidia stradale non visibile caso fortuito 2051 cc'",
      inputSchema: {
        query: z
          .string()
          .min(5)
          .describe("Sintesi densa che unisce elementi fattuali specifici e istituto giuridico. Evitare stop-word."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(15)
          .optional()
          .describe("Numero massimo di precedenti da estrarre (default: 10)."),
      },
    },
    async ({ query, limit }) => {
      const safeLimit = Math.min(limit ?? 10, 15);
      const res = await mcpFetch<{ topMatches?: JurioDocument[] }>(
        JURIO_VECTOR_SEARCH_URL,
        authHeader,
        { query, limit: safeLimit }
      );

      if (res.errorText) {
        return { content: [{ type: "text", text: res.errorText }], isError: res.isError };
      }

      const matches = res.data?.topMatches ?? [];
      if (matches.length === 0) {
        return { content: [{ type: "text", text: "Nessuna sentenza pertinente trovata per questo quesito." }] };
      }

      const formatted = matches.map((m) => formatDocument(m)).join("\n\n---\n\n");
      return { content: [{ type: "text", text: formatted }] };
    }
  );
}