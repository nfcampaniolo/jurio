import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

/* ---------- mock route guards ---------- */
vi.mock("@/routes/PublicOnly", () => ({
  __esModule: true,
  PublicOnly: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="guard-public-only">{children}</div>
  ),
}));

vi.mock("@/routes/ProtectedRoute", () => ({
  __esModule: true,
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="guard-protected">{children}</div>
  ),
}));

vi.mock("@/routes/RegistrationRoute", () => ({
  __esModule: true,
  RegistrationRoute: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="guard-registration">{children}</div>
  ),
}));

/* ---------- mock providers & utility components ---------- */
vi.mock("@/context/AuthProvider", () => ({
  __esModule: true,
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="auth-provider">{children}</div>
  ),
}));

vi.mock("@/components/ScrollToTop", () => ({
  __esModule: true,
  default: () => <div data-testid="scroll-to-top" />,
}));

/* ---------- mock lazy pages (named exports) ---------- */
vi.mock("@/pages/Tool", () => ({
  __esModule: true,
  Tool: () => <div data-testid="page-tool">Tool Page</div>,
}));

vi.mock("@/pages/Login", () => ({
  __esModule: true,
  Login: () => <div data-testid="page-login">Login Page</div>,
}));

vi.mock("@/pages/Register", () => ({
  __esModule: true,
  Register: () => <div data-testid="page-register">Register Page</div>,
}));

vi.mock("@/pages/Profile", () => ({
  __esModule: true,
  Profile: () => <div data-testid="page-profile">Profile Page</div>,
}));

vi.mock("@/pages/EditProfile", () => ({
  __esModule: true,
  EditProfile: () => <div data-testid="page-edit-profile">Edit Profile Page</div>,
}));

vi.mock("@/pages/Plans", () => ({
  __esModule: true,
  Plans: () => <div data-testid="page-plans">Plans Page</div>,
}));

vi.mock("@/pages/Admin", () => ({
  __esModule: true,
  Admin: () => <div data-testid="page-admin">Admin Page</div>,
}));

/* ---------- mock lazy pages (default exports) ---------- */
vi.mock("@/pages/Prezzi", () => ({
  __esModule: true,
  default: () => <div data-testid="page-prezzi">Prezzi Page</div>,
}));

vi.mock("@/pages/Contatti", () => ({
  __esModule: true,
  default: () => <div data-testid="page-contatti">Contatti Page</div>,
}));

vi.mock("@/pages/NotFound", () => ({
  __esModule: true,
  default: () => <div data-testid="page-not-found">NotFound Page</div>,
}));

vi.mock("@/pages/Session", () => ({
  __esModule: true,
  default: () => <div data-testid="page-session">Session Page</div>,
}));

vi.mock("@/pages/Chat", () => ({
  __esModule: true,
  default: () => <div data-testid="page-chat">Chat Page</div>,
}));

vi.mock("@/pages/HistoryPage", () => ({
  __esModule: true,
  default: () => <div data-testid="page-history">History Page</div>,
}));

vi.mock("@/pages/TeamDashboard", () => ({
  __esModule: true,
  default: () => <div data-testid="page-team-dashboard">TeamDashboard Page</div>,
}));

vi.mock("@/components/Chat/FascicoloSetupPage", () => ({
  __esModule: true,
  default: () => <div data-testid="page-fascicolo-setup">Fascicolo Setup Page</div>,
}));

vi.mock("@/pages/PromptBuilder", () => ({
  __esModule: true,
  default: () => <div data-testid="page-prompt-builder">PromptBuilder Page</div>,
}));

vi.mock("@/pages/SupportoWord", () => ({
  __esModule: true,
  default: () => <div data-testid="page-supporto-word">SupportoWord Page</div>,
}));

vi.mock("@/pages/UserUsage", () => ({
  __esModule: true,
  default: () => <div data-testid="page-user-usage">UserUsage Page</div>,
}));

vi.mock("@/pages/BillingSuccess", () => ({
  __esModule: true,
  default: () => <div data-testid="page-billing-success">BillingSuccess Page</div>,
}));

vi.mock("@/pages/BillingCancel", () => ({
  __esModule: true,
  default: () => <div data-testid="page-billing-cancel">BillingCancel Page</div>,
}));

vi.mock("@/pages/Guida", () => ({
  __esModule: true,
  default: () => <div data-testid="page-guida">Guida Page</div>,
}));

vi.mock("@/pages/NotificationsPage", () => ({
  __esModule: true,
  default: () => <div data-testid="page-notifications">Notifications Page</div>,
}));

/* ---------- component under test ---------- */
import App from "@/App";

const navigateTo = (path: string) => {
  window.history.pushState({}, "Test Page", path);
};

describe("App Routing Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Rotte Pubbliche", () => {
    test("renderizza Tool sulla rotta root '/'", async () => {
      navigateTo("/");
      render(<App />);

      expect(await screen.findByTestId("page-tool")).toBeInTheDocument();
      expect(screen.getByTestId("scroll-to-top")).toBeInTheDocument();
    });

    test("renderizza Prezzi su '/prezzi'", async () => {
      navigateTo("/prezzi");
      render(<App />);

      expect(await screen.findByTestId("page-prezzi")).toBeInTheDocument();
    });

    test("renderizza Contatti su '/contatti'", async () => {
      navigateTo("/contatti");
      render(<App />);

      expect(await screen.findByTestId("page-contatti")).toBeInTheDocument();
    });

    test("renderizza Session su '/sessione-attiva'", async () => {
      navigateTo("/sessione-attiva");
      render(<App />);

      expect(await screen.findByTestId("page-session")).toBeInTheDocument();
    });

    test("renderizza SupportoWord su '/supporto-word'", async () => {
      navigateTo("/supporto-word");
      render(<App />);

      expect(await screen.findByTestId("page-supporto-word")).toBeInTheDocument();
    });

    test("renderizza Guida su '/guida' e '/guida/:slug'", async () => {
      navigateTo("/guida");
      const { unmount } = render(<App />);
      expect(await screen.findByTestId("page-guida")).toBeInTheDocument();
      unmount();

      navigateTo("/guida/ricerca-avanzata");
      render(<App />);
      expect(await screen.findByTestId("page-guida")).toBeInTheDocument();
    });

    test("renderizza BillingCancel su '/billing/cancel'", async () => {
      navigateTo("/billing/cancel");
      render(<App />);

      expect(await screen.findByTestId("page-billing-cancel")).toBeInTheDocument();
    });
  });

  describe("Rotte Guest Only (Autenticazione)", () => {
    test("renderizza Login avvolto da PublicOnly su '/login'", async () => {
      navigateTo("/login");
      render(<App />);

      expect(await screen.findByTestId("page-login")).toBeInTheDocument();
      expect(screen.getByTestId("guard-public-only")).toBeInTheDocument();
    });

    test("renderizza Register avvolto da RegistrationRoute su '/registrati'", async () => {
      navigateTo("/registrati");
      render(<App />);

      expect(await screen.findByTestId("page-register")).toBeInTheDocument();
      expect(screen.getByTestId("guard-registration")).toBeInTheDocument();
    });
  });

  describe("Rotte Miste / Tool & Ricerca", () => {
    test("renderizza Tool su '/ricerca'", async () => {
      navigateTo("/ricerca");
      render(<App />);

      expect(await screen.findByTestId("page-tool")).toBeInTheDocument();
    });

    test("renderizza Tool su rotte parametriche '/giurisprudenza/:id' e '/documento/:id'", async () => {
      navigateTo("/giurisprudenza/sentenza-123");
      const { unmount } = render(<App />);
      expect(await screen.findByTestId("page-tool")).toBeInTheDocument();
      unmount();

      navigateTo("/documento/doc-456");
      render(<App />);
      expect(await screen.findByTestId("page-tool")).toBeInTheDocument();
    });

    test("renderizza Chat su '/chat'", async () => {
      navigateTo("/chat");
      render(<App />);

      expect(await screen.findByTestId("page-chat")).toBeInTheDocument();
    });
  });

  describe("Rotte Protette (ProtectedRoute)", () => {
    test("renderizza Profile su '/profilo'", async () => {
      navigateTo("/profilo");
      render(<App />);

      expect(await screen.findByTestId("page-profile")).toBeInTheDocument();
      expect(screen.getByTestId("guard-protected")).toBeInTheDocument();
    });

    test("renderizza EditProfile su '/profilo/modifica'", async () => {
      navigateTo("/profilo/modifica");
      render(<App />);

      expect(await screen.findByTestId("page-edit-profile")).toBeInTheDocument();
      expect(screen.getByTestId("guard-protected")).toBeInTheDocument();
    });

    test("renderizza Plans su '/profilo/piani'", async () => {
      navigateTo("/profilo/piani");
      render(<App />);

      expect(await screen.findByTestId("page-plans")).toBeInTheDocument();
    });

    test("renderizza TeamDashboard su '/profilo/team'", async () => {
      navigateTo("/profilo/team");
      render(<App />);

      expect(await screen.findByTestId("page-team-dashboard")).toBeInTheDocument();
    });

    test("renderizza UserUsage su '/profilo/utilizzi'", async () => {
      navigateTo("/profilo/utilizzi");
      render(<App />);

      expect(await screen.findByTestId("page-user-usage")).toBeInTheDocument();
    });

    test("renderizza PromptBuilder su '/profilo/prompt-builder'", async () => {
      navigateTo("/profilo/prompt-builder");
      render(<App />);

      expect(await screen.findByTestId("page-prompt-builder")).toBeInTheDocument();
    });

    test("renderizza Admin su '/admin'", async () => {
      navigateTo("/admin");
      render(<App />);

      expect(await screen.findByTestId("page-admin")).toBeInTheDocument();
    });

    test("renderizza NotificationsPage su '/notifiche'", async () => {
      navigateTo("/notifiche");
      render(<App />);

      expect(await screen.findByTestId("page-notifications")).toBeInTheDocument();
    });

    test("renderizza BillingSuccess su '/billing/success'", async () => {
      navigateTo("/billing/success");
      render(<App />);

      expect(await screen.findByTestId("page-billing-success")).toBeInTheDocument();
    });

    test("renderizza Chat su '/chat/:chatId' e '/fascicolo/:fascicoloId/:threadId?'", async () => {
      navigateTo("/chat/chat-789");
      const { unmount } = render(<App />);
      expect(await screen.findByTestId("page-chat")).toBeInTheDocument();
      unmount();

      navigateTo("/fascicolo/fasc-10/thread-20");
      render(<App />);
      expect(await screen.findByTestId("page-chat")).toBeInTheDocument();
    });

    test("renderizza FascicoloSetupPage su '/crea-nuovo-fascicolo'", async () => {
      navigateTo("/crea-nuovo-fascicolo");
      render(<App />);

      expect(await screen.findByTestId("page-fascicolo-setup")).toBeInTheDocument();
    });

    test("renderizza HistoryPage su '/storico'", async () => {
      navigateTo("/storico");
      render(<App />);

      expect(await screen.findByTestId("page-history")).toBeInTheDocument();
    });
  });

  describe("Fallback 404", () => {
    test("renderizza NotFound su qualsiasi rotta non censita", async () => {
      navigateTo("/rotta-totalmente-inesistente-404");
      render(<App />);

      expect(await screen.findByTestId("page-not-found")).toBeInTheDocument();
    });
  });
});