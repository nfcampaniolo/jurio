import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { JURIO_VECTOR_SEARCH_URL, VALORI_AREA } from "../constants";
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
        "utili, ripeti senza filtro.\n" +
        "- FILTRO 'area' (opzionale): limita la ricerca a un'area del diritto, includendo anche i giudici di merito e il TAR; " +
        "anch'esso rende la ricerca molto più veloce. Usalo quando la sezione non è pertinente o vuoi includere il merito. " +
        "L'area è una classificazione automatica: se non trovi risultati utili, ripeti senza filtro.\n" +
        "- Usa 'sezione' OPPURE 'area', mai entrambi nella stessa chiamata.",
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
        area: z
          .enum(VALORI_AREA)
          .optional()
          .describe("Area del diritto a cui limitare la ricerca (valore esatto dell'elenco). Non combinare con 'sezione'."),
      },
    },
    async ({ query, limit, sezione, area }) => {
      if (sezione && area) {
        // Un solo prefiltro per volta: ogni combinazione richiederebbe un indice vettoriale composito dedicato.
        return {
          content: [{
            type: "text",
            text: "Usa un solo filtro per volta: 'sezione' oppure 'area'. Ripeti la ricerca con uno dei due, o in parallelo una per filtro.",
          }],
          isError: true,
        };
      }

      const safeLimit = Math.min(limit ?? 10, 15);
      const filtro = sezione
        ? { field: "sezione", value: sezione }
        : area
          ? { field: "area", value: area }
          : null;
      const body = filtro
        ? { query, limit: safeLimit, filters: [{ field: filtro.field, operator: "==", value: filtro.value }] }
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
        const text = filtro
          ? `Nessuna sentenza pertinente trovata con filtro ${filtro.field} = ${filtro.value}. Prova un'altra ${filtro.field} competente o ripeti la ricerca senza filtro.`
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