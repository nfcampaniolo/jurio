import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildPromptBuilderFallbackResult, buildPromptBuilderUserPrompt, getEnhancePromptSystemInstruction,
  ENHANCE_PROMPT_CHAT_SYSTEM_PROMPT, ENHANCE_PROMPT_APPROFONDIMENTO_SYSTEM_PROMPT,
} from "@functions/genai/promptAgent/_prompts";

describe("prompt-agent prompt builders", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes the objective and schema and conditionally includes notes", () => {
    const withNotes = buildPromptBuilderUserPrompt({ objective: "Extract facts", notes: "Be precise", stringifiedSchema: "{}" });
    expect(withNotes).toContain("Extract facts");
    expect(withNotes).toContain("Be precise");
    expect(withNotes).toContain("{}");
    expect(buildPromptBuilderUserPrompt({ objective: "Extract facts", stringifiedSchema: "{}" })).not.toContain("<NOTE_E_LINEE_GUIDA>");
  });

  it("builds the fallback and selects the instruction by enhancement type", () => {
    expect(buildPromptBuilderFallbackResult({ objective: "Analyze", stringifiedSchema: "{}" })).toContain("Analyze");
    expect(getEnhancePromptSystemInstruction("chat")).toBe(ENHANCE_PROMPT_CHAT_SYSTEM_PROMPT);
    expect(getEnhancePromptSystemInstruction("approfondimento")).toBe(ENHANCE_PROMPT_APPROFONDIMENTO_SYSTEM_PROMPT);
  });
});
