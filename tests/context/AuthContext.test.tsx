import { describe, test, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React, { useContext } from "react";
import { AuthContext, type AuthContextType } from "@/context/AuthContext";
import type { User } from "firebase/auth";

// Componente consumer di test per verificare i valori estratti dal contesto
const TestConsumer: React.FC = () => {
  const context = useContext(AuthContext);
  
  if (!context) {
    return <span data-testid="no-provider">No Provider</span>;
  }

  const { user, status, hasConflict, errorMessage } = context;

  return (
    <div>
      <span data-testid="user-status">{user ? user.uid : "no-user"}</span>
      <span data-testid="loading-status">{status}</span>
      <span data-testid="conflict-status">{hasConflict ? "conflict" : "no-conflict"}</span>
      <span data-testid="error-status">{errorMessage || "no-error"}</span>
    </div>
  );
};

describe("AuthContext Suite", () => {
  test("restituisce undefined (gestito dal consumer) in assenza di un Provider esplicito", () => {
    render(<TestConsumer />);

    expect(screen.getByTestId("no-provider")).toHaveTextContent("No Provider");
  });

  test("propaga correttamente i valori personalizzati tramite AuthContext.Provider", () => {
    const mockUser = {
      uid: "usr_flv_2026",
      email: "flavio@jurio.it",
    } as unknown as User;

    const customContextValue: AuthContextType = {
      user: mockUser,
      status: "authenticated",
      hasConflict: true,
      errorMessage: null,
      resolveConflict: vi.fn(),
    };

    render(
      <AuthContext.Provider value={customContextValue}>
        <TestConsumer />
      </AuthContext.Provider>
    );

    expect(screen.getByTestId("user-status")).toHaveTextContent("usr_flv_2026");
    expect(screen.getByTestId("loading-status")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("conflict-status")).toHaveTextContent("conflict");
  });

  test("aggiorna i consumatori quando il valore del Provider cambia dinamicamente", () => {
    const initialValue: AuthContextType = {
      user: null,
      status: "loading",
      hasConflict: false,
      errorMessage: null,
      resolveConflict: vi.fn(),
    };

    const { rerender } = render(
      <AuthContext.Provider value={initialValue}>
        <TestConsumer />
      </AuthContext.Provider>
    );

    expect(screen.getByTestId("user-status")).toHaveTextContent("no-user");
    expect(screen.getByTestId("loading-status")).toHaveTextContent("loading");

    const updatedUser = {
      uid: "usr_updated_999",
    } as unknown as User;

    const updatedValue: AuthContextType = {
      user: updatedUser,
      status: "authenticated",
      hasConflict: false,
      errorMessage: null,
      resolveConflict: vi.fn(),
    };

    rerender(
      <AuthContext.Provider value={updatedValue}>
        <TestConsumer />
      </AuthContext.Provider>
    );

    expect(screen.getByTestId("user-status")).toHaveTextContent("usr_updated_999");
    expect(screen.getByTestId("loading-status")).toHaveTextContent("authenticated");
    expect(screen.getByTestId("conflict-status")).toHaveTextContent("no-conflict");
  });
});