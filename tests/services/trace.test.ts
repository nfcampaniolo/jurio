import { describe, test, expect, vi, beforeEach } from "vitest";

/* ---------- hoisted mocks ---------- */
const { mockGetPerf, mockTrace, mockTraceInstance } = vi.hoisted(() => {
  const instance = {
    putAttribute: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  return {
    mockGetPerf: vi.fn(),
    mockTrace: vi.fn().mockReturnValue(instance),
    mockTraceInstance: instance,
  };
});

/* ---------- mock modules ---------- */
vi.mock("@/services/optionalService", () => ({
  getPerf: () => mockGetPerf(),
}));

vi.mock("firebase/performance", () => ({
  trace: (...args: unknown[]) => mockTrace(...args),
}));

/* ---------- subject under test ---------- */
import { withTrace } from "@/services/perf";

describe("withTrace Utility Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("esegue direttamente la funzione e restituisce il risultato se getPerf restituisce null", async () => {
    mockGetPerf.mockReturnValue(null);
    const mockFn = vi.fn().mockResolvedValue("success_result");

    const result = await withTrace("test_trace", { attr1: "val1" }, mockFn);

    expect(result).toBe("success_result");
    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockTrace).not.toHaveBeenCalled();
  });

  test("configura la traccia, filtra gli attributi e gestisce start/stop quando getPerf è disponibile", async () => {
    mockGetPerf.mockReturnValue({});
    const mockFn = vi.fn().mockResolvedValue("perf_result");

    const attrs = {
      shortKey: "shortVal",
      nullVal: null,
      undefinedVal: undefined,
      longKeyNameExceedingFortyCharactersLimitToEnsureTruncationWorksProperly: "value1",
      val2: "a".repeat(150),
      val3: 123,
      val4: true,
      val5: "extra",
    };

    const result = await withTrace("my_trace", attrs, mockFn);

    expect(result).toBe("perf_result");
    expect(mockTrace).toHaveBeenCalledWith({}, "my_trace");
    expect(mockTraceInstance.start).toHaveBeenCalledTimes(1);
    expect(mockTraceInstance.stop).toHaveBeenCalledTimes(1);

    // Verifica il troncamento delle chiavi (max 40 char)
    expect(mockTraceInstance.putAttribute).toHaveBeenCalledWith(
      "longKeyNameExceedingFortyCharactersLimit",
      "value1"
    );

    // Verifica il troncamento dei valori (max 97 char + "...")
    expect(mockTraceInstance.putAttribute).toHaveBeenCalledWith(
      "val2",
      "a".repeat(97) + "..."
    );

    expect(mockTraceInstance.putAttribute).toHaveBeenCalledTimes(5);
  });

  test("assicura che la traccia venga fermata (stop) anche se la funzione lancia un errore", async () => {
    mockGetPerf.mockReturnValue({});
    const mockFn = vi.fn().mockRejectedValue(new Error("Errore esecuzione"));

    await expect(withTrace("error_trace", {}, mockFn)).rejects.toThrow("Errore esecuzione");

    expect(mockTraceInstance.start).toHaveBeenCalledTimes(1);
    expect(mockTraceInstance.stop).toHaveBeenCalledTimes(1);
  });
});