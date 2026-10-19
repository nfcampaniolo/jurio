import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@functions/genai/_config", () => ({
  ai: { defineFlow: (_config: unknown, handler: unknown) => handler, generate: mocks.generate },
  CFG: { limits: { historyWindow: 2 } },
}));
vi.mock("@functions/genai/tools/index", () => ({ userManualSearch: { name: "userManualSearch" } }));

import { estraiMetadatiFlow, legalAgentSupport, legalGeminiFallbackFlow } from "@functions/genai/supportAgent/flow";

describe("support-agent flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generate.mockReset();
  });

  it("collects manual citations from a completed support response", async () => {
    mocks.generate.mockResolvedValueOnce({
      text: "Answer",
      messages: [{ role: "tool", content: [{ toolResponse: { name: "userManualSearch", output: [{ id: "m1" }] } }] }],
    });
    const handler = legalAgentSupport as unknown as (input: unknown, context: unknown) => Promise<unknown>;
    const result = await handler({ prompt: "How?", history: [] }, { sendChunk: vi.fn() });
    expect(result).toEqual({ risposta: "Answer", fonti: [{ id: "m1" }] });
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
