import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: { collection: vi.fn() },
  validate: vi.fn(),
  embed: vi.fn(),
  increment: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@functions/genai/_config", () => ({
  ai: { defineTool: (_config: unknown, handler: unknown) => handler },
  CFG: {
    domains: { institutional: ["official.test"], practices: ["practice.test"], editorial: ["legal.test"] },
    maxChars: { web: 10 },
    limits: { maxDbLimit: 5 },
    ragDistance: { doctrine: 0.68 },
  },
}));
vi.mock("@functions/_deps", () => ({ getDb: () => mocks.db }));
vi.mock("@functions/_utils", () => ({ validateUserPlanAndLimits: mocks.validate }));
vi.mock("@functions/genai/tools/_helper", () => ({
  safeIncrementRagCounter: mocks.increment, createResearchEmbedding: mocks.embed,
}));

import { doctrineSearch, webSearch } from "@functions/genai/tools/webSearch";

describe("GenAI web and doctrine search tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("TAVILY_API_KEY", "");
    mocks.embed.mockResolvedValue([1, 0]);
    mocks.increment.mockResolvedValue(undefined);
  });
  afterEach(() => vi.unstubAllEnvs());

  it("returns a configuration error before making an HTTP request without an API key", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const handler = webSearch as unknown as (input: unknown, options?: unknown) => Promise<unknown>;
    await expect(handler({ query: "normativa", focus: "all" }, {}))
      .resolves.toEqual([{ error: "TAVILY_API_KEY non configurata." }]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("requires authentication for internal doctrine retrieval", async () => {
    const handler = doctrineSearch as unknown as (input: unknown, options?: unknown) => Promise<unknown>;
    await expect(handler({ query: "dottrina" }, { context: {} }))
      .resolves.toEqual([{ error: "Autenticazione mancante." }]);
    expect(mocks.db.collection).not.toHaveBeenCalled();
  });

  it("posts normalized searches to configured domains and filters unsafe result URLs", async () => {
    vi.stubEnv("TAVILY_API_KEY", "test-key");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({ results: [
        { title: "Safe", url: "https://example.org/path", content: "0123456789abcdefgh" },
        { title: "Unsafe", url: "http://example.org", content: "ignored" },
      ] }),
    } as Response);
    const handler = webSearch as unknown as (input: unknown, options?: unknown) => Promise<unknown>;
    const result = await handler({ query: "  art. 1 \n codice ", focus: "institutional" }, {
      context: { userId: "u1", webLimit: 2 },
    });
    expect(mocks.validate).toHaveBeenCalledWith("u1", "web");
    expect(JSON.parse(String(fetchSpy.mock.calls[0][1]?.body))).toMatchObject({
      api_key: "test-key", query: "art. 1 codice", include_domains: ["official.test"], max_results: 2,
    });
    expect(result).toEqual([{
      title: "Safe", link: "https://example.org/path", url: "https://example.org/path", content: "0123456789",
      source: "example.org", _type: "web_search", sourceType: "web",
    }]);
  });

  it("maps non-success HTTP responses and thrown fetch failures to safe results", async () => {
    vi.stubEnv("TAVILY_API_KEY", "test-key");
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({ ok: false, status: 503 } as Response);
    const handler = webSearch as unknown as (input: unknown, options?: unknown) => Promise<unknown>;
    await expect(handler({ query: "norme", focus: "all" }, {}))
      .resolves.toEqual([{ error: "Il servizio di ricerca web ha restituito un errore." }]);
    fetchSpy.mockRejectedValueOnce(new Error("network error"));
    await expect(handler({ query: "norme", focus: "all" }, {}))
      .resolves.toEqual([{ error: "Servizio di ricerca web non raggiungibile." }]);
  });

  it("applies doctrine filters and returns normalized source records", async () => {
    const docs = [{
      id: "doctrine-1",
      distance: 0.2,
      data: () => ({
        tematica: "Responsabilità", materia: "civile", tipo_documento: "Nota",
        tipo_orientamento: "consolidato", data_documento: "2024-01-01",
        norme_citate: ["art. 1"], summary: "sintesi", orientamento: "orientamento",
        sourceUrl: "https://example.org/doctrine",
      }),
    }];
    const query = { get: vi.fn().mockResolvedValue({ empty: false, docs }) };
    const collection = { where: vi.fn().mockReturnThis(), findNearest: vi.fn(() => query) };
    mocks.db.collection.mockReturnValue(collection);
    const handler = doctrineSearch as unknown as (input: unknown, options?: unknown) => Promise<unknown>;
    const result = await handler({ query: " responsabilità ", subject: " CIVILE ", guidanceType: "consolidato", limit: 2 }, {
      context: { userId: "u1" },
    });
    expect(mocks.embed).toHaveBeenCalledWith("u1", "responsabilità");
    expect(collection.where).toHaveBeenNthCalledWith(1, "materia", "==", "civile");
    expect(collection.where).toHaveBeenNthCalledWith(2, "tipo_orientamento", "==", "consolidato");
    expect(result).toEqual([expect.objectContaining({
      id: "doctrine-1", title: "Responsabilità", source: "example.org",
      content: "sintesi\n\norientamento", sourceType: "doctrine",
    })]);
    expect(mocks.increment).toHaveBeenCalledWith("doctrine", ["doctrine-1"]);
  });
});
