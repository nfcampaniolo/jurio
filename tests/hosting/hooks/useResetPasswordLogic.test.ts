import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const { mockVerify, mockConfirm, params } = vi.hoisted(() => ({
  mockVerify: vi.fn(),
  mockConfirm: vi.fn(),
  params: { value: new URLSearchParams() },
}));

vi.mock("@/features/auth/hooks/auth", () => ({
  verifyResetCode: mockVerify,
  confirmNewPassword: mockConfirm,
}));
vi.mock("react-router-dom", () => ({ useSearchParams: () => [params.value] }));

import { useResetPasswordLogic } from "@/features/auth/hooks/useResetPasswordLogic";

describe("useResetPasswordLogic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    params.value = new URLSearchParams("mode=resetPassword&oobCode=CODE");
  });

  it("senza codice mostra subito link non valido", () => {
    params.value = new URLSearchParams();
    const { result } = renderHook(() => useResetPasswordLogic());
    expect(result.current.phase).toBe("invalid");
    expect(mockVerify).not.toHaveBeenCalled();
  });

  it("verifica il codice e mostra il form con l'email", async () => {
    mockVerify.mockResolvedValue("user@example.test");
    const { result } = renderHook(() => useResetPasswordLogic());

    await waitFor(() => expect(result.current.phase).toBe("form"));
    expect(result.current.email).toBe("user@example.test");
    expect(mockVerify).toHaveBeenCalledWith("CODE");
  });

  it("codice scaduto -> invalid", async () => {
    mockVerify.mockRejectedValue(Object.assign(new Error("x"), { code: "auth/expired-action-code" }));
    const { result } = renderHook(() => useResetPasswordLogic());
    await waitFor(() => expect(result.current.phase).toBe("invalid"));
  });

  it("blocca password deboli o non coincidenti, poi salva", async () => {
    mockVerify.mockResolvedValue("user@example.test");
    mockConfirm.mockResolvedValue(undefined);
    const { result } = renderHook(() => useResetPasswordLogic());
    await waitFor(() => expect(result.current.phase).toBe("form"));

    act(() => result.current.setPassword("debole"));
    expect(result.current.canSubmit).toBe(false);

    act(() => {
      result.current.setPassword("Abcdef1!");
      result.current.setConfirm("Abcdef1?");
    });
    expect(result.current.mismatch).toBe(true);
    expect(result.current.canSubmit).toBe(false);

    act(() => result.current.setConfirm("Abcdef1!"));
    expect(result.current.canSubmit).toBe(true);

    await act(async () => {
      await result.current.submit();
    });
    expect(mockConfirm).toHaveBeenCalledWith("CODE", "Abcdef1!");
    expect(result.current.phase).toBe("done");
  });

  it("errore generico al salvataggio -> messaggio e resta sul form", async () => {
    mockVerify.mockResolvedValue("user@example.test");
    mockConfirm.mockRejectedValue(Object.assign(new Error("net"), { code: "auth/network-request-failed" }));
    const { result } = renderHook(() => useResetPasswordLogic());
    await waitFor(() => expect(result.current.phase).toBe("form"));

    act(() => {
      result.current.setPassword("Abcdef1!");
      result.current.setConfirm("Abcdef1!");
    });
    await act(async () => {
      await result.current.submit();
    });

    expect(result.current.phase).toBe("form");
    expect(result.current.error).toMatch(/Riprova/);
  });
});
