import { describe, test, expect } from "vitest";
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
      loading: false,
      hasConflict: false,
    };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthContext.Provider value={mockContextValue}>
        {children}
      </AuthContext.Provider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.user).toEqual(mockUser);
    expect(result.current.loading).toBe(false);
    expect(result.current.hasConflict).toBe(false);
  });

  test("restituisce i valori predefiniti del contesto se invocato senza Provider esplicito", () => {
    const { result } = renderHook(() => useAuth());

    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(true);
    expect(result.current.hasConflict).toBe(false);
  });

  test("solleva un'eccezione esplicita quando il contesto risolve a valore falsy (null / undefined)", () => {
    const nullWrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthContext.Provider value={null as unknown as AuthContextType}>
        {children}
      </AuthContext.Provider>
    );

    expect(() => renderHook(() => useAuth(), { wrapper: nullWrapper })).toThrow(
      "useAuth must be used within AuthProvider"
    );
  });
});