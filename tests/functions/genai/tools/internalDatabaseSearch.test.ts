import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: { collection: vi.fn() }, embed: vi.fn(), increment: vi.fn().mockResolvedValue(undefined),
  mapToObject: vi.fn((doc: { id: string }) => ({ id: doc.id, summary: "mapped" })),
  makeKeys: vi.fn(() => [] as string[]),
}));
vi.mock("@functions/genai/_config", () => ({
  ai: { defineTool: (_config: unknown, handler: unknown) => handler },
  CFG: {
    limits: { vectorFetchLimit: 30, maxDbLimit: 5, maxDistinguishLimit: 3 },
    ragDistance: { sentence: 0.65, distinguish: 0.62 },
  },
}));
vi.mock("@functions/_deps", () => ({ getDb: () => mocks.db }));
vi.mock("@functions/genai/tools/_helper", () => ({
  createResearchEmbedding: mocks.embed, safeIncrementRagCounter: mocks.increment, mapToObject: mocks.mapToObject,
}));
vi.mock("@functions/_riferimenti_normativi", () => ({ makeRiferimentiNormativiKeys: mocks.makeKeys }));

import { analyzeDistinguishingFacts, internalDatabaseSearch } from "@functions/genai/tools/internalDatabaseSearch";

describe("internal GenAI search tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.embed.mockResolvedValue([1, 0]);
    mocks.increment.mockResolvedValue(undefined);
    mocks.makeKeys.mockReturnValue([]);
    mocks.mapToObject.mockImplementation((doc: { id: string }) => ({ id: doc.id, summary: "mapped" }));
  });

  it("reports a missing query without touching Firestore", async () => {
    const handler = internalDatabaseSearch as unknown as (input: unknown, options?: unknown) => Promise<unknown>;
    await expect(handler({ searchType: "semantic", query: "  " }, { context: { userId: "u1" } }))
      .resolves.toEqual([{ message: "È necessario specificare una query o il numero della sentenza." }]);
    expect(mocks.db.collection).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated semantic and distinguishing searches", async () => {
    const search = internalDatabaseSearch as unknown as (input: unknown, options?: unknown) => Promise<unknown>;
    const distinguish = analyzeDistinguishingFacts as unknown as (input: unknown, options?: unknown) => Promise<unknown>;
    await expect(search({ searchType: "semantic", query: "contratto" }, { context: {} }))
      .resolves.toEqual([{ error: "Autenticazione mancante." }]);
    await expect(distinguish({ query: "fatti di un caso concreto" }, { context: {} }))
      .resolves.toEqual([{ error: "Autenticazione mancante." }]);
    expect(mocks.embed).not.toHaveBeenCalled();
  });

  it("queries all exact identifiers, deduplicates records and filters disallowed sources", async () => {
    const firstDoc = {
      id: "case-1",
      data: () => ({ numero_sentenza: "12/2024", organo_giudicante: "Cassazione", ecli: "ECLI:one", sourceUrl: "https://court.test" }),
    };
    const secondDoc = { id: "case-2", data: () => ({ numero_sentenza: "12/2024", sourceUrl: "javascript:alert(1)" }) };
    const snapshots = [
      { docs: [firstDoc, secondDoc] }, { docs: [firstDoc] }, { docs: [] },
    ];
    const query = {
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValueOnce(snapshots[0]).mockResolvedValueOnce(snapshots[1]).mockResolvedValueOnce(snapshots[2]),
    };
    mocks.db.collection.mockReturnValue(query);
    const handler = internalDatabaseSearch as unknown as (input: unknown, options?: unknown) => Promise<unknown>;
    const result = await handler({ searchType: "exact", query: "n. 12 / 2024" }, {
      context: { userId: "u1", dbLimit: 1, uiFilters: [] },
    });
    expect(query.where).toHaveBeenCalledWith("numero_sentenza", "==", "12/2024");
    expect(result).toEqual([expect.objectContaining({
      id: "case-1", caseNumber: "12/2024", court: "Cassazione", sourceUrl: "https://court.test",
      _score: 1, sourceType: "case_law",
    })]);
    expect(mocks.increment).toHaveBeenCalledWith("sentences", ["case-1"]);
  });

  it("returns empty legal-reference matches without running a database query", async () => {
    const handler = internalDatabaseSearch as unknown as (input: unknown, options?: unknown) => Promise<unknown>;
    await expect(handler({ searchType: "legal_reference", query: "non riconoscibile" }, { context: {} }))
      .resolves.toEqual([{ message: 'Non è stato possibile estrarre un riferimento normativo valido da "non riconoscibile".' }]);
    expect(mocks.makeKeys).toHaveBeenCalledWith("non riconoscibile");
    expect(mocks.db.collection).not.toHaveBeenCalled();
  });

  it("returns ranked semantic results inside the configured distance bound", async () => {
    const docs = [
      { id: "near", distance: 0.2, data: () => ({ numero_sentenza: "1/24", summary: "near", sourceUrl: "https://court.test" }) },
      { id: "too-far", distance: 0.9, data: () => ({ numero_sentenza: "2/24", summary: "far" }) },
    ];
    const nearest = { get: vi.fn().mockResolvedValue({ empty: false, docs }) };
    const query = { where: vi.fn().mockReturnThis(), findNearest: vi.fn(() => nearest) };
    mocks.db.collection.mockReturnValue(query);
    const handler = internalDatabaseSearch as unknown as (input: unknown, options?: unknown) => Promise<unknown>;
    await expect(handler({ searchType: "semantic", query: "principio giuridico" }, {
      context: { userId: "u1", dbLimit: 2, uiFilters: [{ field: "sezione", operator: "==", value: "civile" }] },
    })).resolves.toEqual([expect.objectContaining({
      id: "near", _distance: 0.2, _score: 0.8, _type: "giurisprudenza_semantica",
    })]);
    expect(query.where).toHaveBeenCalledWith("sezione", "==", "civile");
    expect(query.findNearest).toHaveBeenCalledWith(expect.objectContaining({ queryVector: [1, 0], distanceThreshold: 0.65 }));
    expect(mocks.increment).toHaveBeenCalledWith("sentences", ["near"]);
  });

  it("maps legal-reference records and reports empty exact/semantic searches", async () => {
    mocks.makeKeys.mockReturnValue(["cc:art:1"]);
    const doc = { id: "law-1", data: () => ({ numero_sentenza: "3/24", sourceUrl: "javascript:alert(1)" }) };
    const query = {
      where: vi.fn().mockReturnThis(), limit: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ empty: false, docs: [doc] }),
    };
    mocks.db.collection.mockReturnValue(query);
    const handler = internalDatabaseSearch as unknown as (input: unknown, options?: unknown) => Promise<unknown>;
    await expect(handler({ searchType: "legal_reference", query: "articolo 1" }, { context: { dbLimit: 1 } }))
      .resolves.toEqual([expect.objectContaining({
        id: "law-1", summary: "", caseNumber: "3/24", sourceUrl: null, _type: "giurisprudenza_normativa",
      })]);
    expect(mocks.mapToObject).toHaveBeenCalledWith(doc, ["cc:art:1"]);

    query.get.mockResolvedValue({ docs: [] });
    await expect(handler({ searchType: "exact", query: "ECLI:missing" }, { context: {} }))
      .resolves.toEqual([{ message: 'Nessuna sentenza trovata nel database interno per "ECLI:missing".' }]);
    const vector = { get: vi.fn().mockResolvedValue({ empty: true, docs: [] }) };
    mocks.db.collection.mockReturnValue({ findNearest: vi.fn(() => vector) });
    await expect(handler({ searchType: "semantic", query: "nessun risultato" }, { context: { userId: "u1" } }))
      .resolves.toEqual([{ message: "Nessun precedente semanticamente rilevante trovato." }]);
  });

  it("returns a safe error for Firestore and embedding failures and supports empty distinguishing results", async () => {
    const handler = internalDatabaseSearch as unknown as (input: unknown, options?: unknown) => Promise<unknown>;
    mocks.embed.mockRejectedValueOnce(new Error("embedding failed"));
    await expect(handler({ searchType: "semantic", query: "failure" }, { context: { userId: "u1" } }))
      .resolves.toEqual([{ error: "Errore temporaneo durante la ricerca nel database giurisprudenziale." }]);

    const empty = { get: vi.fn().mockResolvedValue({ empty: true, docs: [] }) };
    mocks.db.collection.mockReturnValue({ where: vi.fn().mockReturnThis(), findNearest: vi.fn(() => empty) });
    const distinguish = analyzeDistinguishingFacts as unknown as (input: unknown, options?: unknown) => Promise<unknown>;
    await expect(distinguish({ query: "descrizione dettagliata dei fatti" }, { context: { userId: "u1" } }))
      .resolves.toEqual([{ message: "Nessun precedente fattualmente simile trovato." }]);
  });
});
