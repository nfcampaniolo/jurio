import {
  McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const JURIO_VECTOR_SEARCH_URL =
  "https://vectorsearchjurio-vqoobrenua-ew.a.run.app";
// ============================================================================
// CREAZIONE SERVER MCP
// ============================================================================

export function createMcpServer(authHeader: string): McpServer {
  const server = new McpServer({
    name: "jurio-mcp",
    version: "1.0.0",
  });
  // --------------------------------------------------------------------------
  // TOOL: vectorSearchJurio
  // --------------------------------------------------------------------------
  server.registerTool(
    "vectorSearchJurio",
    {
      title: "Vector Search Jurio",
      description:
        "Cerca sentenze nella giurisprudenza italiana. Usalo per trovare precedenti legali e massime.",

      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe("Il quesito giuridico ottimizzato."),

        limit: z
          .number()
          .int()
          .min(1)
          .max(5)
          .optional()
          .describe(
            "Numero di sentenze da recuperare. Valore massimo: 5."
          ),
      },
    },
    async ({ query, limit }) => {
      try {
        const safeLimit = Math.min(limit ?? 3, 5);
        console.log("[JURIO-MCP] vectorSearchJurio:", {
          query,
          limit: safeLimit,
          hasAuthorization: Boolean(authHeader),
        });
        // --------------------------------------------------------------------
        // Chiamata al backend Vector Search Jurio
        // --------------------------------------------------------------------
        const response = await fetch(JURIO_VECTOR_SEARCH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authHeader
              ? {
                  Authorization: authHeader,
                }
              : {}),
          },
          body: JSON.stringify({
            query,
            limit: safeLimit,
          }),
        });
        // --------------------------------------------------------------------
        // Parsing risposta
        // --------------------------------------------------------------------
        let data: {
          error?: string;
          topMatches?: Array<{
            tipo_documento?: string;
            organo_giudicante?: string;
            numero_sentenza?: string;
            massima?: string;
            fattispecie_rilevante?: string;
            url?: string;
          }>;
        };
        try {
          data = (await response.json()) as typeof data;
        } catch {
          data = {
            error: await response.text(),
          };
        }
        // --------------------------------------------------------------------
        // Errore backend
        // --------------------------------------------------------------------
        if (!response.ok) {
          const errorMessage =
            data.error ??
            response.statusText ??
            `HTTP ${response.status}`;
          console.error(
            "[JURIO-MCP] Errore backend:",
            errorMessage
          );
          return {
            content: [
              {
                type: "text",
                text: `Errore dal backend Jurio: ${errorMessage}`,
              },
            ],
            isError: true,
          };
        }

        // --------------------------------------------------------------------
        // Formattazione risultati
        // --------------------------------------------------------------------

        const matches = data.topMatches ?? [];

        if (matches.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "Nessuna sentenza pertinente trovata.",
              },
            ],
          };
        }

        const formattedResults = matches
          .map((match) => {
            return [
              `DOCUMENTO: ${match.tipo_documento ?? ""} ${
                match.organo_giudicante ?? ""
              }, N. ${match.numero_sentenza ?? ""}`,

              `MASSIMA: ${match.massima ?? ""}`,

              `FATTISPECIE: ${match.fattispecie_rilevante ?? ""}`,

              `url: ${match.url ?? ""}`,
            ].join("\n");
          })
          .join("\n\n---\n\n");

        return {
          content: [
            {
              type: "text",
              text: formattedResults,
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        console.error(
          "[JURIO-MCP] Errore di rete:",
          error
        );

        return {
          content: [
            {
              type: "text",
              text: `Errore di rete: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}