import { Router } from "express";
import { randomBytes, createHash } from "crypto";
import { Timestamp, FieldValue } from "firebase-admin/firestore";
import { getDb } from "../../_deps";

const db = getDb();
export const oauthRouter = Router();

// Dynamic Client Registration (RFC 7591)
oauthRouter.post("/register", async (req, res) => {
  const redirectUris = req.body?.redirect_uris;

  const isValidUriArray =
    Array.isArray(redirectUris) &&
    redirectUris.length > 0 &&
    redirectUris.every((uri) => {
      try {
        new URL(uri);
        return true;
      } catch {
        return false;
      }
    });

  if (!isValidUriArray) {
    res.status(400).json({
      error: "invalid_redirect_uri",
      error_description: "redirect_uris deve essere un array di URL validi.",
    });
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
      token_endpoint_auth_method: "client_secret_post",
    });
  } catch (err) {
    console.error("[JURIO-MCP] Errore registrazione client:", err);
    res.status(500).json({ error: "server_error" });
  }
});

// OAuth Authorize
oauthRouter.get("/authorize", async (req, res) => {
  const {
    client_id,
    redirect_uri,
    state,
    response_type,
    code_challenge,
    code_challenge_method,
  } = req.query;

  if (typeof response_type !== "string" || response_type !== "code") {
    res.status(400).send("Unsupported response_type. Must be 'code'.");
    return;
  }

  if (typeof client_id !== "string" || typeof redirect_uri !== "string") {
    res.status(400).send("Parametri client_id e redirect_uri obbligatori.");
    return;
  }

  if (typeof code_challenge !== "string" || !code_challenge) {
    res.status(400).send("Parametro code_challenge obbligatorio.");
    return;
  }

  if (typeof code_challenge_method !== "string" || code_challenge_method !== "S256") {
    res.status(400).send("code_challenge_method deve essere 'S256'.");
    return;
  }

  if (!/^[A-Za-z0-9_-]{43}$/.test(code_challenge)) {
    res.status(400).send("code_challenge non valido.");
    return;
  }

  if (state !== undefined && (typeof state !== "string" || state.length > 2048)) {
    res.status(400).send("Parametro state non valido.");
    return;
  }

  try {
    const clientRef = db.collection("oauth_clients").doc(client_id);
    const clientSnap = await clientRef.get();

    if (!clientSnap.exists) {
      res.status(400).send("client_id non valido o non registrato.");
      return;
    }

    const clientData = clientSnap.data();
    if (!clientData) {
      res.status(400).send("Registrazione client non valida.");
      return;
    }

    const registeredUris = Array.isArray(clientData.redirect_uris)
      ? clientData.redirect_uris.filter((uri: unknown): uri is string => typeof uri === "string")
      : [];

    if (!registeredUris.includes(redirect_uri)) {
      res.status(400).send("redirect_uri non autorizzato per questo client.");
      return;
    }

    const loginUrl = new URL("https://jurio.it/oauth-login");
    loginUrl.searchParams.set("client_id", client_id);
    loginUrl.searchParams.set("redirect_uri", redirect_uri);
    loginUrl.searchParams.set("code_challenge", code_challenge);
    loginUrl.searchParams.set("code_challenge_method", "S256");

    if (typeof state === "string") {
      loginUrl.searchParams.set("state", state);
    }

    res.redirect(302, loginUrl.toString());
  } catch (err) {
    console.error("[JURIO-MCP] Errore in /authorize:", err);
    if (!res.headersSent) {
      res.status(500).send("Internal server error");
    }
  }
});

// OAuth Token Exchange
oauthRouter.post("/token", async (req, res) => {
  const { grant_type, code, client_id, code_verifier } = req.body || {};

  if (grant_type !== "authorization_code" || !code) {
    res.status(400).json({
      error: "unsupported_grant_type",
      error_description: "Richiesto grant_type=authorization_code e parametro code",
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

    if (!client_id || !codeData.client_id || String(client_id) !== String(codeData.client_id)) {
      res.status(401).json({
        error: "invalid_grant",
        error_description: "client_id non corrisponde al codice",
      });
      return;
    }

    if (!codeData.expiresAt || typeof codeData.expiresAt.toDate !== "function") {
      res.status(401).json({
        error: "invalid_grant",
        error_description: "Scadenza del codice non valida",
      });
      return;
    }

    if (codeData.expiresAt.toDate() <= new Date()) {
      await codeRef.delete().catch(() => {});
      res.status(401).json({
        error: "invalid_grant",
        error_description: "Codice di autorizzazione scaduto",
      });
      return;
    }

    await codeRef.delete();

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
    const expireDate = new Date();
    expireDate.setDate(expireDate.getDate() + 30);
    const expiresInSeconds = 30 * 24 * 60 * 60;

    await db.collection("oauth_tokens").doc(accessToken).set({
      user: codeData.user,
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
      res.status(500).json({ error: "server_error" });
    }
  }
});