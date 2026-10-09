import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./server";
import { randomBytes, createHash } from "crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { getDb, getAdminAuth } from "../deps"; // getAuth deve restituire l'istanza Firebase Admin Auth
import { Timestamp, FieldValue } from "firebase-admin/firestore";

const db = getDb();
const auth = getAdminAuth();

// ============================================================================
// MCP SERVER (EXPRESS)
// ============================================================================

export const app = express();

// 1. Hardening Header e Limite Payload (Protezione DoS)
app.use(helmet());
app.use(express.json({ limit: "10kb" }));

// 2. CORS Restrittivo per Client MCP autorizzati
const ALLOWED_ORIGINS = [
  "https://jurio.it",
  "https://claude.ai",
  "https://chat.openai.com"
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || ALLOWED_ORIGINS.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Origine non consentita dalle policy CORS di Jurio"));
      }
    },
    credentials: true,
  })
);

// Normalizza le richieste: rimuove il prefisso /mcp se presente
app.use((req, res, next) => {
  if (req.url.startsWith("/mcp/")) {
    req.url = req.url.replace(/^\/mcp/, "");
  } else if (req.url === "/mcp") {
    req.url = "/";
  }
  next();
});

// 1. Server Card
app.get(["/.well-known/mcp/server-card", "/.well-known/mcp/server-card/"], (req, res) => {
  res.status(200).json({
    name: "Jurio MCP Server",
    version: "1.0.4",
    description: "Server MCP per la ricerca nella giurisprudenza italiana",
  });
});

// 2. Protected Resource (RFC 9723)
app.get([
  "/.well-known/oauth-protected-resource",
  "/.well-known/oauth-protected-resource/",
  "/.well-known/oauth-protected-resource/mcp"
], (req, res) => {
  res.status(200).json({
    resource: "https://jurio.it/mcp",
    authorization_servers: ["https://jurio.it/mcp"]
  });
});

// 3. Authorization Server Metadata (RFC 8414 & OpenID Discovery)
app.get([
  "/.well-known/oauth-authorization-server",
  "/.well-known/oauth-authorization-server/",
  "/.well-known/oauth-authorization-server/mcp",
  "/.well-known/openid-configuration",
  "/.well-known/openid-configuration/",
  "/.well-known/openid-configuration/mcp"
], (req, res) => {
  res.status(200).json({
    issuer: "https://jurio.it/mcp",
    authorization_endpoint: "https://jurio.it/mcp/authorize",
    token_endpoint: "https://jurio.it/mcp/token",
    registration_endpoint: "https://jurio.it/mcp/register",
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"] // Rimosso 'plain' per RFC 9700 Security Best Practices
  });
});

// 4. Dynamic Client Registration (RFC 7591)
app.post("/register", async (req, res) => {
  const redirectUris = req.body?.redirect_uris;

  if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
    res.status(400).json({ error: "invalid_redirect_uri", error_description: "redirect_uris deve essere un array di URL validi." });
    return;
  }

  const clientId = "client_" + randomBytes(16).toString("hex");
  const clientSecret = randomBytes(32).toString("hex");

  try {
    await db.collection("oauth_clients").doc(clientId).set({
      client_secret: clientSecret,
      redirect_uris: redirectUris,
      createdAt: FieldValue.serverTimestamp(),
    });

    res.status(201).json({
      client_id: clientId,
      client_secret: clientSecret,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_secret_expires_at: 0,
      grant_types: ["authorization_code"],
      response_types: ["code"],
      redirect_uris: redirectUris,
      token_endpoint_auth_method: "client_secret_post"
    });
  } catch (err) {
    console.error("[JURIO-MCP] Errore registrazione client:", err);
    res.status(500).json({ error: "server_error" });
  }
});

// 5. OAuth Authorize (con prevenzione Open Redirect & Supporto PKCE)
app.get("/authorize", async (req, res) => {
  const {
    client_id,
    redirect_uri,
    state,
    response_type,
    code_challenge,
    code_challenge_method,
  } = req.query;

  // --------------------------------------------------------------------------
  // Validazione parametri base
  // --------------------------------------------------------------------------

  if (typeof response_type !== "string" || response_type !== "code") {
    res.status(400).send("Unsupported response_type. Must be 'code'.");
    return;
  }

  if (
    typeof client_id !== "string" ||
    typeof redirect_uri !== "string"
  ) {
    res.status(400).send(
      "Parametri client_id e redirect_uri obbligatori."
    );
    return;
  }

  // --------------------------------------------------------------------------
  // PKCE obbligatorio
  // --------------------------------------------------------------------------

  if (typeof code_challenge !== "string" || !code_challenge) {
    res.status(400).send(
      "Parametro code_challenge obbligatorio."
    );
    return;
  }

  if (
    typeof code_challenge_method !== "string" ||
    code_challenge_method !== "S256"
  ) {
    res.status(400).send(
      "code_challenge_method deve essere 'S256'."
    );
    return;
  }

  // Verifica sintattica del PKCE code challenge.
  // Per S256 deve essere una stringa base64url di 43 caratteri
  // nella configurazione standard.
  if (!/^[A-Za-z0-9_-]{43}$/.test(code_challenge)) {
    res.status(400).send(
      "code_challenge non valido."
    );
    return;
  }

  // --------------------------------------------------------------------------
  // State: opzionale, ma se presente deve essere una stringa ragionevole
  // --------------------------------------------------------------------------

  if (
    state !== undefined &&
    (typeof state !== "string" || state.length > 2048)
  ) {
    res.status(400).send("Parametro state non valido.");
    return;
  }

  try {
    // ------------------------------------------------------------------------
    // Validazione client
    // ------------------------------------------------------------------------

    const clientRef = db
      .collection("oauth_clients")
      .doc(client_id);

    const clientSnap = await clientRef.get();

    if (!clientSnap.exists) {
      res.status(400).send(
        "client_id non valido o non registrato."
      );
      return;
    }

    const clientData = clientSnap.data();

    if (!clientData) {
      res.status(400).send(
        "Registrazione client non valida."
      );
      return;
    }

    // ------------------------------------------------------------------------
    // Validazione redirect_uri
    // ------------------------------------------------------------------------

    const registeredUris = Array.isArray(clientData.redirect_uris)
      ? clientData.redirect_uris.filter(
          (uri: unknown): uri is string =>
            typeof uri === "string"
        )
      : [];

    if (!registeredUris.includes(redirect_uri)) {
      res.status(400).send(
        "redirect_uri non autorizzato per questo client."
      );
      return;
    }

    // ------------------------------------------------------------------------
    // Costruzione URL di login
    // ------------------------------------------------------------------------

    const loginUrl = new URL(
      "https://jurio.it/oauth-login"
    );

    loginUrl.searchParams.set(
      "client_id",
      client_id
    );

    loginUrl.searchParams.set(
      "redirect_uri",
      redirect_uri
    );

    loginUrl.searchParams.set(
      "code_challenge",
      code_challenge
    );

    loginUrl.searchParams.set(
      "code_challenge_method",
      "S256"
    );

    if (typeof state === "string") {
      loginUrl.searchParams.set("state", state);
    }

    res.redirect(302, loginUrl.toString());
  } catch (err) {
    console.error(
      "[JURIO-MCP] Errore in /authorize:",
      err
    );

    if (!res.headersSent) {
      res.status(500).send(
        "Internal server error"
      );
    }
  }
});

// 6. OAuth Token Exchange (con verifica PKCE S256 e protezione da Replay Attack)
app.post("/token", async (req, res) => {
  const { grant_type, code, client_id, code_verifier } = req.body || {};

  if (grant_type !== "authorization_code" || !code) {
    res.status(400).json({
      error: "unsupported_grant_type",
      error_description:
        "Richiesto grant_type=authorization_code e parametro code",
    });
    return;
  }

  try {
    const codeRef = db.collection("oauth_codes").doc(String(code));
    const codeSnap = await codeRef.get();

    if (!codeSnap.exists) {
      res.status(401).json({
        error: "invalid_grant",
        error_description: "Codice non valido o gia' utilizzato",
      });
      return;
    }

    const codeData = codeSnap.data();

    if (!codeData) {
      res.status(401).json({
        error: "invalid_grant",
        error_description: "Dati del codice non validi",
      });
      return;
    }

    // Verifica che il client_id della richiesta corrisponda
    // a quello associato all'authorization code.
    if (
      !client_id ||
      !codeData.client_id ||
      String(client_id) !== String(codeData.client_id)
    ) {
      res.status(401).json({
        error: "invalid_grant",
        error_description: "client_id non corrisponde al codice",
      });
      return;
    }

    // expiresAt obbligatorio: fail-closed.
    // Se manca o non è valido, il codice viene rifiutato.
    if (!codeData.expiresAt || typeof codeData.expiresAt.toDate !== "function") {
      res.status(401).json({
        error: "invalid_grant",
        error_description: "Scadenza del codice non valida",
      });
      return;
    }

    // Verifica la TTL del codice di autorizzazione.
    if (codeData.expiresAt.toDate() <= new Date()) {
      // Cleanup del codice scaduto.
      await codeRef.delete().catch(() => {});

      res.status(401).json({
        error: "invalid_grant",
        error_description: "Codice di autorizzazione scaduto",
      });
      return;
    }

    // Single-use enforcement.
    // Il codice viene eliminato prima di emettere il token.
    await codeRef.delete();

    // Verifica PKCE se richiesto all'atto dell'autorizzazione.
    if (codeData.code_challenge) {
      if (!code_verifier) {
        res.status(400).json({
          error: "invalid_request",
          error_description: "code_verifier mancante",
        });
        return;
      }

      const computedChallenge = createHash("sha256")
        .update(String(code_verifier))
        .digest("base64url");

      if (computedChallenge !== String(codeData.code_challenge)) {
        res.status(400).json({
          error: "invalid_grant",
          error_description: "Verifica PKCE fallita",
        });
        return;
      }
    }

    const accessToken = randomBytes(32).toString("hex");

    // Scadenza del token: 30 giorni
    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + 30);

    const expiresInSeconds = 30 * 24 * 60 * 60;

    await db.collection("oauth_tokens").doc(accessToken).set({
      uid: codeData.uid,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromDate(expireDate),
      client_id: String(codeData.client_id),
    });

    res.status(200).json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: expiresInSeconds,
    });
  } catch (err) {
    console.error("[JURIO-MCP] Errore scambio token:", err);

    if (!res.headersSent) {
      res.status(500).json({
        error: "server_error",
      });
    }
  }
});

// 7. MCP Protocol Transport (Risolutezza Token Opaque -> Custom Token Firebase)
app.use(async (req, res) => {
  if (req.method === "OPTIONS") { 
    res.status(204).end(); 
    return; 
  }

  const authHeader = typeof req.headers?.authorization === "string" ? req.headers.authorization : "";

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.set("WWW-Authenticate", 'Bearer realm="jurio", error="unauthorized"');
    res.status(401).json({
      error: "unauthorized",
      message: "Autenticazione richiesta per utilizzare Jurio MCP."
    });
    return;
  }

  const token = authHeader.replace("Bearer ", "").trim();

  try {
    // 1. Verifica la presenza del token Opaque nel DB
    const tokenSnap = await db.collection("oauth_tokens").doc(token).get();

    if (!tokenSnap.exists) {
      res.set("WWW-Authenticate", 'Bearer realm="jurio", error="invalid_token"');
      res.status(401).json({ error: "unauthorized", message: "Token non valido o revocato." });
      return;
    }

    const tokenData = tokenSnap.data();
    if (!tokenData || !tokenData?.expiresAt) {
         throw new Error("Token data non valido o mancante");
    }
    if (tokenData.expiresAt.toDate() <= new Date()) {
         await tokenSnap.ref.delete().catch(() => {});
        res.set(
            "WWW-Authenticate",
            'Bearer realm="jurio", error="invalid_token"'
        );
        res.status(401).json({
            error: "unauthorized",
            message: "Token di accesso scaduto."
        });
        return;
    }

    const uid = tokenData?.uid;
    // 2. Controllo scadenza token
    if (tokenData?.expiresAt && tokenData.expiresAt.toDate() < new Date()) {
      await db.collection("oauth_tokens").doc(token).delete().catch(() => {}); // cleanup silent
      res.set("WWW-Authenticate", 'Bearer realm="jurio", error="invalid_token"');
      res.status(401).json({ error: "unauthorized", message: "Token di accesso scaduto." });
      return;
    }

    // 3. Generazione Custom Token per Firebase Auth (Bridge verso la logica interna del server MCP)
    const customToken = await auth.createCustomToken(uid);
    const mcpAuthHeader = `Bearer ${customToken}`;

    // 4. Istanziazione server MCP con Header autenticato
    const server = createMcpServer(mcpAuthHeader);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    res.on("close", () => {
      transport.close().catch(console.error);
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("[JURIO-MCP] Errore durante l'autenticazione o esecuzione MCP:", error);
    if (!res.headersSent) res.status(500).json({ error: "MCP server error" });
    return;
  }
});