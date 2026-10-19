import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@functions/genai/_config", () => ({ ai: { defineFlow: (_config: unknown, handler: unknown) => handler, generate: mocks.generate } }));

import { enhancePromptFlow, promptBuilderFlow } from "@functions/genai/promptAgent/flow";

describe("prompt-agent flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generate.mockReset();
  });

  it("builds a schema from supplied fields and uses the fallback for empty model output", async () => {
    mocks.generate.mockResolvedValueOnce({ text: " " });
    const sendChunk = vi.fn();
    const handler = promptBuilderFlow as unknown as (input: unknown, context: unknown) => Promise<unknown>;
    const result = await handler({
      objective: "Extract", notes: "Rules", userId: "u1",
      fields: [{ name: "state", type: "enum", description: "Status", isRequired: true, enumValues: "open, closed" }],
    }, { sendChunk }) as { result: string };
    expect(result.result).toContain("Extract");
    expect(result.result).toContain("state");
    expect(mocks.generate.mock.calls[0][0].messages[1].content[0].text).toContain("Rules");
    expect(sendChunk).toHaveBeenCalledTimes(3);
  });

  it("returns trimmed enhanced text for the selected enhancement type", async () => {
    mocks.generate.mockResolvedValueOnce({ text: "  improved  " });
    const handler = enhancePromptFlow as unknown as (input: unknown) => Promise<unknown>;
    await expect(handler({ prompt: "raw", type: "chat", history: [] })).resolves.toEqual({ enhancedPrompt: "improved" });
    expect(mocks.generate.mock.calls[0][0].messages[0].content[0].text).toContain("avvocato");
  });
});
