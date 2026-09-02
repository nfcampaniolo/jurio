import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

// ---- FirebaseError mock ----
class FirebaseErrorMock extends Error {
  code: string;
  constructor(code = "unknown", message = "firebase") {
    super(message);
    this.code = code;
  }
}
vi.mock("firebase/app", () => ({ FirebaseError: FirebaseErrorMock }));

// ---- user mock ----
const fetchRegisterDoc = vi.fn<(uid: string) => Promise<{ start?: unknown } | null>>();
vi.mock("@/services/user", () => ({
  fetchRegisterDoc: (...a: Parameters<typeof fetchRegisterDoc>) => fetchRegisterDoc(...a),
}));

// ---- plan domain mocks ----
const toStartDate = vi.fn<(raw: unknown) => Date | null>();
const trialDaysLeft = vi.fn<(d: Date) => number>();
vi.mock("@/hooks/planlDomain", () => ({
  toStartDate: (...a: Parameters<typeof toStartDate>) => toStartDate(...a),
  trialDaysLeft: (...a: Parameters<typeof trialDaysLeft>) => trialDaysLeft(...a),
}));

async function importFresh() {
  return import("@/hooks/usePlans"); // src/services/trial/useTrialInfo.ts
}

describe("useTrialInfo", () => {
  it("resets state when not trial or uid missing", async () => {
    const { useTrialInfo } = await importFresh();

    const { result, rerender } = renderHook((p: { isTrial: boolean; uid: string | null }) => useTrialInfo(p), {
      initialProps: { isTrial: false, uid: "u1" },
    });

    expect(result.current.trialLoading).toBe(false);
    expect(result.current.trialErr).toBeNull();
    expect(result.current.trialLeft).toBeNull();

    rerender({ isTrial: true, uid: "" });

    expect(result.current.trialLoading).toBe(false);
    expect(result.current.trialErr).toBeNull();
    expect(result.current.trialLeft).toBeNull();

    expect(fetchRegisterDoc).not.toHaveBeenCalled();
  });

  it("sets error when register doc missing", async () => {
    fetchRegisterDoc.mockResolvedValueOnce(null);

    const { useTrialInfo } = await importFresh();
    const { result } = renderHook(() => useTrialInfo({ isTrial: true, uid: "u1" }));

    await waitFor(() => {
      expect(result.current.trialLoading).toBe(false);
    });

    expect(fetchRegisterDoc).toHaveBeenCalledWith("u1");
    expect(result.current.trialErr).toBe("Dati prova non trovati (register/{uid}).");
    expect(result.current.trialLeft).toBeNull();
  });

  it("sets error when start is invalid", async () => {
    fetchRegisterDoc.mockResolvedValueOnce({ start: "bad" });
    toStartDate.mockReturnValueOnce(null);

    const { useTrialInfo } = await importFresh();
    const { result } = renderHook(() => useTrialInfo({ isTrial: true, uid: "u1" }));

    await waitFor(() => {
      expect(result.current.trialLoading).toBe(false);
    });

    expect(toStartDate).toHaveBeenCalledWith("bad");
    expect(result.current.trialErr).toBe("Campo start non valido in register/{uid}.");
    expect(result.current.trialLeft).toBeNull();
  });

  it("computes trialLeft on success", async () => {
    const start = new Date("2026-01-01T00:00:00.000Z");
    fetchRegisterDoc.mockResolvedValueOnce({ start: "raw" });
    toStartDate.mockReturnValueOnce(start);
    trialDaysLeft.mockReturnValueOnce(7);

    const { useTrialInfo } = await importFresh();
    const { result } = renderHook(() => useTrialInfo({ isTrial: true, uid: "u1" }));

    await waitFor(() => {
      expect(result.current.trialLoading).toBe(false);
    });

    expect(result.current.trialErr).toBeNull();
    expect(result.current.trialLeft).toBe(7);
    expect(trialDaysLeft).toHaveBeenCalledWith(start);
  });

  it("maps FirebaseError to firebase message", async () => {
    fetchRegisterDoc.mockRejectedValueOnce(new FirebaseErrorMock("permission-denied"));

    const { useTrialInfo } = await importFresh();
    const { result } = renderHook(() => useTrialInfo({ isTrial: true, uid: "u1" }));

    await waitFor(() => {
      expect(result.current.trialLoading).toBe(false);
    });

    expect(result.current.trialErr).toBe("Errore Firebase nel recupero della prova.");
    expect(result.current.trialLeft).toBeNull();
  });

  it("uses generic Error message on non-firebase error", async () => {
    fetchRegisterDoc.mockRejectedValueOnce(new Error("boom"));

    const { useTrialInfo } = await importFresh();
    const { result } = renderHook(() => useTrialInfo({ isTrial: true, uid: "u1" }));

    await waitFor(() => {
      expect(result.current.trialLoading).toBe(false);
    });

    expect(result.current.trialErr).toBe("boom");
  });

    it("does not set state after unmount (cancelled)", async () => {
    let resolve!: (v: { start?: unknown } | null) => void;

    fetchRegisterDoc.mockImplementationOnce(
        () =>
        new Promise<{ start?: unknown } | null>((r) => {
            resolve = r;
        })
    );

    toStartDate.mockReturnValue(new Date());
    trialDaysLeft.mockReturnValue(3);

    const { useTrialInfo } = await importFresh();
    const { result, unmount } = renderHook(() =>
        useTrialInfo({ isTrial: true, uid: "u1" })
    );

    await waitFor(() => {
        expect(result.current.trialLoading).toBe(true);
    });

    unmount();

    resolve({ start: "raw" });

    await Promise.resolve();

    expect(trialDaysLeft).not.toHaveBeenCalled();
    });
});