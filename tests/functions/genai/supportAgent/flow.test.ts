import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generate: vi.fn(), manualSearch: vi.fn() }));
vi.mock("@functions/genai/_config", () => ({
  ai: { defineFlow: (_config: unknown, handler: unknown) => handler, generate: mocks.generate },
}));
vi.mock("@functions/genai/tools/support", () => ({ searchUserManual: mocks.manualSearch }));

import { estraiMetadatiFlow, legalAgentSupport, legalGeminiFallbackFlow } from "@functions/genai/supportAgent/flow";
import { SYSTEM_PROMPT_JURIO_SUPPORT } from "@functions/genai/supportAgent/_prompts";

describe("support-agent flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generate.mockReset();
    mocks.manualSearch.mockResolvedValue([{ id: "m1", text: "Manual excerpt", links: ["/guide"] }]);
  });

  it("searches the manual before generating and returns its citations", async () => {
    mocks.generate.mockResolvedValueOnce({ text: "Answer" });
    const sendChunk = vi.fn();
    const handler = legalAgentSupport as unknown as (input: unknown, context: unknown) => Promise<unknown>;
    const result = await handler({ prompt: "How?", history: [] }, { sendChunk });
    expect(mocks.manualSearch).toHaveBeenCalledWith("How?");
    expect(mocks.generate).toHaveBeenCalledOnce();
    expect(mocks.generate.mock.calls[0][0]).toMatchObject({
      config: {
        maxOutputTokens: 1200,
        thinkingConfig: { thinkingLevel: "LOW" },
      },
    });
    expect(mocks.generate.mock.calls[0][0]).not.toHaveProperty("model");
    const systemPrompt = mocks.generate.mock.calls[0][0].messages[0].content[0].text;
    expect(systemPrompt).toContain("Manual excerpt");
    expect(systemPrompt.split(SYSTEM_PROMPT_JURIO_SUPPORT).length - 1).toBe(1);
    expect(result).toEqual({
      risposta: "Answer",
      fonti: [{ id: "m1", text: "Manual excerpt", links: ["/guide"] }],
    });
    expect(sendChunk).toHaveBeenCalledWith({ status: "Consultazione del manuale Jurio..." });
  });

  it("preserves the full streamed answer when the final model text is shorter", async () => {
    mocks.generate.mockImplementationOnce(async ({ onChunk }: { onChunk: (chunk: { text: string }) => void }) => {
      onChunk({ text: "Jurio è l'assistente legale " });
      onChunk({ text: "virtuale basato su intelligenza artificiale." });
      return { text: "Jurio è l'assistente legale virtuale basato su int" };
    });
    const sendChunk = vi.fn();
    const handler = legalAgentSupport as unknown as (input: unknown, context: unknown) => Promise<unknown>;

    await expect(handler({ prompt: "Come funziona Jurio?", history: [] }, { sendChunk })).resolves.toEqual({
      risposta: "Jurio è l'assistente legale virtuale basato su intelligenza artificiale.",
      fonti: [{ id: "m1", text: "Manual excerpt", links: ["/guide"] }],
    });
    expect(sendChunk).toHaveBeenCalledWith({ text: "virtuale basato su intelligenza artificiale." });
  });

  it("generates an answer without citations when manual search has no matches", async () => {
    mocks.manualSearch.mockResolvedValueOnce([{ message: "No matches" }]);
    mocks.generate.mockResolvedValueOnce({ text: "Answer" });
    const handler = legalAgentSupport as unknown as (input: unknown, context: unknown) => Promise<unknown>;
    await expect(handler({ prompt: "How?" }, { sendChunk: vi.fn() })).resolves.toEqual({
      risposta: "Answer",
      fonti: [],
    });
    expect(mocks.generate.mock.calls[0][0].messages[0].content[0].text)
      .toContain("Nessuna fonte pertinente");
  });

  it("caps manual excerpts and conversation history sent to the model", async () => {
    mocks.manualSearch.mockResolvedValueOnce([
      { id: "m1", text: "A".repeat(1600), links: ["/guide"] },
      { id: "m2", text: "B".repeat(1400), links: ["/pricing"] },
      { id: "m3", text: "C".repeat(1200), links: ["/privacy"] },
    ]);
    mocks.generate.mockResolvedValueOnce({ text: "Answer" });
    const history = Array.from({ length: 6 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "model",
      content: `${index}:` + "H".repeat(900),
    }));
    const handler = legalAgentSupport as unknown as (input: unknown, context: unknown) => Promise<unknown>;

    await handler({ prompt: "How?", history }, { sendChunk: vi.fn() });

    const messages = mocks.generate.mock.calls[0][0].messages;
    expect(messages).toHaveLength(6);
    const systemContext = messages[0].content[0].text;
    expect(systemContext).toContain("A".repeat(1000));
    expect(systemContext).not.toContain("A".repeat(1001));
    expect(systemContext).toContain("B".repeat(1000));
    expect(systemContext).not.toContain("C".repeat(100));
    expect(messages[1].content[0].text).toContain("2:");
    expect(messages[1].content[0].text).not.toContain("H".repeat(701));
  });

  it("returns structured fallback output or null when generation has no output", async () => {
    mocks.generate.mockResolvedValueOnce({ output: { sintesi: "S", queryAlternativa: "Q" } });
    const fallback = legalGeminiFallbackFlow as unknown as (input: unknown) => Promise<unknown>;
    await expect(fallback({ query: "query" })).resolves.toEqual({ sintesi: "S", queryAlternativa: "Q" });
    mocks.generate.mockResolvedValueOnce({ output: null });
    await expect(fallback({ query: "query" })).resolves.toBeNull();
  });

  it("returns empty metadata when extraction generation fails", async () => {
    mocks.generate.mockRejectedValueOnce(new Error("offline"));
    const handler = estraiMetadatiFlow as unknown as (input: unknown) => Promise<unknown>;
    await expect(handler({ chatContext: "chat", metadatiAttuali: {} })).resolves.toEqual({ dati_nuovi_o_aggiornati: [] });
  });
});
