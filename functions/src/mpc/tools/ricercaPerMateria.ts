import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDb } from "../../_deps";
import { NOMI_AREE } from "../constants";
import { verifyPlanAndLimits, findBySottocategoriaAdmin, formatDocument } from "../helpers";

export function registerRicercaPerMateria(server: McpServer, authHeader: string): void {
  server.registerTool(
    "ricercaPerMateria",
    {
      title: "Ricerca per Area Giuridica o Sottocategoria",
      description:
        "Trova sentenze filtrate per materia (MACRO-AREA o SOTTOCATEGORIA).\n" +
        "Se cerchi per macro-area, DEVI usare uno dei seguenti valori esatti: '" +
        NOMI_AREE +
        "'.",
      inputSchema: {
        termine: z
          .string()
          .describe(
            "Il nome esatto della Macro-Area oppure una parola chiave per la sottocategoria (es. 'Diritto Penale Sostanziale' oppure 'bancarotta')."
          ),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Numero massimo di risultati (default: 10)."),
      },
    },
    async ({ termine, limit }) => {
      try {
        const db = getDb();

        const authCheck = await verifyPlanAndLimits(authHeader, db);
        if (!authCheck.ok) {
          return { content: [{ type: "text", text: authCheck.text }], isError: authCheck.isError };
        }

        const safeLimit = Math.min(limit ?? 10, 50);
        const docs = await findBySottocategoriaAdmin(termine, safeLimit, db);

        if (!docs || docs.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `Nessuna giurisprudenza trovata per la materia/categoria: '${termine}'. Prova a usare termini più generici o la macro-area esatta.`,
              },
            ],
          };
        }

        const formatted = docs.map((doc) => formatDocument(doc)).join("\n\n---\n\n");
        return { content: [{ type: "text", text: formatted }] };
      } catch (error: unknown) {
        return {
          content: [
            {
              type: "text",
              text: `Errore nella ricerca per materia: ${
                error instanceof Error ? error.message : String(error)
              }`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}