import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import React, { useContext } from "react";
import { AuthContext, type AuthContextType } from "@/context/AuthContext";
import type { User } from "firebase/auth";

// Componente consumer di test per verificare i valori estratti dal contesto
const TestConsumer: React.FC = () => {
  const { user, loading, hasConflict } = useContext(AuthContext);

  return (
    <div>
      <span data-testid="user-status">{user ? user.uid : "no-user"}</span>
      <span data-testid="loading-status">{loading ? "loading" : "idle"}</span>
      <span data-testid="conflict-status">{hasConflict ? "conflict" : "no-conflict"}</span>
    </div>
  );
};

describe("AuthContext Suite", () => {
  test("fornisce i valori di default corretti in assenza di un Provider esplicito", () => {
    render(<TestConsumer />);

    expect(screen.getByTestId("user-status")).toHaveTextContent("no-user");
    expect(screen.getByTestId("loading-status")).toHaveTextContent("loading");
    expect(screen.getByTestId("conflict-status")).toHaveTextContent("no-conflict");
  });

  test("propaga correttamente i valori personalizzati tramite AuthContext.Provider", () => {
    const mockUser = {
      uid: "usr_flv_2026",
      email: "flavio@jurio.it",
    } as unknown as User;

    const customContextValue: AuthContextType = {
      user: mockUser,
      loading: false,
      hasConflict: true,
    };

    render(
      <AuthContext.Provider value={customContextValue}>
        <TestConsumer />
      </AuthContext.Provider>
    );

    expect(screen.getByTestId("user-status")).toHaveTextContent("usr_flv_2026");
    expect(screen.getByTestId("loading-status")).toHaveTextContent("idle");
    expect(screen.getByTestId("conflict-status")).toHaveTextContent("conflict");
  });

  test("aggiorna i consumatori quando il valore del Provider cambia dinamicamente", () => {
    const initialValue: AuthContextType = {
      user: null,
      loading: true,
      hasConflict: false,
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
      loading: false,
      hasConflict: false,
    };

    rerender(
      <AuthContext.Provider value={updatedValue}>
        <TestConsumer />
      </AuthContext.Provider>
    );

    expect(screen.getByTestId("user-status")).toHaveTextContent("usr_updated_999");
    expect(screen.getByTestId("loading-status")).toHaveTextContent("idle");
    expect(screen.getByTestId("conflict-status")).toHaveTextContent("no-conflict");
  });
});