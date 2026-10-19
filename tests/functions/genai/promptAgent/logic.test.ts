import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const user = { exists: true };
  const doc = {
    get: vi.fn().mockResolvedValue(user),
    collection: vi.fn(() => ({ add: vi.fn().mockResolvedValue({ id: "prompt-1" }) })),
  };
  const db = { collection: vi.fn(() => ({ doc: vi.fn(() => doc) })) };
  return {
    db, doc, validate: vi.fn().mockResolvedValue(undefined),
    secure: vi.fn((_req: unknown, _res: unknown, handler: (uid: string) => unknown) => handler("u1")),
    promptFlow: { stream: vi.fn() }, enhanceFlow: vi.fn(),
  };
});
vi.mock("@functions/_deps", () => ({ getDb: () => mocks.db }));
vi.mock("@functions/_utils", () => ({
  validateUserPlanAndLimits: mocks.validate, withSecureApiEndpoint: mocks.secure,
}));
vi.mock("@functions/genai/promptAgent/flow", () => ({ promptBuilderFlow: mocks.promptFlow, enhancePromptFlow: mocks.enhanceFlow }));

import { executeEnhancePromptAgent, executePromptAgent } from "@functions/genai/promptAgent/logic";

describe("prompt-agent endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.doc.get.mockResolvedValue({ exists: true });
    mocks.doc.collection.mockReturnValue({ add: vi.fn().mockResolvedValue({ id: "prompt-1" }) });
    mocks.validate.mockResolvedValue(undefined);
  });

  it("rejects missing prompt-builder fields after loading the user plan", async () => {
    const req = { body: {}, on: vi.fn() };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await executePromptAgent(req as never, res as never);
    expect(mocks.validate).toHaveBeenCalledWith("u1", "prompting", expect.any(Object));
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Bad Request: Dati mancanti (title, objective o fields)." });
  });

  it("rejects empty prompt enhancement requests", async () => {
    const req = { body: {} };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await executeEnhancePromptAgent(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Bad Request: Prompt mancante o invalido." });
  });

  it("streams sanitized prompt output, persists it, and terminates the SSE response", async () => {
    mocks.promptFlow.stream.mockReturnValue({
      stream: (async function* () { yield "draft chunk"; })(),
      output: Promise.resolve({ result: " generated prompt " }),
    });
    const req = {
      body: {
        title: " Title ", objective: " Objective ", notes: " Notes ",
        fields: [{ name: "a<>b", type: " string ", description: " description ", isRequired: true }],
      },
      on: vi.fn(),
    };
    const res = {
      status: vi.fn().mockReturnThis(), json: vi.fn(), setHeader: vi.fn(), flushHeaders: vi.fn(),
      write: vi.fn(), end: vi.fn(), writableEnded: false, headersSent: true,
    };
    await executePromptAgent(req as never, res as never);
    expect(mocks.promptFlow.stream).toHaveBeenCalledWith({
      objective: "Objective", notes: "Notes",
      fields: [{ name: "ab", type: "string", description: "description", isRequired: true }],
      userId: "u1",
    });
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('"message":"draft chunk"'));
    expect(res.write).toHaveBeenCalledWith(expect.stringContaining('"promptId":"prompt-1"'));
    expect(res.write).toHaveBeenCalledWith("data: [DONE]\n\n");
    expect(res.end).toHaveBeenCalledOnce();
  });

  it("returns a 400 for unsupported enhancement types and passes sanitized history on success", async () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await executeEnhancePromptAgent({ body: { prompt: "Q", type: "bad" } } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);

    mocks.enhanceFlow.mockResolvedValueOnce({ enhancedPrompt: "better" });
    const history = Array.from({ length: 11 }, (_, index) => ({
      role: index === 10 ? "assistant" : "custom", content: ` message-${index} `,
    }));
    await executeEnhancePromptAgent({
      body: { prompt: " Q ", type: " chat ", history },
    } as never, res as never);
    expect(mocks.enhanceFlow).toHaveBeenCalledWith({
      prompt: "Q", type: "chat",
      history: history.slice(-10).map((message) => ({ role: message.role === "assistant" ? "model" : "user", content: message.content })),
    });
    expect(res.status).toHaveBeenLastCalledWith(200);
    expect(res.json).toHaveBeenLastCalledWith({ enhancedPrompt: "better" });
  });
});
