import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

/* ---------- mock react-router-dom ---------- */
const mockNavigate = vi.fn();
vi.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
}));

/* ---------- mock react-hot-toast ---------- */
vi.mock("react-hot-toast", () => ({
  __esModule: true,
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", () => ({
  __esModule: true,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: React.forwardRef<
      HTMLDivElement,
      React.HTMLAttributes<HTMLDivElement> & { layoutId?: string }
    >(({ children, ...props }, ref) => (
      <div ref={ref} {...props}>
        {children}
      </div>
    )),
  },
}));

/* ---------- mock hooks & navigation ---------- */
const mockDeleteAccount = vi.fn();
let mockProfileReturn = {
  user: { uid: "admin-123" } as unknown,
  loading: false,
  userData: { status: "admin", email: "admin@jurio.it" } as {
    status: string;
    email: string;
  } | null,
  name: "Flavio",
  surname: "Campaniolo",
  avatar: "https://jurio.it/avatar.png",
  deleteAccount: mockDeleteAccount,
};

vi.mock("@/features/profile/hooks/useProfile", () => ({
  __esModule: true,
  useProfile: () => mockProfileReturn,
}));

const mockNavigateItem = vi.fn();
vi.mock("@/routes/navigation", () => ({
  __esModule: true,
  navigateItem: (...args: unknown[]) => mockNavigateItem(...args),
}));

/* ---------- mock services/admin ---------- */
const mockExecuteAdminMaintenanceTask = vi.fn();
const mockExecuteAdminMergeCategoryTask = vi.fn();

vi.mock("@/features/admin/hooks/admin", () => ({
  __esModule: true,
  executeAdminMaintenanceTask: (...args: unknown[]) =>
    mockExecuteAdminMaintenanceTask(...args),
  executeAdminMergeCategoryTask: (...args: unknown[]) =>
    mockExecuteAdminMergeCategoryTask(...args),
}));

/* ---------- mock subcomponents ---------- */
vi.mock("@/features/profile/components/HeaderProfile", () => ({
  __esModule: true,
  HeaderProfile: ({
    name,
    surname,
    actions,
  }: {
    name: string;
    surname: string;
    actions: Array<{ id: string; label: string; onClick: () => void }>;
  }) => (
    <header data-testid="header-profile">
      <span>
        {name} {surname}
      </span>
      {actions.map((act) => (
        <button key={act.id} onClick={act.onClick} data-testid={`action-${act.id}`}>
          {act.label}
        </button>
      ))}
    </header>
  ),
}));

vi.mock("@/features/admin/components//UploadMaxima", () => ({
  __esModule: true,
  UploadMaxima: () => <div data-testid="upload-maxima-section">Upload Maxima Content</div>,
}));

vi.mock("@/features/admin/components//FirebaseManual", () => ({
  __esModule: true,
  default: () => <div data-testid="firebase-manual-section">Firebase Manual Content</div>,
  FirebaseManual: () => (
    <div data-testid="firebase-manual-section">Firebase Manual Content</div>
  ),
}));

vi.mock("@/features/admin/components//AdminTaxonomySection", () => ({
  __esModule: true,
  AdminTaxonomySection: ({
    mergeParams,
    setMergeParams,
    isMerging,
    onMergeSubmit,
  }: {
    mergeParams: { vecchiaCategoria: string; nuovaCategoria: string | null };
    setMergeParams: React.Dispatch<
      React.SetStateAction<{ vecchiaCategoria: string; nuovaCategoria: string | null }>
    >;
    isMerging: boolean;
    onMergeSubmit: () => void;
  }) => (
    <div data-testid="taxonomy-section">
      <input
        placeholder="Vecchia Categoria"
        value={mergeParams.vecchiaCategoria}
        onChange={(e) =>
          setMergeParams({ ...mergeParams, vecchiaCategoria: e.target.value })
        }
      />
      <input
        placeholder="Nuova Categoria"
        value={mergeParams.nuovaCategoria ?? ""}
        onChange={(e) =>
          setMergeParams({ ...mergeParams, nuovaCategoria: e.target.value })
        }
      />
      <button onClick={onMergeSubmit} disabled={isMerging}>
        {isMerging ? "Unificazione in corso..." : "Esegui Unificazione"}
      </button>
    </div>
  ),
}));

vi.mock("@/features/admin/components//AdminMaintenanceSection", () => ({
  __esModule: true,
  AdminMaintenanceSection: ({
    maintenanceParams,
    isUpdating,
    onParamChange,
    onMaintenanceSubmit,
  }: {
    maintenanceParams: Record<string, string>;
    isUpdating: boolean;
    onParamChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onMaintenanceSubmit: () => void;
  }) => (
    <div data-testid="maintenance-section">
      <input
        name="materia"
        placeholder="Materia"
        value={maintenanceParams.materia}
        onChange={onParamChange}
      />
      <button onClick={onMaintenanceSubmit} disabled={isUpdating}>
        {isUpdating ? "Aggiornamento in corso..." : "Avvia Manutenzione"}
      </button>
    </div>
  ),
}));

vi.mock("@/features/admin/components//AdminFooterLinks", () => ({
  __esModule: true,
  AdminFooterLinks: () => <footer data-testid="admin-footer">Admin Footer Links</footer>,
}));

vi.mock("@/shared/components/ConfirmModal", () => ({
  __esModule: true,
  ConfirmModal: ({
    isOpen,
    title,
    onCancel,
    onConfirm,
  }: {
    isOpen: boolean;
    title: string;
    onCancel: () => void;
    onConfirm: () => void;
  }) =>
    isOpen ? (
      <div data-testid="confirm-modal">
        <h2>{title}</h2>
        <button onClick={onCancel}>Annulla</button>
        <button onClick={onConfirm}>Conferma Eliminazione</button>
      </div>
    ) : null,
}));

/* ---------- component ---------- */
import { Admin } from "@/features/admin/Admin";
import { toast } from "react-hot-toast";

describe("Admin Dashboard Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockProfileReturn = {
      user: { uid: "admin-123" },
      loading: false,
      userData: { status: "admin", email: "admin@jurio.it" },
      name: "Flavio",
      surname: "Campaniolo",
      avatar: "https://jurio.it/avatar.png",
      deleteAccount: mockDeleteAccount,
    };
    mockExecuteAdminMaintenanceTask.mockResolvedValue({ success: true });
    mockExecuteAdminMergeCategoryTask.mockResolvedValue({ message: "Unificazione riuscita!" });
  });

  test("mostra lo stato di caricamento quando loading è true o i dati utente non sono disponibili", () => {
    mockProfileReturn.loading = true;
    const { rerender } = render(<Admin />);
    expect(screen.getByText("Caricamento...")).toBeInTheDocument();

    mockProfileReturn.loading = false;
    mockProfileReturn.userData = null;
    rerender(<Admin />);
    expect(screen.getByText("Caricamento...")).toBeInTheDocument();
  });

  test("renderizza HeaderProfile con i dati dell'utente e gestisce le azioni di navigazione", () => {
    render(<Admin />);

    expect(screen.getByTestId("header-profile")).toBeInTheDocument();
    expect(screen.getByText("Flavio Campaniolo")).toBeInTheDocument();

    const chatActionBtn = screen.getByTestId("action-home");
    fireEvent.click(chatActionBtn);
    expect(mockNavigateItem).toHaveBeenCalledWith(
      { type: "route", target: "/chat" },
      mockNavigate
    );

    const searchActionBtn = screen.getByTestId("action-search");
    fireEvent.click(searchActionBtn);
    expect(mockNavigateItem).toHaveBeenCalledWith(
      { type: "route", target: "/ricerca" },
      mockNavigate
    );
  });

  test("renderizza la barra dei tab per gli utenti admin con Upload Massivo attivo di default", () => {
    render(<Admin />);

    expect(screen.getByRole("button", { name: /Upload Massivo/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Contenuti & Prompt/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tassonomia/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Manutenzione DB/i })).toBeInTheDocument();

    expect(screen.getByTestId("upload-maxima-section")).toBeInTheDocument();
  });

  test("non visualizza i tab di amministrazione né i contenuti riservati se l'utente non è admin", () => {
    mockProfileReturn.userData = { status: "user", email: "avvocato@studio.it" };
    render(<Admin />);

    expect(screen.queryByRole("button", { name: /Upload Massivo/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId("upload-maxima-section")).not.toBeInTheDocument();
  });

  test("consente il passaggio da un tab all'altro visualizzando i componenti corrispondenti", () => {
    render(<Admin />);

    // Passa al tab Contenuti & Prompt
    fireEvent.click(screen.getByRole("button", { name: /Contenuti & Prompt/i }));
    expect(screen.getByTestId("firebase-manual-section")).toBeInTheDocument();

    // Passa al tab Tassonomia
    fireEvent.click(screen.getByRole("button", { name: /Tassonomia/i }));
    expect(screen.getByTestId("taxonomy-section")).toBeInTheDocument();

    // Passa al tab Manutenzione DB
    fireEvent.click(screen.getByRole("button", { name: /Manutenzione DB/i }));
    expect(screen.getByTestId("maintenance-section")).toBeInTheDocument();
  });

  test("esegue handleMaintenance con parametri filtrati e mostra il messaggio di successo", async () => {
    render(<Admin />);

    fireEvent.click(screen.getByRole("button", { name: /Manutenzione DB/i }));

    const materiaInput = screen.getByPlaceholderText("Materia");
    fireEvent.change(materiaInput, { target: { name: "materia", value: "Diritto Civile" } });

    const submitBtn = screen.getByRole("button", { name: "Avvia Manutenzione" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockExecuteAdminMaintenanceTask).toHaveBeenCalledWith(
        { materia: "Diritto Civile" },
        expect.any(Function)
      );
      expect(toast.success).toHaveBeenCalledWith("Task di manutenzione completato!");
    });
  });

  test("gestisce gli errori durante la manutenzione DB mostrando un toast di errore", async () => {
    mockExecuteAdminMaintenanceTask.mockRejectedValue(new Error("Errore connessione server"));
    render(<Admin />);

    fireEvent.click(screen.getByRole("button", { name: /Manutenzione DB/i }));
    const submitBtn = screen.getByRole("button", { name: "Avvia Manutenzione" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Errore connessione server");
    });
  });

  test("blocca l'unificazione delle categorie se il campo obbligatorio è vuoto", async () => {
    render(<Admin />);

    fireEvent.click(screen.getByRole("button", { name: /Tassonomia/i }));
    const mergeBtn = screen.getByRole("button", { name: "Esegui Unificazione" });
    fireEvent.click(mergeBtn);

    expect(toast.error).toHaveBeenCalledWith("Compila il campo della categoria da eliminare.");
    expect(mockExecuteAdminMergeCategoryTask).not.toHaveBeenCalled();
  });

  test("esegue l'unificazione delle categorie con successo e resetta i campi", async () => {
    render(<Admin />);

    fireEvent.click(screen.getByRole("button", { name: /Tassonomia/i }));

    const oldCatInput = screen.getByPlaceholderText("Vecchia Categoria");
    const newCatInput = screen.getByPlaceholderText("Nuova Categoria");

    fireEvent.change(oldCatInput, { target: { value: "Civile Vecchio" } });
    fireEvent.change(newCatInput, { target: { value: "Civile 2026" } });

    const mergeBtn = screen.getByRole("button", { name: "Esegui Unificazione" });
    fireEvent.click(mergeBtn);

    await waitFor(() => {
      expect(mockExecuteAdminMergeCategoryTask).toHaveBeenCalledWith(
        "Civile Vecchio",
        "Civile 2026"
      );
      expect(toast.success).toHaveBeenCalledWith("Unificazione riuscita!");
      expect(oldCatInput).toHaveValue("");
    });
  });

  test("gestisce gli errori durante l'unificazione delle categorie", async () => {
    mockExecuteAdminMergeCategoryTask.mockRejectedValue(new Error("Categoria non trovata"));
    render(<Admin />);

    fireEvent.click(screen.getByRole("button", { name: /Tassonomia/i }));

    const oldCatInput = screen.getByPlaceholderText("Vecchia Categoria");
    fireEvent.change(oldCatInput, { target: { value: "Categoria Errata" } });

    const mergeBtn = screen.getByRole("button", { name: "Esegui Unificazione" });
    fireEvent.click(mergeBtn);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Categoria non trovata");
    });
  });
});