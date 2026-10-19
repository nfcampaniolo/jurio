import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildQuoteSystemPrompt, buildReviewSystemPrompt } from "@functions/genai/wordAgent/_prompts";

describe("Word-agent system prompts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("describes source-backed quote and review behavior", () => {
    expect(buildQuoteSystemPrompt()).toContain("NESSUN_RISULTATO");
    expect(buildReviewSystemPrompt()).toContain("webSearch");
    expect(buildReviewSystemPrompt()).toContain("testoOriginale");
  });
});
