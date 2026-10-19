import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const mocks = vi.hoisted(() => {
  const tokenGet = vi.fn();
  const docDelete = vi.fn();
  const doc = { get: tokenGet };
  const collection = vi.fn(() => ({ doc: vi.fn(() => doc) }));
  const db = { collection };
  const close = vi.fn().mockResolvedValue(undefined);
  const handleRequest = vi.fn().mockResolvedValue(undefined);
  const connect = vi.fn().mockResolvedValue(undefined);
  const server = { connect };
  const createMcpServer = vi.fn(() => server);
  const transportConfig = vi.fn();
  return {
    tokenGet, docDelete, collection, db, close, handleRequest,
    connect, server, createMcpServer, transportConfig,
  };
});

vi.mock("@functions/_deps", () => ({ getDb: () => mocks.db }));
vi.mock("@functions/mpc/server", () => ({ createMcpServer: mocks.createMcpServer }));

const functionRequire = createRequire(resolve(process.cwd(), "functions/src/mpc/routes/mcp.routes.ts"));
const transportModule = functionRequire("@modelcontextprotocol/sdk/server/streamableHttp.js");
let mcpRouter: typeof import("@functions/mpc/routes/mcp.routes").mcpRouter;

function routeMiddleware() {
  const layers = (mcpRouter as unknown as { stack: Array<{ handle: (req: unknown, res: unknown) => Promise<void> }> }).stack;
  return layers[0].handle;
}

function makeResponse() {
  return {
    headersSent: false,
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
    end: vi.fn(),
    set: vi.fn().mockReturnThis(),
    on: vi.fn(),
  };
}

describe("mcpRouter", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.spyOn(transportModule, "StreamableHTTPServerTransport").mockImplementation(function (this: unknown, config: unknown) {
      mocks.transportConfig(config);
      return {
        close: mocks.close,
        handleRequest: mocks.handleRequest,
      } as never;
    } as never);
    mocks.tokenGet.mockResolvedValue({ exists: false });
    mocks.docDelete.mockResolvedValue(undefined);
    mocks.close.mockResolvedValue(undefined);
    mocks.handleRequest.mockResolvedValue(undefined);
    mocks.connect.mockResolvedValue(undefined);
    ({ mcpRouter } = await import("@functions/mpc/routes/mcp.routes"));
  });

  it("handles CORS preflight without checking authentication", async () => {
    const res = makeResponse();

    await routeMiddleware()({ method: "OPTIONS", headers: {} }, res);

    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalledOnce();
    expect(mocks.tokenGet).not.toHaveBeenCalled();
  });

  it("rejects missing bearer credentials and malformed token strings", async () => {
    const missing = makeResponse();
    await routeMiddleware()({ method: "GET", headers: {} }, missing);
    expect(missing.status).toHaveBeenCalledWith(401);
    expect(missing.json).toHaveBeenCalledWith(expect.objectContaining({ error: "unauthorized" }));

    const malformed = makeResponse();
    await routeMiddleware()({ method: "GET", headers: { authorization: "Bearer nope" } }, malformed);
    expect(malformed.status).toHaveBeenCalledWith(401);
    expect(mocks.tokenGet).not.toHaveBeenCalled();
  });

  it("rejects an unknown valid-shape token", async () => {
    const res = makeResponse();
    const token = "a".repeat(64);

    await routeMiddleware()({ method: "POST", headers: { authorization: `Bearer ${token}$` } }, res);

    expect(mocks.tokenGet).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "unauthorized", message: "Token non valido o revocato." });
  });

  it("rejects malformed token records and deletes expired tokens", async () => {
    const malformed = makeResponse();
    mocks.tokenGet.mockResolvedValueOnce({ exists: true, data: () => ({ uid: "user" }) });
    await routeMiddleware()({ method: "POST", headers: { authorization: `Bearer ${"b".repeat(64)}$` } }, malformed);
    expect(malformed.status).toHaveBeenCalledWith(401);
    expect(malformed.json).toHaveBeenCalledWith({ error: "unauthorized", message: "Dati del token non validi." });

    const deleteToken = vi.fn().mockResolvedValue(undefined);
    const expired = makeResponse();
    mocks.tokenGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ uid: "user", expiresAt: { toDate: () => new Date(Date.now() - 1000) } }),
      ref: { delete: deleteToken },
    });
    await routeMiddleware()({ method: "POST", headers: { authorization: `Bearer ${"c".repeat(64)}$` } }, expired);
    expect(deleteToken).toHaveBeenCalledOnce();
    expect(expired.status).toHaveBeenCalledWith(401);
    expect(expired.json).toHaveBeenCalledWith({ error: "unauthorized", message: "Token scaduto." });
  });

  it("authenticates valid requests and catches failures while connecting the MCP server", async () => {
    const res = makeResponse();
    const req = {
      method: "POST",
      headers: { authorization: `Bearer ${"d".repeat(64)}$` },
      body: { jsonrpc: "2.0" },
    };
    mocks.tokenGet.mockResolvedValue({
      exists: true,
      data: () => ({ uid: "user", expiresAt: { toDate: () => new Date(Date.now() + 60_000) } }),
    });
    mocks.connect.mockRejectedValueOnce(new Error("transport connection failed"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await routeMiddleware()(req, res);

    expect(mocks.createMcpServer).toHaveBeenCalledOnce();
    expect(mocks.connect).toHaveBeenCalledOnce();
    expect(mocks.handleRequest).not.toHaveBeenCalled();
    expect(res.on).toHaveBeenCalledWith("close", expect.any(Function));
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "MCP server error" });
    expect(consoleError).toHaveBeenCalledOnce();
  });

  it("returns an internal error when Firestore or the MCP transport fails", async () => {
    const res = makeResponse();
    mocks.tokenGet.mockRejectedValue(new Error("database unavailable"));
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    await routeMiddleware()({ method: "POST", headers: { authorization: `Bearer ${"e".repeat(64)}$` } }, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "MCP server error" });
    expect(consoleError).toHaveBeenCalledOnce();
  });
});
