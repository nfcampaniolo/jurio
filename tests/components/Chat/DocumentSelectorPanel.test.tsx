import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

/* ---------- hoisted shared mocks ---------- */
const { mockUseParams, mockToast } = vi.hoisted(() => ({
  mockUseParams: vi.fn(),
  mockToast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

/* ---------- mock firebase ---------- */
vi.mock("firebase/app", () => ({
  getApp: () => ({}),
  initializeApp: () => ({}),
}));

vi.mock("firebase/auth", () => ({
  getAuth: () => ({
    currentUser: { uid: "test-user-id" },
  }),
}));

/* ---------- mock react-router-dom ---------- */
vi.mock("react-router-dom", () => ({
  useParams: () => mockUseParams(),
}));

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid={`icon-${name}`} {...props} />
  );
  return {
    X: Icon("x"),
    FileText: Icon("file-text"),
    Loader2: Icon("loader-2"),
    Info: Icon("info"),
    Play: Icon("play"),
    UploadCloud: Icon("upload-cloud"),
  };
});

/* ---------- mock react-icons/fa ---------- */
vi.mock("react-icons/fa", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid={`fa-${name}`} {...props} />
  );
  return {
    FaChevronDown: Icon("chevron-down"),
    FaCheck: Icon("check"),
  };
});

/* ---------- mock react-hot-toast ---------- */
vi.mock("react-hot-toast", () => ({
  toast: mockToast,
  default: mockToast,
}));

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", async () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { [key: string]: unknown }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

/* ---------- mock @headlessui/react ---------- */
vi.mock("@headlessui/react", () => ({
  Menu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  MenuButton: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button data-testid="sort-menu-button" {...props}>{children}</button>
  ),
  MenuItems: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div data-testid="sort-menu-items" {...props}>{children}</div>
  ),
  MenuItem: ({ children }: { children: ((bag: { active: boolean }) => React.ReactNode) | React.ReactNode }) => (
    <div>{typeof children === "function" ? children({ active: true }) : children}</div>
  ),
  Transition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

/* ---------- mock DropZoneUploader ---------- */
vi.mock("@/components/Document/DropZoneUploader", () => ({
  DropZoneUploader: (props: {
    pendingFiles: File[];
    onDrag: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    removePendingFile: (index: number) => void;
  }) => (
    <div data-testid="drop-zone-uploader">
      <span data-testid="pending-files-count">{props.pendingFiles.length}</span>
      <button
        data-testid="trigger-drag-enter"
        onClick={() => props.onDrag({ type: "dragenter", preventDefault: () => {}, stopPropagation: () => {} } as unknown as React.DragEvent)}
      >
        DragEnter
      </button>
      <button
        data-testid="trigger-drag-over"
        onClick={() => props.onDrag({ type: "dragover", preventDefault: () => {}, stopPropagation: () => {} } as unknown as React.DragEvent)}
      >
        DragOver
      </button>
      <button
        data-testid="trigger-drag-leave"
        onClick={() => props.onDrag({ type: "dragleave", preventDefault: () => {}, stopPropagation: () => {} } as unknown as React.DragEvent)}
      >
        DragLeave
      </button>
      <button
        data-testid="trigger-drop"
        onClick={() => props.onDrop({
          preventDefault: () => {},
          stopPropagation: () => {},
          dataTransfer: { files: [new File(["content"], "dropped.pdf")] },
        } as unknown as React.DragEvent)}
      >
        Drop
      </button>
      <button
        data-testid="trigger-drop-empty"
        onClick={() => props.onDrop({
          preventDefault: () => {},
          stopPropagation: () => {},
          dataTransfer: { files: [] },
        } as unknown as React.DragEvent)}
      >
        DropEmpty
      </button>
      <button
        data-testid="trigger-file-change"
        onClick={() => props.onFileChange({
          target: { files: [new File(["content2"], "picked.pdf")], value: "fake-path" },
        } as unknown as React.ChangeEvent<HTMLInputElement>)}
      >
        FileChange
      </button>
      <button
        data-testid="trigger-file-change-empty"
        onClick={() => props.onFileChange({
          target: { files: [] },
        } as unknown as React.ChangeEvent<HTMLInputElement>)}
      >
        FileChangeEmpty
      </button>
      <button data-testid="trigger-remove-pending" onClick={() => props.removePendingFile(0)}>
        RemovePending
      </button>
    </div>
  ),
}));

/* ---------- mock DocumentCard ---------- */
vi.mock("@/components/Document/DocumentCard", () => ({
  DocumentCard: (props: {
    doc: { id: string; name: string };
    fallbackIndex: number;
    onToggleDoc: (doc: unknown) => void;
    onToggleFascicoloLink: (doc: unknown) => void;
    openRenameModal: (doc: unknown) => void;
    openDeleteModal: (doc: unknown) => void;
    onErrorLimit: () => void;
  }) => (
    <div data-testid={`document-card-${props.doc.id || props.fallbackIndex}`}>
      <span>{props.doc.name}</span>
      <button data-testid={`toggle-doc-${props.doc.id}`} onClick={() => props.onToggleDoc(props.doc)}>
        Toggle
      </button>
      <button data-testid={`toggle-link-${props.doc.id}`} onClick={() => props.onToggleFascicoloLink(props.doc)}>
        ToggleLink
      </button>
      <button data-testid={`rename-doc-${props.doc.id}`} onClick={() => props.openRenameModal(props.doc)}>
        Rename
      </button>
      <button data-testid={`delete-doc-${props.doc.id}`} onClick={() => props.openDeleteModal(props.doc)}>
        Delete
      </button>
      <button data-testid={`error-limit-${props.doc.id}`} onClick={() => props.onErrorLimit()}>
        ErrorLimit
      </button>
    </div>
  ),
}));

/* ---------- mock DocumentModals ---------- */
vi.mock("@/components/Document/DocumentModals", () => ({
  DocumentModals: (props: {
    isRenameOpen: boolean;
    isDeleteOpen: boolean;
    newName: string;
    setNewName: (name: string) => void;
    handleRenameSubmit: (e: React.FormEvent) => void;
    handleDeleteConfirm: () => void;
    closeRenameModal: () => void;
    closeDeleteModal: () => void;
  }) => (
    <div data-testid="document-modals">
      {props.isRenameOpen && (
        <div data-testid="rename-modal">
          <input
            data-testid="rename-input"
            value={props.newName}
            onChange={(e) => props.setNewName(e.target.value)}
          />
          <button data-testid="rename-submit" onClick={(e) => props.handleRenameSubmit(e)}>
            Submit Rename
          </button>
          <button data-testid="rename-close" onClick={props.closeRenameModal}>
            Close Rename
          </button>
        </div>
      )}
      {props.isDeleteOpen && (
        <div data-testid="delete-modal">
          <button data-testid="delete-confirm" onClick={props.handleDeleteConfirm}>
            Confirm Delete
          </button>
          <button data-testid="delete-close" onClick={props.closeDeleteModal}>
            Close Delete
          </button>
        </div>
      )}
    </div>
  ),
}));

/* ---------- mock PromptSelector ---------- */
vi.mock("@/components/PromptSelector", () => ({
  PromptSelector: (props: { value: string; onChange: (val: string) => void }) => (
    <div data-testid="prompt-selector">
      <input
        data-testid="prompt-selector-input"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
      />
    </div>
  ),
}));

/* ---------- component ---------- */
import { DocumentSelectorPanel } from "@/components/Chat/DocumentSelectorPanel"; // <-- adegua il path se necessario
import type { AttachedDocument } from "@/interfaces/interfaces";

describe("DocumentSelectorPanel", () => {
  const mockOnClose = vi.fn();
  const mockOnToggleDoc = vi.fn();
  const mockOnProcessFiles = vi.fn();
  const mockOnToggleFascicoloLink = vi.fn();
  const mockOnRenameDocumento = vi.fn();
  const mockOnDeleteDocumento = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseParams.mockReturnValue({});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  const sampleArchiveDocs: AttachedDocument[] = [
    {
      id: "doc-1",
      name: "Sentenza Cassazione Civile.pdf",
      dataSentenza: { toDate: () => new Date("2026-01-10T10:00:00Z") },
      fascicoloIds: ["fasc-100"],
    } as unknown as AttachedDocument,
    {
      id: "doc-2",
      name: "Atto di Citazione.pdf",
      dataSentenza: { toDate: () => new Date("2026-02-15T10:00:00Z") },
      fascicoloIds: [],
    } as unknown as AttachedDocument,
    {
      id: "doc-3",
      name: "Memoria 183.pdf",
      dataSentenza: undefined,
      fascicoloIds: ["fasc-100"],
    } as unknown as AttachedDocument,
  ];

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    archiveDocs: sampleArchiveDocs,
    attachedDocs: [],
    onToggleDoc: mockOnToggleDoc,
    onProcessFiles: mockOnProcessFiles,
    onToggleFascicoloLink: mockOnToggleFascicoloLink,
    isLoading: false,
    isProcessing: false,
    onRenameDocumento: mockOnRenameDocumento,
    onDeleteDocumento: mockOnDeleteDocumento,
  };

  test("non renderizza nulla quando isOpen è false", () => {
    render(<DocumentSelectorPanel {...defaultProps} isOpen={false} />);
    expect(screen.queryByText("Documenti Sessione")).not.toBeInTheDocument();
  });

  test("renderizza pannello, gestisce chiusura da header e backdrop", () => {
    const { container } = render(<DocumentSelectorPanel {...defaultProps} />);

    expect(screen.getByText("Documenti Sessione")).toBeInTheDocument();
    expect(screen.getByText("0 / 10 Allegati")).toBeInTheDocument();

    // Chiusura tramite bottone X
    const closeBtn = screen.getByLabelText("Chiudi pannello documenti");
    fireEvent.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    // Chiusura tramite click sul backdrop
    const backdrop = container.querySelector(".fixed.inset-0.bg-black\\/40")!;
    fireEvent.click(backdrop);
    expect(mockOnClose).toHaveBeenCalledTimes(2);
  });

  test("gestisce backdrop click quando isProcessing è true (nessuna chiusura)", () => {
    const { container } = render(<DocumentSelectorPanel {...defaultProps} isProcessing={true} />);

    const backdrop = container.querySelector(".fixed.inset-0.bg-black\\/40")!;
    fireEvent.click(backdrop);
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  test("gestisce drag, drop e selezione file dal DropZoneUploader con limiti", () => {
    render(
      <DocumentSelectorPanel
        {...defaultProps}
        attachedDocs={new Array(9).fill({ id: "d" }) as AttachedDocument[]}
      />
    );

    expect(screen.getByText("9 / 10 Allegati")).toBeInTheDocument();

    // Trigger drag events
    fireEvent.click(screen.getByTestId("trigger-drag-enter"));
    fireEvent.click(screen.getByTestId("trigger-drag-over"));
    fireEvent.click(screen.getByTestId("trigger-drag-leave"));

    // Drop valido (1 file: 9 + 1 = 10)
    fireEvent.click(screen.getByTestId("trigger-drop"));
    expect(screen.getByTestId("pending-files-count")).toHaveTextContent("1");
    expect(screen.getByText("10 / 10 Allegati")).toBeInTheDocument();

    // Drop con superamento limite (10 + 1 > 10)
    fireEvent.click(screen.getByTestId("trigger-drop"));
    expect(mockToast.error).toHaveBeenCalledWith("Puoi allegare al massimo 10 documenti in totale.");

    // Drop vuoto
    fireEvent.click(screen.getByTestId("trigger-drop-empty"));

    // File change vuoto
    fireEvent.click(screen.getByTestId("trigger-file-change-empty"));

    // Rimuovi file pending
    fireEvent.click(screen.getByTestId("trigger-remove-pending"));
    expect(screen.getByTestId("pending-files-count")).toHaveTextContent("0");

    // File change valido
    fireEvent.click(screen.getByTestId("trigger-file-change"));
    expect(screen.getByTestId("pending-files-count")).toHaveTextContent("1");
  });

  test("filtra i documenti tramite la barra di ricerca", () => {
    render(<DocumentSelectorPanel {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText("Cerca documenti...");
    fireEvent.change(searchInput, { target: { value: "Citazione" } });

    expect(screen.getByTestId("document-card-doc-2")).toBeInTheDocument();
    expect(screen.queryByTestId("document-card-doc-1")).not.toBeInTheDocument();
  });

  test("gestisce tutti i criteri di ordinamento (data desc/asc, nome asc/desc)", () => {
    render(<DocumentSelectorPanel {...defaultProps} />);

    const menuButton = screen.getByTestId("sort-menu-button");
    const menuItems = screen.getByTestId("sort-menu-items");

    // Default: data desc ("Più recenti")
    expect(menuButton).toHaveTextContent("Più recenti");

    // 1. Data asc: Meno recenti
    const menoRecentiBtn = screen.getByText("Meno recenti", { selector: "span" });
    fireEvent.click(menoRecentiBtn);
    expect(menuButton).toHaveTextContent("Meno recenti");

    // 2. Nome asc: Nome A–Z
    const nomeAzBtn = screen.getByText("Nome A–Z", { selector: "span" });
    fireEvent.click(nomeAzBtn);
    expect(menuButton).toHaveTextContent("Nome A–Z");

    // 3. Nome desc: Nome Z–A
    const nomeZaBtn = screen.getByText("Nome Z–A", { selector: "span" });
    fireEvent.click(nomeZaBtn);
    expect(menuButton).toHaveTextContent("Nome Z–A");

    // 4. Torna a Più recenti
    const piuRecentiBtn = menuItems.querySelector("span")!;
    fireEvent.click(piuRecentiBtn);
    expect(menuButton).toHaveTextContent("Più recenti");
  });

  test("organizza i documenti tra 'Documenti in questo fascicolo' e 'Altri documenti in archivio'", () => {
    mockUseParams.mockReturnValue({ fascicoloId: "fasc-100" });

    render(<DocumentSelectorPanel {...defaultProps} />);

    expect(screen.getByText("Documenti in questo fascicolo")).toBeInTheDocument();
    expect(screen.getByText("Altri documenti in archivio")).toBeInTheDocument();

    expect(screen.getByTestId("document-card-doc-1")).toBeInTheDocument();
    expect(screen.getByTestId("document-card-doc-3")).toBeInTheDocument();
    expect(screen.getByTestId("document-card-doc-2")).toBeInTheDocument();
  });

  test("gestisce stato di caricamento archivio (isLoading = true)", () => {
    render(<DocumentSelectorPanel {...defaultProps} isLoading={true} />);

    expect(screen.getByText("Sincronizzazione archivio in corso...")).toBeInTheDocument();
    expect(screen.getByTestId("icon-loader-2")).toBeInTheDocument();
  });

  test("gestisce archivio vuoto (archiveDocs = [])", () => {
    render(<DocumentSelectorPanel {...defaultProps} archiveDocs={[]} />);

    expect(
      screen.getByText("Non ci sono ancora documenti salvati nel tuo profilo.")
    ).toBeInTheDocument();
  });

  test("elabora i file in sospeso con PromptSelector e chiude il pannello", async () => {
    mockUseParams.mockReturnValue({ fascicoloId: "fasc-100" });

    render(<DocumentSelectorPanel {...defaultProps} />);

    // Aggiunge un file in pending
    fireEvent.click(screen.getByTestId("trigger-file-change"));

    // PromptSelector visibile
    expect(screen.getByTestId("prompt-selector")).toBeInTheDocument();
    const promptInput = screen.getByTestId("prompt-selector-input");
    fireEvent.change(promptInput, { target: { value: "custom-prompt-1" } });

    // Pulsante Carica ed Elabora
    const processBtn = screen.getByRole("button", { name: /Carica ed Elabora \(1\)/i });
    fireEvent.click(processBtn);

    await waitFor(() => {
      expect(mockOnProcessFiles).toHaveBeenCalledWith(
        expect.any(Array),
        "custom-prompt-1",
        "fasc-100"
      );
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });
  });

  test("chiude semplicemente il pannello se non ci sono file in sospeso", async () => {
    render(<DocumentSelectorPanel {...defaultProps} />);

    const confirmBtn = screen.getByRole("button", { name: "Conferma e chiudi" });
    fireEvent.click(confirmBtn);

    expect(mockOnProcessFiles).not.toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test("gestisce lo stato isProcessing sul bottone di invio", () => {
    render(<DocumentSelectorPanel {...defaultProps} isProcessing={true} />);

    const submitBtn = screen.getByRole("button", { name: /Elaborazione in corso\.\.\./i });
    expect(submitBtn).toBeDisabled();
  });

  test("gestisce il flusso di rinomina documento (apertura, submit, annulla ed errore)", async () => {
    render(<DocumentSelectorPanel {...defaultProps} />);

    // Apri modale rinomina da DocumentCard
    fireEvent.click(screen.getByTestId("rename-doc-doc-1"));
    expect(screen.getByTestId("rename-modal")).toBeInTheDocument();

    const renameInput = screen.getByTestId("rename-input");
    expect(renameInput).toHaveValue("Sentenza Cassazione Civile.pdf");

    // Modifica nome e invia
    fireEvent.change(renameInput, { target: { value: "Nuovo Nome.pdf" } });
    fireEvent.click(screen.getByTestId("rename-submit"));

    await waitFor(() => {
      expect(mockOnRenameDocumento).toHaveBeenCalledWith("doc-1", "Nuovo Nome.pdf");
      expect(screen.queryByTestId("rename-modal")).not.toBeInTheDocument();
    });

    // Riapri e chiudi
    fireEvent.click(screen.getByTestId("rename-doc-doc-1"));
    fireEvent.click(screen.getByTestId("rename-close"));
    expect(screen.queryByTestId("rename-modal")).not.toBeInTheDocument();

    // Submit con input vuoto (early return)
    fireEvent.click(screen.getByTestId("rename-doc-doc-1"));
    fireEvent.change(screen.getByTestId("rename-input"), { target: { value: "   " } });
    fireEvent.click(screen.getByTestId("rename-submit"));

    // Gestione errore onRenameDocumento
    mockOnRenameDocumento.mockRejectedValueOnce(new Error("Rename failed"));
    fireEvent.change(screen.getByTestId("rename-input"), { target: { value: "Valido.pdf" } });
    fireEvent.click(screen.getByTestId("rename-submit"));

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith("Errore rinomina:", expect.any(Error));
    });
  });

  test("gestisce il flusso di eliminazione documento (apertura, conferma, annulla ed errore)", async () => {
    render(<DocumentSelectorPanel {...defaultProps} />);

    // Apri modale eliminazione
    fireEvent.click(screen.getByTestId("delete-doc-doc-2"));
    expect(screen.getByTestId("delete-modal")).toBeInTheDocument();

    // Conferma eliminazione
    fireEvent.click(screen.getByTestId("delete-confirm"));

    await waitFor(() => {
      expect(mockOnDeleteDocumento).toHaveBeenCalledWith("doc-2");
      expect(screen.queryByTestId("delete-modal")).not.toBeInTheDocument();
    });

    // Riapri e chiudi
    fireEvent.click(screen.getByTestId("delete-doc-doc-2"));
    fireEvent.click(screen.getByTestId("delete-close"));
    expect(screen.queryByTestId("delete-modal")).not.toBeInTheDocument();

    // Gestione errore onDeleteDocumento
    mockOnDeleteDocumento.mockRejectedValueOnce(new Error("Delete failed"));
    fireEvent.click(screen.getByTestId("delete-doc-doc-2"));
    fireEvent.click(screen.getByTestId("delete-confirm"));

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith("Errore eliminazione:", expect.any(Error));
    });
  });

  test("collega le callback di DocumentCard per toggle e limite errori", () => {
    render(<DocumentSelectorPanel {...defaultProps} />);

    fireEvent.click(screen.getByTestId("toggle-doc-doc-1"));
    expect(mockOnToggleDoc).toHaveBeenCalledWith(sampleArchiveDocs[0]);

    fireEvent.click(screen.getByTestId("toggle-link-doc-1"));
    expect(mockOnToggleFascicoloLink).toHaveBeenCalledWith(sampleArchiveDocs[0]);

    fireEvent.click(screen.getByTestId("error-limit-doc-1"));
    expect(mockToast.error).toHaveBeenCalledWith("Limite massimo raggiunto.");
  });
});