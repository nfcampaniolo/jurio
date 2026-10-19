import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildJurioSupportSystemPrompt, buildFallbackUserPrompt, buildEstraiMetadatiPrompt,
} from "@functions/genai/supportAgent/_prompts";

describe("support-agent prompt builders", () => {
  beforeEach(() => vi.clearAllMocks());

  it("adds a caller prefix and frames fallback queries", () => {
    const prompt = buildJurioSupportSystemPrompt("Base instructions");
    expect(prompt.startsWith("Base instructions")).toBe(true);
    expect(prompt).toContain("userManualSearch");
    expect(buildFallbackUserPrompt("contratto")).toContain('"contratto"');
  });

  it("includes serialized current metadata and chat context in extraction instructions", () => {
    const prompt = buildEstraiMetadatiPrompt({ metadatiAttuali: { Cliente: "Ada" }, chatContext: "La data è oggi." });
    expect(prompt).toContain('"Cliente": "Ada"');
    expect(prompt).toContain("La data è oggi.");
  });
});
