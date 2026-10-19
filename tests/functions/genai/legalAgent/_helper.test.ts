import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generate: vi.fn(), file: vi.fn(), database: vi.fn(), web: vi.fn() }));
vi.mock("@functions/genai/_config", () => ({
  ai: { generate: mocks.generate },
  CFG: { limits: { historyWindow: 2 } },
}));
vi.mock("@functions/genai/tools/index", () => ({
  userFileSearch: mocks.file, internalDatabaseSearch: mocks.database, webSearch: mocks.web,
}));

import {
  appendOrchestrationRule, appendRetrievalContext, executeDeterministicRetrieval, executeRequestedTools,
  extractAndFormatSources, extractToolName,
  getExecutionProfile, prepareContextAndMessages,
} from "@functions/genai/legalAgent/_helper";

describe("legal-agent orchestration helpers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds system and retrieval context at the correct message locations", () => {
    const messages = [{ role: "user", content: [] as { text: string }[] }];
    appendOrchestrationRule(messages as never);
    appendRetrievalContext(messages as never, "retrieved", "manual");
    expect(messages[0].role).toBe("system");
    expect(messages[1].role).toBe("user");
    expect(messages[1].content[0].text).toContain("retrieved");
    expect(appendRetrievalContext([{ role: "assistant" }], "x", "y")).toBeUndefined();
    expect(extractToolName({ content: [{ toolRequest: { name: "webSearch" } }] })).toBe("webSearch");
    expect(extractToolName(null)).toBeNull();
  });

  it("selects retrieval limits and maps history into model/user messages", () => {
    expect(getExecutionProfile("short")).toMatchObject({ dbLimit: 5, webLimit: 2 });
    expect(getExecutionProfile("x".repeat(150))).toMatchObject({ dbLimit: 8, webLimit: 3 });
    const messages = prepareContextAndMessages({
      prompt: "new", userId: "u1", history: [
        { role: "user", content: "old" }, { role: "assistant", content: "prior" },
      ],
    });
    expect(messages.map((message) => message.role)).toEqual(["system", "user", "model", "user"]);
    expect(messages.at(-1).content[0].text).toBe("new");
  });

  it("deduplicates tool calls and returns a safe error for unknown tools", async () => {
    const tool = Object.assign(vi.fn().mockResolvedValue([{ id: "s1" }]), { __action: { name: "manual" } });
    const sendChunk = vi.fn();
    const requests = [
      { toolRequest: { name: "manual", input: { query: "q" }, ref: "r1" } },
      { toolRequest: { name: "manual", input: { query: "q" }, ref: "r2" } },
      { toolRequest: { name: "missing", input: {} } },
    ];
    const result = await executeRequestedTools(requests, [tool], { userId: "u1" }, sendChunk);
    expect(tool).toHaveBeenCalledOnce();
    expect(result[0].toolResponse.output).toEqual([{ id: "s1" }]);
    expect(result[1].toolResponse.output).toEqual({ error: "Errore temporaneo durante l'esecuzione del tool." });
  });

  it("chooses deterministic retrieval by attachments, exact case number, or skips conversational turns", async () => {
    mocks.file.mockResolvedValue([{ id: "file-1" }]);
    const context = { userId: "u1", fascicoloId: null, docs: ["file-1"], uiFilters: [], dbLimit: 5, webLimit: 2 };
    const send = vi.fn();
    await expect(executeDeterministicRetrieval({ prompt: "document", fascicoloId: null }, "document", context, send))
      .resolves.toMatchObject({ skipTurn1: true, preRetrievalSourceName: "Documentazione Allegata" });
    expect(mocks.file).toHaveBeenCalled();
    mocks.database.mockResolvedValue([{ id: "case-1" }]);
    await expect(executeDeterministicRetrieval(
      { prompt: "sentenza 123/2024", fascicoloId: null }, "sentenza 123/2024",
      { ...context, docs: [] }, send,
    )).resolves.toMatchObject({ preRetrievalSourceName: "Database Giurisprudenza" });
    await expect(executeDeterministicRetrieval(
      { prompt: "grazie", fascicoloId: null }, "grazie", { ...context, docs: [] }, send,
    )).resolves.toMatchObject({ skipTurn1: false, preRetrievalOutput: null });
  });

  it("formats and deduplicates citations from tool and deterministic retrieval results", () => {
    const sources = extractAndFormatSources(
      [{ role: "tool", content: [{ toolResponse: { name: "webSearch", output: [
        { id: "s1", titolo: "Case source", link: "https://example.org", _distance: 0.1 },
        { id: "s1", titolo: "Duplicate" },
        { error: "failed" },
      ] } }] }],
      [{ id: "d1", fileName: "contract.pdf", _type: "document_chunk", _distance: 0.5 }],
    );
    expect(sources).toHaveLength(2);
    expect(sources).toEqual(expect.arrayContaining([
      expect.objectContaining({ identificativo: "Case source", score: 0.9, match_percentage: 90, url_riferimento: "https://example.org" }),
      expect.objectContaining({ identificativo: "contract.pdf", _type: "document_chunk", match_percentage: 50 }),
    ]));
  });
});
