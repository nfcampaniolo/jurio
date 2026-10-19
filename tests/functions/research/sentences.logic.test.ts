import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const cors = vi.fn();
  const auth = vi.fn();
  const embeddingCreate = vi.fn();
  const nearest = vi.fn();
  const select = vi.fn();
  const get = vi.fn();
  const db = { collection: vi.fn() };
  const validate = vi.fn();
  const rag = vi.fn();
  const fallback = vi.fn();
  return { cors, auth, embeddingCreate, nearest, select, get, db, validate, rag, fallback };
});

vi.mock("@functions/_deps", () => ({ getDb: () => mocks.db }));
vi.mock("@functions/_utils", () => ({
  corsHandlerDomain: mocks.cors,
  validateUserPlanAndLimits: mocks.validate,
}));
vi.mock("@functions/research/_helper", () => ({
  getOpenAIClient: () => ({ embeddings: { create: mocks.embeddingCreate } }),
  authenticateRequest: mocks.auth,
  applyFirestoreFilters: (query: unknown) => query,
  safeTruncateText: (text: unknown) => typeof text === "string" ? text.slice(0, 10000) : null,
  parseLimitParam: (limit: unknown) => Math.min(Math.max(Number(limit) || 50, 1), 100),
}));
vi.mock("@functions/research/_utils", () => ({
  getKeywordStems: () => [{ original: "diritto", stem: "diritt" }],
  calculateMatchScore: () => ({ textMatchScore: 1, authorityBonus: 0, recencyBonus: 0 }),
  applyHighlightWithRegex: (text: string) => `<mark>${text}</mark>`,
  generateHighlightRegex: vi.fn(() => /diritto/gi),
}));
vi.mock("@functions/genai/_utils", () => ({ incrementRagCounter: mocks.rag }));
vi.mock("@functions/genai/supportAgent/flow", () => ({ legalGeminiFallbackFlow: mocks.fallback }));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { vector: vi.fn((value: number[]) => ({ vector: value })) },
}));

describe("sentence vector search endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cors.mockImplementation(async (_req: unknown, _res: unknown, callback: () => Promise<unknown>) => callback());
    mocks.auth.mockResolvedValue({ uid: "user-1", isOAuthRequest: true });
    mocks.validate.mockResolvedValue(undefined);
    mocks.embeddingCreate.mockResolvedValue({ data: [{ embedding: [0.1, 0.2] }] });
    mocks.nearest.mockReturnValue({ get: mocks.get });
    mocks.select.mockReturnValue({ findNearest: mocks.nearest });
    mocks.db.collection.mockReturnValue({ select: mocks.select });
    mocks.get.mockResolvedValue({
      docs: [{
        id: "sentence-1",
        data: () => ({ massima: "Principio di diritto applicabile", distance: 0.4, tipo_documento: "sentenza" }),
      }],
    });
    mocks.rag.mockResolvedValue(undefined);
    mocks.fallback.mockResolvedValue(null);
  });

  const response = () => ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
  });

  it("returns a ranked sentence search result for an OAuth caller", async () => {
    // Arrange
    const { executeVectorSearchJurio } = await import("@functions/research/sentences.logic");
    const res = response();

    // Act
    await executeVectorSearchJurio({ method: "POST", body: { query: "diritto civile", limit: 5 } } as never, res as never);

    // Assert
    expect(mocks.validate).toHaveBeenCalledWith("user-1", "research");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      ids: ["sentence-1"],
      status: "SUCCESS",
      topMatches: [expect.objectContaining({ id: "sentence-1", _source: "direct" })],
    }));
    expect(mocks.rag).toHaveBeenCalledWith("sentences", ["sentence-1"]);
    expect(mocks.fallback).not.toHaveBeenCalled();
  });

  it("rejects an invalid query before authentication", async () => {
    // Arrange
    const { executeVectorSearchJurio } = await import("@functions/research/sentences.logic");
    const res = response();

    // Act
    await executeVectorSearchJurio({ method: "POST", body: { query: " " } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.embeddingCreate).not.toHaveBeenCalled();
  });

  it("maps plan authorization failures to forbidden responses", async () => {
    // Arrange
    mocks.validate.mockRejectedValue(new Error("FORBIDDEN"));
    const { executeVectorSearchJurio } = await import("@functions/research/sentences.logic");
    const res = response();

    // Act
    await executeVectorSearchJurio({ method: "POST", body: { query: "diritto civile" } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: "Forbidden", message: "Piano non abilitato." });
  });

  it("uses the non-OAuth fallback when vector matches are too weak", async () => {
    // Arrange
    mocks.auth.mockResolvedValue({ uid: "user-2", isOAuthRequest: false });
    mocks.get.mockResolvedValue({ docs: [] });
    mocks.fallback.mockResolvedValue({ sintesi: "Sintesi", queryAlternativa: "questione giuridica" });
    const { executeVectorSearchJurio } = await import("@functions/research/sentences.logic");
    const res = response();

    // Act
    await executeVectorSearchJurio({ method: "POST", body: { query: "diritto civile" } } as never, res as never);

    // Assert
    expect(mocks.fallback).toHaveBeenCalledWith({ query: "diritto civile" });
    expect(mocks.embeddingCreate).toHaveBeenCalledTimes(2);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: "GEMINI_FALLBACK" }));
  });
});
