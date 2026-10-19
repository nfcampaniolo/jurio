import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: { collection: vi.fn() },
  cors: vi.fn((_req: unknown, _res: unknown, handler: () => unknown) => handler()),
  secure: vi.fn((_req: unknown, _res: unknown, handler: (uid: string) => unknown) => handler("u1")),
  minute: vi.fn(), daily: vi.fn(), appCheck: vi.fn(),
  supportFlow: { stream: vi.fn() },
  metadataFlow: vi.fn(),
}));
vi.mock("@functions/_deps", () => ({ getDb: () => mocks.db }));
vi.mock("@functions/_utils", () => ({
  corsHandlerDomain: mocks.cors, requireAppCheck: mocks.appCheck,
  consumePerMinuteFeature: mocks.minute, consumeDailyFeature: mocks.daily,
  withSecureApiEndpoint: mocks.secure, validateUserPlanAndLimits: vi.fn(),
}));
vi.mock("@functions/genai/supportAgent/flow", () => ({ legalAgentSupport: mocks.supportFlow, estraiMetadatiFlow: mocks.metadataFlow }));
import {
  enforcePublicRateLimit, executeGenerateEmbedding, executeSupport, executeUpdateMetadataFromChat,
} from "@functions/genai/supportAgent/logic";

describe("support-agent endpoint helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetAllMocks();
    mocks.cors.mockImplementation((_req, _res, handler) => handler());
    mocks.secure.mockImplementation((_req, _res, handler) => handler("u1"));
    mocks.appCheck.mockResolvedValue(undefined);
    mocks.minute.mockResolvedValue(undefined);
    mocks.daily.mockResolvedValue(undefined);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("uses a hashed forwarded address for the public limits", async () => {
    const req = { headers: { "x-forwarded-for": "192.0.2.1, proxy" }, ip: "127.0.0.1" };
    const identifier = await enforcePublicRateLimit(req as never, "support_public");
    expect(identifier).toMatch(/^ip_[a-f0-9]{64}$/);
    expect(mocks.minute).toHaveBeenCalledWith(identifier, "support_public", expect.any(Number));
    expect(mocks.daily).toHaveBeenCalledWith(identifier, "support_public", expect.any(Number));
  });

  it("answers preflight requests without authentication or rate-limit calls", async () => {
    const req = { method: "OPTIONS" };
    const res = { status: vi.fn().mockReturnThis(), end: vi.fn() };
    await executeSupport(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.end).toHaveBeenCalledOnce();
    expect(mocks.appCheck).not.toHaveBeenCalled();
  });

  it("returns 401 for failed App Check and 429 for a rejected public quota", async () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    mocks.appCheck.mockRejectedValueOnce(new Error("missing token"));
    await executeSupport({ method: "POST", headers: {}, ip: "127.0.0.1" } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });

    vi.clearAllMocks();
    mocks.cors.mockImplementation((_req, _res, handler) => handler());
    mocks.appCheck.mockResolvedValue(undefined);
    mocks.minute.mockRejectedValueOnce(new Error("over quota"));
    await executeSupport({ method: "POST", ip: "127.0.0.1" } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith({ error: "Too Many Requests" });
  });

  it("rejects invalid request methods and invalid message arrays after checks", async () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await executeSupport({ method: "GET" } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(405);
    mocks.appCheck.mockResolvedValue(undefined);
    mocks.minute.mockResolvedValue(undefined);
    mocks.daily.mockResolvedValue(undefined);
    await executeSupport({ method: "POST", headers: {}, body: { messages: [] }, ip: "127.0.0.1" } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenLastCalledWith({ error: "Bad Request: Invalid messages array length." });
  });

  it("normalizes request history and writes stream chunks and the final result", async () => {
    const stream = {
      stream: (async function* () { yield { status: "searching" }; })(),
      output: Promise.resolve({ risposta: "answer" }),
    };
    mocks.supportFlow.stream.mockReturnValue(stream);
    const req = {
      method: "POST", headers: {}, ip: "127.0.0.1",
      body: { messages: [
        { role: "assistant", content: "prior" },
        { role: "user", content: "  question  " },
      ] },
      on: vi.fn(),
    };
    mocks.appCheck.mockResolvedValue(undefined);
    mocks.minute.mockResolvedValue(undefined);
    mocks.daily.mockResolvedValue(undefined);
    const res = {
      status: vi.fn().mockReturnThis(), json: vi.fn(), setHeader: vi.fn(), flushHeaders: vi.fn(),
      write: vi.fn(), end: vi.fn(), writableEnded: false, headersSent: true,
    };
    await executeSupport(req as never, res as never);
    expect(mocks.supportFlow.stream).toHaveBeenCalledWith({
      prompt: "question", history: [{ role: "model", content: "prior" }],
    });
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('"status":"searching"'));
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('"result":{"risposta":"answer"}'));
    expect(res.write).toHaveBeenCalledWith("data: [DONE]\n\n");
    expect(res.end).toHaveBeenCalledOnce();
  });

  it("updates only sanitized metadata returned for a user message", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    const fascicoloRef = {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          collection: vi.fn(() => ({
            orderBy: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
            get: vi.fn().mockResolvedValue({
              docs: [{ data: () => ({ role: "user", content: " Cliente: Ada " }) }],
            }),
          })),
        })),
      })),
      get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ metadati: { old: "value" } }) }),
      update,
    };
    mocks.db.collection.mockReturnValue({ doc: vi.fn(() => fascicoloRef) });
    mocks.metadataFlow.mockResolvedValue({
      dati_nuovi_o_aggiornati: [
        { chiave: " N°me! ", valore: " Ada Lovelace " },
        { chiave: "", valore: "ignored" },
        { chiave: "Invalid", valore: "" },
      ],
    });
    await executeUpdateMetadataFromChat({
      data: { data: () => ({ role: "user", content: "input" }) },
      params: { fascicoloId: "f1", threadId: "t1", messageId: "m1" },
    } as never);
    expect(mocks.metadataFlow).toHaveBeenCalledWith({
      chatContext: "UTENTE: Cliente: Ada", metadatiAttuali: { old: "value" },
    });
    expect(update).toHaveBeenCalledWith({ "metadati.Nme": "Ada Lovelace" });
  });

  it("skips model-generated metadata events and returns 500 if embedding secrets are unavailable", async () => {
    mocks.db.collection.mockClear();
    await executeUpdateMetadataFromChat({
      data: { data: () => ({ role: "model", content: "assistant" }) },
      params: { fascicoloId: "f1", threadId: "t1", messageId: "m1" },
    } as never);
    expect(mocks.db.collection).not.toHaveBeenCalled();

    vi.stubEnv("OPENAI_API_KEY", "");
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    mocks.db.collection.mockReturnValue({ doc: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: true }) })) });
    await executeGenerateEmbedding({ body: { text: "some text" } } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal Server Error" });
  });

});
