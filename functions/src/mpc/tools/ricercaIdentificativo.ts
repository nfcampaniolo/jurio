import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getDb } from "../../_deps";
import { verifyPlanAndLimits, findByNumeroSentenzaAdmin, formatDocument } from "../helpers";

export function registerRicercaIdentificativo(server: McpServer, authHeader: string): void {
  server.registerTool(
    "ricercaIdentificativo",
    {
      title: "Ricerca per Numero Sentenza, ECLI o URN",
      description:
        "Usa questo strumento QUANDO l'utente chiede una sentenza specifica citando il suo identificativo (es. '123/2026', ECLI o URN).",
      inputSchema: {
        identificativo: z.string().max(100).describe("L'identificativo esatto (es. '456/2023' o ECLI)."),
      },
    },
    async ({ identificativo }) => {
      try {
        const db = getDb();

        const authCheck = await verifyPlanAndLimits(authHeader, db);
        if (!authCheck.ok) {
          return { content: [{ type: "text", text: authCheck.text }], isError: authCheck.isError };
        }

        const docs = await findByNumeroSentenzaAdmin(identificativo, db);
        if (!docs || docs.length === 0) {
          return {
            content: [
              { type: "text", text: `Nessun documento trovato per l'identificativo: ${identificativo}` },
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
              text: `Errore nella ricerca per identificativo: ${
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