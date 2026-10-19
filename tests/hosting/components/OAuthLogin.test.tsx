import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import  { type ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { OAuthLogin } from "@/features/auth/components/OAuthLogin";
import { useOAuthLogic } from "@/features/auth/hooks/useOAuthLogic";

/* ---------- Mock Sottocomponenti ---------- */
vi.mock("@/features/auth/components/AuthLayout", () => ({
  AuthLayout: ({
    title,
    subtitle,
    children,
  }: {
    title?: string;
    subtitle?: string;
    children: ReactNode;
  }) => (
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

/* ---------- Mock Hook Logica ---------- */
vi.mock("@/features/auth/hooks/useOAuthLogic", () => ({
  useOAuthLogic: vi.fn(),
}));

const mockedUseOAuthLogic = vi.mocked(useOAuthLogic);

describe("OAuthLogin Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setMockOAuthState = (state: Partial<ReturnType<typeof useOAuthLogic>>) => {
    mockedUseOAuthLogic.mockReturnValue({
      authStatus: "unauthenticated",
      isLoading: false,
      isAuthorizing: false,
      error: null,
      ...state,
    } as unknown as ReturnType<typeof useOAuthLogic>);
  };

  test("renderizza la schermata di errore con messaggio custom quando error è presente", () => {
    setMockOAuthState({
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

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Autenticazione Interrotta" })
    ).toBeInTheDocument();
    expect(screen.getByText("Credenziali non valide o scadute.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Ricarica la pagina" })
    ).toBeInTheDocument();
  });

  test("renderizza il messaggio di errore di fallback se authStatus è 'error' senza messaggio specifico", () => {
    setMockOAuthState({
      authStatus: "error",
      isLoading: false,
      isAuthorizing: false,
      error: null,
    });

    render(
      <MemoryRouter>
        <OAuthLogin />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/Si è verificato un errore anomalo durante la verifica delle credenziali/i)
    ).toBeInTheDocument();
  });

  test("renderizza 'Connessione al sistema...' durante il caricamento iniziale", () => {
    setMockOAuthState({
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

    expect(
      screen.getByRole("heading", { level: 2, name: "Connessione al sistema..." })
    ).toBeInTheDocument();
  });

  test("renderizza 'Elaborazione delle credenziali...' quando isAuthorizing è attivo", () => {
    setMockOAuthState({
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

    expect(
      screen.getByRole("heading", { level: 2, name: "Elaborazione delle credenziali..." })
    ).toBeInTheDocument();
  });

  test("renderizza il layout di autenticazione, il form e il pulsante Google quando l'utente non è autenticato", () => {
    setMockOAuthState({
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
    expect(
      screen.getByRole("heading", { level: 1, name: "Accesso alla Piattaforma" })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Autenticati per abilitare le funzionalità avanzate dell'assistente IA per la ricerca giurisprudenziale."
      )
    ).toBeInTheDocument();
    expect(screen.getByTestId("auth-form")).toBeInTheDocument();
    expect(screen.getByTestId("google-button")).toBeInTheDocument();
    expect(screen.getByText("Autenticazione tramite provider")).toBeInTheDocument();
  });

  test("non renderizza nulla se l'utente è autenticato e non è in corso alcuna autorizzazione", () => {
    setMockOAuthState({
      authStatus: "authenticated",
      isLoading: false,
      isAuthorizing: false,
      error: null,
    });

    const { container } = render(
      <MemoryRouter>
        <OAuthLogin />
      </MemoryRouter>
    );

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId("auth-layout")).not.toBeInTheDocument();
  });
});