import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

/* ---------- hoisted shared mocks ---------- */
const {
  mockNavigate,
  mockSearchParamsGet,
  mockUseLegalChat,
  mockToast,
  mockUuidv4,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockSearchParamsGet: vi.fn(),
  mockUseLegalChat: vi.fn(),
  mockToast: {
    error: vi.fn(),
    success: vi.fn(),
  },
  mockUuidv4: vi.fn(),
}));

/* ---------- mock react-router-dom ---------- */
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
  useSearchParams: () => [{ get: mockSearchParamsGet }],
}));

/* ---------- mock uuid ---------- */
vi.mock("uuid", () => ({
  v4: () => mockUuidv4(),
}));

/* ---------- mock react-hot-toast ---------- */
vi.mock("react-hot-toast", () => ({
  toast: mockToast,
  default: mockToast,
}));

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid={`icon-${name}`} {...props} />
  );
  return {
    FileText: Icon("file-text"),
    Plus: Icon("plus"),
    Loader2: Icon("loader-2"),
  };
});

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
}));

/* ---------- mock DocumentSelectorPanel ---------- */
vi.mock("@/components/Chat/DocumentSelectorPanel", () => ({
  DocumentSelectorPanel: (props: {
    isOpen: boolean;
    onClose: () => void;
    archiveDocs: unknown[];
    attachedDocs: unknown[];
    onToggleDoc: (doc: unknown) => void;
    onProcessFiles: (...args: unknown[]) => void;
    isLoading: boolean;
    isProcessing: boolean;
  }) => (
    <div data-testid="document-selector-panel" data-open={props.isOpen}>
      {props.isOpen && (
        <>
          <button data-testid="modal-close-btn" onClick={props.onClose}>
            Close Modal
          </button>
          <span data-testid="modal-archive-count">{props.archiveDocs.length}</span>
          <span data-testid="modal-attached-count">{props.attachedDocs.length}</span>
        </>
      )}
    </div>
  ),
}));

/* ---------- mock useLegalChat ---------- */
vi.mock("@/hooks/useLegalChat", () => ({
  useLegalChat: () => mockUseLegalChat(),
}));

/* ---------- component ---------- */
import { FascicoloSetupPage } from "@/components/Chat/FascicoloSetupPage"; // <-- adegua il path se necessario
import type { AttachedDocument } from "@/interfaces/interfaces";

describe("FascicoloSetupPage", () => {
  const mockSetSessionTitle = vi.fn();
  const mockHandleProcessFiles = vi.fn();
  const mockHandleToggleDoc = vi.fn();

  const defaultChatLogic = {
    archiveDocs: [] as AttachedDocument[],
    isLoadingData: false,
    isProcessingFiles: false,
    processFilesParallel: mockHandleProcessFiles,
    attachedDocs: [] as AttachedDocument[],
    toggleDocSelection: mockHandleToggleDoc,
    sessionTitle: "",
    setSessionTitle: mockSetSessionTitle,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamsGet.mockReturnValue(null); // default: modalita standard
    mockUseLegalChat.mockReturnValue(defaultChatLogic);
    mockUuidv4.mockReturnValue("uuid-test-default");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  test("renderizza correttamente la modalità creazione nuovo fascicolo (isConverting = false)", () => {
    render(<FascicoloSetupPage />);

    // Header & sottotitolo
    expect(screen.getByRole("heading", { name: "Nuovo Fascicolo", level: 1 })).toBeInTheDocument();
    expect(
      screen.getByText("Inizializza la pratica definendo il titolo e i documenti legali di partenza.")
    ).toBeInTheDocument();

    // Input titolo
    expect(screen.getByText("Nome del Fascicolo")).toBeInTheDocument();
    const titleInput = screen.getByPlaceholderText("Es. Pratica Rossi vs Bianchi");
    expect(titleInput).toBeInTheDocument();
    expect(titleInput).toHaveValue("");

    // Conteggio documenti e stato vuoto
    expect(screen.getByText("Documenti Collegati (0)")).toBeInTheDocument();
    expect(screen.getByText("Nessun documento pronto per questo fascicolo.")).toBeInTheDocument();

    // Pulsante submit disabilitato per assenza titolo e documenti
    const submitBtn = screen.getByRole("button", { name: "Crea Fascicolo" });
    expect(submitBtn).toBeDisabled();

    // Pulsante Annulla
    expect(screen.getByRole("button", { name: "Annulla" })).toBeInTheDocument();
  });

  test("renderizza la modalità conversione da sessione temporanea (isConverting = true via query param)", () => {
    mockSearchParamsGet.mockImplementation((param: string) => (param === "convert" ? "true" : null));
    mockUseLegalChat.mockReturnValue({
      ...defaultChatLogic,
      sessionTitle: "Ricerca Preliminare",
      attachedDocs: [], // anche con 0 documenti è abilitato se c'è il titolo
    });

    render(<FascicoloSetupPage />);

    expect(screen.getByRole("heading", { name: "Converti in Fascicolo", level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Nome del Nuovo Fascicolo")).toBeInTheDocument();

    // Il bottone submit riporta il testo corretto ed è abilitato in conversione
    const submitBtn = screen.getByRole("button", { name: "Completa Conversione" });
    expect(submitBtn).toBeEnabled();
  });

  test("gestisce la digitazione nel campo titolo fascicolo", () => {
    render(<FascicoloSetupPage />);

    const titleInput = screen.getByPlaceholderText("Es. Pratica Rossi vs Bianchi");
    fireEvent.change(titleInput, { target: { value: "Pratica Sinistro Stradale" } });

    expect(mockSetSessionTitle).toHaveBeenCalledWith("Pratica Sinistro Stradale");
  });

  test("renderizza la lista dei documenti allegati quando presenti", () => {
    const attachedDocs: AttachedDocument[] = [
      { id: "doc-1", name: "Atto di Citazione.pdf" } as AttachedDocument,
      { id: "doc-2", name: "Perizia Tecnica.pdf" } as AttachedDocument,
    ];

    mockUseLegalChat.mockReturnValue({
      ...defaultChatLogic,
      sessionTitle: "Pratica con allegati",
      attachedDocs,
    });

    render(<FascicoloSetupPage />);

    expect(screen.getByText("Documenti Collegati (2)")).toBeInTheDocument();
    expect(screen.getByText("Atto di Citazione.pdf")).toBeInTheDocument();
    expect(screen.getByText("Perizia Tecnica.pdf")).toBeInTheDocument();
    expect(screen.queryByText("Nessun documento pronto per questo fascicolo.")).not.toBeInTheDocument();

    // Verifica la presenza delle icone file
    expect(screen.getAllByTestId("icon-file-text")).toHaveLength(2);

    // Con titolo e documenti, il bottone standard è abilitato
    const submitBtn = screen.getByRole("button", { name: "Crea Fascicolo" });
    expect(submitBtn).toBeEnabled();
  });

  test("gestisce l'apertura e la chiusura del DocumentSelectorPanel", () => {
    mockUseLegalChat.mockReturnValue({
      ...defaultChatLogic,
      archiveDocs: [{ id: "arc-1", name: "Archivio.pdf" } as AttachedDocument],
      attachedDocs: [{ id: "att-1", name: "Allegato.pdf" } as AttachedDocument],
    });

    render(<FascicoloSetupPage />);

    const panel = screen.getByTestId("document-selector-panel");
    expect(panel).toHaveAttribute("data-open", "false");

    // Click su "Gestisci Documenti"
    const manageDocsBtn = screen.getByRole("button", { name: /Gestisci Documenti/i });
    fireEvent.click(manageDocsBtn);

    expect(panel).toHaveAttribute("data-open", "true");
    expect(screen.getByTestId("modal-archive-count")).toHaveTextContent("1");
    expect(screen.getByTestId("modal-attached-count")).toHaveTextContent("1");

    // Chiusura modale
    fireEvent.click(screen.getByTestId("modal-close-btn"));
    expect(panel).toHaveAttribute("data-open", "false");
  });

  test("gestisce l'azione Annulla tornando indietro nella navigazione (navigate(-1))", () => {
    render(<FascicoloSetupPage />);

    const cancelBtn = screen.getByRole("button", { name: "Annulla" });
    fireEvent.click(cancelBtn);

    expect(mockNavigate).toHaveBeenCalledWith(-1);
  });

  test("invia il form e naviga al nuovo fascicolo con UUID generati e state", async () => {
    const attachedDocs: AttachedDocument[] = [
      { id: "doc-1", name: "Sentenza.pdf" } as AttachedDocument,
    ];

    mockUseLegalChat.mockReturnValue({
      ...defaultChatLogic,
      sessionTitle: "Nuova Pratica Fiscale",
      attachedDocs,
    });

    // Simuliamo 2 chiamate a uuidv4 (newThreadId e newFascicoloId)
    mockUuidv4
      .mockReturnValueOnce("thread-uuid-111")
      .mockReturnValueOnce("fascicolo-uuid-222");

    render(<FascicoloSetupPage />);

    const submitBtn = screen.getByRole("button", { name: "Crea Fascicolo" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/fascicolo/fascicolo-uuid-222/thread-uuid-111", {
        state: {
          inizializzaTitolo: "Nuova Pratica Fiscale",
          inizializzaDocumenti: attachedDocs,
        },
      });
    });
  });

  test("gestisce errori durante la sottomissione mostrando un toast di errore", async () => {
    mockUseLegalChat.mockReturnValue({
      ...defaultChatLogic,
      sessionTitle: "Pratica con errore",
      attachedDocs: [{ id: "doc-1", name: "Doc.pdf" } as AttachedDocument],
    });

    mockNavigate.mockImplementationOnce(() => {
      throw new Error("Navigation crashed");
    });

    render(<FascicoloSetupPage />);

    const submitBtn = screen.getByRole("button", { name: "Crea Fascicolo" });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        "Errore durante il salvataggio del fascicolo:",
        expect.any(Error)
      );
      expect(mockToast.error).toHaveBeenCalledWith("Errore durante la creazione della pratica. Riprova.");
    });
  });

  test("non invia il form se il titolo è composto solo da spazi vuoti", () => {
    mockUseLegalChat.mockReturnValue({
      ...defaultChatLogic,
      sessionTitle: "   ",
      attachedDocs: [{ id: "doc-1", name: "Doc.pdf" } as AttachedDocument],
    });

    render(<FascicoloSetupPage />);

    const submitBtn = screen.getByRole("button", { name: "Crea Fascicolo" });
    expect(submitBtn).toBeDisabled();

    fireEvent.click(submitBtn);
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});