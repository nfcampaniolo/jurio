import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { translateRiferimento } from "../../_riferimenti_normativi";
import { getDb } from "../../_deps";
import { verifyPlanAndLimits, formatDocument, JurioDocument } from "../helpers";

export function registerRicercaNormativa(server: McpServer, authHeader: string): void {
  server.registerTool(
    "ricercaNormativa",
    {
      title: "Ricerca Sentenze per Riferimento Normativo",
      description:
        "Trova massime e sentenze associate a uno specifico articolo di legge o codice.\n" +
        "USO OBBLIGATORIO: Passa un singolo articolo formattato secondo lo standard italiano (es. 'art. 2051 c.c.').",
      inputSchema: {
        riferimento: z
          .string().max(100)
          .describe("La norma da cercare nel formato 'art. [numero] [fonte]' (es. 'art. 2051 c.c.')."),
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .optional()
          .describe("Numero di sentenze da recuperare (default: 10)."),
      },
    },
    async ({ riferimento, limit }) => {
      try {
        const db = getDb();

        const authCheck = await verifyPlanAndLimits(authHeader, db);
        if (!authCheck.ok) {
          return { content: [{ type: "text", text: authCheck.text }], isError: authCheck.isError };
        }

        const safeLimit = Math.min(limit ?? 10, 20);
        const translation = translateRiferimento(riferimento);
        const searchKey = translation.key;

        if (!searchKey) {
          return {
            content: [
              {
                type: "text",
                text: `Impossibile interpretare il riferimento normativo: '${riferimento}'. Verifica il formato.`,
              },
            ],
            isError: true,
          };
        }

        const snap = await db
          .collection("sentences")
          .where("riferimenti_normativi_key", "array-contains", searchKey)
          .limit(safeLimit)
          .get();

        if (snap.empty) {
          return {
            content: [
              {
                type: "text",
                text: `Nessun precedente trovato con riferimento diretto a ${riferimento} (chiave: ${searchKey}).`,
              },
            ],
          };
        }

        const formatted = snap.docs
          .map((doc) => formatDocument({ id: doc.id, ...doc.data() } as JurioDocument))
          .join("\n\n---\n\n");
        return { content: [{ type: "text", text: formatted }] };
      } catch (error: unknown) {
        return {
          content: [
            {
              type: "text",
              text: `Errore Firestore: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}