import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: { collection: vi.fn() },
  embed: vi.fn(),
  increment: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@functions/genai/_config", () => ({
  ai: { defineTool: (_config: unknown, handler: unknown) => handler },
  CFG: { limits: { maxDbLimit: 5, maxDocsPerInQuery: 30 }, ragDistance: { document: 0.6 } },
}));
vi.mock("@functions/_deps", () => ({ getDb: () => mocks.db }));
vi.mock("@functions/genai/tools/_helper", () => ({
  createResearchEmbedding: mocks.embed, safeIncrementRagCounter: mocks.increment,
}));

import { userFileSearch } from "@functions/genai/tools/userFileSearch";

describe("userFileSearch tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.embed.mockResolvedValue([1, 0]);
    mocks.increment.mockResolvedValue(undefined);
  });

  it("requires an authenticated user before embedding or database access", async () => {
    const handler = userFileSearch as unknown as (input: { query: string }, options?: unknown) => Promise<unknown>;
    await expect(handler({ query: "documento" }, { context: { docs: ["a"] } }))
      .resolves.toEqual([{ error: "Autenticazione mancante." }]);
    expect(mocks.embed).not.toHaveBeenCalled();
    expect(mocks.db.collection).not.toHaveBeenCalled();
  });

  it("returns ranked unique owner/shared chunks and increments only returned IDs", async () => {
    const docs = [
      { id: "chunk-2", distance: 0.2, data: () => ({ parentId: "file", text: "second", index: 2, user: "u1" }) },
      { id: "chunk-1", distance: 0.1, data: () => ({ parentId: "file", text: "first", index: 1, user: "u1" }) },
    ];
    const vectorQuery = { get: vi.fn().mockResolvedValue({ docs }) };
    const base = {
      where: vi.fn().mockReturnThis(),
      findNearest: vi.fn(() => vectorQuery),
    };
    mocks.db.collection.mockReturnValue(base);
    const handler = userFileSearch as unknown as (input: { query: string }, options?: unknown) => Promise<unknown>;
    const result = await handler(
      { query: "  contratto   locazione " },
      { context: { userId: "u1", docs: ["file", "", 3], dbLimit: 1 } },
    );
    expect(mocks.embed).toHaveBeenCalledWith("u1", "contratto locazione");
    expect(base.where).toHaveBeenCalledWith("user", "==", "u1");
    expect(base.where).toHaveBeenCalledWith("parentId", "in", ["file"]);
    expect(base.where).toHaveBeenCalledWith("visibleTo", "array-contains", "u1");
    expect(result).toEqual([{
      id: "chunk-1", documentId: "file", fileName: "Documento utente", paragraphText: "first",
      originalPosition: 1, _distance: 0.1, _score: 0.9, _type: "document_chunk", sourceType: "document",
    }]);
    expect(mocks.increment).toHaveBeenCalledWith("document_chunks", ["chunk-1"]);
  });

  it("returns an empty-results message and maps database failures to a safe error", async () => {
    const query = { get: vi.fn().mockResolvedValue({ docs: [] }) };
    const base = { where: vi.fn().mockReturnThis(), findNearest: vi.fn(() => query) };
    mocks.db.collection.mockReturnValue(base);
    const handler = userFileSearch as unknown as (input: { query: string }, options?: unknown) => Promise<unknown>;
    await expect(handler({ query: "contratto" }, { context: { userId: "u1" } }))
      .resolves.toEqual([{ message: "Nessun paragrafo rilevante trovato nei documenti accessibili." }]);

    mocks.db.collection.mockImplementationOnce(() => { throw new Error("database unavailable"); });
    await expect(handler({ query: "contratto" }, { context: { userId: "u1" } }))
      .resolves.toEqual([{ error: "Errore temporaneo durante la consultazione dell'archivio utente." }]);
  });
});
