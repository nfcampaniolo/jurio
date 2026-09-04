import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

import type { User } from "firebase/auth";
import type { AuthContextType } from "@/context/AuthContext";

/* ---------- hoisted mocks ---------- */
const { mockAuthState, mockNavigateComponent, mockUserExists } = vi.hoisted(() => ({
  mockAuthState: {
    user: null as User | null,
    status: 'loading', // Ora usiamo lo status esplicito
    hasConflict: false,
    errorMessage: null,
    resolveConflict: vi.fn(),
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
vi.mock("@/shared/services/user", () => ({
  __esModule: true,
  userExists: (uid: string) => mockUserExists(uid),
}));

/* ---------- mock ErrorScreen component ---------- */
vi.mock("@/shared/components/ErrorScreen", () => ({
  __esModule: true,
  ErrorScreen: ({ message, details }: { message: string, details?: string }) => (
    <div data-testid="error-screen">
      <span>{message}</span>
      {details && <span>{details}</span>}
    </div>
  ),
}));

/* ---------- component under test ---------- */
import { RegistrationRoute } from "@/routes/RegistrationRoute";

describe("RegistrationRoute Route Guard Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.user = null;
    mockAuthState.status = 'loading';
    mockAuthState.hasConflict = false;
    mockAuthState.errorMessage = null;
    mockUserExists.mockResolvedValue(false);
  });

  test("mostra AuthLoader quando Firebase è in stato di inizializzazione (status: 'loading')", () => {
    mockAuthState.status = 'loading';

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

  test("renderizza immediatamente i children per utenti guest non autenticati (status: 'unauthenticated')", () => {
    mockAuthState.user = null;
    mockAuthState.status = 'unauthenticated';

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
    mockAuthState.status = 'authenticated';
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
    mockAuthState.status = 'authenticated';
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
    mockAuthState.status = 'authenticated';
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

  test("BLOCCA l'accesso mostrando ErrorScreen se la verifica su Firestore fallisce per errore di rete", async () => {
    mockAuthState.user = { uid: "usr_flv_2026" } as unknown as User;
    mockAuthState.status = 'authenticated';
    mockUserExists.mockRejectedValue(new Error("Timeout Firestore"));

    render(
      <RegistrationRoute>
        <div data-testid="register-form">Form Registrazione</div>
      </RegistrationRoute>
    );

    await waitFor(() => {
      expect(screen.getByTestId("error-screen")).toBeInTheDocument();
    });

    // Assicuriamoci che venga mostrato l'errore e NON il form (Risoluzione del falso negativo)
    expect(screen.getByText(/Errore di rete/i)).toBeInTheDocument();
    expect(screen.queryByTestId("register-form")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mock-navigate")).not.toBeInTheDocument();
  });

  test("BLOCCA l'accesso se il context di autenticazione globale è in stato di errore", () => {
    mockAuthState.user = null;
    mockAuthState.status = 'error';
    mockAuthState.errorMessage = "Token revocato";

    render(
      <RegistrationRoute>
        <div data-testid="register-form">Form Registrazione</div>
      </RegistrationRoute>
    );

    expect(screen.getByTestId("error-screen")).toBeInTheDocument();
    expect(screen.getByText(/Errore di connessione/i)).toBeInTheDocument();
    expect(screen.getByText("Token revocato")).toBeInTheDocument();
    expect(screen.queryByTestId("register-form")).not.toBeInTheDocument();
  });
});