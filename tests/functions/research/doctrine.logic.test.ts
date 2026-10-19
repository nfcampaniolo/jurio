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
  return { cors, auth, embeddingCreate, nearest, select, get, db, validate };
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
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: { vector: vi.fn((value: number[]) => ({ vector: value })) },
}));

describe("doctrine vector search endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cors.mockImplementation(async (_req: unknown, _res: unknown, callback: () => Promise<unknown>) => callback());
    mocks.auth.mockResolvedValue({ uid: "user-1" });
    mocks.validate.mockResolvedValue(undefined);
    mocks.embeddingCreate.mockResolvedValue({ data: [{ embedding: [0.1, 0.2] }] });
    mocks.nearest.mockReturnValue({ get: mocks.get });
    mocks.select.mockReturnValue({ findNearest: mocks.nearest });
    mocks.db.collection.mockReturnValue({ select: mocks.select });
    mocks.get.mockResolvedValue({
      docs: [{
        id: "doctrine-1",
        data: () => ({ sintesi: "Sintesi giuridica", distance: 0.2, materia: "civile" }),
      }],
    });
  });

  const response = () => ({
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
    send: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
  });

  it("returns preflight and rejects unsupported methods", async () => {
    // Arrange
    const { executeVectorSearchDoctrine } = await import("@functions/research/doctrine.logic");
    const optionsRes = response();
    const postOnlyRes = response();

    // Act
    await executeVectorSearchDoctrine({ method: "OPTIONS" } as never, optionsRes as never);
    await executeVectorSearchDoctrine({ method: "GET" } as never, postOnlyRes as never);

    // Assert
    expect(optionsRes.status).toHaveBeenCalledWith(204);
    expect(postOnlyRes.status).toHaveBeenCalledWith(405);
    expect(mocks.embeddingCreate).not.toHaveBeenCalled();
  });

  it("validates query text without invoking authentication or embeddings", async () => {
    // Arrange
    const { executeVectorSearchDoctrine } = await import("@functions/research/doctrine.logic");
    const res = response();

    // Act
    await executeVectorSearchDoctrine({ method: "POST", body: { query: " " } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.auth).not.toHaveBeenCalled();
    expect(mocks.embeddingCreate).not.toHaveBeenCalled();
  });

  it("embeds an authenticated query and maps Firestore documents to search results", async () => {
    // Arrange
    const { executeVectorSearchDoctrine } = await import("@functions/research/doctrine.logic");
    const req = { method: "POST", body: { query: "  responsabilità civile ", limit: 3 } };
    const res = response();

    // Act
    await executeVectorSearchDoctrine(req as never, res as never);

    // Assert
    expect(mocks.validate).toHaveBeenCalledWith("user-1", "research");
    expect(mocks.embeddingCreate).toHaveBeenCalledWith(expect.objectContaining({
      input: "Contesto giuridico italiano dottrinale: responsabilità civile",
    }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      results: [expect.objectContaining({ id: "doctrine-1", tipo_documento: "dottrina", sintesi: "Sintesi giuridica" })],
    });
  });

  it("maps known authentication failures to client errors", async () => {
    // Arrange
    mocks.auth.mockRejectedValue(new Error("UNAUTHORIZED"));
    const { executeVectorSearchDoctrine } = await import("@functions/research/doctrine.logic");
    const res = response();

    // Act
    await executeVectorSearchDoctrine({ method: "POST", body: { query: "diritto civile" } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: "Unauthorized" });
  });
});
