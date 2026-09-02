import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

/* ---------- mock @dr.pogodin/react-helmet ---------- */
vi.mock("@dr.pogodin/react-helmet", () => ({
  Helmet: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="helmet-wrapper">{children}</div>
  ),
}));

/* ---------- mock react-router-dom ---------- */
let mockLocationState: Record<string, unknown> | null = null;

vi.mock("react-router-dom", () => ({
  __esModule: true,
  useLocation: () => ({
    pathname: "/chat",
    state: mockLocationState,
    search: "",
    hash: "",
    key: "chat-key",
  }),
}));

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", () => ({
  __esModule: true,
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => ({
  __esModule: true,
  PanelRight: () => <svg data-testid="icon-panel-right" />,
  X: () => <svg data-testid="icon-x" />,
  FolderPlus: () => <svg data-testid="icon-folder-plus" />,
}));

/* ---------- mock child components ---------- */
vi.mock("@/components/Info/Header", () => ({
  __esModule: true,
  Header: () => <header data-testid="main-header">Header Navigation</header>,
}));

vi.mock("@/components/AccessDenied", () => ({
  __esModule: true,
  AccessDenied: () => <div data-testid="access-denied-component">Access Denied Modal</div>,
}));

vi.mock("@/components/Chat/Filters", () => ({
  __esModule: true,
  FilterModal: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="filter-modal">
        <button onClick={onClose} data-testid="close-filter-btn">
          Chiudi Filtri
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/Chat/DocumentSelectorPanel", () => ({
  __esModule: true,
  DocumentSelectorPanel: ({
    isOpen,
    onClose,
  }: {
    isOpen: boolean;
    onClose: () => void;
  }) =>
    isOpen ? (
      <div data-testid="document-selector-panel">
        <button onClick={onClose} data-testid="close-docs-panel-btn">
          Chiudi Documenti
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/Chat/TitlePromptModal", () => ({
  __esModule: true,
  TitlePromptModal: ({
    isOpen,
    onClose,
    onConfirm,
  }: {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (title: string) => void;
  }) =>
    isOpen ? (
      <div data-testid="title-prompt-modal">
        <button
          onClick={() => onConfirm("Nuovo Fascicolo Ristrutturato")}
          data-testid="confirm-title-btn"
        >
          Conferma Titolo
        </button>
        <button onClick={onClose} data-testid="close-title-btn">
          Annulla
        </button>
      </div>
    ) : null,
}));

vi.mock("@/components/Chat/SelectionScreen", () => ({
  __esModule: true,
  SelectionScreen: ({
    startTempChat,
    startFascicoloSetup,
  }: {
    startTempChat: () => void;
    startFascicoloSetup: () => void;
  }) => (
    <div data-testid="selection-screen">
      <button onClick={startTempChat} data-testid="btn-start-temp">
        Avvia Chat Temporanea
      </button>
      <button onClick={startFascicoloSetup} data-testid="btn-start-fascicolo">
        Crea Fascicolo
      </button>
    </div>
  ),
}));

vi.mock("@/components/Chat/ChatWorkspace", () => ({
  __esModule: true,
  ChatWorkspace: ({
    handleDocumentAction,
    removeQuote,
  }: {
    handleDocumentAction: (action: string, text: string) => void;
    removeQuote: (index: number) => void;
  }) => (
    <div data-testid="chat-workspace">
      <button
        onClick={() => handleDocumentAction("quote", "Estratto Testo Normativo")}
        data-testid="btn-action-quote"
      >
        Aggiungi Quote
      </button>
      <button
        onClick={() => handleDocumentAction("semaforo", "Principio di Diritto")}
        data-testid="btn-action-semaforo"
      >
        Azione Semaforo
      </button>
      <button
        onClick={() => handleDocumentAction("distinguish", "Fatti Chiave")}
        data-testid="btn-action-distinguish"
      >
        Azione Distinguish
      </button>
      <button onClick={() => removeQuote(0)} data-testid="btn-remove-quote">
        Rimuovi Quote
      </button>
    </div>
  ),
}));

vi.mock("@/components/Chat/ChatHeader", () => ({
  __esModule: true,
  ChatHeader: ({
    sessionTitle,
    setShowTitleModal,
    setShowMobileSidebar,
    closeSession,
  }: {
    sessionTitle: string;
    setShowTitleModal: (v: boolean) => void;
    setShowMobileSidebar: (updater: (prev: boolean) => boolean) => void;
    closeSession: () => void;
  }) => (
    <div data-testid="chat-header">
      <span data-testid="header-session-title">{sessionTitle}</span>
      <button onClick={() => setShowTitleModal(true)} data-testid="btn-open-title-modal">
        Rinomina
      </button>
      <button
        onClick={() => setShowMobileSidebar((prev) => !prev)}
        data-testid="btn-toggle-mobile-sidebar"
      >
        Toggle Sidebar Mobile
      </button>
      <button onClick={closeSession} data-testid="btn-close-session">
        Chiudi Sessione
      </button>
    </div>
  ),
}));

vi.mock("@/components/Chat/MessageList", () => ({
  __esModule: true,
  MessageList: ({
    messages,
  }: {
    messages: Array<{ id: string; content: string }>;
  }) => (
    <div data-testid="message-list">
      {messages.map((m) => (
        <p key={m.id}>{m.content}</p>
      ))}
    </div>
  ),
}));

vi.mock("@/components/Chat/MessageTimeline", () => ({
  __esModule: true,
  MessageTimeline: () => <div data-testid="message-timeline">Timeline Component</div>,
}));

vi.mock("@/components/Chat/ChatInput", () => ({
  __esModule: true,
  ChatInput: ({
    inputValue,
    setInputValue,
    handleSendMessage,
    setShowFilters,
    setShowDocsModal,
  }: {
    inputValue: string;
    setInputValue: (v: string) => void;
    handleSendMessage: () => void;
    setShowFilters: (v: boolean) => void;
    setShowDocsModal: (v: boolean) => void;
  }) => (
    <div data-testid="chat-input-wrapper">
      <input
        data-testid="mock-chat-input"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
      />
      <button onClick={handleSendMessage} data-testid="btn-send-message">
        Invia
      </button>
      <button onClick={() => setShowFilters(true)} data-testid="btn-open-filters">
        Filtri
      </button>
      <button onClick={() => setShowDocsModal(true)} data-testid="btn-open-docs">
        Documenti
      </button>
    </div>
  ),
}));

vi.mock("@/components/Chat/RightSidebar", () => ({
  __esModule: true,
  RightSidebar: ({
    onThreadSelect,
    onNewThread,
  }: {
    onThreadSelect: (id: string) => void;
    onNewThread: () => void;
  }) => (
    <div data-testid="right-sidebar">
      <button onClick={() => onThreadSelect("thr-101")} data-testid="btn-select-thread">
        Seleziona Thread
      </button>
      <button onClick={onNewThread} data-testid="btn-new-thread">
        Nuovo Thread
      </button>
    </div>
  ),
}));

/* ---------- mock useLegalChat hook ---------- */
const mockSetInputValue = vi.fn();
const mockSetActiveSourceId = vi.fn();
const mockSetShowFilters = vi.fn();
const mockSetShowDocsModal = vi.fn();
const mockSetFilterState = vi.fn();
const mockClearFilters = vi.fn();
const mockHandleSendMessage = vi.fn();
const mockToggleDocSelection = vi.fn();
const mockRemoveAttachment = vi.fn();
const mockStartTempChat = vi.fn();
const mockStartFascicoloSetup = vi.fn();
const mockCloseSession = vi.fn();
const mockProcessFilesParallel = vi.fn();
const mockHandleSourceClick = vi.fn();
const mockConvertChatToFascicolo = vi.fn();
const mockSetShowTitleModal = vi.fn();
const mockSetSessionTitle = vi.fn();
const mockHandleToggleFascicoloLink = vi.fn();
const mockHandleDeleteDocumento = vi.fn();
const mockHandleRenameDocumento = vi.fn();
const mockSetActiveQuote = vi.fn();
const mockStartThread = vi.fn();
const mockCreateNewThread = vi.fn();
const mockDeleteThread = vi.fn();

let mockLegalChatState = {
  sessionType: "seleziona" as "seleziona" | "temporanea" | "fascicolo",
  isConverting: false,
  messages: [] as Array<{ id: string; content: string }>,
  inputValue: "",
  setInputValue: mockSetInputValue,
  activeSourceId: null as string | null,
  setActiveSourceId: mockSetActiveSourceId,
  showFilters: false,
  setShowFilters: mockSetShowFilters,
  showDocsModal: false,
  setShowDocsModal: mockSetShowDocsModal,
  attachedDocs: [] as Array<{ id: string; name: string }>,
  filterState: {},
  setFilterState: mockSetFilterState,
  activeFiltersCount: 0,
  clearFilters: mockClearFilters,
  messagesEndRef: { current: null },
  handleSendMessage: mockHandleSendMessage,
  toggleDocSelection: mockToggleDocSelection,
  removeAttachment: mockRemoveAttachment,
  seo: { title: "Legal AI Assistant | Jurio", desc: "Assistente giuridico conversazionale" },
  isStreaming: false,
  agentStatusText: "",
  startTempChat: mockStartTempChat,
  startFascicoloSetup: mockStartFascicoloSetup,
  closeSession: mockCloseSession,
  sessionTitle: "Sessione Preliminare",
  threadTitle: "Thread Principale",
  archiveDocs: [],
  isLoadingData: false,
  processFilesParallel: mockProcessFilesParallel,
  isProcessingFiles: false,
  handleSourceClick: mockHandleSourceClick,
  threads: [],
  activeThreadId: null as string | null,
  convertChatToFascicolo: mockConvertChatToFascicolo,
  showTitleModal: false,
  setShowTitleModal: mockSetShowTitleModal,
  setSessionTitle: mockSetSessionTitle,
  denyOpen: false,
  handleToggleFascicoloLink: mockHandleToggleFascicoloLink,
  handleDeleteDocumento: mockHandleDeleteDocumento,
  handleRenameDocumento: mockHandleRenameDocumento,
  setActiveQuote: mockSetActiveQuote,
  activeQuote: [] as string[],
  isReadOnly: false,
  startThread: mockStartThread,
  createNewThread: mockCreateNewThread,
  deleteThread: mockDeleteThread,
};

vi.mock("@/hooks/useLegalChat", () => ({
  __esModule: true,
  useLegalChat: () => mockLegalChatState,
}));

/* ---------- component under test ---------- */
import { LegalChatPage } from "@/pages/Chat";

describe("LegalChatPage Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLocationState = null;
    mockLegalChatState = {
      sessionType: "seleziona",
      isConverting: false,
      messages: [],
      inputValue: "",
      setInputValue: mockSetInputValue,
      activeSourceId: null,
      setActiveSourceId: mockSetActiveSourceId,
      showFilters: false,
      setShowFilters: mockSetShowFilters,
      showDocsModal: false,
      setShowDocsModal: mockSetShowDocsModal,
      attachedDocs: [],
      filterState: {},
      setFilterState: mockSetFilterState,
      activeFiltersCount: 0,
      clearFilters: mockClearFilters,
      messagesEndRef: { current: null },
      handleSendMessage: mockHandleSendMessage,
      toggleDocSelection: mockToggleDocSelection,
      removeAttachment: mockRemoveAttachment,
      seo: { title: "Legal AI Assistant | Jurio", desc: "Assistente giuridico conversazionale" },
      isStreaming: false,
      agentStatusText: "",
      startTempChat: mockStartTempChat,
      startFascicoloSetup: mockStartFascicoloSetup,
      closeSession: mockCloseSession,
      sessionTitle: "Sessione Preliminare",
      threadTitle: "Thread Principale",
      archiveDocs: [],
      isLoadingData: false,
      processFilesParallel: mockProcessFilesParallel,
      isProcessingFiles: false,
      handleSourceClick: mockHandleSourceClick,
      threads: [],
      activeThreadId: null,
      convertChatToFascicolo: mockConvertChatToFascicolo,
      showTitleModal: false,
      setShowTitleModal: mockSetShowTitleModal,
      setSessionTitle: mockSetSessionTitle,
      denyOpen: false,
      handleToggleFascicoloLink: mockHandleToggleFascicoloLink,
      handleDeleteDocumento: mockHandleDeleteDocumento,
      handleRenameDocumento: mockHandleRenameDocumento,
      setActiveQuote: mockSetActiveQuote,
      activeQuote: [],
      isReadOnly: false,
      startThread: mockStartThread,
      createNewThread: mockCreateNewThread,
      deleteThread: mockDeleteThread,
    };
  });

  afterEach(() => {
    document.body.style.overflow = "unset";
  });

  test("renderizza la schermata iniziale di selezione con header e gestisce l'avvio della sessione", () => {
    render(<LegalChatPage />);

    expect(screen.getByTestId("main-header")).toBeInTheDocument();
    expect(screen.getByTestId("selection-screen")).toBeInTheDocument();
    expect(screen.queryByTestId("chat-header")).not.toBeInTheDocument();

    fireEvent.click(screen.getByTestId("btn-start-temp"));
    expect(mockStartTempChat).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId("btn-start-fascicolo"));
    expect(mockStartFascicoloSetup).toHaveBeenCalledTimes(1);
  });

  test("inizializza il titolo della sessione se passato tramite router location state", () => {
    mockLocationState = { inizializzaTitolo: "Fascicolo n. 450/2026" };

    render(<LegalChatPage />);

    expect(mockSetSessionTitle).toHaveBeenCalledWith("Fascicolo n. 450/2026");
  });

  test("renderizza il layout completo della chat quando la sessione è attiva (temporanea o fascicolo)", () => {
    mockLegalChatState.sessionType = "temporanea";
    mockLegalChatState.messages = [
      { id: "m-1", content: "Parere sulla responsabilità contrattuale" },
    ];

    render(<LegalChatPage />);

    expect(screen.getByTestId("chat-workspace")).toBeInTheDocument();
    expect(screen.getByTestId("chat-header")).toBeInTheDocument();
    expect(screen.getByTestId("message-list")).toBeInTheDocument();
    expect(screen.getByText("Parere sulla responsabilità contrattuale")).toBeInTheDocument();
    expect(screen.getByTestId("message-timeline")).toBeInTheDocument();
    expect(screen.getByTestId("chat-input-wrapper")).toBeInTheDocument();
    expect(screen.getByTestId("right-sidebar")).toBeInTheDocument();
  });

  test("gestisce le azioni del workspace documentale (quote, semaforo, distinguish)", () => {
    mockLegalChatState.sessionType = "fascicolo";
    render(<LegalChatPage />);

    // Azione Quote
    fireEvent.click(screen.getByTestId("btn-action-quote"));
    expect(mockSetActiveQuote).toHaveBeenCalled();

    // Azione Semaforo
    fireEvent.click(screen.getByTestId("btn-action-semaforo"));
    expect(mockSetInputValue).toHaveBeenCalledWith(
      'Verifica legittimità del seguente principio estratto dal documento: "Principio di Diritto"'
    );

    // Azione Distinguish
    fireEvent.click(screen.getByTestId("btn-action-distinguish"));
    expect(mockSetInputValue).toHaveBeenCalledWith(
      'Trova un distinguish per i seguenti fatti estratti dal documento: "Fatti Chiave"'
    );

    // Rimozione Quote
    fireEvent.click(screen.getByTestId("btn-remove-quote"));
    expect(mockSetActiveQuote).toHaveBeenCalled();
  });

  test("apre e gestisce i modal di supporto (Filtri, Documenti, Titolo)", () => {
    mockLegalChatState.sessionType = "temporanea";
    mockLegalChatState.showFilters = true;
    mockLegalChatState.showDocsModal = true;
    mockLegalChatState.showTitleModal = true;

    render(<LegalChatPage />);

    expect(screen.getByTestId("filter-modal")).toBeInTheDocument();
    expect(screen.getByTestId("document-selector-panel")).toBeInTheDocument();
    expect(screen.getByTestId("title-prompt-modal")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("close-filter-btn"));
    expect(mockSetShowFilters).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByTestId("close-docs-panel-btn"));
    expect(mockSetShowDocsModal).toHaveBeenCalledWith(false);

    fireEvent.click(screen.getByTestId("confirm-title-btn"));
    expect(mockSetShowTitleModal).toHaveBeenCalledWith(false);
    expect(mockSetSessionTitle).toHaveBeenCalledWith("Nuovo Fascicolo Ristrutturato");
    expect(mockConvertChatToFascicolo).toHaveBeenCalledWith("Nuovo Fascicolo Ristrutturato");
  });

  test("gestisce la sidebar destra per selezione e creazione thread", () => {
    mockLegalChatState.sessionType = "fascicolo";
    render(<LegalChatPage />);

    fireEvent.click(screen.getByTestId("btn-select-thread"));
    expect(mockStartThread).toHaveBeenCalledWith("thr-101");

    fireEvent.click(screen.getByTestId("btn-new-thread"));
    expect(mockCreateNewThread).toHaveBeenCalledTimes(1);
  });

  test("mostra AccessDenied e blocca lo scroll del body quando denyOpen è true", () => {
    mockLegalChatState.denyOpen = true;

    render(<LegalChatPage />);

    expect(screen.getByTestId("access-denied-component")).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");
  });
});