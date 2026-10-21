import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: { collection: vi.fn() },
  secure: vi.fn((_req: unknown, _res: unknown, handler: (uid: string) => unknown) => handler("u1")),
  flowStream: { stream: vi.fn() },
  validate: vi.fn(),
  persist: vi.fn().mockResolvedValue(undefined),
  migrate: vi.fn().mockResolvedValue(undefined),
  processDocs: vi.fn().mockResolvedValue(undefined),
  extractMetadata: vi.fn().mockResolvedValue(0),
  setupSse: vi.fn(),
  sendSse: vi.fn(),
  sendRaw: vi.fn(),
}));
vi.mock("@functions/_deps", () => ({ getDb: () => mocks.db, sanitize: (value: unknown) => value }));
vi.mock("@functions/_utils", () => ({ validateUserPlanAndLimits: mocks.validate, withSecureApiEndpoint: mocks.secure }));
vi.mock("@functions/genai/legalAgent/flow", () => ({ legalAgentFlow: { stream: vi.fn() } }));
vi.mock("@functions/genai/supportAgent/_metadata", () => ({ extractMetadataFromThread: mocks.extractMetadata }));
vi.mock("@functions/genai/legalAgent/_utils", () => ({
  setupLegalAgentSse: mocks.setupSse, sendLegalAgentSse: mocks.sendSse, sendLegalAgentSseRaw: mocks.sendRaw,
  persistLegalAgentConversation: mocks.persist, migrateChatToFascicolo: mocks.migrate, processFascicoloDocs: mocks.processDocs,
}));

import { executeLegalAgent } from "@functions/genai/legalAgent/logic";
import { legalAgentFlow } from "@functions/genai/legalAgent/flow";

describe("legal-agent endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validate.mockResolvedValue(undefined);
    mocks.persist.mockResolvedValue(undefined);
    mocks.migrate.mockResolvedValue(undefined);
    mocks.processDocs.mockResolvedValue(undefined);
  });

  it("rejects missing prompts before database operations", async () => {
    const req = { body: {}, on: vi.fn() };
    const res = { on: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
    await executeLegalAgent(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Bad Request", details: "Parametro 'prompt' mancante." });
    expect(mocks.db.collection).not.toHaveBeenCalled();
  });

  it("validates migration inputs and delegates a complete migration", async () => {
    const req = { body: { action: "migrate", old_chat_uuid: "chat-1", new_fascicolo_uuid: "case-1", title: "Case" }, on: vi.fn() };
    const res = { on: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
    await executeLegalAgent(req as never, res as never);
    expect(mocks.migrate).toHaveBeenCalledWith({
      uid: "u1", oldChatId: "chat-1", newFascicoloId: "case-1", title: "Case",
    });
    expect(mocks.extractMetadata).toHaveBeenCalledWith("case-1", "chat-1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it("completes the migration even if metadata extraction fails", async () => {
    mocks.extractMetadata.mockRejectedValueOnce(new Error("llm down"));
    const req = { body: { action: "migrate", old_chat_uuid: "chat-1", new_fascicolo_uuid: "case-1" }, on: vi.fn() };
    const res = { on: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn() };
    vi.spyOn(console, "error").mockImplementation(() => {});
    await executeLegalAgent(req as never, res as never);
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it("loads history, streams a response and persists the completed chat", async () => {
    const historyMessages = { orderBy: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(), get: vi.fn().mockResolvedValue({ empty: true, docs: [] }) };
    const chatRef = { collection: vi.fn(() => historyMessages) };
    mocks.db.collection.mockImplementation((name: string) => name === "register"
      ? { doc: () => ({ get: vi.fn().mockResolvedValue({ exists: true }) }) }
      : { doc: () => chatRef });
    vi.mocked(legalAgentFlow.stream).mockReturnValue({
      stream: (async function* () { yield { status: "working" }; })(),
      output: Promise.resolve({ risposta: "answer", fonti: [] }),
    } as never);
    const req = {
      body: { prompt: "  question ", context: { chat_uuid: "chat-1" }, docs: [" d1 ", "", 3], filters: "not-array" },
      on: vi.fn(),
    };
    const res = { on: vi.fn(), status: vi.fn().mockReturnThis(), json: vi.fn(), writableEnded: false, end: vi.fn(), headersSent: true };
    await executeLegalAgent(req as never, res as never);
    expect(mocks.validate).toHaveBeenCalledWith("u1", "legal_agent", { exists: true });
    expect(legalAgentFlow.stream).toHaveBeenCalledWith(expect.objectContaining({
      prompt: "question", docs: [" d1 "], filters: [], history: [], isFirstMessage: true,
      userId: "u1", fascicoloId: null,
    }));
    expect(mocks.persist).toHaveBeenCalledWith(expect.objectContaining({
      uid: "u1", prompt: "question", parentId: "chat-1", isFirstMessage: true,
    }));
    expect(res.end).toHaveBeenCalledOnce();
  });
});
