import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { AuthContext, type AuthContextType } from "@/context/AuthContext";
import type { User } from "firebase/auth";

/* ---------- hoisted mocks ---------- */
const { mockNavigateComponent, mockUseLocation } = vi.hoisted(() => ({
  mockNavigateComponent: vi.fn(),
  mockUseLocation: vi.fn(() => ({
    pathname: "/profilo",
    search: "",
    hash: "",
    state: null,
    key: "test-key",
  })),
}));

/* ---------- mock react-router-dom ---------- */
vi.mock("react-router-dom", () => ({
  __esModule: true,
  useLocation: () => mockUseLocation(),
  Navigate: ({
    to,
    replace,
    state,
  }: {
    to: string;
    replace?: boolean;
    state?: unknown;
  }) => {
    mockNavigateComponent({ to, replace, state });
    return (
      <div
        data-testid="mock-navigate"
        data-to={to}
        data-replace={String(replace)}
      />
    );
  },
}));

/* ---------- component under test ---------- */
import { ProtectedRoute } from "@/routes/ProtectedRoute"; 

describe("ProtectedRoute Route Guard Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseLocation.mockReturnValue({
      pathname: "/profilo",
      search: "",
      hash: "",
      state: null,
      key: "test-key",
    });
  });

  // Helper per soddisfare i requisiti della nuova interfaccia AuthContextType
  const baseContext: Partial<AuthContextType> = {
    errorMessage: null,
    resolveConflict: vi.fn(),
  };

  const renderWithAuth = (
    contextValue: Partial<AuthContextType>,
    children: React.ReactNode = <div data-testid="protected-content">Contenuto Protetto</div>
  ) => {
    return render(
      <AuthContext.Provider value={{ ...baseContext, ...contextValue } as AuthContextType}>
        <ProtectedRoute>{children}</ProtectedRoute>
      </AuthContext.Provider>
    );
  };

  test("mostra il componente di caricamento quando lo status è 'loading'", () => {
    renderWithAuth({
      user: null,
      status: "loading",
      hasConflict: false,
    });

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Caricamento…")).toBeInTheDocument();
    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mock-navigate")).not.toBeInTheDocument();
  });

  test("reindirizza a '/sessione-attiva' con replace quando hasConflict è true", () => {
    renderWithAuth({
      user: { uid: "usr_flv_2026" } as User,
      status: "authenticated",
      hasConflict: true,
    });

    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
    expect(screen.getByTestId("mock-navigate")).toBeInTheDocument();

    expect(mockNavigateComponent).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/sessione-attiva",
        replace: true,
      })
    );
  });

  test("reindirizza a '/login' preservando la location corrente in state.from quando lo status è 'unauthenticated'", () => {
    const currentLocation = {
      pathname: "/profilo/piani",
      search: "?ref=upgrade",
      hash: "",
      state: null,
      key: "location-key-1",
    };
    mockUseLocation.mockReturnValue(currentLocation);

    renderWithAuth({
      user: null,
      status: "unauthenticated",
      hasConflict: false,
    });

    expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument();
    expect(screen.getByTestId("mock-navigate")).toBeInTheDocument();

    expect(mockNavigateComponent).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "/login",
        replace: true,
        state: { from: currentLocation },
      })
    );
  });

  test("renderizza i children quando l'utente è autenticato e non ci sono conflitti né caricamenti", () => {
    const mockUser = {
      uid: "usr_flv_2026",
      email: "flavio@jurio.it",
    } as User;

    renderWithAuth(
      {
        user: mockUser,
        status: "authenticated",
        hasConflict: false,
      },
      <div data-testid="protected-dashboard">Pannello Utente Jurio</div>
    );

    expect(screen.getByTestId("protected-dashboard")).toBeInTheDocument();
    expect(screen.getByText("Pannello Utente Jurio")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-navigate")).not.toBeInTheDocument();
  });
});