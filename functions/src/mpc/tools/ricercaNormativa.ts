import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { translateRiferimento } from "../../_riferimenti_normativi";
import { getDb } from "../../_deps";
import { verifyPlanAndLimits, formatDocument, JurioDocument } from "../helpers";

// Candidati extra letti da Firestore per poter privilegiare i provvedimenti che citano
// la norma nella massima o nella fattispecie (l'indice copre anche il testo integrale).
const OVERFETCH_FACTOR = 3;
const MAX_CANDIDATES = 60;

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** True se massima, fattispecie o questione di diritto richiamano esplicitamente l'articolo. */
export function citaArticoloNelTesto(doc: JurioDocument, article: string | undefined): boolean {
  if (!article) return true;
  const testo = [doc.massima, doc.fattispecie_rilevante, doc.questione_di_diritto]
    .filter((v): v is string => typeof v === "string")
    .join(" ")
    .toLowerCase();
  if (!testo) return false;
  const pattern = new RegExp(
    `\\bart(?:t|icol[oi])?\\.?\\s*(?:\\d+[\\w-]*\\s*(?:,|e)\\s*)*${escapeRegExp(article.toLowerCase())}(?![\\d])`,
  );
  return pattern.test(testo);
}

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
          .limit(Math.min(safeLimit * OVERFETCH_FACTOR, MAX_CANDIDATES))
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

        const article = translation.parsed?.article;
        const candidates = snap.docs.map((doc) => {
          const data = { id: doc.id, ...doc.data() } as JurioDocument;
          return { data, esplicito: citaArticoloNelTesto(data, article) };
        });
        // Ordinamento stabile: prima chi cita la norma in massima/fattispecie, poi il resto.
        const ranked = [
          ...candidates.filter((c) => c.esplicito),
          ...candidates.filter((c) => !c.esplicito),
        ].slice(0, safeLimit);

        const formatted = ranked
          .map(({ data, esplicito }) => {
            const base = formatDocument(data);
            return esplicito
              ? base
              : `${base}\nNOTA: ${riferimento} è citato nel testo integrale del provvedimento, ma non nella massima né nella fattispecie.`;
          })
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