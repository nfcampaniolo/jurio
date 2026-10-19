import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generate: vi.fn(), file: vi.fn() }));
vi.mock("@functions/genai/_config", () => ({
  ai: { defineFlow: (_config: unknown, handler: unknown) => handler, generate: mocks.generate },
  CFG: { limits: { historyWindow: 6 } },
}));
vi.mock("@functions/genai/tools/index", () => ({
  userFileSearch: mocks.file, dynamicTools: [],
}));

import { legalAgentFlow } from "@functions/genai/legalAgent/flow";

describe("legal-agent flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generate.mockReset();
  });

  it("returns the model answer with no sources when no tool call is requested", async () => {
    mocks.generate.mockResolvedValueOnce({ text: "Legal response", messages: [] });
    const handler = legalAgentFlow as unknown as (input: unknown, context: unknown) => Promise<unknown>;
    const result = await handler({ prompt: "question", userId: "u1" }, { sendChunk: vi.fn() });
    expect(result).toEqual({ risposta: "Legal response", fonti: [], titoloGenerato: undefined });
    expect(mocks.generate).toHaveBeenCalledOnce();
  });

  it("replaces a blank model response with the safe fallback", async () => {
    mocks.generate.mockResolvedValueOnce({ text: "  ", messages: [] });
    const handler = legalAgentFlow as unknown as (input: unknown, context: unknown) => Promise<unknown>;
    await expect(handler({ prompt: "question", userId: "u1" }, { sendChunk: vi.fn() }))
      .resolves.toMatchObject({ risposta: "Nessuna risposta generata." });
  });

  it("preloads attached documents and returns their retrieval outputs as citations", async () => {
    mocks.file.mockResolvedValueOnce([{
      id: "chunk-1", fileName: "contratto.pdf", paragraphText: "clausola", _type: "document_chunk", _distance: 0.1,
    }]);
    mocks.generate.mockResolvedValueOnce({ text: "Document answer", messages: [] });
    const handler = legalAgentFlow as unknown as (input: unknown, context: unknown) => Promise<unknown>;
    const result = await handler({ prompt: "document question", userId: "u1", docs: ["doc-1"] }, { sendChunk: vi.fn() });
    expect(mocks.file).toHaveBeenCalledWith(
      { query: "document question" },
      { context: expect.objectContaining({ userId: "u1", docs: ["doc-1"] }) },
    );
    expect(result).toMatchObject({
      risposta: "Document answer",
      fonti: [expect.objectContaining({ identificativo: "contratto.pdf", _type: "document_chunk" })],
    });
  });

  it("executes requested tool calls and asks the model to synthesize their results", async () => {
    mocks.generate
      .mockResolvedValueOnce({ toolRequests: [{ toolRequest: { name: "unknownTool", input: {} } }], messages: [] })
      .mockResolvedValueOnce({ text: "Synthesized answer", messages: [] });
    const handler = legalAgentFlow as unknown as (input: unknown, context: unknown) => Promise<unknown>;
    const result = await handler({ prompt: "question", userId: "u1" }, { sendChunk: vi.fn() });
    expect(mocks.generate).toHaveBeenCalledTimes(2);
    expect(mocks.generate.mock.calls[1][0].messages.at(-1).content[0].text)
      .toContain("Errore temporaneo durante l'esecuzione del tool.");
    expect(result).toMatchObject({ risposta: "Synthesized answer" });
  });

  it("emits a safe streaming error and rejects when model generation fails", async () => {
    mocks.generate.mockRejectedValueOnce(new Error("private provider detail"));
    const sendChunk = vi.fn();
    const handler = legalAgentFlow as unknown as (input: unknown, context: unknown) => Promise<unknown>;
    await expect(handler({ prompt: "question", userId: "u1" }, { sendChunk }))
      .rejects.toThrow("Il motore neurale ha incontrato un errore imprevisto durante l'elaborazione.");
    expect(sendChunk).toHaveBeenCalledWith({
      error: { message: "Il motore neurale ha incontrato un errore imprevisto durante l'elaborazione." },
    });
  });
});
