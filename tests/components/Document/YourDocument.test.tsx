import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import type { DocumentoGiurisprudenziale } from "@/interfaces/interfaces";

/* ---------- hoisted mocks ---------- */
const {
  mockToast,
  mockAuthUser,
  mockUploadedDocsState,
  mockSavedDocsState,
} = vi.hoisted(() => {
  const toastSuccess = vi.fn();
  const toastError = vi.fn();
  const toastFn = Object.assign(vi.fn(), {
    success: toastSuccess,
    error: toastError,
  });

  const mockAuthUser = { uid: "current-user-123" };

  const mockUploadedDocsState = {
    documents: [] as DocumentoGiurisprudenziale[],
    loading: false,
    error: null as string | null,
    reload: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    deleteDocumento: vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined),
    handleRenameDocumento: vi.fn<(id: string, name: string) => Promise<void>>().mockResolvedValue(undefined),
  };

  const mockSavedDocsState = {
    savedSentenze: [] as DocumentoGiurisprudenziale[],
    loading: false,
    error: null as string | null,
    isUnauthorized: false,
    fetchSentences: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    unsaveSentence: vi.fn<(id: string) => Promise<void>>().mockResolvedValue(undefined),
  };

  return {
    mockToast: toastFn,
    mockAuthUser,
    mockUploadedDocsState,
    mockSavedDocsState,
  };
});

/* ---------- mock react-hot-toast ---------- */
vi.mock("react-hot-toast", () => ({
  __esModule: true,
  toast: mockToast,
  default: mockToast,
}));

/* ---------- mock auth context ---------- */
vi.mock("@/context/useAuth", () => ({
  __esModule: true,
  useAuth: () => ({
    user: mockAuthUser,
  }),
}));

/* ---------- mock useDocuments hooks ---------- */
vi.mock("@/hooks/useDocuments", () => ({
  __esModule: true,
  useDocuments: () => mockUploadedDocsState,
  useSavedSentenze: () => mockSavedDocsState,
}));

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => ({
  __esModule: true,
  Loader2: ({ className }: { className?: string }) => (
    <svg data-testid="loader-spinner" className={className} />
  ),
}));

/* ---------- mock react-icons/fa ---------- */
vi.mock("react-icons/fa", () => ({
  __esModule: true,
  FaFileAlt: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="fa-file-alt" {...props} />,
  FaChevronDown: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="fa-chevron-down" {...props} />,
  FaCheck: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="fa-check" {...props} />,
  FaBalanceScale: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="fa-balance-scale" {...props} />,
}));

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", () => ({
  __esModule: true,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
  },
}));

/* ---------- mock @headlessui/react ---------- */
vi.mock("@headlessui/react", () => ({
  __esModule: true,
  Menu: Object.assign(
    ({ children }: { children: React.ReactNode }) => <div data-testid="headless-menu">{children}</div>,
    {
      Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
        <button {...props}>{children}</button>
      ),
      Items: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
        <div {...props}>{children}</div>
      ),
      Item: ({ children }: { children: (props: { active: boolean }) => React.ReactNode }) => (
        <div>{children({ active: false })}</div>
      ),
    }
  ),
  Transition: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

/* ---------- mock componenti figli ---------- */
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
      <div data-testid="mock-confirm-modal">
        <h3>{title}</h3>
        <p>{message}</p>
        <button onClick={onConfirm}>Conferma Rifiuto/Elimina</button>
        <button onClick={onCancel}>Annulla</button>
      </div>
    ) : null,
}));

vi.mock("@/components/AccessDenied", () => ({
  __esModule: true,
  AccessDenied: () => <div data-testid="mock-access-denied">Accesso Negato</div>,
}));

vi.mock("@/components/Document/YourDocumentCard", () => ({
  __esModule: true,
  DocumentCard: ({
    doc,
    isOwner,
    onOpen,
    onRemove,
    onRename,
  }: {
    doc: DocumentoGiurisprudenziale;
    isOwner: boolean;
    onOpen: (doc: DocumentoGiurisprudenziale) => void;
    onRemove: (e: React.MouseEvent, doc: DocumentoGiurisprudenziale) => void;
    onRename: (e: React.MouseEvent, doc: DocumentoGiurisprudenziale) => void;
  }) => (
    <div data-testid={`mock-doc-card-${doc.id}`}>
      <span>{doc.nome_file || doc.organo_giudicante}</span>
      <span>Owner: {isOwner ? "true" : "false"}</span>
      <button onClick={() => onOpen(doc)}>Apri Documento</button>
      <button onClick={(e) => onRename(e, doc)}>Rinomina</button>
      <button onClick={(e) => onRemove(e, doc)}>Elimina</button>
    </div>
  ),
}));

vi.mock("@/components/Document/YourDocumentRenameModal", () => ({
  __esModule: true,
  DocumentRenameModal: ({
    isOpen,
    newName,
    setNewName,
    onClose,
    onSubmit,
  }: {
    isOpen: boolean;
    newName: string;
    setNewName: (name: string) => void;
    onClose: () => void;
    onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  }) =>
    isOpen ? (
      <div data-testid="mock-rename-modal">
        <form onSubmit={onSubmit}>
          <input
            data-testid="rename-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <button type="submit">Salva Rinomina</button>
          <button type="button" onClick={onClose}>
            Chiudi Rinomina
          </button>
        </form>
      </div>
    ) : null,
}));

/* ---------- component ---------- */
import { YourDocument } from "@/components/Document/YourDocument";

describe("YourDocument Component Suite", () => {
  const originalOpen = window.open;
  const mockWindowOpen = vi.fn();

  const dummyUploadedDocs: DocumentoGiurisprudenziale[] = [
    {
      id: "doc-1",
      nome_file: "Sentenza_Contrattuale_2026.pdf",
      massima: "Inadempimento e clausola penale.",
      data_sentenza: "2026-05-10",
      user: "current-user-123",
    } as unknown as DocumentoGiurisprudenziale,
    {
      id: "doc-2",
      nome_file: "Parere_Due_Diligence.pdf",
      massima: "Valutazione rischi societari.",
      data_sentenza: "2026-06-15",
      user: "colleague-user-456",
    } as unknown as DocumentoGiurisprudenziale,
  ];

  const dummySavedDocs: DocumentoGiurisprudenziale[] = [
    {
      id: "saved-1",
      organo_giudicante: "Corte di Cassazione",
      numero_sentenza: "9988/2026",
      massima: "Responsabilità civile extracontrattuale.",
      data_sentenza: "2026-01-20",
      user: "current-user-123",
    } as unknown as DocumentoGiurisprudenziale,
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    window.open = mockWindowOpen;
    window.innerWidth = 1024;

    mockUploadedDocsState.documents = [...dummyUploadedDocs];
    mockUploadedDocsState.loading = false;
    mockUploadedDocsState.error = null;

    mockSavedDocsState.savedSentenze = [...dummySavedDocs];
    mockSavedDocsState.loading = false;
    mockSavedDocsState.error = null;
    mockSavedDocsState.isUnauthorized = false;
  });

  afterEach(() => {
    window.open = originalOpen;
    vi.restoreAllMocks();
  });

  test("renderizza i documenti caricati suddividendoli tra Personali e Condivisi dal Team", () => {
    render(<YourDocument />);

    expect(
      screen.getByRole("heading", { name: "I tuoi documenti elaborati", level: 1 })
    ).toBeInTheDocument();

    expect(screen.getByText("I tuoi documenti")).toBeInTheDocument();
    expect(screen.getByTestId("mock-doc-card-doc-1")).toBeInTheDocument();
    expect(screen.getByText("Owner: true")).toBeInTheDocument();

    expect(screen.getByText("Documenti condivisi dal Team")).toBeInTheDocument();
    expect(screen.getByTestId("mock-doc-card-doc-2")).toBeInTheDocument();
    expect(screen.getByText("Owner: false")).toBeInTheDocument();
  });

  test("passa alla modalità 'Salvati' e visualizza le sentenze archiviate", () => {
    render(<YourDocument />);

    const savedTabBtn = screen.getByRole("button", { name: "Salvati" });
    fireEvent.click(savedTabBtn);

    expect(
      screen.getByRole("heading", { name: "Il tuo archivio salvati", level: 1 })
    ).toBeInTheDocument();

    expect(screen.getByTestId("mock-doc-card-saved-1")).toBeInTheDocument();
    expect(screen.getByText("Corte di Cassazione")).toBeInTheDocument();
  });

  test("mostra lo stato di caricamento (loading spinner)", () => {
    mockUploadedDocsState.loading = true;

    render(<YourDocument />);

    expect(screen.getByTestId("loader-spinner")).toBeInTheDocument();
    expect(
      screen.getByText("Caricamento documenti in corso…")
    ).toBeInTheDocument();
  });

  test("mostra il messaggio di errore quando presente", () => {
    mockUploadedDocsState.error = "Errore di connessione al database";

    render(<YourDocument />);

    expect(
      screen.getByText("Errore di connessione al database")
    ).toBeInTheDocument();
  });

  test("mostra AccessDenied quando l'accesso ai salvati non è autorizzato", () => {
    mockSavedDocsState.isUnauthorized = true;

    render(<YourDocument />);

    fireEvent.click(screen.getByRole("button", { name: "Salvati" }));

    expect(screen.getByTestId("mock-access-denied")).toBeInTheDocument();
  });

  test("mostra lo stato vuoto (empty state) se non vi sono documenti presenti", () => {
    mockUploadedDocsState.documents = [];

    render(<YourDocument />);

    expect(screen.getByText("Nessun documento trovato")).toBeInTheDocument();
    expect(
      screen.getByText(/Non hai ancora elaborato nessun documento/i)
    ).toBeInTheDocument();
  });

  test("filtra la lista documenti tramite campo di ricerca testuale", () => {
    render(<YourDocument />);

    const searchInput = screen.getByPlaceholderText("Cerca documenti...");
    fireEvent.change(searchInput, { target: { value: "Diligence" } });

    expect(screen.getByTestId("mock-doc-card-doc-2")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-doc-card-doc-1")).toBeNull();
  });

  test("ordina i documenti al click sulle opzioni del menu di ordinamento", () => {
    render(<YourDocument />);

    const sortBtn = screen.getByRole("button", { name: /Nome A–Z/i });
    fireEvent.click(sortBtn);

    expect(screen.getByTestId("mock-doc-card-doc-1")).toBeInTheDocument();
    expect(screen.getByTestId("mock-doc-card-doc-2")).toBeInTheDocument();
  });

  test("apre il documento in una nuova scheda su desktop (_blank)", () => {
    render(<YourDocument />);

    const openBtn = screen.getAllByRole("button", { name: "Apri Documento" })[0];
    fireEvent.click(openBtn);

    expect(mockWindowOpen).toHaveBeenCalledWith(
      "/documento/doc-1",
      "_blank",
      "noopener,noreferrer"
    );
  });

  test("ricarica i documenti cliccando sul pulsante 'Ricarica'", async () => {
    render(<YourDocument />);

    const reloadBtn = screen.getByRole("button", { name: "Ricarica" });
    fireEvent.click(reloadBtn);

    await waitFor(() => {
      expect(mockUploadedDocsState.reload).toHaveBeenCalledTimes(1);
    });
  });

  test("impedisce l'eliminazione o rinomina di documenti appartenenti ad altri membri del team", () => {
    render(<YourDocument />);

    const colleagueCard = screen.getByTestId("mock-doc-card-doc-2");
    const removeBtn = colleagueCard.querySelector("button:nth-of-type(3)")!;
    const renameBtn = colleagueCard.querySelector("button:nth-of-type(2)")!;

    fireEvent.click(removeBtn);
    expect(mockToast.error).toHaveBeenCalledWith("Non puoi eliminare documenti non tuoi.");
    expect(screen.queryByTestId("mock-confirm-modal")).toBeNull();

    fireEvent.click(renameBtn);
    expect(mockToast.error).toHaveBeenCalledWith("Non puoi rinominare documenti non tuoi.");
    expect(screen.queryByTestId("mock-rename-modal")).toBeNull();
  });

  test("esegue il flusso di eliminazione documento personale con conferma modale", async () => {
    render(<YourDocument />);

    const personalCard = screen.getByTestId("mock-doc-card-doc-1");
    const removeBtn = personalCard.querySelector("button:nth-of-type(3)")!;
    fireEvent.click(removeBtn);

    expect(screen.getByTestId("mock-confirm-modal")).toBeInTheDocument();
    expect(screen.getByText("Elimina documento")).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Conferma Rifiuto/Elimina" });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockUploadedDocsState.deleteDocumento).toHaveBeenCalledWith("doc-1");
      expect(mockUploadedDocsState.reload).toHaveBeenCalledTimes(1);
      expect(mockToast.success).toHaveBeenCalledWith("Documento eliminato con successo");
    });

    expect(screen.queryByTestId("mock-confirm-modal")).toBeNull();
  });

  test("esegue il flusso di rinomina documento tramite modale", async () => {
    render(<YourDocument />);

    const personalCard = screen.getByTestId("mock-doc-card-doc-1");
    const renameBtn = personalCard.querySelector("button:nth-of-type(2)")!;
    fireEvent.click(renameBtn);

    expect(screen.getByTestId("mock-rename-modal")).toBeInTheDocument();

    const renameInput = screen.getByTestId("rename-input");
    fireEvent.change(renameInput, { target: { value: "Nuovo_Nome_Sentenza.pdf" } });

    const submitRenameBtn = screen.getByRole("button", { name: "Salva Rinomina" });
    fireEvent.click(submitRenameBtn);

    await waitFor(() => {
      expect(mockUploadedDocsState.handleRenameDocumento).toHaveBeenCalledWith(
        "doc-1",
        "Nuovo_Nome_Sentenza.pdf"
      );
      expect(mockUploadedDocsState.reload).toHaveBeenCalledTimes(1);
      expect(mockToast.success).toHaveBeenCalledWith("Documento rinominato");
    });

    expect(screen.queryByTestId("mock-rename-modal")).toBeNull();
  });

  test("renderizza e gestisce la paginazione con il pulsante 'Carica altri'", () => {
    const manyDocs = Array.from({ length: 15 }, (_, i) => ({
      id: `doc-bulk-${i}`,
      nome_file: `Documento_${i}.pdf`,
      user: "current-user-123",
      data_sentenza: "2026-01-01",
    })) as unknown as DocumentoGiurisprudenziale[];

    mockUploadedDocsState.documents = manyDocs;

    render(<YourDocument />);

    const loadMoreBtn = screen.getByRole("button", { name: "Carica altri" });
    expect(loadMoreBtn).toBeInTheDocument();

    fireEvent.click(loadMoreBtn);

    expect(screen.queryByRole("button", { name: "Carica altri" })).toBeNull();
  });
});