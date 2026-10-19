import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildReasoningUserPrompt, buildDoctrineSystemPrompt, buildDoctrineUserPrompt,
  DOCTRINE_CHUNK_SAFETY_NET, REASONING_SYSTEM_PROMPT,
} from "@functions/genai/documentAnalysisAgent/_prompts";

describe("document-analysis prompt builders", () => {
  beforeEach(() => vi.clearAllMocks());

  it("combines the analysis directive with the source text", () => {
    expect(REASONING_SYSTEM_PROMPT).toContain("JSON valido");
    expect(buildReasoningUserPrompt({ promptToUse: "Riassumi", question: "Testo" })).toContain("Testo");
  });

  it("preserves document URL and chunk coordinates and adds chunk safeguards", () => {
    expect(buildDoctrineSystemPrompt("base")).toContain(DOCTRINE_CHUNK_SAFETY_NET);
    expect(buildDoctrineUserPrompt({ sourceUrl: "https://example.org", chunkIndex: 2, totalChunks: 3, chunk: "body" }))
      .toContain("2/3");
    expect(buildDoctrineUserPrompt({ sourceUrl: "https://example.org", chunkIndex: 2, totalChunks: 3, chunk: "body" }))
      .toContain("body");
  });
});
