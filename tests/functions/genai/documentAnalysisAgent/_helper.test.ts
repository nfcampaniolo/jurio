import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  randomInt: vi.fn(() => 0),
}));

vi.mock("@functions/genai/_config", () => ({ ai: { generate: mocks.generate } }));
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return {
    ...actual,
    default: { ...actual, randomInt: mocks.randomInt },
    randomInt: mocks.randomInt,
  };
});

import { chunkText, generateWithRetry, isResourceExhaustedError, safeParseJson } from "@functions/genai/documentAnalysisAgent/_helper";


describe("document-analysis helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generate.mockReset();
    mocks.randomInt.mockReturnValue(0);
  });

  it("splits long content and handles empty content and fenced JSON", () => {
    expect(chunkText("first\n\nsecond", 7)).toEqual(["first", "secon", "d"]);
    expect(chunkText("")).toEqual([]);
    expect(safeParseJson("```json\n{\"ok\":true}\n```")).toEqual({ ok: true });
    expect(safeParseJson("{broken")).toBeNull();
  });


  it("identifies retryable rate-limit errors and retries only those", async () => {
    expect(isResourceExhaustedError({ status: "RESOURCE_EXHAUSTED" })).toBe(true);
    expect(isResourceExhaustedError(new Error("other"))).toBe(false);

    mocks.generate
      .mockRejectedValueOnce({ code: 429 })
      .mockResolvedValueOnce({ text: "ok" });

    mocks.randomInt.mockReturnValue(375);
    vi.useFakeTimers();

    try {
      const retry = generateWithRetry({} as never, 1);

      await vi.advanceTimersByTimeAsync(3374);
      expect(mocks.generate).toHaveBeenCalledOnce();

      await vi.advanceTimersByTimeAsync(1);
      await expect(retry).resolves.toEqual({ text: "ok" });

      expect(mocks.generate).toHaveBeenCalledTimes(2);
      expect(mocks.randomInt).toHaveBeenCalledWith(1000);
    } finally {
      vi.useRealTimers();
    }
  });

  it("propagates non-rate-limit failures without retrying", async () => {
    mocks.generate.mockRejectedValueOnce(new Error("bad request"));
    await expect(generateWithRetry({} as never)).rejects.toThrow("bad request");
    expect(mocks.generate).toHaveBeenCalledOnce();
  });
});
