import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { JURIO_EXTRACT_TEXT_URL } from "../constants";
import { mcpFetch } from "../utils/mcpFetch";
import { getDb } from "../../_deps";

export function registerEstraiTestoDocumento(server: McpServer, authHeader: string): void {
  server.registerTool(
    "estraiTestoDocumento",
    {
      title: "Estrai Testo Documento PDF da URL",
      description:
        "Estrae e pulisce il testo da un documento PDF memorizzato su Jurio a partire dal suo URL pubblico.",
      inputSchema: {
        url: z
          .string()
          .describe(
            "L'URL della sentenza su Jurio (es. 'https://jurio.it/giurisprudenza/8c0893ca-5a7a-471a-9ed0-128ab34d0bfa')."
          ),
      },
    },
    async ({ url }) => {
      const match = url.match(/\/giurisprudenza\/([a-zA-Z0-9_-]+)/);
      const currentDocId = match ? match[1] : null;

      if (!currentDocId) {
        return {
          content: [
            {
              type: "text",
              text: "Impossibile estrarre l'ID del documento dall'URL fornito. Assicurati che l'URL sia nel formato corretto.",
            },
          ],
          isError: true,
        };
      }

      try {
        const db = getDb();
        const docSnap = await db.collection("sentences").doc(currentDocId).get();
        if (docSnap.exists) {
          const docData = docSnap.data();
          const fonte = docData?.fonte;

          if (fonte && fonte.includes("italgiure")) {
            return {
              content: [
                {
                  type: "text",
                  text: "Non si ha accesso alla fonte https://www.italgiure.giustizia.it/. Si prega di cercare la fonte direttamente dal portale Italgiure.",
                },
              ],
              isError: true,
            };
          }
        }
      } catch (error) {
        console.error("Errore durante la verifica della fonte su Firestore:", error);
      }

      const storagePath = `sentences/${currentDocId}.pdf`;
      const res = await mcpFetch<{ pages?: number; text?: string }>(
        JURIO_EXTRACT_TEXT_URL,
        authHeader,
        { storagePath }
      );

      if (res.errorText) {
        return { content: [{ type: "text", text: res.errorText }], isError: res.isError };
      }

      return {
        content: [
          {
            type: "text",
            text: `ESTRAZIONE COMPLETATA (Pagine: ${res.data?.pages ?? 0})\n\n${res.data?.text ?? ""}`,
          },
        ],
      };
    }
  );
}