import { Router, type Response } from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "../server";
import { getDb } from "../../_deps";
import { logSafeError } from "../../_logging";

const db = getDb();
export const mcpRouter = Router();
const MCP_RESOURCE = "https://jurio.it/mcp";
const RESOURCE_METADATA_URL = "https://jurio.it/.well-known/oauth-protected-resource/mcp";

type DiagnosticOrigin =
  | "authentication"
  | "transport"
  | "jsonrpc"
  | "application"
  | "unknown";

type PhaseName =
  | "request_received"
  | "auth_header_validated"
  | "token_shape_validated"
  | "token_db_lookup_start"
  | "token_db_lookup_end"
  | "token_validated"
  | "transport_created"
  | "server_connect_start"
  | "server_connect_end"
  | "transport_handle_start"
  | "transport_handle_end"
  | "response_close";

type PhaseMark = { name: PhaseName; t: number };

function parseJsonRpcMethod(body: unknown): string | undefined {
  if (Array.isArray(body)) {
    for (const item of body) {
      if (item && typeof item === "object" && "method" in item && typeof item.method === "string") {
        return item.method;
      }
    }
    return undefined;
  }

  if (body && typeof body === "object" && "method" in body && typeof body.method === "string") {
    return body.method;
  }

  return undefined;
}

function inferMcpPhase(jsonRpcMethod?: string): string {
  if (!jsonRpcMethod) return "unknown";
  if (jsonRpcMethod === "initialize") return "initialize";
  if (jsonRpcMethod === "notifications/initialized") return "post_initialize_notification";
  if (jsonRpcMethod.startsWith("tools/")) return "tools";
  if (jsonRpcMethod.startsWith("resources/")) return "resources";
  if (jsonRpcMethod.startsWith("prompts/")) return "prompts";
  return "jsonrpc_other";
}

function safeHeaderValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function truncateText(value: string, max = 4096): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}... [truncated ${value.length - max} chars]`;
}

function computePhaseDurations(phases: PhaseMark[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (let i = 0; i < phases.length; i += 1) {
    const current = phases[i];
    const next = phases[i + 1];
    if (!next) break;
    out[`${current.name}__to__${next.name}`] = Number((next.t - current.t).toFixed(3));
  }
  return out;
}

function getTransportOriginFromMessage(message: string | undefined): DiagnosticOrigin {
  if (!message) return "transport";
  const normalized = message.toLowerCase();

  if (normalized.includes("parse error") || normalized.includes("json-rpc") || normalized.includes("invalid request")) {
    return "jsonrpc";
  }

  if (normalized.includes("protocol version") || normalized.includes("content-type") || normalized.includes("not acceptable")) {
    return "transport";
  }

  if (normalized.includes("session") || normalized.includes("mcp-session-id")) {
    return "transport";
  }

  return "transport";
}

function setOAuthChallenge(res: Response, error: string): void {
  res.set(
    "WWW-Authenticate",
    `Bearer realm="jurio", resource_metadata="${RESOURCE_METADATA_URL}", error="${error}"`
  );
}

mcpRouter.use(async (req, res) => {
  const startedAtMs = Date.now();
  const startedAtIso = new Date(startedAtMs).toISOString();
  const phases: PhaseMark[] = [{ name: "request_received", t: performance.now() }];
  const responseChunks: Buffer[] = [];
  let responseBytes = 0;
  let origin: DiagnosticOrigin = "unknown";
  let originDetail: string | undefined;
  let logged = false;

  const jsonRpcMethod = parseJsonRpcMethod(req.body);
  const mcpPhase = inferMcpPhase(jsonRpcMethod);
  const protocolVersion = safeHeaderValue(req.headers?.["mcp-protocol-version"]);
  const mcpSessionIdPresent = typeof req.headers?.["mcp-session-id"] === "string";
  const userAgent = safeHeaderValue(req.headers?.["user-agent"]);

  const writeIsSpy = typeof res.write === "function" && "mock" in (res.write as unknown as Record<string, unknown>);
  const endIsSpy = typeof res.end === "function" && "mock" in (res.end as unknown as Record<string, unknown>);
  const writeOriginal = typeof res.write === "function" && !writeIsSpy ? res.write.bind(res) : undefined;
  const endOriginal = typeof res.end === "function" && !endIsSpy ? res.end.bind(res) : undefined;

  function collectResponseChunk(chunk: unknown): void {
    if (chunk === undefined || chunk === null) return;
    if (Buffer.isBuffer(chunk)) {
      responseChunks.push(chunk);
      responseBytes += chunk.length;
      return;
    }
    if (typeof chunk === "string") {
      const buf = Buffer.from(chunk);
      responseChunks.push(buf);
      responseBytes += buf.length;
      return;
    }
    const serialized = Buffer.from(String(chunk));
    responseChunks.push(serialized);
    responseBytes += serialized.length;
  }

  if (writeOriginal) {
    res.write = ((chunk: unknown, ...args: unknown[]) => {
      collectResponseChunk(chunk);
      return writeOriginal(chunk as never, ...(args as never[]));
    }) as typeof res.write;
  }

  if (endOriginal) {
    res.end = ((chunk?: unknown, ...args: unknown[]) => {
      collectResponseChunk(chunk);
      return endOriginal(chunk as never, ...(args as never[]));
    }) as typeof res.end;
  }

  function logDiagnosticIfNeeded(): void {
    if (logged) return;
    logged = true;

    if (res.statusCode !== 400 && res.statusCode !== 401) return;

    const contentType = typeof res.getHeader === "function"
      ? safeHeaderValue(res.getHeader("content-type"))
      : undefined;

    const responseBodyRaw = Buffer.concat(responseChunks).toString("utf8");
    const responseBody = truncateText(responseBodyRaw);

    console.warn("MCP_HTTP_DIAGNOSTIC", {
      timestamp: startedAtIso,
      method: req.method,
      endpoint: req.originalUrl ?? req.url,
      statusCode: res.statusCode,
      contentType,
      userAgent,
      jsonRpcMethod,
      mcpProtocolVersion: protocolVersion,
      mcpSessionIdPresent,
      mcpPhase,
      origin,
      originDetail,
      responseBody,
      responseBodyBytes: responseBytes,
      durationMs: Date.now() - startedAtMs,
      phaseDurationsMs: computePhaseDurations(phases),
    });
  }

  if (typeof res.once === "function") {
    res.once("finish", logDiagnosticIfNeeded);
  } else if (typeof res.on === "function") {
    res.on("finish", logDiagnosticIfNeeded);
  }

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  phases.push({ name: "auth_header_validated", t: performance.now() });

  const authHeader = typeof req.headers?.authorization === "string" ? req.headers.authorization : "";

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    origin = "authentication";
    originDetail = "missing_or_invalid_authorization_header";
    setOAuthChallenge(res, "unauthorized");
    res.status(401).json({
      error: "unauthorized",
      message: "Autenticazione richiesta per utilizzare Jurio MCP.",
    });
    return;
  }

  const token = authHeader.replace("Bearer ", "").trim();

  try {
    if (!/^[a-f0-9]{64}$/.test(token)) {
      origin = "authentication";
      originDetail = "invalid_token_shape";
      setOAuthChallenge(res, "invalid_token");
      res.status(401).json({ error: "unauthorized", message: "Token non valido." });
      return;
    }

    phases.push({ name: "token_shape_validated", t: performance.now() });
    phases.push({ name: "token_db_lookup_start", t: performance.now() });

    const tokenSnap = await db.collection("oauth_tokens").doc(token).get();
    phases.push({ name: "token_db_lookup_end", t: performance.now() });

    if (!tokenSnap.exists) {
      origin = "authentication";
      originDetail = "token_not_found_or_revoked";
      setOAuthChallenge(res, "invalid_token");
      res.status(401).json({ error: "unauthorized", message: "Token non valido o revocato." });
      return;
    }

    const tokenData = tokenSnap.data();
    const expiresAt = tokenData?.expiresAt;
    const uid = tokenData?.user;

    if (typeof uid !== "string" || !uid || !expiresAt || typeof expiresAt.toDate !== "function") {
      origin = "authentication";
      originDetail = "token_record_malformed";
      setOAuthChallenge(res, "invalid_token");
      res.status(401).json({ error: "unauthorized", message: "Dati del token non validi." });
      return;
    }

    if (expiresAt.toDate() <= new Date()) {
      await tokenSnap.ref.delete().catch(() => {});
      origin = "authentication";
      originDetail = "token_expired";
      setOAuthChallenge(res, "invalid_token");
      res.status(401).json({ error: "unauthorized", message: "Token scaduto." });
      return;
    }

    if (tokenData?.resource && tokenData.resource !== MCP_RESOURCE) {
      origin = "authentication";
      originDetail = "token_resource_mismatch";
      setOAuthChallenge(res, "invalid_token");
      res.status(401).json({ error: "unauthorized", message: "Token non valido per questa risorsa." });
      return;
    }

    phases.push({ name: "token_validated", t: performance.now() });

    // Server stateless: niente stream SSE di notifiche (GET) né sessioni da chiudere (DELETE).
    // Senza questo 405 la GET restava aperta fino al timeout di 300s, tenendo l'istanza occupata e fatturata.
    if (req.method === "GET" || req.method === "DELETE") {
      res.set("Allow", "POST, OPTIONS");
      res.status(405).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed: questo server MCP è stateless e accetta solo POST." },
        id: null,
      });
      return;
    }

    const mcpAuthHeader = `Bearer ${token}`;
    const server = createMcpServer(mcpAuthHeader);

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    phases.push({ name: "transport_created", t: performance.now() });

    transport.onerror = (error) => {
      origin = getTransportOriginFromMessage(error?.message);
      originDetail = error?.message;
    };

    res.on("close", () => {
      phases.push({ name: "response_close", t: performance.now() });
      transport.close().catch(console.error);
    });

    phases.push({ name: "server_connect_start", t: performance.now() });
    await server.connect(transport);
    phases.push({ name: "server_connect_end", t: performance.now() });

    phases.push({ name: "transport_handle_start", t: performance.now() });
    await transport.handleRequest(req, res, req.body);
    phases.push({ name: "transport_handle_end", t: performance.now() });
  } catch (error) {
    if (origin === "unknown") {
      origin = "application";
      originDetail = error instanceof Error ? error.message : String(error);
    }

    logSafeError("MCP_AUTHENTICATION_OR_EXECUTION_FAILED", error);
    if (!res.headersSent) res.status(500).json({ error: "MCP server error" });
    return;
  }
});
