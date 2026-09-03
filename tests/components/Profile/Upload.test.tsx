import { describe, test, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import type { DocumentoGiurisprudenziale } from "@/interfaces/interfaces";

/* ---------- tipi mock hook usePdfAnalyzer ---------- */
interface MockPdfAnalyzerHook {
  file: File | null;
  dragActive: boolean;
  loading: boolean;
  progress: string | null;
  extractedText: string | null;
  analysisResult: string | null;
  inputRef: React.RefObject<HTMLInputElement | null>;
  analyzeReason: Mock<(promptId: string) => void>;
  handleDrag: Mock<(e: React.DragEvent<HTMLElement>) => void>;
  setFile: Mock<(file: File | null) => void>;
  setExtractedText: Mock<(text: string | null) => void>;
  setAnalysisResult: Mock<(res: string | null) => void>;
  validatePdf: Mock<(files: FileList) => boolean>;
  denyOpen: boolean;
  isDuplicateModalOpen: boolean;
  setIsDuplicateModalOpen: Mock<(isOpen: boolean) => void>;
  executeAnalysis: Mock<(promptId: string, duplicateId?: string) => void>;
  duplicateId: string | null;
}

/* ---------- hoisted mocks ---------- */
const { mockPdfAnalyzerState, mockVectorSearch, mockTrackEvent } = vi.hoisted(() => ({
  mockPdfAnalyzerState: {
    file: null,
    dragActive: false,
    loading: false,
    progress: null,
    extractedText: null,
    analysisResult: null,
    inputRef: { current: null },
    analyzeReason: vi.fn<(promptId: string) => void>(),
    handleDrag: vi.fn<(e: React.DragEvent<HTMLElement>) => void>(),
    setFile: vi.fn<(file: File | null) => void>(),
    setExtractedText: vi.fn<(text: string | null) => void>(),
    setAnalysisResult: vi.fn<(res: string | null) => void>(),
    validatePdf: vi.fn<(files: FileList) => boolean>(() => true),
    denyOpen: false,
    isDuplicateModalOpen: false,
    setIsDuplicateModalOpen: vi.fn<(isOpen: boolean) => void>(),
    executeAnalysis: vi.fn<(promptId: string, duplicateId?: string) => void>(),
    duplicateId: null,
  } as MockPdfAnalyzerHook,
  mockVectorSearch: vi.fn(),
  mockTrackEvent: vi.fn(),
}));

/* ---------- mock hook usePdfAnalyzer ---------- */
vi.mock("@/features/profile/hooks/usePdfAnalyzer", () => ({
  usePdfAnalyzer: () => mockPdfAnalyzerState,
}));

/* ---------- mock services ---------- */
vi.mock("@/features/search/hooks/vectorSearch", () => ({
  vectorSearch: (...args: unknown[]) => mockVectorSearch(...args),
}));

vi.mock("@/infrastructure/analytics", () => ({
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

/* ---------- mock child components ---------- */

vi.mock("@/features/profile/components/UploadDropzone", () => ({
  UploadDropzone: () => <div data-testid="mock-upload-dropzone">UploadDropzone Mock</div>,
}));

vi.mock("@/features/profile/components/CloudPickerModal", () => ({
  CloudPickerModal: ({
    isOpen,
    onClose,
    onSelectFile,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onSelectFile: (file: { name: string; blob: Blob }) => void;
  }) =>
    isOpen ? (
      <div data-testid="mock-cloud-picker-modal">
        <button type="button" onClick={onClose}>
          Chiudi Cloud Modal
        </button>
        <button
          type="button"
          onClick={() =>
            onSelectFile({
              name: "sentenza_drive.pdf",
              blob: new Blob(["cloud-bytes"], { type: "application/pdf" }),
            })
          }
        >
          Seleziona File Cloud
        </button>
      </div>
    ) : null,
}));

vi.mock("@/features/profile/components/ExtractedTextModal", () => ({
  ExtractedTextModal: ({ showText }: { showText: boolean }) =>
    showText ? <div data-testid="mock-extracted-text-modal">ExtractedTextModal Mock</div> : null,
}));


vi.mock("@/shared/components/PromptSelector", () => ({
  PromptSelector: ({
    value,
    onChange,
    disabled,
  }: {
    value: string;
    onChange: (val: string) => void;
    disabled?: boolean;
    label?: string;
  }) => (
    <select
      data-testid="mock-prompt-selector"
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="default">Default Prompt</option>
      <option value="custom-prompt-1">Custom Prompt Penale</option>
    </select>
  ),
}));

vi.mock("@/features/document/components/Massima", () => ({
  MassimaCard: ({ result }: { result: unknown }) => (
    <div data-testid="mock-massima-card">{JSON.stringify(result)}</div>
  ),
}));

vi.mock("@/features/profile/components/VectorSearchResults", () => ({
  VectorSearchResults: ({
    handleVectorSearch,
    handleClick,
  }: {
    handleVectorSearch: () => void;
    handleClick: (doc: DocumentoGiurisprudenziale) => void;
  }) => (
    <div data-testid="mock-vector-search-results">
      <button type="button" onClick={handleVectorSearch}>
        Avvia Ricerca Vettoriale
      </button>
      <button
        type="button"
        onClick={() =>
          handleClick({
            id: "sent-cass-2026-100",
            numero_documento: "100/2026",
          } as unknown as DocumentoGiurisprudenziale)
        }
      >
        Apri Sentenza
      </button>
    </div>
  ),
}));


vi.mock("@/shared/components/AccessDenied", () => ({
  AccessDenied: () => <div data-testid="mock-access-denied">Access Denied Mock</div>,
}));

vi.mock("@/shared/components/ConfirmModal", () => ({
  ConfirmModal: ({
    isOpen,
    title,
    message,
    confirmText,
    cancelText,
    onConfirm,
    onCancel,
  }: {
    isOpen: boolean;
    title: string;
    message: string;
    confirmText: string;
    cancelText: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    isOpen ? (
      <div data-testid="mock-confirm-modal">
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

/* ---------- mock icons sicuri ---------- */
vi.mock("react-icons/fa", () => ({
  FaCloud: (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid="fa-cloud" {...props} />
  ),
  FaTimes: (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid="fa-times" {...props} />
  ),
}));

vi.mock("lucide-react", () => ({
  Loader2: (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid="icon-loader-2" {...props} />
  ),
}));

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
      div: passthrough("div"),
    },
  };
});

/* ---------- component ---------- */
import { Upload } from "@/features/profile/components/UploadSentences"; // <-- adegua il path se necessario

describe("Upload Component Suite", () => {
  const originalOpen = window.open;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPdfAnalyzerState.file = null;
    mockPdfAnalyzerState.loading = false;
    mockPdfAnalyzerState.progress = null;
    mockPdfAnalyzerState.extractedText = null;
    mockPdfAnalyzerState.analysisResult = null;
    mockPdfAnalyzerState.denyOpen = false;
    mockPdfAnalyzerState.isDuplicateModalOpen = false;
    mockPdfAnalyzerState.duplicateId = null;
    mockPdfAnalyzerState.validatePdf.mockReturnValue(true);

    mockVectorSearch.mockResolvedValue({ allMatches: [] });

    window.open = vi.fn();
    global.URL.createObjectURL = vi.fn(() => "blob:http://localhost/mock-blob-url");
  });

  afterEach(() => {
    window.open = originalOpen;
    document.body.style.overflow = "unset";
    vi.restoreAllMocks();
  });

  test("renderizza la schermata principale con intestazione, pulsante Cloud e UploadDropzone", () => {
    render(<Upload />);

    expect(screen.getByRole("heading", { name: "Analizza un documento", level: 1 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Importa dal Cloud/i })).toBeInTheDocument();
    expect(screen.getByTestId("mock-upload-dropzone")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-cloud-picker-modal")).toBeNull();
  });

  test("gestisce l'apertura, chiusura e importazione file dal CloudPickerModal", () => {
    render(<Upload />);

    const cloudBtn = screen.getByRole("button", { name: /Importa dal Cloud/i });
    fireEvent.click(cloudBtn);

    expect(screen.getByTestId("mock-cloud-picker-modal")).toBeInTheDocument();

    const selectCloudFileBtn = screen.getByRole("button", { name: "Seleziona File Cloud" });
    fireEvent.click(selectCloudFileBtn);

    expect(mockPdfAnalyzerState.validatePdf).toHaveBeenCalledWith([expect.any(File)]);
    expect(mockPdfAnalyzerState.setFile).toHaveBeenCalledWith(
      expect.objectContaining({ name: "sentenza_drive.pdf" })
    );
    expect(mockPdfAnalyzerState.setExtractedText).toHaveBeenCalledWith("");
    expect(mockPdfAnalyzerState.setAnalysisResult).toHaveBeenCalledWith(null);
    expect(screen.queryByTestId("mock-cloud-picker-modal")).toBeNull();
  });

  test("non imposta il file se la validazione validatePdf fallisce all'importazione cloud", () => {
    mockPdfAnalyzerState.validatePdf.mockReturnValueOnce(false);

    render(<Upload />);

    fireEvent.click(screen.getByRole("button", { name: /Importa dal Cloud/i }));
    fireEvent.click(screen.getByRole("button", { name: "Seleziona File Cloud" }));

    expect(mockPdfAnalyzerState.validatePdf).toHaveBeenCalledTimes(1);
    expect(mockPdfAnalyzerState.setFile).not.toHaveBeenCalled();
  });

  test("mostra il box di pre-analisi con il selettore prompt quando è presente extractedText ma non analysisResult", () => {
    mockPdfAnalyzerState.extractedText = "Testo estratto dalla sentenza n. 123/2026...";
    mockPdfAnalyzerState.analysisResult = null;

    render(<Upload />);

    expect(screen.getByTestId("mock-prompt-selector")).toBeInTheDocument();

    const analyzeBtn = screen.getByRole("button", { name: "Analizza il documento" });
    expect(analyzeBtn).toBeInTheDocument();

    fireEvent.click(analyzeBtn);
    expect(mockPdfAnalyzerState.analyzeReason).toHaveBeenCalledWith("default");

    const promptSelector = screen.getByTestId("mock-prompt-selector");
    fireEvent.change(promptSelector, { target: { value: "custom-prompt-1" } });

    const customAnalyzeBtn = screen.getByRole("button", { name: "Esegui Prompt Custom" });
    expect(customAnalyzeBtn).toBeInTheDocument();

    fireEvent.click(customAnalyzeBtn);
    expect(mockPdfAnalyzerState.analyzeReason).toHaveBeenCalledWith("custom-prompt-1");
  });

  test("apre il modale ExtractedTextModal al click su 'visualizza il documento sorgente'", () => {
    mockPdfAnalyzerState.extractedText = "Estratto testo legale...";

    render(<Upload />);

    expect(screen.queryByTestId("mock-extracted-text-modal")).toBeNull();

    const viewSourceBtn = screen.getByRole("button", { name: "visualizza il documento sorgente" });
    fireEvent.click(viewSourceBtn);

    expect(screen.getByTestId("mock-extracted-text-modal")).toBeInTheDocument();
  });

  test("renderizza MassimaCard e VectorSearchResults quando analysisResult e file sono valorizzati", () => {
    const dummyFile = new File(["pdf"], "sentenza.pdf", { type: "application/pdf" });
    const dummyAnalysis = JSON.stringify({
      massima: "In tema di contratti bancari...",
      fattispecie_rilevante: "Fideiussione omnibus e clausole nulle...",
    });

    mockPdfAnalyzerState.file = dummyFile;
    mockPdfAnalyzerState.analysisResult = dummyAnalysis;

    render(<Upload />);

    expect(screen.getByTestId("mock-massima-card")).toBeInTheDocument();
    expect(screen.getByTestId("mock-vector-search-results")).toBeInTheDocument();
  });

  test("esegue la ricerca vettoriale basata su massima e fattispecie e riutilizza la cache alla seconda richiesta", async () => {
    const dummyFile = new File(["pdf"], "ordinanza.pdf", { type: "application/pdf" });
    mockPdfAnalyzerState.file = dummyFile;
    mockPdfAnalyzerState.analysisResult = JSON.stringify({
      massima: "Principio di diritto bancario",
      fattispecie_rilevante: "Nullità parziale",
    });

    const mockMatches = [
      { id: "match-1", numero_documento: "11/2026" },
      { id: "match-2", numero_documento: "12/2026" },
    ];
    mockVectorSearch.mockResolvedValueOnce({ allMatches: mockMatches });

    render(<Upload />);

    const searchBtn = screen.getByRole("button", { name: "Avvia Ricerca Vettoriale" });

    // 1. Prima chiamata: invoca vectorSearch
    fireEvent.click(searchBtn);

    await waitFor(() => {
      expect(mockVectorSearch).toHaveBeenCalledWith(
        "Principio di diritto bancario Nullità parziale",
        [],
        15
      );
    });

    // 2. Seconda chiamata: sfrutta la cache
    fireEvent.click(searchBtn);
    expect(mockVectorSearch).toHaveBeenCalledTimes(1);
  });

  test("gestisce il click su un risultato tracciando l'evento analytics e aprendo la sentenza", () => {
    const dummyFile = new File(["pdf"], "decreto.pdf", { type: "application/pdf" });
    mockPdfAnalyzerState.file = dummyFile;
    mockPdfAnalyzerState.analysisResult = JSON.stringify({ massima: "Massima test" });

    render(<Upload />);

    const openDocBtn = screen.getByRole("button", { name: "Apri Sentenza" });
    fireEvent.click(openDocBtn);

    expect(mockTrackEvent).toHaveBeenCalledWith("sentence_opened", { source: "search" });
    expect(window.open).toHaveBeenCalledWith("/giurisprudenza/sent-cass-2026-100", expect.any(String));
  });

  test("mostra il componente AccessDenied quando denyOpen è true", () => {
    mockPdfAnalyzerState.denyOpen = true;

    render(<Upload />);

    expect(screen.getByTestId("mock-access-denied")).toBeInTheDocument();
  });

  test("gestisce la modale di conferma per documento duplicato", () => {
    mockPdfAnalyzerState.file = new File(["pdf"], "contratto_esistente.pdf", { type: "application/pdf" });
    mockPdfAnalyzerState.isDuplicateModalOpen = true;
    mockPdfAnalyzerState.duplicateId = "doc-dup-789";

    render(<Upload />);

    const confirmModal = screen.getByTestId("mock-confirm-modal");
    expect(confirmModal).toBeInTheDocument();
    expect(
      screen.getByText('Il documento "contratto_esistente.pdf" è già stato caricato in precedenza. Lo vuoi sovrascrivere?')
    ).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: "Sì, sovrascrivi" });
    fireEvent.click(confirmBtn);

    expect(mockPdfAnalyzerState.setIsDuplicateModalOpen).toHaveBeenCalledWith(false);
    expect(mockPdfAnalyzerState.executeAnalysis).toHaveBeenCalledWith("default", "doc-dup-789");
  });

  test("annulla la sovrascrittura del duplicato alla pressione del tasto Annulla", () => {
    mockPdfAnalyzerState.isDuplicateModalOpen = true;

    render(<Upload />);

    const cancelBtn = screen.getByRole("button", { name: "Annulla" });
    fireEvent.click(cancelBtn);

    expect(mockPdfAnalyzerState.setIsDuplicateModalOpen).toHaveBeenCalledWith(false);
    expect(mockPdfAnalyzerState.executeAnalysis).not.toHaveBeenCalled();
  });

  test("blocca lo scroll del body impostando overflow a hidden quando un modale è aperto", () => {
    const { rerender } = render(<Upload />);
    expect(document.body.style.overflow).toBe("unset");

    // Apertura Cloud Modal
    fireEvent.click(screen.getByRole("button", { name: /Importa dal Cloud/i }));
    expect(document.body.style.overflow).toBe("hidden");

    // Chiusura Cloud Modal
    fireEvent.click(screen.getByRole("button", { name: "Chiudi Cloud Modal" }));
    expect(document.body.style.overflow).toBe("unset");

    // Con denyOpen attivo
    mockPdfAnalyzerState.denyOpen = true;
    rerender(<Upload />);
    expect(document.body.style.overflow).toBe("hidden");
  });
});