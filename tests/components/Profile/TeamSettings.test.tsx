import { describe, test, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import type { Team } from "@/interfaces/interfaces";

/* ---------- tipi mock hook useTeamSettings ---------- */
interface MockTeamSettingsHook {
  name: string;
  setName: Mock<(name: string) => void>;
  isTeamDefault: boolean;
  toggleTeamDefault: Mock<() => void>;
  saving: boolean;
  isSharingAll: boolean;
  isShareConfirmOpen: boolean;
  handleSave: Mock<(e: React.FormEvent) => void>;
  handleShareAllPastDocuments: Mock<() => void>;
  closeShareConfirm: Mock<() => void>;
  executeShareAll: Mock<() => void>;
  deleteTeamAction: Mock<(teamId: string, revokeDocs: boolean) => Promise<void>>;
}

/* ---------- hoisted mocks ---------- */
const { mockNavigate, mockTeamSettingsState } = vi.hoisted(() => ({
  mockNavigate: vi.fn<(to: string) => void>(),
  mockTeamSettingsState: {
    name: "Studio Legale Campaniolo",
    setName: vi.fn<(name: string) => void>(),
    isTeamDefault: true,
    toggleTeamDefault: vi.fn<() => void>(),
    saving: false,
    isSharingAll: false,
    isShareConfirmOpen: false,
    handleSave: vi.fn<(e: React.FormEvent) => void>((e) => e.preventDefault()),
    handleShareAllPastDocuments: vi.fn<() => void>(),
    closeShareConfirm: vi.fn<() => void>(),
    executeShareAll: vi.fn<() => void>(),
    deleteTeamAction: vi.fn<(teamId: string, revokeDocs: boolean) => Promise<void>>(),
  } as MockTeamSettingsHook,
}));

/* ---------- mock react-router-dom ---------- */
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

/* ---------- mock hook useTeamSettings ---------- */
vi.mock("@/hooks/teams", () => ({
  useTeamSettings: () => mockTeamSettingsState,
}));

/* ---------- mock ConfirmModal (dichiarato inline per evitare TDZ) ---------- */
interface MockConfirmModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm: () => void;
  onCancel: () => void;
}

vi.mock("../ConfirmModal", () => ({
  ConfirmModal: ({
    isOpen,
    title,
    message,
    confirmText,
    cancelText,
    onConfirm,
    onCancel,
  }: MockConfirmModalProps) =>
    isOpen ? (
      <div role="dialog" aria-modal="true" data-testid="mock-confirm-modal">
        <h4>{title}</h4>
        <p>{message}</p>
        <button type="button" onClick={onConfirm}>
          {confirmText}
        </button>
        <button type="button" onClick={onCancel}>
          {cancelText}
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/ConfirmModal", () => ({
  ConfirmModal: ({
    isOpen,
    title,
    message,
    confirmText,
    cancelText,
    onConfirm,
    onCancel,
  }: MockConfirmModalProps) =>
    isOpen ? (
      <div role="dialog" aria-modal="true" data-testid="mock-confirm-modal">
        <h4>{title}</h4>
        <p>{message}</p>
        <button type="button" onClick={onConfirm}>
          {confirmText}
        </button>
        <button type="button" onClick={onCancel}>
          {cancelText}
        </button>
      </div>
    ) : null,
}));

/* ---------- mock react-icons/fi ---------- */
vi.mock("react-icons/fi", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid={`fi-${name}`} {...props} />
  );
  return {
    FiSettings: Icon("settings"),
    FiSave: Icon("save"),
    FiShare2: Icon("share-2"),
    FiAlertTriangle: Icon("alert-triangle"),
    FiTrash2: Icon("trash-2"),
  };
});

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => ({
  Loader2: (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid="icon-loader-2" {...props} />
  ),
}));

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", async () => {
  const ReactActual = await import("react");

  const passthrough =
    (Tag: string) =>
    ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLElement> & { [key: string]: unknown }) =>
      ReactActual.createElement(Tag, props, children);

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      section: passthrough("section"),
      div: passthrough("div"),
      span: passthrough("span"),
      svg: passthrough("svg"),
    },
  };
});

/* ---------- component ---------- */
import TeamSettings from "@/components/Profile/TeamSettings"; // <-- adegua il path se necessario

describe("TeamSettings Component Suite", () => {
  const dummyTeam: Team = {
    id: "team-workspace-99",
    name: "Studio Legale Campaniolo",
  } as unknown as Team;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTeamSettingsState.name = "Studio Legale Campaniolo";
    mockTeamSettingsState.isTeamDefault = true;
    mockTeamSettingsState.saving = false;
    mockTeamSettingsState.isSharingAll = false;
    mockTeamSettingsState.isShareConfirmOpen = false;
    mockTeamSettingsState.deleteTeamAction.mockResolvedValue(undefined);

    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = (props: Partial<React.ComponentProps<typeof TeamSettings>> = {}) => {
    const defaultProps: React.ComponentProps<typeof TeamSettings> = {
      team: dummyTeam,
      isManager: true,
      ...props,
    };

    return render(<TeamSettings {...defaultProps} />);
  };

  test("renderizza i campi di configurazione completi per il manager", () => {
    renderComponent({ isManager: true });

    expect(screen.getByRole("heading", { name: /Impostazioni Workspace/i, level: 2 })).toBeInTheDocument();
    expect(
      screen.getByText("Modifica il nome del team e le preferenze di visibilità dei documenti.")
    ).toBeInTheDocument();

    const nameInput = screen.getByRole("textbox");
    expect(nameInput).toHaveValue("Studio Legale Campaniolo");
    expect(nameInput).not.toBeDisabled();

    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.getByText("Visibile al Team di default")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salva Modifiche/i })).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: /Azioni di massa/i, level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Danger Zone/i, level: 3 })).toBeInTheDocument();
  });

  test("disabilita i campi e nasconde le azioni riservate quando isManager è false", () => {
    renderComponent({ isManager: false });

    expect(
      screen.getByText("Visualizza le impostazioni attuali del Workspace (modificabili solo dai manager).")
    ).toBeInTheDocument();

    const nameInput = screen.getByRole("textbox");
    expect(nameInput).toBeDisabled();
    expect(screen.getByRole("checkbox")).toBeDisabled();

    expect(screen.queryByRole("button", { name: /Salva Modifiche/i })).toBeNull();
    expect(screen.queryByRole("heading", { name: /Azioni di massa/i })).toBeNull();
    expect(screen.queryByRole("heading", { name: /Danger Zone/i })).toBeNull();
  });

  test("gestisce la modifica del nome workspace e l'invio del form", () => {
    renderComponent();

    const nameInput = screen.getByRole("textbox");
    fireEvent.change(nameInput, { target: { value: "Studio Legale Associato" } });

    expect(mockTeamSettingsState.setName).toHaveBeenCalledWith("Studio Legale Associato");

    const form = nameInput.closest("form")!;
    fireEvent.submit(form);

    expect(mockTeamSettingsState.handleSave).toHaveBeenCalledTimes(1);
  });

  test("gestisce il toggle della visibilità predefinita dei documenti", () => {
    mockTeamSettingsState.isTeamDefault = false;

    renderComponent();

    expect(screen.getByText("Privato di default")).toBeInTheDocument();

    const checkbox = screen.getByRole("checkbox");
    expect(checkbox).not.toBeChecked();

    fireEvent.click(checkbox);
    expect(mockTeamSettingsState.toggleTeamDefault).toHaveBeenCalledTimes(1);
  });

  test("mostra lo stato di caricamento e disabilita il form durante il salvataggio (saving: true)", () => {
    mockTeamSettingsState.saving = true;

    renderComponent();

    const nameInput = screen.getByRole("textbox");
    expect(nameInput).toBeDisabled();

    const saveButton = screen.getByRole("button", { name: /Salvataggio\.\.\./i });
    expect(saveButton).toBeDisabled();
    expect(screen.getByTestId("icon-loader-2")).toBeInTheDocument();
  });

  test("avvia la condivisione massiva dello storico e gestisce le azioni del ConfirmModal", () => {
    const { rerender } = renderComponent();

    const shareAllBtn = screen.getByRole("button", { name: /Condividi tutto lo storico/i });
    fireEvent.click(shareAllBtn);

    expect(mockTeamSettingsState.handleShareAllPastDocuments).toHaveBeenCalledTimes(1);

    mockTeamSettingsState.isShareConfirmOpen = true;
    rerender(<TeamSettings team={dummyTeam} isManager={true} />);

    const modal = screen.getByTestId("mock-confirm-modal");
    expect(modal).toBeInTheDocument();
    expect(screen.getByText("Condivisione massiva documenti")).toBeInTheDocument();

    // 1. Procedi
    const confirmBtn = screen.getByRole("button", { name: "Procedi" });
    fireEvent.click(confirmBtn);
    expect(mockTeamSettingsState.executeShareAll).toHaveBeenCalledTimes(1);

    // 2. Annulla
    const cancelBtn = screen.getByRole("button", { name: "Annulla" });
    fireEvent.click(cancelBtn);
    expect(mockTeamSettingsState.closeShareConfirm).toHaveBeenCalledTimes(1);
  });

  test("mostra il caricamento sul pulsante di condivisione di massa se isSharingAll è true", () => {
    mockTeamSettingsState.isSharingAll = true;

    renderComponent();

    const shareAllBtn = screen.getByRole("button", { name: /Elaborazione in corso\.\.\./i });
    expect(shareAllBtn).toBeDisabled();
    expect(screen.getByTestId("icon-loader-2")).toBeInTheDocument();
  });

  test("apre la modale di eliminazione del Workspace, permette di annullare e chiude il dialogo", () => {
    renderComponent();

    const openDeleteBtn = screen.getByRole("button", { name: /Elimina Workspace/i });
    fireEvent.click(openDeleteBtn);

    expect(screen.getByRole("heading", { name: "Elimina Workspace", level: 3 })).toBeInTheDocument();

    const cancelBtn = screen.getByRole("button", { name: "Annulla" });
    fireEvent.click(cancelBtn);

    expect(screen.queryByRole("heading", { name: "Elimina Workspace", level: 3 })).toBeNull();
    expect(mockTeamSettingsState.deleteTeamAction).not.toHaveBeenCalled();
  });

  test("esegue l'eliminazione del Workspace trasferendo i documenti e reindirizza a /profilo", async () => {
    renderComponent();

    const openDeleteBtn = screen.getByRole("button", { name: /Elimina Workspace/i });
    fireEvent.click(openDeleteBtn);

    const revokeCheckbox = screen.getAllByRole("checkbox")[1];
    expect(revokeCheckbox).toBeChecked();

    const confirmDeleteBtn = screen.getByRole("button", { name: /Sì, elimina Workspace/i });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(mockTeamSettingsState.deleteTeamAction).toHaveBeenCalledWith(
        "team-workspace-99",
        true
      );
    });

    expect(mockNavigate).toHaveBeenCalledWith("/profilo");
    expect(screen.queryByRole("heading", { name: "Elimina Workspace", level: 3 })).toBeNull();
  });

  test("permette di deselezionare la riassegnazione dei fascicoli prima dell'eliminazione", async () => {
    renderComponent();

    fireEvent.click(screen.getByRole("button", { name: /Elimina Workspace/i }));

    const revokeCheckbox = screen.getAllByRole("checkbox")[1];
    fireEvent.click(revokeCheckbox);
    expect(revokeCheckbox).not.toBeChecked();

    const confirmDeleteBtn = screen.getByRole("button", { name: /Sì, elimina Workspace/i });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(mockTeamSettingsState.deleteTeamAction).toHaveBeenCalledWith(
        "team-workspace-99",
        false
      );
    });
  });

  test("gestisce il fallimento di deleteTeamAction fermando il caricamento", async () => {
    mockTeamSettingsState.deleteTeamAction.mockRejectedValueOnce(new Error("Errore eliminazione"));

    renderComponent();

    fireEvent.click(screen.getByRole("button", { name: /Elimina Workspace/i }));

    const confirmDeleteBtn = screen.getByRole("button", { name: /Sì, elimina Workspace/i });
    fireEvent.click(confirmDeleteBtn);

    await waitFor(() => {
      expect(mockTeamSettingsState.deleteTeamAction).toHaveBeenCalledTimes(1);
    });

    expect(console.error).toHaveBeenCalledWith("Errore eliminazione:", expect.any(Error));
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});