import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import type { User } from "firebase/auth";
import type { AuthContextType } from "@/context/AuthContext";

/* ---------- hoisted mocks ---------- */
const { mockAuthState, mockNavigateComponent, mockUserExists } = vi.hoisted(() => ({
  mockAuthState: {
    user: null as User | null,
    loading: false,
    hasConflict: false,
  } as AuthContextType,
  mockNavigateComponent: vi.fn(),
  mockUserExists: vi.fn(),
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

/* ---------- mock user service ---------- */
vi.mock("@/services/user", () => ({
  __esModule: true,
  userExists: (uid: string) => mockUserExists(uid),
}));

/* ---------- component under test ---------- */
import { RegistrationRoute } from "@/routes/RegistrationRoute";

describe("RegistrationRoute Route Guard Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.user = null;
    mockAuthState.loading = false;
    mockAuthState.hasConflict = false;
    mockUserExists.mockResolvedValue(false);
  });

  test("mostra AuthLoader quando Firebase è in stato di inizializzazione della sessione (loading: true)", () => {
    mockAuthState.loading = true;

    render(
      <RegistrationRoute>
        <div data-testid="register-form">Form Registrazione</div>
      </RegistrationRoute>
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Caricamento…")).toBeInTheDocument();
    expect(screen.queryByTestId("register-form")).not.toBeInTheDocument();
    expect(mockUserExists).not.toHaveBeenCalled();
  });

  test("renderizza immediatamente i children per utenti guest non autenticati senza interrogare Firestore", () => {
    mockAuthState.user = null;
    mockAuthState.loading = false;

    render(
      <RegistrationRoute>
        <div data-testid="register-form">Form Registrazione</div>
      </RegistrationRoute>
    );

    expect(screen.getByTestId("register-form")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mock-navigate")).not.toBeInTheDocument();
    expect(mockUserExists).not.toHaveBeenCalled();
  });

  test("mostra AuthLoader mentre è in corso la verifica del profilo su Firestore", () => {
    mockAuthState.user = { uid: "usr_flv_2026" } as unknown as User;
    mockUserExists.mockImplementation(() => new Promise(() => {})); // Promise pendente

    render(
      <RegistrationRoute>
        <div data-testid="register-form">Form Registrazione</div>
      </RegistrationRoute>
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Caricamento…")).toBeInTheDocument();
    expect(screen.queryByTestId("register-form")).not.toBeInTheDocument();
    expect(mockUserExists).toHaveBeenCalledWith("usr_flv_2026");
  });

  test("reindirizza a '/profilo' con replace se l'utente è autenticato e ha già un profilo completato su Firestore", async () => {
    mockAuthState.user = { uid: "usr_flv_2026" } as unknown as User;
    mockUserExists.mockResolvedValue(true);

    render(
      <RegistrationRoute>
        <div data-testid="register-form">Form Registrazione</div>
      </RegistrationRoute>
    );

    await waitFor(() => {
      expect(screen.getByTestId("mock-navigate")).toBeInTheDocument();
    });

    expect(mockNavigateComponent).toHaveBeenCalledWith({
      to: "/profilo",
      replace: true,
    });
    expect(screen.queryByTestId("register-form")).not.toBeInTheDocument();
  });

  test("renderizza i children se l'utente è autenticato in Auth ma non ha ancora un record profilo su Firestore", async () => {
    mockAuthState.user = { uid: "usr_new_2026" } as unknown as User;
    mockUserExists.mockResolvedValue(false);

    render(
      <RegistrationRoute>
        <div data-testid="register-form">Form Completamento Profilo</div>
      </RegistrationRoute>
    );

    await waitFor(() => {
      expect(screen.getByTestId("register-form")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("mock-navigate")).not.toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  test("consente l'accesso al form se la verifica su Firestore fallisce (catch handler)", async () => {
    mockAuthState.user = { uid: "usr_flv_2026" } as unknown as User;
    mockUserExists.mockRejectedValue(new Error("Firestore lookup error"));

    render(
      <RegistrationRoute>
        <div data-testid="register-form">Form Registrazione</div>
      </RegistrationRoute>
    );

    await waitFor(() => {
      expect(screen.getByTestId("register-form")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("mock-navigate")).not.toBeInTheDocument();
  });
});