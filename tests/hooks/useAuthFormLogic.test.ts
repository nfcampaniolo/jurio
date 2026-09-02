import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

type UserLike = { uid: string };

const loginWithEmail = vi.fn<(email: string, password: string) => Promise<{ user: UserLike }>>();
const registerWithEmail = vi.fn<(email: string, password: string) => Promise<unknown>>();
const resetPassword = vi.fn<(email: string) => Promise<unknown>>();
vi.mock("@/services/auth", () => ({
  loginWithEmail,
  registerWithEmail,
  resetPassword,
}));

const userExists = vi.fn<(uid: string) => Promise<boolean>>();
vi.mock("@/services/user", () => ({ userExists }));

const setUserMock = vi.fn<(u: UserLike) => void>();
vi.mock("@/stores/userStore", () => ({
  useUserStore: (selector: (s: { setUser: typeof setUserMock }) => unknown) =>
    selector({ setUser: setUserMock }),
}));

const navigateMock = vi.fn<(path: string) => void>();
vi.mock("react-router-dom", () => ({
  useNavigate: () => navigateMock,
}));

const toastFn = vi.fn<(msg: string) => void>();
const toastError = vi.fn<(msg: string, opts?: unknown) => void>();
vi.mock("react-hot-toast", () => ({
  toast: Object.assign(toastFn, { error: toastError }),
}));

async function importFresh() {
  return import("@/hooks/useAuthFormLogic"); // <-- cambia path
}

function mkEvt(): { preventDefault: () => void } {
  return { preventDefault: vi.fn() };
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("useAuthFormLogic", () => {
  it("initial state + toggleMode", async () => {
    const { useAuthFormLogic } = await importFresh();
    const { result } = renderHook(() => useAuthFormLogic("login"));

    expect(result.current.mode).toBe("login");
    expect(result.current.email).toBe("");
    expect(result.current.password).toBe("");

    act(() => {
      result.current.toggleMode();
    });
    expect(result.current.mode).toBe("register");

    act(() => {
      result.current.toggleMode();
    });
    expect(result.current.mode).toBe("login");
  });

  it("login success -> existing user navigates /profilo", async () => {
    loginWithEmail.mockResolvedValueOnce({ user: { uid: "u1" } });
    userExists.mockResolvedValueOnce(true);

    const { useAuthFormLogic } = await importFresh();
    const { result } = renderHook(() => useAuthFormLogic("login"));

    act(() => {
      result.current.setEmail("a@b.com");
      result.current.setPassword("Pwd123!!");
    });

    await act(async () => {
      await result.current.handleSubmit(mkEvt() as unknown as React.FormEvent);
    });

    expect(loginWithEmail).toHaveBeenCalledWith("a@b.com", "Pwd123!!");
    expect(setUserMock).toHaveBeenCalledWith({ uid: "u1" });
    expect(userExists).toHaveBeenCalledWith("u1");
    expect(navigateMock).toHaveBeenCalledWith("/profilo");
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("login success -> new user navigates /registrati", async () => {
    loginWithEmail.mockResolvedValueOnce({ user: { uid: "u2" } });
    userExists.mockResolvedValueOnce(false);

    const { useAuthFormLogic } = await importFresh();
    const { result } = renderHook(() => useAuthFormLogic("login"));

    act(() => {
      result.current.setEmail("a@b.com");
      result.current.setPassword("Pwd123!!");
    });

    await act(async () => {
      await result.current.handleSubmit(mkEvt() as unknown as React.FormEvent);
    });

    expect(navigateMock).toHaveBeenCalledWith("/registrati");
  });

  it("login failure -> sets error", async () => {
    loginWithEmail.mockRejectedValueOnce(new Error("bad login"));

    const { useAuthFormLogic } = await importFresh();
    const { result } = renderHook(() => useAuthFormLogic("login"));

    act(() => {
      result.current.setEmail("a@b.com");
      result.current.setPassword("Pwd123!!");
    });

    await act(async () => {
      await result.current.handleSubmit(mkEvt() as unknown as React.FormEvent);
    });

    expect(result.current.error).toBe("bad login");
    expect(navigateMock).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it("register: password requirements fail -> toast.error and does not call register", async () => {
    const { useAuthFormLogic } = await importFresh();
    const { result } = renderHook(() => useAuthFormLogic("register"));

    act(() => {
      result.current.setEmail("a@b.com");
      result.current.setPassword("short"); // fallisce più regole
    });

    await act(async () => {
      await result.current.handleSubmit(mkEvt() as unknown as React.FormEvent);
    });

    expect(toastError).toHaveBeenCalled();
    expect(registerWithEmail).not.toHaveBeenCalled();
    expect(result.current.mode).toBe("register");
    expect(result.current.loading).toBe(false);
  });

  it("register: password ok -> calls register and switches to login mode", async () => {
    registerWithEmail.mockResolvedValueOnce(undefined);

    const { useAuthFormLogic } = await importFresh();
    const { result } = renderHook(() => useAuthFormLogic("register"));

    act(() => {
      result.current.setEmail("a@b.com");
      result.current.setPassword("Abcdef1!"); // ok: maiuscola minuscola numero speciale 8
    });

    await act(async () => {
      await result.current.handleSubmit(mkEvt() as unknown as React.FormEvent);
    });

    expect(registerWithEmail).toHaveBeenCalledWith("a@b.com", "Abcdef1!");
    expect(result.current.mode).toBe("login");
    expect(result.current.loading).toBe(false);
  });

  it("register: registerWithEmail throws -> sets error", async () => {
    registerWithEmail.mockRejectedValueOnce(new Error("reg fail"));

    const { useAuthFormLogic } = await importFresh();
    const { result } = renderHook(() => useAuthFormLogic("register"));

    act(() => {
      result.current.setEmail("a@b.com");
      result.current.setPassword("Abcdef1!");
    });

    await act(async () => {
      await result.current.handleSubmit(mkEvt() as unknown as React.FormEvent);
    });

    expect(result.current.error).toBe("reg fail");
    expect(result.current.mode).toBe("register"); // non arriva allo switch
  });

  it("handleResetPassword: missing email -> sets error and does not call resetPassword", async () => {
    const { useAuthFormLogic } = await importFresh();
    const { result } = renderHook(() => useAuthFormLogic("login"));

    await act(async () => {
      await result.current.handleResetPassword();
    });

    expect(result.current.error).toBe("Inserisci l’email per reimpostare la password");
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it("handleResetPassword: success -> sets confirmation message", async () => {
    resetPassword.mockResolvedValueOnce(undefined);

    const { useAuthFormLogic } = await importFresh();
    const { result } = renderHook(() => useAuthFormLogic("login"));

    act(() => {
      result.current.setEmail("a@b.com");
    });

    await act(async () => {
      await result.current.handleResetPassword();
    });

    await waitFor(() => {
      expect(result.current.error).toBe("Email di recupero inviata");
    });

    expect(resetPassword).toHaveBeenCalledWith("a@b.com");
    expect(result.current.loading).toBe(false);
  });

  it("handleResetPassword: failure -> sets error message", async () => {
    resetPassword.mockRejectedValueOnce(new Error("reset fail"));

    const { useAuthFormLogic } = await importFresh();
    const { result } = renderHook(() => useAuthFormLogic("login"));

    act(() => {
      result.current.setEmail("a@b.com");
    });

    await act(async () => {
      await result.current.handleResetPassword();
    });

    expect(result.current.error).toBe("reset fail");
    expect(result.current.loading).toBe(false);
  });
});