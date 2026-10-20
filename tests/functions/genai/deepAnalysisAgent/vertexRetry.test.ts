import { afterEach, describe, expect, it, vi } from "vitest";
import {
  generateWithVertexRetry,
  VertexAiTemporarilyUnavailableError,
} from "@functions/genai/deepAnalysisAgent/_vertexRetry";

describe("Vertex AI retry handling", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("retries resource exhaustion and returns the next successful result", async () => {
    vi.useFakeTimers();
    const generate = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce({ status: "RESOURCE_EXHAUSTED", code: 429 })
      .mockResolvedValueOnce("report");
    const onRetry = vi.fn().mockResolvedValue(undefined);

    const result = generateWithVertexRetry(generate, onRetry);
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(result).resolves.toBe("report");
    expect(generate).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledWith(1, 2_000);
  });

  it("does not retry non-transient generation errors", async () => {
    const error = new Error("Invalid output");
    const generate = vi.fn().mockRejectedValue(error);
    const onRetry = vi.fn();

    await expect(generateWithVertexRetry(generate, onRetry)).rejects.toBe(error);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it("returns a recoverable error after exhausting transient retries", async () => {
    vi.useFakeTimers();
    const generate = vi
      .fn<() => Promise<string>>()
      .mockRejectedValue({ status: "RESOURCE_EXHAUSTED", code: 429 });

    const result = generateWithVertexRetry(generate, vi.fn().mockResolvedValue(undefined));
    const rejection = expect(result).rejects.toBeInstanceOf(
      VertexAiTemporarilyUnavailableError
    );
    await vi.advanceTimersByTimeAsync(7_000);

    await rejection;
    expect(generate).toHaveBeenCalledTimes(3);
  });
});
