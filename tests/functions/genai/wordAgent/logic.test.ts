import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: { collection: vi.fn() },
  doc: { get: vi.fn() },
  secure: vi.fn((_req: unknown, _res: unknown, handler: (uid: string) => unknown) => handler("u1")),
  validate: vi.fn(),
  quoteStream: { stream: vi.fn() },
  reviewStream: { stream: vi.fn() },
}));
vi.mock("@functions/_deps", () => ({ getDb: () => mocks.db }));
vi.mock("@functions/_utils", () => ({ validateUserPlanAndLimits: mocks.validate, withSecureApiEndpoint: mocks.secure }));
vi.mock("@functions/genai/wordAgent/flow", () => ({ wordQuoteFlow: mocks.quoteStream, wordReviewFlow: mocks.reviewStream }));

import { executeWordAgent } from "@functions/genai/wordAgent/logic";

describe("Word-agent endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.collection.mockReturnValue({ doc: vi.fn(() => mocks.doc) });
    mocks.doc.get.mockResolvedValue({ exists: true });
    mocks.validate.mockResolvedValue(undefined);
  });

  it("rejects an absent action before reading user records or starting a stream", async () => {
    const req = { body: {}, on: vi.fn() };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await executeWordAgent(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Bad Request", details: "Parametro 'action' mancante o non valido." });
    expect(mocks.db.collection).not.toHaveBeenCalled();
  });

  it("streams quote results and includes routing inputs and the final event", async () => {
    const output = { testoQuote: "quote", fonti: [] };
    mocks.quoteStream.stream.mockReturnValue({
      stream: (async function* () { yield { status: "searching" }; })(),
      output: Promise.resolve(output),
    });
    const req = { body: { action: "research", contesto: " facts ", filters: [{ field: "x" }], promptIndirizzamento: " focus " }, on: vi.fn() };
    const res = {
      status: vi.fn().mockReturnThis(), json: vi.fn(), setHeader: vi.fn(), flushHeaders: vi.fn(),
      write: vi.fn(), end: vi.fn(), writableEnded: false,
    };
    await executeWordAgent(req as never, res as never);
    expect(mocks.validate).toHaveBeenCalledWith("u1", "research_agent", expect.any(Object));
    expect(mocks.quoteStream.stream).toHaveBeenCalledWith({
      contesto: " facts ", promptIndirizzamento: " focus ", filters: [{ field: "x" }], userId: "u1",
    });
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('"result":{"testoQuote":"quote"'));
    expect(res.write).toHaveBeenCalledWith("data: [DONE]\n\n");
    expect(res.end).toHaveBeenCalledOnce();
  });

  it("rejects invalid review chunks and unsupported actions after plan validation", async () => {
    const res = {
      status: vi.fn().mockReturnThis(), json: vi.fn(), setHeader: vi.fn(), flushHeaders: vi.fn(),
      write: vi.fn(), end: vi.fn(), writableEnded: false,
    };
    await executeWordAgent({ body: { action: "review", chunks: "not-array" }, on: vi.fn() } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Per la review serve un array di chunks." });

    await expect(executeWordAgent({ body: { action: "unknown" }, on: vi.fn() } as never, res as never))
      .rejects.toThrow("Azione 'unknown' non supportata da wordAgent.");
  });

  it("streams review chunks with the caller's directive and returns the completed result", async () => {
    const output = { tesi: [] };
    mocks.reviewStream.stream.mockReturnValue({
      stream: (async function* () { yield { message: { status: "reviewing" } }; })(),
      output: Promise.resolve(output),
    });
    const req = { body: { action: "review", chunks: ["text"], promptIndirizzamento: "check" }, on: vi.fn() };
    const res = {
      status: vi.fn().mockReturnThis(), json: vi.fn(), setHeader: vi.fn(), flushHeaders: vi.fn(),
      write: vi.fn(), end: vi.fn(), writableEnded: false,
    };
    await executeWordAgent(req as never, res as never);
    expect(mocks.reviewStream.stream).toHaveBeenCalledWith({
      chunks: ["text"], promptIndirizzamento: "check", userId: "u1",
    });
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('"result":{"tesi":[]}'));
    expect(res.write).toHaveBeenCalledWith("data: [DONE]\n\n");
  });
});
