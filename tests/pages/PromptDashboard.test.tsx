import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

/* ---------- hoisted mocks ---------- */
const {
  mockHandleOpenCreator,
  mockHandleBackToList,
  mockRequestDelete,
  mockConfirmDelete,
  mockCancelDelete,
} = vi.hoisted(() => ({
  mockHandleOpenCreator: vi.fn(),
  mockHandleBackToList: vi.fn(),
  mockRequestDelete: vi.fn(),
  mockConfirmDelete: vi.fn(),
  mockCancelDelete: vi.fn(),
}));

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", () => ({
  __esModule: true,
  AnimatePresence: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  useReducedMotion: vi.fn(() => false),
  motion: {
    div: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
      ({ children, ...props }, ref) => (
        <div ref={ref} {...props}>
          {children}
        </div>
      )
    ),
  },
}));

/* ---------- mock subcomponents ---------- */
type PromptItem = { id: string; title: string };
type TemplateItem = { id: string; name: string };

vi.mock("@/components/Profile/PromptList", () => ({
  __esModule: true,
  PromptList: ({
    prompts,
    isLoading,
    onCreateNew,
    onDelete,
  }: {
    prompts: PromptItem[];
    isLoading: boolean;
    onCreateNew: () => void;
    onDelete: (id: string) => void;
  }) => (
    <div data-testid="prompt-list" data-loading={isLoading}>
      <button type="button" data-testid="btn-create-new" onClick={onCreateNew}>
        Nuovo Prompt
      </button>
      {prompts.map((p) => (
        <div key={p.id} data-testid={`prompt-item-${p.id}`}>
          <span>{p.title}</span>
          <button
            type="button"
            data-testid={`btn-delete-${p.id}`}
            onClick={() => onDelete(p.id)}
          >
            Elimina
          </button>
        </div>
      ))}
    </div>
  ),
}));

vi.mock("@/components/Profile/PromptCreator", () => ({
  __esModule: true,
  PromptCreator: ({
    onBack,
    template,
  }: {
    onBack: () => void;
    template: TemplateItem | null;
  }) => (
    <div data-testid="prompt-creator">
      <span>{template ? `Template: ${template.name}` : "Nessun Template"}</span>
      <button type="button" data-testid="btn-back-to-list" onClick={onBack}>
        Torna alla lista
      </button>
    </div>
  ),
}));

vi.mock("@/components/ConfirmModal", () => ({
  __esModule: true,
  ConfirmModal: ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
  }: {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    isOpen ? (
      <div data-testid="confirm-modal">
        <h2>{title}</h2>
        <p>{message}</p>
        <button type="button" onClick={onCancel} data-testid="btn-modal-cancel">
          Annulla
        </button>
        <button type="button" onClick={onConfirm} data-testid="btn-modal-confirm">
          Elimina
        </button>
      </div>
    ) : null,
}));

/* ---------- mock usePromptDashboard hook ---------- */
type PromptDashboardState = {
  view: "list" | "create";
  prompts: PromptItem[];
  isLoading: boolean;
  selectedTemplate: TemplateItem | null;
  isDeleteModalOpen: boolean;
  handleOpenCreator: () => void;
  handleBackToList: () => void;
  requestDelete: (id: string) => void;
  confirmDelete: () => void;
  cancelDelete: () => void;
};

let mockDashboardState: PromptDashboardState = {
  view: "list",
  prompts: [
    { id: "p1", title: "Atto di Citazione" },
    { id: "p2", title: "Ricorso per Decreto Ingiuntivo" },
  ],
  isLoading: false,
  selectedTemplate: null,
  isDeleteModalOpen: false,
  handleOpenCreator: mockHandleOpenCreator,
  handleBackToList: mockHandleBackToList,
  requestDelete: mockRequestDelete,
  confirmDelete: mockConfirmDelete,
  cancelDelete: mockCancelDelete,
};

vi.mock("@/hooks/usePromptGenerator", () => ({
  __esModule: true,
  usePromptDashboard: () => mockDashboardState,
}));

/* ---------- component under test ---------- */
import { PromptDashboard } from "@/pages/PromptBuilder"; // <-- adegua il path se necessario

describe("PromptDashboard Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = "";
    mockDashboardState = {
      view: "list",
      prompts: [
        { id: "p1", title: "Atto di Citazione" },
        { id: "p2", title: "Ricorso per Decreto Ingiuntivo" },
      ],
      isLoading: false,
      selectedTemplate: null,
      isDeleteModalOpen: false,
      handleOpenCreator: mockHandleOpenCreator,
      handleBackToList: mockHandleBackToList,
      requestDelete: mockRequestDelete,
      confirmDelete: mockConfirmDelete,
      cancelDelete: mockCancelDelete,
    };
  });

  test("renderizza PromptList con la lista dei prompt quando view è 'list'", () => {
    render(<PromptDashboard />);

    expect(screen.getByTestId("prompt-list")).toBeInTheDocument();
    expect(screen.getByText("Atto di Citazione")).toBeInTheDocument();
    expect(screen.getByText("Ricorso per Decreto Ingiuntivo")).toBeInTheDocument();
    expect(screen.queryByTestId("prompt-creator")).not.toBeInTheDocument();
  });

  test("gestisce la creazione e la richiesta di eliminazione dalla lista dei prompt", () => {
    render(<PromptDashboard />);

    // Click nuovo prompt
    fireEvent.click(screen.getByTestId("btn-create-new"));
    expect(mockHandleOpenCreator).toHaveBeenCalledTimes(1);

    // Click eliminazione prompt specifico
    fireEvent.click(screen.getByTestId("btn-delete-p1"));
    expect(mockRequestDelete).toHaveBeenCalledWith("p1");
  });

  test("renderizza PromptCreator con i dati del template quando view è 'create'", () => {
    mockDashboardState.view = "create";
    mockDashboardState.selectedTemplate = {
      id: "tpl_1",
      name: "Schema Memoria Difensiva",
    };

    render(<PromptDashboard />);

    expect(screen.getByTestId("prompt-creator")).toBeInTheDocument();
    expect(screen.getByText("Template: Schema Memoria Difensiva")).toBeInTheDocument();
    expect(screen.queryByTestId("prompt-list")).not.toBeInTheDocument();

    // Click per tornare indietro
    fireEvent.click(screen.getByTestId("btn-back-to-list"));
    expect(mockHandleBackToList).toHaveBeenCalledTimes(1);
  });

  test("apre automaticamente il creator e pulisce l'hash quando URL contiene '#crea'", () => {
    window.location.hash = "#crea";
    const replaceStateSpy = vi.spyOn(window.history, "replaceState");

    render(<PromptDashboard />);

    expect(mockHandleOpenCreator).toHaveBeenCalledTimes(1);
    expect(replaceStateSpy).toHaveBeenCalledWith(
      null,
      "",
      window.location.pathname + window.location.search
    );

    replaceStateSpy.mockRestore();
  });

  test("mostra ConfirmModal e inoltra conferme o annullamenti quando isDeleteModalOpen è true", () => {
    mockDashboardState.isDeleteModalOpen = true;

    render(<PromptDashboard />);

    expect(screen.getByTestId("confirm-modal")).toBeInTheDocument();
    expect(screen.getByText("Elimina Prompt Personalizzato")).toBeInTheDocument();
    expect(
      screen.getByText(
        "Confermi l'eliminazione definitiva del prompt dal tuo archivio? La rimozione interromperà le automazioni collegate a questo schema di analisi."
      )
    ).toBeInTheDocument();

    // Click Annulla
    fireEvent.click(screen.getByTestId("btn-modal-cancel"));
    expect(mockCancelDelete).toHaveBeenCalledTimes(1);

    // Click Conferma Eliminazione
    fireEvent.click(screen.getByTestId("btn-modal-confirm"));
    expect(mockConfirmDelete).toHaveBeenCalledTimes(1);
  });
});