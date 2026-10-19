import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ db: { collection: vi.fn() }, embed: vi.fn() }));
vi.mock("@functions/genai/_config", () => ({
  ai: { defineTool: (_config: unknown, handler: unknown) => handler },
  CFG: { limits: { vectorFetchLimit: 30, maxManualLimit: 2 }, ragDistance: { manual: 0.6 } },
}));
vi.mock("@functions/_deps", () => ({ getDb: () => mocks.db }));
vi.mock("@functions/genai/tools/_helper", () => ({ createEmbedding: mocks.embed }));

import { userManualSearch } from "@functions/genai/tools/support";

describe("userManualSearch tool", () => {
  beforeEach(() => vi.clearAllMocks());

  it("short-circuits whitespace-only queries without requesting embeddings", async () => {
    const handler = userManualSearch as unknown as (input: { query: string }) => Promise<unknown>;
    await expect(handler({ query: " \n " })).resolves.toEqual([{ message: "Query manuale vuota." }]);
    expect(mocks.embed).not.toHaveBeenCalled();
    expect(mocks.db.collection).not.toHaveBeenCalled();
  });

  it("returns nearest manual results in ascending distance and caps the result count", async () => {
    const docs = [
      { id: "far", distance: 0.55, data: () => ({ text: "far", links: "invalid" }) },
      { id: "near", distance: 0.1, data: () => ({ text: "near", links: ["/guide"], images: "image" }) },
      { id: "outside", distance: 0.7, data: () => ({ text: "outside" }) },
    ];
    const query = { get: vi.fn().mockResolvedValue({ empty: false, docs }) };
    const collection = { findNearest: vi.fn(() => query) };
    mocks.db.collection.mockReturnValue(collection);
    mocks.embed.mockResolvedValue([1, 0]);
    const handler = userManualSearch as unknown as (input: { query: string }) => Promise<unknown>;
    const result = await handler({ query: "  guida   Jurio " });
    expect(mocks.embed).toHaveBeenCalledWith("guida Jurio");
    expect(collection.findNearest).toHaveBeenCalledWith(expect.objectContaining({ limit: 30, distanceThreshold: 0.6 }));
    expect(result).toEqual([
      expect.objectContaining({ id: "near", text: "near", links: ["/guide"] }),
      expect.objectContaining({ id: "far", text: "far", links: [] }),
    ]);
    const scores = (result as Array<{ _score: number }>).map(({ _score }) => _score);
    expect(scores[0]).toBeCloseTo(0.9);
    expect(scores[1]).toBeCloseTo(0.45);
  });

  it("handles empty vector snapshots and embedding or database errors", async () => {
    mocks.embed.mockResolvedValue([1]);
    mocks.db.collection.mockReturnValue({ findNearest: () => ({ get: vi.fn().mockResolvedValue({ empty: true, docs: [] }) }) });
    const handler = userManualSearch as unknown as (input: { query: string }) => Promise<unknown>;
    await expect(handler({ query: "pricing guide" })).resolves.toEqual([
      { message: "Nessuna informazione pertinente trovata nel manuale." },
    ]);
    mocks.embed.mockRejectedValueOnce(new Error("offline"));
    await expect(handler({ query: "pricing guide" })).resolves.toEqual([
      { error: "Errore durante la ricerca nel manuale di Jurio." },
    ]);
  });
});
