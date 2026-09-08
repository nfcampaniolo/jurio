import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { OAuthLogin } from "@/features/auth/components/OAuthLogin";
import { useOAuthLogic } from "@/features/auth/hooks/useOAuthLogic";

vi.mock("@/features/auth/hooks/useOAuthLogic", () => ({
  useOAuthLogic: vi.fn(),
}));

vi.mock("@/features/auth/components/AuthLayout", () => ({
  AuthLayout: ({ title, subtitle, children }: { title?: string; subtitle?: string; children: React.ReactNode }) => (
    <div data-testid="auth-layout">
      {title && <h1>{title}</h1>}
      {subtitle && <p>{subtitle}</p>}
      {children}
    </div>
  ),
}));

vi.mock("@/features/auth/components/AuthForm", () => ({
  AuthForm: () => <div data-testid="auth-form">AuthForm Mock</div>,
}));

vi.mock("@/features/auth/components/GoogleButton", () => ({
  GoogleButton: () => <button data-testid="google-button">Google Login</button>,
}));

const mockedUseOAuthLogic = vi.mocked(useOAuthLogic);

describe("OAuthLogin Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza la schermata di errore se lo stato è 'error' o viene fornito un errore", () => {
    mockedUseOAuthLogic.mockReturnValue({
      authStatus: "error",
      isLoading: false,
      isAuthorizing: false,
      error: "Credenziali non valide o scadute.",
    });

    render(
      <MemoryRouter>
        <OAuthLogin />
      </MemoryRouter>
    );

    expect(screen.getByText("Errore")).toBeInTheDocument();
    expect(screen.getByText("Credenziali non valide o scadute.")).toBeInTheDocument();
  });

  test("renderizza il messaggio di verifica in corso durante il caricamento standard", () => {
    mockedUseOAuthLogic.mockReturnValue({
      authStatus: "loading",
      isLoading: true,
      isAuthorizing: false,
      error: null,
    });

    render(
      <MemoryRouter>
        <OAuthLogin />
      </MemoryRouter>
    );

    expect(screen.getByText("Verifica in corso...")).toBeInTheDocument();
  });

  test("renderizza il messaggio di autorizzazione in corso se isLoading e isAuthorizing sono veri", () => {
    mockedUseOAuthLogic.mockReturnValue({
      authStatus: "loading",
      isLoading: true,
      isAuthorizing: true,
      error: null,
    });

    render(
      <MemoryRouter>
        <OAuthLogin />
      </MemoryRouter>
    );

    expect(screen.getByText("Autorizzazione in corso...")).toBeInTheDocument();
  });

  test("renderizza il layout di autenticazione, il form e il pulsante Google quando l'utente non è autenticato", () => {
    mockedUseOAuthLogic.mockReturnValue({
      authStatus: "unauthenticated",
      isLoading: false,
      isAuthorizing: false,
      error: null,
    });

    render(
      <MemoryRouter>
        <OAuthLogin />
      </MemoryRouter>
    );

    expect(screen.getByTestId("auth-layout")).toBeInTheDocument();
    expect(screen.getByText("Collega l'Assistente IA")).toBeInTheDocument();
    expect(screen.getByText("Accedi per autorizzare l'Intelligenza Artificiale ad utilizzare la ricerca giuridica.")).toBeInTheDocument();
    expect(screen.getByTestId("auth-form")).toBeInTheDocument();
    expect(screen.getByTestId("google-button")).toBeInTheDocument();
    expect(screen.getByText("oppure")).toBeInTheDocument();
  });

  test("renderizza lo spinner di autorizzazione in corso quando l'utente è autenticato in attesa di redirect", () => {
    mockedUseOAuthLogic.mockReturnValue({
      authStatus: "authenticated",
      isLoading: false,
      isAuthorizing: false,
      error: null,
    });

    render(
      <MemoryRouter>
        <OAuthLogin />
      </MemoryRouter>
    );

    expect(screen.getByText("Autorizzazione in corso...")).toBeInTheDocument();
    expect(screen.queryByTestId("auth-layout")).not.toBeInTheDocument();
  });
});