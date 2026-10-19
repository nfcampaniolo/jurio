import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  secure: vi.fn(),
  validate: vi.fn(),
  get: vi.fn(),
  collection: vi.fn(),
  create: vi.fn(),
  db: { collection: vi.fn() },
  OpenAI: vi.fn(),
}));

vi.mock("@functions/_deps", () => ({ getDb: () => mocks.db }));
vi.mock("@functions/_utils", () => ({
  withSecureApiEndpoint: mocks.secure,
  validateUserPlanAndLimits: mocks.validate,
}));
vi.mock("../../../functions/node_modules/openai/index.mjs", () => ({ default: mocks.OpenAI }));

describe("admin reasoning endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.OpenAI.mockImplementation(function () {
      return { chat: { completions: { create: mocks.create } } };
    });
    process.env.DEEPSEEK_API_KEY = "deepseek-test";
    delete process.env.OPENAI_API_KEY;
    mocks.secure.mockImplementation(async (_req: unknown, _res: unknown, callback: (uid: string) => Promise<void>) => callback("admin-uid"));
    mocks.validate.mockResolvedValue(undefined);
    mocks.get.mockResolvedValue({ exists: true, data: () => ({ planId: "admin" }) });
    mocks.db.collection.mockReturnValue({ doc: vi.fn(() => ({ get: mocks.get })) });
    mocks.create.mockResolvedValue({ choices: [{ message: { content: '{"summary":"ok"}' } }] });
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });

  it("rejects an empty question before doing user or model work", async () => {
    // Arrange
    const req = { body: { question: "   " } } as never;
    const res = response();
    const { executeReasoningAdmin } = await import("@functions/admin/reason.logic");

    // Act
    await executeReasoningAdmin(req, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.db.collection).not.toHaveBeenCalled();
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("uses DeepSeek and returns the parsed reasoning payload", async () => {
    // Arrange
    const req = { body: { question: "  Analizza la decisione  " } } as never;
    const res = response();
    const { executeReasoningAdmin } = await import("@functions/admin/reason.logic");

    // Act
    await executeReasoningAdmin(req, res as never);

    // Assert
    expect(mocks.validate).toHaveBeenCalledWith("admin-uid", "admin", expect.any(Object));
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ model: "deepseek-chat" }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: { summary: "ok" }, status: "SENT_BY_BOT", model: "deepseek-chat", provider: "deepseek",
    });
  });

  it("falls back to OpenAI when DeepSeek fails", async () => {
    // Arrange
    process.env.OPENAI_API_KEY = "openai-test";
    mocks.create
      .mockRejectedValueOnce(new Error("DeepSeek unavailable"))
      .mockResolvedValueOnce({ choices: [{ message: { content: "```json\n{\"fallback\":true}\n```" } }] });
    const req = { body: { question: "domanda legale" } } as never;
    const res = response();
    const { executeReasoningAdmin } = await import("@functions/admin/reason.logic");

    // Act
    await executeReasoningAdmin(req, res as never);

    // Assert
    expect(mocks.create).toHaveBeenCalledTimes(2);
    expect(res.json).toHaveBeenCalledWith({
      message: { fallback: true }, status: "SENT_BY_BOT", model: "gpt-4o-mini", provider: "openai_fallback",
    });
  });

  it("returns an internal error when no fallback key is configured", async () => {
    // Arrange
    delete process.env.DEEPSEEK_API_KEY;
    const req = { body: { question: "domanda" } } as never;
    const res = response();
    const { executeReasoningAdmin } = await import("@functions/admin/reason.logic");

    // Act
    await executeReasoningAdmin(req, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  it("rejects non-admin users", async () => {
    // Arrange
    mocks.get.mockResolvedValue({ exists: true, data: () => ({ planId: "prova" }) });
    const req = { body: { question: "domanda" } } as never;
    const res = response();
    const { executeReasoningAdmin } = await import("@functions/admin/reason.logic");

    // Act
    await executeReasoningAdmin(req, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.validate).not.toHaveBeenCalled();
  });
});
