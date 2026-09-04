import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import type { User } from "firebase/auth";
import type { AuthContextType } from "@/context/AuthContext";

/* ---------- hoisted mocks ---------- */
const { mockAuthState, mockNavigateComponent } = vi.hoisted(() => ({
  mockAuthState: {
    user: null as User | null,
    status: "unauthenticated",
    hasConflict: false,
    errorMessage: null,
    resolveConflict: vi.fn(),
  } as AuthContextType,
  mockNavigateComponent: vi.fn(),
}));

/* ---------- mock react-router-dom ---------- */
vi.mock("react-router-dom", () => ({
  __esModule: true,
  Navigate: ({ to, replace }: { to: string; replace?: boolean }) => {
    mockNavigateComponent({ to, replace });
    return (
      <div
        data-testid="mock-navigate"
        data-to={to}
        data-replace={String(replace)}
      />
    );
  },
}));

/* ---------- mock useAuth hook ---------- */
vi.mock("@/context/useAuth", () => ({
  __esModule: true,
  useAuth: () => mockAuthState,
}));

/* ---------- component under test ---------- */
import { PublicOnly } from "@/routes/PublicOnly";

describe("PublicOnly Route Guard Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.user = null;
    mockAuthState.status = "unauthenticated";
    mockAuthState.hasConflict = false;
    mockAuthState.errorMessage = null;
  });

  test("renderizza il loader (AuthLoader) quando lo stato di autenticazione è in caricamento ('loading')", () => {
    mockAuthState.status = "loading";

    render(
      <PublicOnly>
        <div data-testid="guest-content">Login Form</div>
      </PublicOnly>
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Caricamento…")).toBeInTheDocument();
    expect(screen.queryByTestId("guest-content")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mock-navigate")).not.toBeInTheDocument();
  });

  test("reindirizza alla pagina '/profilo' con replace quando l'utente è già autenticato ('authenticated')", () => {
    mockAuthState.user = { uid: "usr_flv_2026", email: "flavio@jurio.it" } as unknown as User;
    mockAuthState.status = "authenticated";

    render(
      <PublicOnly>
        <div data-testid="guest-content">Login Form</div>
      </PublicOnly>
    );

    expect(screen.queryByTestId("guest-content")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByTestId("mock-navigate")).toBeInTheDocument();

    expect(mockNavigateComponent).toHaveBeenCalledWith({
      to: "/profilo",
      replace: true,
    });
  });

  test("renderizza i children quando l'utente non è autenticato ('unauthenticated')", () => {
    mockAuthState.user = null;
    mockAuthState.status = "unauthenticated";

    render(
      <PublicOnly>
        <div data-testid="guest-content">Schermata di Accesso Pubblica</div>
      </PublicOnly>
    );

    expect(screen.getByTestId("guest-content")).toBeInTheDocument();
    expect(screen.getByText("Schermata di Accesso Pubblica")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mock-navigate")).not.toBeInTheDocument();
  });
});