import { beforeEach, describe, expect, it, vi } from "vitest";
import { PromptFieldSchema, PromptOutputSchema } from "@functions/genai/promptAgent/_schema";

describe("prompt-agent schemas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("validates required field metadata and optional enum values", () => {
    expect(PromptFieldSchema.parse({
      name: "status", type: "enum", description: "Current status", isRequired: true, enumValues: "open,closed",
    })).toMatchObject({ name: "status", isRequired: true });
    expect(PromptFieldSchema.safeParse({ name: "status" }).success).toBe(false);
    expect(PromptOutputSchema.parse({ result: "Generated" })).toEqual({ result: "Generated" });
  });
});
