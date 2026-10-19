import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generate: vi.fn(), generateWithRetry: vi.fn() }));
vi.mock("@functions/genai/_config", () => ({ ai: { defineFlow: (_config: unknown, handler: unknown) => handler, generate: mocks.generate } }));
vi.mock("@functions/genai/documentAnalysisAgent/_helper", () => ({
  chunkText: (text: string) => text ? [text] : [],
  safeParseJson: (text: string) => { try { return JSON.parse(text); } catch { return null; } },
  generateWithRetry: mocks.generateWithRetry,
}));

import { doctrineFlow, reasoningFlow } from "@functions/genai/documentAnalysisAgent/flow";

describe("document-analysis flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generate.mockReset();
    mocks.generateWithRetry.mockReset();
  });

  it("returns structured reasoning output and parses fenced JSON fallback text", async () => {
    const handler = reasoningFlow as unknown as (input: unknown) => Promise<unknown>;
    mocks.generate.mockResolvedValueOnce({ output: { sintesi: "Risultato" } });
    await expect(handler({ question: "Q" })).resolves.toEqual({ sintesi: "Risultato" });
    mocks.generate.mockResolvedValueOnce({ text: "```json\n{\"sintesi\":\"fallback\"}\n```" });
    await expect(handler({ question: "Q", customPrompt: "P" })).resolves.toEqual({ sintesi: "fallback" });
  });

  it("adds a usable summary to extracted doctrine and wraps definitive generation failures", async () => {
    const handler = doctrineFlow as unknown as (input: unknown) => Promise<unknown>;
    mocks.generateWithRetry.mockResolvedValueOnce({ text: JSON.stringify({ tematiche: [{ tematica: "T", questione_di_diritto: "Q", orientamento: "O" }] }) });
    const result = await handler({ extractedText: "Document text", sourceUrl: "https://example.org" }) as { tematiche: Array<{ summary: string }> };
    expect(result.tematiche[0].summary).toContain("Tematica: T");
    mocks.generateWithRetry.mockRejectedValueOnce(new Error("model down"));
    await expect(handler({ extractedText: "text", sourceUrl: "url" })).rejects.toThrow("Elaborazione Gemini fallita nel chunk 1.");
  });
});
