import { Router } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "../server";
import { getDb } from "../../_deps";

const db = getDb();
export const mcpRouter = Router();

mcpRouter.use(async (req, res) => {
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  const authHeader = typeof req.headers?.authorization === "string" ? req.headers.authorization : "";

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.set("WWW-Authenticate", 'Bearer realm="jurio", error="unauthorized"');
    res.status(401).json({
      error: "unauthorized",
      message: "Autenticazione richiesta per utilizzare Jurio MCP.",
    });
    return;
  }

  const token = authHeader.replace("Bearer ", "").trim();

  try {
    if (!/^[a-f0-9]{64}\$/.test(token)) {
      res.set("WWW-Authenticate", 'Bearer realm="jurio", error="invalid_token"');
      res.status(401).json({ error: "unauthorized", message: "Token non valido." });
      return;
    }

    const tokenSnap = await db.collection("oauth_tokens").doc(token).get();

    if (!tokenSnap.exists) {
      res.set("WWW-Authenticate", 'Bearer realm="jurio", error="invalid_token"');
      res.status(401).json({ error: "unauthorized", message: "Token non valido o revocato." });
      return;
    }

    const tokenData = tokenSnap.data();
    const expiresAt = tokenData?.expiresAt;
    const uid = tokenData?.user;

    if (typeof uid !== "string" || !uid || !expiresAt || typeof expiresAt.toDate !== "function") {
      res.status(401).json({ error: "unauthorized", message: "Dati del token non validi." });
      return;
    }

    if (expiresAt.toDate() <= new Date()) {
      await tokenSnap.ref.delete().catch(() => {});
      res.set("WWW-Authenticate", 'Bearer realm="jurio", error="invalid_token"');
      res.status(401).json({ error: "unauthorized", message: "Token scaduto." });
      return;
    }

    const mcpAuthHeader = `Bearer ${token}`;
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