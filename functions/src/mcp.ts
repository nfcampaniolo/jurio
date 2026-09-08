import { onRequest } from "firebase-functions/v2/https";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { randomBytes } from "crypto";
import * as admin from "firebase-admin";

// Inizializza l'app admin per accedere a Firestore
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const JURIO_VECTOR_SEARCH_URL = "https://vectorsearchjurio-vqoobrenua-ew.a.run.app";

// ============================================================================
// CREAZIONE SERVER MCP E TOOL
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
      description: "Cerca sentenze nella giurisprudenza italiana. Usalo per trovare precedenti legali e massime.",
      inputSchema: {
        query: z.string().min(1).describe("Il quesito giuridico ottimizzato."),
        limit: z.number().int().min(1).max(5).optional().describe("Numero di sentenze da recuperare. Valore massimo: 5."),
      },
    },
    async ({ query, limit }) => {
      try {
        const safeLimit = Math.min(limit ?? 3, 5);
        console.log("[JURIO-MCP] vectorSearchJurio:", { query, limit: safeLimit, hasAuthorization: Boolean(authHeader) });
        
        // Chiamata al backend
        const response = await fetch(JURIO_VECTOR_SEARCH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(authHeader ? { Authorization: authHeader } : {}),
          },
          body: JSON.stringify({ query, limit: safeLimit }),
        });
        
        // Parsing risposta
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
          data = { error: await response.text() };
        }
        
        // Gestione errore
        if (!response.ok) {
          const errorMessage = data.error ?? response.statusText ?? `HTTP ${response.status}`;
          console.error("[JURIO-MCP] Errore backend:", errorMessage);
          return {
            content: [{ type: "text", text: `Errore dal backend Jurio: ${errorMessage}` }],
            isError: true,
          };
        }

        const matches = data.topMatches ?? [];

        if (matches.length === 0) {
          return {
            content: [{ type: "text", text: "Nessuna sentenza pertinente trovata." }],
          };
        }

        // Formattazione (rimosse label vuote)
        const formattedResults = matches
          .map((match) => {
            const lines: string[] = [];
            lines.push(`DOCUMENTO: ${match.tipo_documento ?? ""} ${match.organo_giudicante ?? ""}, N. ${match.numero_sentenza ?? ""}`);
            
            if (match.massima && match.massima.trim() !== "") {
              lines.push(`MASSIMA: ${match.massima.trim()}`);
            }
            if (match.fattispecie_rilevante && match.fattispecie_rilevante.trim() !== "") {
              lines.push(`FATTISPECIE: ${match.fattispecie_rilevante.trim()}`);
            }
            if (match.url && match.url.trim() !== "") {
              lines.push(`url: ${match.url.trim()}`);
            }
            return lines.join("\n");
          })
          .join("\n\n---\n\n");

        return {
          content: [{ type: "text", text: formattedResults }],
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[JURIO-MCP] Errore di rete:", error);
        return {
          content: [{ type: "text", text: `Errore di rete: ${message}` }],
          isError: true,
        };
      }
    }
  );

  return server;
}

// ============================================================================
// GESTIONE CORS
// ============================================================================
const corsHandlerDomain = (req: any, res: any, next: () => void) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, Mcp-Session-Id");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  next();
};

// ============================================================================
// CLOUD FUNCTION PRINCIPALE
// ============================================================================
export const jurioMcpServer = onRequest(
  {
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async (req: any, res: any): Promise<void> => {
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      const path = req.path || "";

      if (path === "/favicon.ico" || path === "/favicon.png") {
        res.redirect(302, "https://jurio.it/logo.webp");
        return;
      }

      if (path === "/.well-known/mcp/server-card/" || path === "/.well-known/mcp/server-card") {
        res.status(200).json({
          name: "Jurio MCP Server",
          version: "1.0.0",
          description: "Server MCP per la ricerca nella giurisprudenza italiana",
        });
        return;
      }
      
      // ----------------------------------------------------------------------
      // OAUTH2: ENDPOINT /authorize
      // ----------------------------------------------------------------------
      if (req.method === "GET" && path === "/authorize") {
        const { client_id, redirect_uri, state, response_type } = req.query;

        if (response_type !== "code") {
          res.status(400).send("Unsupported response_type. Must be 'code'.");
          return;
        }

        const loginUrl = new URL("https://jurio.it/oauth-login");
        if (client_id) loginUrl.searchParams.append("client_id", String(client_id));
        if (redirect_uri) loginUrl.searchParams.append("redirect_uri", String(redirect_uri));
        if (state) loginUrl.searchParams.append("state", String(state));

        res.redirect(302, loginUrl.toString());
        return;
      }

      // ----------------------------------------------------------------------
      // OAUTH2: ENDPOINT /token
      // ----------------------------------------------------------------------
      if (req.method === "POST" && path === "/token") {
        const code = req.body?.code || req.query?.code;
        const grant_type = req.body?.grant_type || req.query?.grant_type;

        if (grant_type !== "authorization_code" || !code) {
          res.status(400).json({ error: "unsupported_grant_type" });
          return;
        }

        try {
          const codeRef = db.collection("oauth_codes").doc(code);
          const codeSnap = await codeRef.get();

          if (!codeSnap.exists) {
            res.status(401).json({ error: "invalid_grant", error_description: "Codice non valido o scaduto" });
            return;
          }

          const codeData = codeSnap.data();
          const uid = codeData?.uid;

          // Eliminiamo il codice
          await codeRef.delete();

          // Generiamo il token definitivo
          const accessToken = randomBytes(32).toString("hex");

          await db.collection("oauth_tokens").doc(accessToken).set({
            uid: uid,
            createdAt: FieldValue.serverTimestamp(),
            client_id: req.body?.client_id || req.query?.client_id || "claude_web"
          });

          res.status(200).json({
            access_token: accessToken,
            token_type: "Bearer",
            expires_in: 31536000,
          });
        } catch (err) {
          console.error("[JURIO-MCP] Errore scambio token:", err);
          res.status(500).json({ error: "server_error" });
        }
        return;
      }

      // Root ping
      if (req.method === "GET" && (path === "" || path === "/")) {
        res.status(200).json({
          name: "Jurio MCP Server",
          status: "active",
        });
        return;
      }
      
      // ----------------------------------------------------------------------
      // STREAMABLE HTTP SERVER TRANSPORT
      // ----------------------------------------------------------------------
      const authHeader = typeof req.headers?.authorization === "string" ? req.headers.authorization : "";

      const server = createMcpServer(authHeader);

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

      res.on("close", () => {
        void transport.close().catch((error: unknown) => {
          console.error("[JURIO-MCP] Errore chiusura transport:", error);
        });
      });

      try {
        await server.connect(transport);
        console.log(`[JURIO-MCP] ${req.method} ${path}`);
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[JURIO-MCP] Errore MCP:", error);

        if (!res.headersSent) {
          res.status(500).json({
            error: "MCP server error",
            message,
          });
        }
      }
    });
  }
);