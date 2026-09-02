import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import type { Action } from "@/interfaces/interfaces";

/* ---------- hoisted mocks ---------- */
const { mockNavigate, mockNavigateItem, mockLogout, mockToast } = vi.hoisted(() => {
  const toastFn = vi.fn();
  return {
    mockNavigate: vi.fn(),
    mockNavigateItem: vi.fn(),
    mockLogout: vi.fn().mockResolvedValue(undefined),
    mockToast: Object.assign(toastFn, {
      success: vi.fn(),
      error: vi.fn(),
    }),
  };
});

/* ---------- mock react-router-dom ---------- */
vi.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
}));

/* ---------- mock react-hot-toast ---------- */
vi.mock("react-hot-toast", () => ({
  __esModule: true,
  toast: mockToast,
  default: mockToast,
}));

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", () => ({
  __esModule: true,
  motion: {
    section: React.forwardRef<
      HTMLElement,
      React.HTMLAttributes<HTMLElement> & {
        initial?: unknown;
        animate?: unknown;
        transition?: unknown;
      }
    >(({ children, ...props }, ref) => (
      <section ref={ref} {...props}>
        {children}
      </section>
    )),
  },
}));

/* ---------- mock navigation helper ---------- */
vi.mock("@/hooks/navigation", () => ({
  __esModule: true,
  navigateItem: (...args: unknown[]) => mockNavigateItem(...args),
}));

/* ---------- mock auth service ---------- */
vi.mock("@/services/auth", () => ({
  __esModule: true,
  logout: () => mockLogout(),
}));

/* ---------- mock subcomponents ---------- */
vi.mock("@/components/Profile/HeaderProfile", () => ({
  __esModule: true,
  HeaderProfile: ({
    name,
    surname,
    avatar,
    actions,
  }: {
    name: string;
    surname: string;
    avatar: string;
    actions: Action[];
  }) => (
    <header data-testid="header-profile">
      <span>
        {name} {surname}
      </span>
      <img src={avatar} alt="User Avatar" />
      <div data-testid="actions-container">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            data-testid={`btn-action-${action.id}`}
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ))}
      </div>
    </header>
  ),
}));

vi.mock("@/components/Profile/UploadSentences", () => ({
  __esModule: true,
  Upload: () => <div data-testid="upload-sentences">Upload Sentenze Component</div>,
}));

vi.mock("@/components/Document/YourDocument.tsx", () => ({
  __esModule: true,
  YourDocument: () => <div data-testid="your-document">I Tuoi Documenti Component</div>,
}));

vi.mock("@/components/ConfirmModal", () => ({
  __esModule: true,
  ConfirmModal: ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    onExport,
  }: {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    onExport?: () => void;
  }) =>
    isOpen ? (
      <div data-testid="confirm-modal">
        <h2>{title}</h2>
        <p>{message}</p>
        <button type="button" onClick={onExport} data-testid="btn-modal-export">
          Esporta
        </button>
        <button type="button" onClick={onCancel} data-testid="btn-modal-cancel">
          Annulla
        </button>
        <button type="button" onClick={onConfirm} data-testid="btn-modal-confirm">
          Elimina Account
        </button>
      </div>
    ) : null,
}));

/* ---------- mock useProfile hook ---------- */
const mockDeleteAccount = vi.fn();
const mockExportAccount = vi.fn();

let mockProfileState = {
  user: { uid: "usr_flv_2026" } as { uid: string } | null,
  loading: false,
  userData: { role: "avvocato", email: "flavio@jurio.it" } as {
    role: string;
    email: string;
  } | null,
  name: "Flavio",
  surname: "Campaniolo",
  avatar: "https://jurio.it/avatar.webp",
  deleteAccount: mockDeleteAccount,
  exportAccount: mockExportAccount,
};

vi.mock("@/hooks/useProfile", () => ({
  __esModule: true,
  useProfile: () => mockProfileState,
}));

/* ---------- component under test ---------- */
import { Profile } from "@/pages/Profile";

describe("Profile Page Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfileState = {
      user: { uid: "usr_flv_2026" },
      loading: false,
      userData: { role: "avvocato", email: "flavio@jurio.it" },
      name: "Flavio",
      surname: "Campaniolo",
      avatar: "https://jurio.it/avatar.webp",
      deleteAccount: mockDeleteAccount,
      exportAccount: mockExportAccount,
    };
  });

  test("mostra lo stato di caricamento quando loading è true o i dati utente non sono disponibili", () => {
    mockProfileState.loading = true;
    const { rerender } = render(<Profile />);
    expect(screen.getByText("Caricamento...")).toBeInTheDocument();

    mockProfileState.loading = false;
    mockProfileState.user = null;
    rerender(<Profile />);
    expect(screen.getByText("Caricamento...")).toBeInTheDocument();

    mockProfileState.user = { uid: "usr_flv_2026" };
    mockProfileState.userData = null;
    rerender(<Profile />);
    expect(screen.getByText("Caricamento...")).toBeInTheDocument();
  });

  test("renderizza HeaderProfile con i dati anagrafici, i componenti Upload, YourDocument e i link legali", () => {
    render(<Profile />);

    expect(screen.getByTestId("header-profile")).toBeInTheDocument();
    expect(screen.getByText("Flavio Campaniolo")).toBeInTheDocument();
    expect(screen.getByTestId("upload-sentences")).toBeInTheDocument();
    expect(screen.getByTestId("your-document")).toBeInTheDocument();

    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Termini" })).toHaveAttribute("href", "/termini");
    expect(screen.getByRole("link", { name: "Trattamento dati" })).toHaveAttribute("href", "/gdpr");
  });

  test("gestisce le azioni di routing tramite navigateItem e navigate diretto", () => {
    render(<Profile />);

    // Ricerca Giurisprudenza
    fireEvent.click(screen.getByTestId("btn-action-search"));
    expect(mockNavigateItem).toHaveBeenCalledWith(
      { type: "route", target: "/ricerca" },
      mockNavigate
    );

    // Consulente Legale / Chat
    fireEvent.click(screen.getByTestId("btn-action-chat"));
    expect(mockNavigateItem).toHaveBeenCalledWith(
      { type: "route", target: "/chat" },
      mockNavigate
    );

    // Piani
    fireEvent.click(screen.getByTestId("btn-action-pricing"));
    expect(mockNavigate).toHaveBeenCalledWith("/profilo/piani");

    // Modifica Profilo
    fireEvent.click(screen.getByTestId("btn-action-edit"));
    expect(mockNavigate).toHaveBeenCalledWith("/profilo/modifica");

    // Utilizzi
    fireEvent.click(screen.getByTestId("btn-action-utilizzi"));
    expect(mockNavigate).toHaveBeenCalledWith("/profilo/utilizzi");

    // Workspace / Team
    fireEvent.click(screen.getByTestId("btn-action-team"));
    expect(mockNavigate).toHaveBeenCalledWith("/profilo/team");
  });

  test("esegue il logout asincrono e naviga verso '/login'", async () => {
    render(<Profile />);

    fireEvent.click(screen.getByTestId("btn-action-logout"));

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
    });
  });

  test("gestisce il flusso di esportazione dati e cancellazione account tramite ConfirmModal", async () => {
    render(<Profile />);

    expect(screen.queryByTestId("confirm-modal")).not.toBeInTheDocument();

    // Apertura modale
    fireEvent.click(screen.getByTestId("btn-action-delete"));
    expect(screen.getByTestId("confirm-modal")).toBeInTheDocument();

    // Esportazione dati
    fireEvent.click(screen.getByTestId("btn-modal-export"));
    expect(mockExportAccount).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith("Preparazione esportazione dati...");

    // Annullamento
    fireEvent.click(screen.getByTestId("btn-modal-cancel"));
    expect(screen.queryByTestId("confirm-modal")).not.toBeInTheDocument();

    // Riapertura e Conferma eliminazione
    fireEvent.click(screen.getByTestId("btn-action-delete"));
    fireEvent.click(screen.getByTestId("btn-modal-confirm"));

    expect(mockDeleteAccount).toHaveBeenCalledTimes(1);
    expect(mockToast.success).toHaveBeenCalledWith("Profilo eliminato con successo");
    expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
    expect(screen.queryByTestId("confirm-modal")).not.toBeInTheDocument();
  });
});