import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

/* =========================
   MOCKS
========================= */

const loginWithGoogle = vi.fn<() => Promise<{ uid: string }>>();
vi.mock("@/services/auth", () => ({
  loginWithGoogle,
}));

const userExists = vi.fn<(uid: string) => Promise<boolean>>();
vi.mock("@/services/user", () => ({
  userExists,
}));

const setUserMock = vi.fn<(u: { uid: string }) => void>();
vi.mock("@/stores/userStore", () => ({
  useUserStore: (selector: (s: { setUser: typeof setUserMock }) => unknown) =>
    selector({ setUser: setUserMock }),
}));

const navigateMock = vi.fn<(path: string) => void>();
vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

/* =========================
   IMPORT FRESH
========================= */

async function importFresh() {
  return import("@/hooks/useGoogleAuthLogic"); // <-- adatta path
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

/* =========================
   TESTS
========================= */

describe("useGoogleAuthLogic", () => {
  it("initial state", async () => {
    const { useGoogleAuthLogic } = await importFresh();
    const { result } = renderHook(() => useGoogleAuthLogic());

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("success -> existing user navigates to /profilo", async () => {
    loginWithGoogle.mockResolvedValueOnce({ uid: "u1" });
    userExists.mockResolvedValueOnce(true);

    const { useGoogleAuthLogic } = await importFresh();
    const { result } = renderHook(() => useGoogleAuthLogic());

    await act(async () => {
      await result.current.handleGoogleLogin();
    });

    expect(loginWithGoogle).toHaveBeenCalled();
    expect(setUserMock).toHaveBeenCalledWith({ uid: "u1" });
    expect(userExists).toHaveBeenCalledWith("u1");
    expect(navigateMock).toHaveBeenCalledWith("/profilo");
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("success -> new user navigates to /registrati", async () => {
    loginWithGoogle.mockResolvedValueOnce({ uid: "u2" });
    userExists.mockResolvedValueOnce(false);

    const { useGoogleAuthLogic } = await importFresh();
    const { result } = renderHook(() => useGoogleAuthLogic());

    await act(async () => {
      await result.current.handleGoogleLogin();
    });

    expect(setUserMock).toHaveBeenCalledWith({ uid: "u2" });
    expect(navigateMock).toHaveBeenCalledWith("/registrati");
    expect(result.current.loading).toBe(false);
  });

  it("handles Error instance", async () => {
    loginWithGoogle.mockRejectedValueOnce(new Error("Google fail"));

    const { useGoogleAuthLogic } = await importFresh();
    const { result } = renderHook(() => useGoogleAuthLogic());

    await act(async () => {
      await result.current.handleGoogleLogin();
    });

    await waitFor(() => {
      expect(result.current.error).toBe("Google fail");
    });

    expect(result.current.loading).toBe(false);
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it("handles non-Error rejection", async () => {
    loginWithGoogle.mockRejectedValueOnce("boom");

    const { useGoogleAuthLogic } = await importFresh();
    const { result } = renderHook(() => useGoogleAuthLogic());

    await act(async () => {
      await result.current.handleGoogleLogin();
    });

    await waitFor(() => {
      expect(result.current.error).toBe("Errore login con Google");
    });

    expect(result.current.loading).toBe(false);
  });

  it("sets loading true during execution", async () => {
    let resolve!: (v: { uid: string }) => void;

    loginWithGoogle.mockImplementationOnce(
      () =>
        new Promise((r) => {
          resolve = r;
        })
    );

    const { useGoogleAuthLogic } = await importFresh();
    const { result } = renderHook(() => useGoogleAuthLogic());

    act(() => {
      result.current.handleGoogleLogin();
    });

    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolve({ uid: "u3" });
    });

    userExists.mockResolvedValueOnce(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
  });
});