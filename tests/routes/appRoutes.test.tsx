import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { createMemoryRouter, RouterProvider } from "react-router-dom";

/* ---------- mock dei route guards ---------- */
vi.mock("@/routes/PublicOnly", () => ({
  PublicOnly: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="guard-public-only">{children}</div>
  ),
}));

vi.mock("@/routes/ProtectedRoute", () => ({
  ProtectedRoute: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="guard-protected">{children}</div>
  ),
}));

vi.mock("@/routes/RegistrationRoute", () => ({
  RegistrationRoute: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="guard-registration">{children}</div>
  ),
}));

/* ---------- mock dei componenti lazy (named exports) ---------- */
vi.mock("@/features/search/Tool", () => ({
  Tool: () => <div data-testid="page-tool">Tool Page</div>,
}));

vi.mock("@/features/document/Documento", () => ({
  Documento: () => <div data-testid="page-documento">Documento Page</div>,
}));

vi.mock("@/features/auth/Login", () => ({
  Login: () => <div data-testid="page-login">Login Page</div>,
}));

vi.mock("@/features/auth/Register", () => ({
  Register: () => <div data-testid="page-register">Register Page</div>,
}));

vi.mock("@/features/profile/Profile", () => ({
  Profile: () => <div data-testid="page-profile">Profile Page</div>,
}));

vi.mock("@/features/profile/EditProfile", () => ({
  EditProfile: () => <div data-testid="page-edit-profile">Edit Profile Page</div>,
}));

vi.mock("@/features/plans/Plans", () => ({
  Plans: () => <div data-testid="page-plans">Plans Page</div>,
}));

vi.mock("@/features/admin/Admin", () => ({
  Admin: () => <div data-testid="page-admin">Admin Page</div>,
}));

/* ---------- mock dei componenti lazy (default exports) ---------- */
vi.mock("@/features/plans/Prezzi", () => ({
  default: () => <div data-testid="page-prezzi">Prezzi Page</div>,
}));

vi.mock("@/features/info/Contatti", () => ({
  default: () => <div data-testid="page-contatti">Contatti Page</div>,
}));

vi.mock("@/shared/NotFound", () => ({
  default: () => <div data-testid="page-not-found">404 Not Found</div>,
}));

vi.mock("@/features/auth/Session", () => ({
  default: () => <div data-testid="page-session">Session Page</div>,
}));

vi.mock("@/features/chat/Chat", () => ({
  default: () => <div data-testid="page-chat">Chat Page</div>,
}));

vi.mock("@/features/chat/components/HistoryPage", () => ({
  default: () => <div data-testid="page-history">History Page</div>,
}));

vi.mock("@/features/teams/TeamDashboard", () => ({
  default: () => <div data-testid="page-team-dashboard">Team Dashboard</div>,
}));

vi.mock("@/features/chat/components/FascicoloSetupPage", () => ({
  default: () => <div data-testid="page-fascicolo-setup">Fascicolo Setup</div>,
}));

vi.mock("@/features/prompt/PromptBuilder", () => ({
  default: () => <div data-testid="page-prompt-builder">Prompt Builder</div>,
}));

vi.mock("@/features/guide/components/SupportoWord", () => ({
  default: () => <div data-testid="page-supporto-word">Supporto Word</div>,
}));

vi.mock("@/features/profile/UserUsage", () => ({
  default: () => <div data-testid="page-user-usage">User Usage</div>,
}));

vi.mock("@/features/plans/BillingSuccess", () => ({
  default: () => <div data-testid="page-billing-success">Billing Success</div>,
}));

vi.mock("@/features/plans/BillingCancel", () => ({
  default: () => <div data-testid="page-billing-cancel">Billing Cancel</div>,
}));

vi.mock("@/features/guide/Guida", () => ({
  default: () => <div data-testid="page-guida">Guida Page</div>,
}));

vi.mock("@/features/notifications/NotificationsPage", () => ({
  default: () => <div data-testid="page-notifications">Notifications Page</div>,
}));

/* ---------- subject under test ---------- */
import { appRoutes } from "@/routes/routes"; // adegua il path relativo al file delle rotte

describe("appRoutes Routing Configuration Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderWithRouter = (initialEntry: string) => {
    const router = createMemoryRouter(appRoutes, {
      initialEntries: [initialEntry],
    });
    return render(<RouterProvider router={router} />);
  };

  describe("Rotte Pubbliche e Miste", () => {
    test("renderizza la Tool page sulla root '/' e su '/ricerca'", async () => {
      const { unmount } = renderWithRouter("/");
      await waitFor(() => expect(screen.getByTestId("page-tool")).toBeInTheDocument());
      unmount();

      renderWithRouter("/ricerca");
      await waitFor(() => expect(screen.getByTestId("page-tool")).toBeInTheDocument());
    });

    test("renderizza Prezzi, Contatti e Guida con supporto a parametri slug", async () => {
      const { unmount } = renderWithRouter("/prezzi");
      await waitFor(() => expect(screen.getByTestId("page-prezzi")).toBeInTheDocument());
      unmount();

      renderWithRouter("/guida/ricerca-avanzata");
      await waitFor(() => expect(screen.getByTestId("page-guida")).toBeInTheDocument());
    });

    test("risolve i documenti giurisprudenziali su '/giurisprudenza/:id' e '/documento/:id'", async () => {
      const { unmount } = renderWithRouter("/giurisprudenza/sentenza-123");
      await waitFor(() => expect(screen.getByTestId("page-documento")).toBeInTheDocument());
      unmount();

      renderWithRouter("/documento/sentenza-456");
      await waitFor(() => expect(screen.getByTestId("page-documento")).toBeInTheDocument());
    });
  });

  describe("Rotte Guest-Only (PublicOnly & RegistrationRoute)", () => {
    test("avvolge la rotta '/login' all'interno del guard PublicOnly", async () => {
      renderWithRouter("/login");

      await waitFor(() => {
        expect(screen.getByTestId("guard-public-only")).toBeInTheDocument();
        expect(screen.getByTestId("page-login")).toBeInTheDocument();
      });
    });

    test("avvolge la rotta '/registrati' all'interno del guard RegistrationRoute", async () => {
      renderWithRouter("/registrati");

      await waitFor(() => {
        expect(screen.getByTestId("guard-registration")).toBeInTheDocument();
        expect(screen.getByTestId("page-register")).toBeInTheDocument();
      });
    });
  });

  describe("Rotte Protette (ProtectedRoute)", () => {
    test("isola le aree profilo e amministrazione dietro ProtectedRoute", async () => {
      const { unmount } = renderWithRouter("/profilo");
      await waitFor(() => {
        expect(screen.getByTestId("guard-protected")).toBeInTheDocument();
        expect(screen.getByTestId("page-profile")).toBeInTheDocument();
      });
      unmount();

      renderWithRouter("/admin");
      await waitFor(() => {
        expect(screen.getByTestId("guard-protected")).toBeInTheDocument();
        expect(screen.getByTestId("page-admin")).toBeInTheDocument();
      });
    });

    test("risolve la chat contestuale e i fascicoli nidificati (/fascicolo/:id/:threadId?)", async () => {
      const { unmount } = renderWithRouter("/chat/session-999");
      await waitFor(() => {
        expect(screen.getByTestId("guard-protected")).toBeInTheDocument();
        expect(screen.getByTestId("page-chat")).toBeInTheDocument();
      });
      unmount();

      renderWithRouter("/fascicolo/fasc-123/thread-456");
      await waitFor(() => {
        expect(screen.getByTestId("guard-protected")).toBeInTheDocument();
        expect(screen.getByTestId("page-chat")).toBeInTheDocument();
      });
    });
  });

  describe("Rotte Fallback (404 Not Found)", () => {
    test("intercetta percorsi inesistenti e renderizza il componente NotFound", async () => {
      renderWithRouter("/percorso-sconosciuto-o-errato");

      await waitFor(() => {
        expect(screen.getByTestId("page-not-found")).toBeInTheDocument();
      });
    });
  });
});