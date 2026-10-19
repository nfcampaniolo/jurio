import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@functions/genai/_config", () => ({ ai: { generate: mocks.generate } }));

import { chunkText, generateWithRetry, isResourceExhaustedError, safeParseJson } from "@functions/genai/documentAnalysisAgent/_helper";

describe("document-analysis helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generate.mockReset();
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
    mocks.generate.mockRejectedValueOnce({ code: 429 }).mockResolvedValueOnce({ text: "ok" });
    vi.useFakeTimers();
    const retry = generateWithRetry({} as never, 1);
    await vi.runAllTimersAsync();
    await expect(retry).resolves.toEqual({ text: "ok" });
    expect(mocks.generate).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("propagates non-rate-limit failures without retrying", async () => {
    mocks.generate.mockRejectedValueOnce(new Error("bad request"));
    await expect(generateWithRetry({} as never)).rejects.toThrow("bad request");
    expect(mocks.generate).toHaveBeenCalledOnce();
  });
});
