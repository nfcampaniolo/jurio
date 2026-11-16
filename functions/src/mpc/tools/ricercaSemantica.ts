import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { JURIO_VECTOR_SEARCH_URL } from "../constants";
import { mcpFetch } from "../utils/mcpFetch";
import { formatDocument, JurioDocument } from "../helpers";
import { TESTO_LEGENDA_SEZIONI, VALORI_SEZIONE } from "../sezioni";

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
        "- ESEMPIO OTTIMALE: 'caduta pedone dislivello marciapiede insidia stradale non visibile caso fortuito 2051 cc'\n" +
        "- FILTRO 'sezione' (opzionale, consigliato): limita la ricerca a una sezione ed è molto più veloce. " +
        "Scegli la sezione competente per l'argomento dalla legenda del parametro. Se l'argomento riguarda più sezioni " +
        "(es. responsabilità medica: QUARTA SEZIONE PENALE per i profili penali e TERZA SEZIONE CIVILE per il risarcimento), esegui ricerche " +
        "parallele, una per sezione. Il filtro esclude i giudici di merito e le altre sezioni: se non trovi risultati " +
        "utili, ripeti senza filtro.",
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
        sezione: z
          .enum(VALORI_SEZIONE)
          .optional()
          .describe(
            "Sezione a cui limitare la ricerca. Usa ESATTAMENTE uno di questi valori, in maiuscolo:\n" + TESTO_LEGENDA_SEZIONI
          ),
      },
    },
    async ({ query, limit, sezione }) => {
      const safeLimit = Math.min(limit ?? 10, 15);
      const body = sezione
        ? { query, limit: safeLimit, filters: [{ field: "sezione", operator: "==", value: sezione }] }
        : { query, limit: safeLimit };
      const res = await mcpFetch<{ topMatches?: JurioDocument[]; allMatches?: JurioDocument[] }>(
        JURIO_VECTOR_SEARCH_URL,
        authHeader,
        body
      );

      if (res.errorText) {
        return { content: [{ type: "text", text: res.errorText }], isError: res.isError };
      }

      // topMatches: contengono la maggior parte delle parole chiave della query.
      // allMatches: semanticamente vicini (sopra la soglia di similarità) ma con corrispondenza lessicale parziale.
      const top = res.data?.topMatches ?? [];
      const partial = (res.data?.allMatches ?? []).slice(0, Math.max(0, safeLimit - top.length));
      if (top.length === 0 && partial.length === 0) {
        const text = sezione
          ? `Nessuna sentenza pertinente trovata con filtro sezione = ${sezione}. Prova un'altra sezione competente o ripeti la ricerca senza filtro.`
          : "Nessuna sentenza pertinente trovata per questo quesito.";
        return { content: [{ type: "text", text }] };
      }

      const blocks = [
        ...top.map((m) => formatDocument(m)),
        ...partial.map(
          (m) => `${formatDocument(m)}\nPERTINENZA: parziale (non tutte le parole chiave del quesito compaiono nel documento).`
        ),
      ];
      const totale = blocks.length;
      const header = totale < safeLimit
        ? `Trovati ${totale} ${totale === 1 ? "risultato" : "risultati"} sopra la soglia di pertinenza (richiesti: ${safeLimit}).\n\n`
        : "";
      const formatted = header + blocks.join("\n\n---\n\n");
      return { content: [{ type: "text", text: formatted }] };
    }
  );
}