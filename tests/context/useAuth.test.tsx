import { describe, test, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import React from "react";
import { AuthContext, type AuthContextType } from "@/context/AuthContext";
import { useAuth } from "@/context/useAuth";
import type { User } from "firebase/auth";

describe("useAuth Hook Suite", () => {
  test("restituisce lo stato di autenticazione quando eseguito all'interno di AuthContext.Provider", () => {
    const mockUser = {
      uid: "usr_flv_2026",
      email: "flavio@jurio.it",
    } as unknown as User;

    const mockContextValue: AuthContextType = {
      user: mockUser,
      status: "authenticated",
      hasConflict: false,
      errorMessage: null,
      resolveConflict: vi.fn(),
    };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthContext.Provider value={mockContextValue}>
        {children}
      </AuthContext.Provider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.status).toBe("authenticated");
    expect(result.current.hasConflict).toBe(false);
    expect(result.current.errorMessage).toBeNull();
    expect(typeof result.current.resolveConflict).toBe("function");
  });

  test("solleva un'eccezione esplicita quando invocato senza un Provider esplicito", () => {
    expect(() => {
      renderHook(() => useAuth());
    }).toThrow("useAuth must be used within AuthProvider");
  });
});