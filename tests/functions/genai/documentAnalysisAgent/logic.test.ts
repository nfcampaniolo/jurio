import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: { collection: vi.fn(), batch: vi.fn(), runTransaction: vi.fn() },
  batch: { set: vi.fn(), delete: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) },
  transaction: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  createDoctrineEmbeddings: vi.fn(),
  secure: vi.fn((_req: unknown, _res: unknown, handler: (uid: string) => unknown) => handler("u1")),
  validate: vi.fn(),
  reasoning: vi.fn(),
  doctrine: vi.fn(),
}));
vi.mock("@functions/_deps", () => ({ getDb: () => mocks.db }));
vi.mock("@functions/_utils", () => ({ validateUserPlanAndLimits: mocks.validate, withSecureApiEndpoint: mocks.secure }));
vi.mock("@functions/genai/documentAnalysisAgent/flow", () => ({ reasoningFlow: mocks.reasoning, doctrineFlow: mocks.doctrine }));
vi.mock("@functions/genai/documentAnalysisAgent/_embedding", () => ({
  createDoctrineEmbeddings: mocks.createDoctrineEmbeddings,
}));

import { executeAdminDoctrineUpload, executeReasoning } from "@functions/genai/documentAnalysisAgent/logic";

describe("document-analysis endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validate.mockResolvedValue(undefined);
    mocks.reasoning.mockResolvedValue({ sintesi: "answer" });
    mocks.doctrine.mockResolvedValue({ tematiche: [{ tematica: "tema" }] });
    mocks.batch.commit.mockResolvedValue(undefined);
    mocks.createDoctrineEmbeddings.mockResolvedValue([[0.1, 0.2]]);
    let lockData: Record<string, unknown> | undefined;
    mocks.transaction.get.mockImplementation(async () => ({
      exists: !!lockData,
      data: () => lockData,
    }));
    mocks.transaction.set.mockImplementation((_ref: unknown, data: Record<string, unknown>) => {
      lockData = data;
    });
    mocks.transaction.delete.mockImplementation(() => {
      lockData = undefined;
    });
    mocks.db.runTransaction.mockImplementation(
      (callback: (transaction: typeof mocks.transaction) => Promise<unknown>) =>
        callback(mocks.transaction)
    );
  });

  it("rejects an empty question before querying Firestore", async () => {
    const req = { body: {} };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await executeReasoning(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Bad Request: Invalid or missing 'question'" });
    expect(mocks.db.collection).not.toHaveBeenCalled();
  });

  it("rejects oversized questions before accessing services", async () => {
    const req = { body: { question: "x".repeat(1_000_001) } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await executeReasoning(req as never, res as never);
    expect(res.status).toHaveBeenCalledWith(413);
    expect(mocks.db.collection).not.toHaveBeenCalled();
  });

  it("checks the user quota and returns structured reasoning output", async () => {
    const userSnap = { exists: true };
    mocks.db.collection.mockImplementation((name: string) => name === "register"
      ? { doc: () => ({ get: vi.fn().mockResolvedValue(userSnap) }) }
      : { where: vi.fn().mockReturnThis(), count: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ data: () => ({ count: 3 }) }) })) });
    const req = { body: { question: "  explain this ", promptId: "default" } };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await executeReasoning(req as never, res as never);
    expect(mocks.validate).toHaveBeenCalledWith("u1", "reasoning", userSnap);
    expect(mocks.reasoning).toHaveBeenCalledWith({ question: "explain this", customPrompt: undefined });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: { sintesi: "answer" }, status: "SENT_BY_BOT", model: "gemini-3.5-flash", provider: "google",
    });
  });

  it("blocks analysis at the 100-document limit", async () => {
    mocks.db.collection.mockImplementation((name: string) => name === "register"
      ? { doc: () => ({ get: vi.fn().mockResolvedValue({ exists: true }) }) }
      : { where: vi.fn().mockReturnThis(), count: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ data: () => ({ count: 100 }) }) })) });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await executeReasoning({ body: { question: "Question" } } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: "document_limit_reached" }));
    expect(mocks.reasoning).not.toHaveBeenCalled();
  });

  it("denies doctrine uploads for non-admin users", async () => {
    mocks.db.collection.mockReturnValue({
      doc: () => ({ get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ planId: "prova" }) }) }),
    });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await executeAdminDoctrineUpload({ body: {}, ip: "127.0.0.1" } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.validate).not.toHaveBeenCalledWith("u1", "admin", expect.anything());
    expect(mocks.doctrine).not.toHaveBeenCalled();
  });

  it("saves extracted doctrine topics in a batch and returns counts", async () => {
    const savedRef = { id: "theme-1" };
    const doctrineCollection = {
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ empty: true, docs: [] }),
      doc: vi.fn(() => savedRef),
    };
    const userSnap = { exists: true, data: () => ({ planId: "admin" }) };
    mocks.db.collection.mockImplementation((name: string) => name === "register"
      ? { doc: () => ({ get: vi.fn().mockResolvedValue(userSnap) }) }
      : doctrineCollection);
    mocks.db.batch.mockReturnValue(mocks.batch);
    mocks.doctrine.mockResolvedValue({ tematiche: [{ tematica: "Tema 1", summary: "Sintesi" }] });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await executeAdminDoctrineUpload({
      body: { extractedText: " document ", sourceUrl: " https://example.org " }, ip: "127.0.0.1",
    } as never, res as never);
    expect(mocks.validate).toHaveBeenCalledWith("u1", "admin", userSnap);
    expect(mocks.doctrine).toHaveBeenCalledWith({ extractedText: "document", sourceUrl: "https://example.org" });
    expect(mocks.batch.set).toHaveBeenCalledWith(savedRef, expect.objectContaining({
      tematica: "Tema 1", sourceUrl: "https://example.org", uploaded_by: "u1",
      isEmbeddingFinished: true, isEmbeddingFailed: false, contentHash: expect.any(String),
      embedding: expect.anything(),
    }));
    expect(mocks.createDoctrineEmbeddings).toHaveBeenCalledWith(["Sintesi"], expect.any(String));
    expect(mocks.batch.commit).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: "Documento indicizzato con successo", tematiche_estratte: 1, tematiche_salvate: 1,
    }));
  });

  it("does not start duplicate work while the same source is being processed", async () => {
    const activeLock = {
      owner: "another-request",
      leaseExpiresAt: new Date(Date.now() + 60_000),
    };
    mocks.transaction.get.mockResolvedValue({
      exists: true,
      data: () => activeLock,
    });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await executeAdminDoctrineUpload({
      body: { extractedText: "document", sourceUrl: "https://example.org" },
      ip: "127.0.0.1",
    } as never, res as never);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      error: "DOCUMENT_PROCESSING",
    }));
    expect(mocks.doctrine).not.toHaveBeenCalled();
    expect(mocks.createDoctrineEmbeddings).not.toHaveBeenCalled();
  });

  it("skips model and embedding work for an already indexed exact input", async () => {
    const indexedDoc = {
      data: () => ({ document_base_id: "existing-document" }),
    };
    const doctrineCollection = {
      where: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ empty: false, docs: [indexedDoc] }),
      doc: vi.fn(),
    };
    const userSnap = { exists: true, data: () => ({ planId: "admin" }) };
    mocks.db.collection.mockImplementation((name: string) => name === "register"
      ? { doc: () => ({ get: vi.fn().mockResolvedValue(userSnap) }) }
      : name === "doctrine_upload_locks"
        ? { doc: () => ({ id: "lock-ref" }) }
        : doctrineCollection);
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };

    await executeAdminDoctrineUpload({
      body: { extractedText: "document", sourceUrl: "https://example.org" },
      ip: "127.0.0.1",
    } as never, res as never);

    expect(doctrineCollection.where).toHaveBeenCalledWith("contentHash", "==", expect.any(String));
    expect(mocks.doctrine).not.toHaveBeenCalled();
    expect(mocks.createDoctrineEmbeddings).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      message: "Documento già indicizzato",
      docBaseId: "existing-document",
      alreadyIndexed: true,
    }));
  });
});
