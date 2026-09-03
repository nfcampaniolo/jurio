import { describe, test, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import type { DocumentoGiurisprudenziale } from "@/interfaces/interfaces";

/* ---------- tipi mock useSearchBar ---------- */
interface MockDetailedMatch {
  type: "numero_sentenza" | "normativa" | "sottocategoria";
  query?: string;
  value?: string;
  docs: DocumentoGiurisprudenziale[];
}

interface MockWebFallback {
  sintesi: string;
  queryAlternativa?: string;
}

interface MockSearchBarHook {
  searchInput: string;
  setSearchInput: Mock<(val: string) => void>;
  filteredSuggestions: string[];
  activeIndex: number;
  setActiveIndex: Mock<(idx: number) => void>;
  showSuggestions: boolean;
  setShowSuggestions: Mock<(show: boolean) => void>;
  topResults: DocumentoGiurisprudenziale[];
  results: DocumentoGiurisprudenziale[];
  visibleCount: number;
  filterGrado: string;
  setFilterGrado: Mock<(v: string) => void>;
  filterTipo: string;
  setFilterTipo: Mock<(v: string) => void>;
  handleSearch: Mock<(term: string) => void>;
  handleKeyDown: Mock<(e: React.KeyboardEvent<HTMLInputElement>) => void>;
  handleClick: Mock<(doc: DocumentoGiurisprudenziale) => void>;
  startDate: string;
  setStartDate: Mock<(v: string) => void>;
  endDate: string;
  setEndDate: Mock<(v: string) => void>;
  filterTipologia: string;
  setFilterTipologia: Mock<(v: string) => void>;
  sortBy: string;
  setSortBy: Mock<(v: string) => void>;
  filterSezione: string;
  setFilterSezione: Mock<(v: string) => void>;
  numberPages: number;
  setnumberPages: Mock<(v: number) => void>;
  detailedMatch: MockDetailedMatch | null;
  isDeepSearchAvailable: boolean;
  handleDeepSearch: Mock<() => void>;
  loadDistinctSottocategorie: Mock<() => Promise<string[]>>;
  clearFilters: Mock<() => void>;
  loading: boolean;
  deny: boolean;
  handleLoadMore: Mock<() => void>;
  isDbPaginatedMode: boolean;
  hasMoreDbResults: boolean;
  webFallback: MockWebFallback | null;
  searchStatus: string | null;
}

/* ---------- hoisted mocks ---------- */
const { mockSearchBarState } = vi.hoisted(() => ({
  mockSearchBarState: {
    searchInput: "",
    setSearchInput: vi.fn<(val: string) => void>(),
    filteredSuggestions: [],
    activeIndex: -1,
    setActiveIndex: vi.fn<(idx: number) => void>(),
    showSuggestions: false,
    setShowSuggestions: vi.fn<(show: boolean) => void>(),
    topResults: [],
    results: [],
    visibleCount: 10,
    filterGrado: "",
    setFilterGrado: vi.fn<(v: string) => void>(),
    filterTipo: "",
    setFilterTipo: vi.fn<(v: string) => void>(),
    handleSearch: vi.fn<(term: string) => void>(),
    handleKeyDown: vi.fn<(e: React.KeyboardEvent<HTMLInputElement>) => void>(),
    handleClick: vi.fn<(doc: DocumentoGiurisprudenziale) => void>(),
    startDate: "",
    setStartDate: vi.fn<(v: string) => void>(),
    endDate: "",
    setEndDate: vi.fn<(v: string) => void>(),
    filterTipologia: "",
    setFilterTipologia: vi.fn<(v: string) => void>(),
    sortBy: "",
    setSortBy: vi.fn<(v: string) => void>(),
    filterSezione: "",
    setFilterSezione: vi.fn<(v: string) => void>(),
    numberPages: 1,
    setnumberPages: vi.fn<(v: number) => void>(),
    detailedMatch: null,
    isDeepSearchAvailable: false,
    handleDeepSearch: vi.fn<() => void>(),
    loadDistinctSottocategorie: vi.fn<() => Promise<string[]>>().mockResolvedValue([]),
    clearFilters: vi.fn<() => void>(),
    loading: false,
    deny: false,
    handleLoadMore: vi.fn<() => void>(),
    isDbPaginatedMode: false,
    hasMoreDbResults: false,
    webFallback: null,
    searchStatus: null,
  } as MockSearchBarHook,
}));

/* ---------- mock hook useSearchBar ---------- */
vi.mock("@/features/search/hooks/useSearchBar", () => ({
  useSearchBar: () => mockSearchBarState,
}));

/* ---------- mock child components ---------- */
vi.mock("@/features/search/components/LeftPickerPanel", () => ({
  LeftPickerPanel: ({
    open,
    onClose,
    runSearch,
  }: {
    open: boolean;
    onClose: () => void;
    runSearch: (term: string) => void;
  }) =>
    open ? (
      <div data-testid="mock-left-picker-panel">
        <button type="button" onClick={onClose}>
          Chiudi Picker
        </button>
        <button type="button" onClick={() => runSearch("Diritto Civile")}>
          Seleziona Argomento Picker
        </button>
      </div>
    ) : null,
}));

vi.mock("@/features/search/components/SearchFilters", () => ({
  SearchFilters: () => <div data-testid="mock-search-filters">SearchFilters Mock</div>,
}));

vi.mock("@/features/search/components/SearchResultsList", () => ({
  SearchResultsList: ({
    totalResultsCount,
    handleLoadMore,
  }: {
    totalResultsCount: number;
    handleLoadMore: () => void;
  }) => (
    <div data-testid="mock-search-results-list">
      <span>Risultati: {totalResultsCount}</span>
      <button type="button" onClick={handleLoadMore}>
        Carica Altri Risultati
      </button>
    </div>
  ),
}));

vi.mock("@/shared/components/AccessDenied", () => ({
  AccessDenied: () => <div data-testid="mock-access-denied">Accesso Negato</div>,
}));

vi.mock("@/shared/components/Typewriter", () => ({
  Typewriter: ({ text }: { text: string }) => <div data-testid="mock-typewriter">{text}</div>,
}));

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid={`icon-${name}`} {...props} />
  );
  return {
    Search: Icon("search"),
    Sliders: Icon("sliders"),
    X: Icon("x"),
    Loader2: Icon("loader-2"),
    BookOpen: Icon("book-open"),
    TextSearch: Icon("text-search"),
    CheckCircle2: Icon("check-circle-2"),
    ArrowLeft: Icon("arrow-left"),
    MoreVertical: Icon("more-vertical"),
    Mic: Icon("mic"),
  };
});

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    h1: ({ children, className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (
      <h1 className={className} {...props}>
        {children}
      </h1>
    ),
    p: ({ children, className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => (
      <p className={className} {...props}>
        {children}
      </p>
    ),
    div: ({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
    ul: ({ children, className, ...props }: React.HTMLAttributes<HTMLUListElement>) => (
      <ul className={className} {...props}>
        {children}
      </ul>
    ),
  },
}));

/* ---------- mock SpeechRecognition ---------- */
class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = "it-IT";
  onresult: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  onend: (() => void) | null = null;

  start = vi.fn();
  stop = vi.fn();
}

/* ---------- component ---------- */
import { SearchBar } from "@/features/search/components/SearchBar";

describe("SearchBar Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSearchBarState.searchInput = "";
    mockSearchBarState.filteredSuggestions = [];
    mockSearchBarState.activeIndex = -1;
    mockSearchBarState.showSuggestions = false;
    mockSearchBarState.topResults = [];
    mockSearchBarState.results = [];
    mockSearchBarState.visibleCount = 10;
    mockSearchBarState.detailedMatch = null;
    mockSearchBarState.isDeepSearchAvailable = false;
    mockSearchBarState.loading = false;
    mockSearchBarState.deny = false;
    mockSearchBarState.webFallback = null;
    mockSearchBarState.searchStatus = null;
    mockSearchBarState.loadDistinctSottocategorie.mockResolvedValue(["Contratti", "Societario"]);

    Object.defineProperty(window, "SpeechRecognition", {
      writable: true,
      configurable: true,
      value: MockSpeechRecognition,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      writable: true,
      configurable: true,
      value: MockSpeechRecognition,
    });

    window.innerWidth = 1024;
  });

  afterEach(() => {
    document.body.style.overflow = "unset";
    vi.restoreAllMocks();
  });

  test("renderizza l'intestazione principale, la barra di ricerca, i pulsanti filtri, picker, microfono e risultati", () => {
    render(<SearchBar />);

    expect(screen.getByRole("heading", { name: "Consulta la giurisprudenza online", level: 1 })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Cerca")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Apri pannello termini" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mostra filtri" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dettatura vocale" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Avvia ricerca" })).toBeInTheDocument();

    expect(screen.getByTestId("mock-search-results-list")).toBeInTheDocument();
  });

  test("renderizza la vista AccessDenied quando deny è true", () => {
    mockSearchBarState.deny = true;

    render(<SearchBar />);

    expect(screen.getByTestId("mock-access-denied")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Cerca")).toBeNull();
  });

  test("gestisce l'input di ricerca e aggiorna l'indice dei suggerimenti", () => {
    render(<SearchBar />);

    const input = screen.getByPlaceholderText("Cerca");
    fireEvent.change(input, { target: { value: "responsabilità medica" } });

    expect(mockSearchBarState.setSearchInput).toHaveBeenCalledWith("responsabilità medica");
    expect(mockSearchBarState.setShowSuggestions).toHaveBeenCalledWith(true);
    expect(mockSearchBarState.setActiveIndex).toHaveBeenCalledWith(-1);
  });

  test("mostra la lista di suggerimenti e invoca handleSearch alla selezione di un termine", () => {
    mockSearchBarState.showSuggestions = true;
    mockSearchBarState.filteredSuggestions = ["fideiussione omnibus", "contratti derivati"];

    render(<SearchBar />);

    expect(screen.getByText("fideiussione omnibus")).toBeInTheDocument();
    expect(screen.getByText("contratti derivati")).toBeInTheDocument();

    const firstSuggestion = screen.getByText("fideiussione omnibus").closest("li")!;
    fireEvent.mouseDown(firstSuggestion);

    expect(mockSearchBarState.setSearchInput).toHaveBeenCalledWith("fideiussione omnibus");
    expect(mockSearchBarState.setShowSuggestions).toHaveBeenCalledWith(false);
    expect(mockSearchBarState.handleSearch).toHaveBeenCalledWith("fideiussione omnibus");
  });

  test("mostra il messaggio di fallback quando non ci sono suggerimenti filtrati", () => {
    mockSearchBarState.showSuggestions = true;
    mockSearchBarState.filteredSuggestions = [];

    render(<SearchBar />);

    expect(screen.getByText("Nessun suggerimento trovato")).toBeInTheDocument();
  });

  test("apre e chiude il pannello filtri su desktop tramite il pulsante Sliders", () => {
    render(<SearchBar />);

    const toggleFiltersBtn = screen.getByRole("button", { name: "Mostra filtri" });
    expect(screen.queryByTestId("mock-search-filters")).toBeNull();

    fireEvent.click(toggleFiltersBtn);
    expect(screen.getAllByTestId("mock-search-filters")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Nascondi filtri" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Nascondi filtri" }));
    expect(screen.queryByTestId("mock-search-filters")).toBeNull();
  });

  test("apre il LeftPickerPanel caricando le sottocategorie distinte e permette la ricerca", async () => {
    render(<SearchBar />);

    const pickerBtn = screen.getByRole("button", { name: "Apri pannello termini" });
    fireEvent.click(pickerBtn);

    await waitFor(() => {
      expect(mockSearchBarState.loadDistinctSottocategorie).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByTestId("mock-left-picker-panel")).toBeInTheDocument();

    const selectItemBtn = screen.getByRole("button", { name: "Seleziona Argomento Picker" });
    fireEvent.click(selectItemBtn);

    expect(mockSearchBarState.handleSearch).toHaveBeenCalledWith("Diritto Civile");
  });

  test("gestisce il toggle del riconoscimento vocale (SpeechRecognition) e aggiorna l'input con il parlato", () => {
    render(<SearchBar />);

    const micBtn = screen.getByRole("button", { name: "Dettatura vocale" });
    fireEvent.click(micBtn);

    expect(screen.getByPlaceholderText("In ascolto...")).toBeInTheDocument();

    fireEvent.click(micBtn);
    expect(screen.getByPlaceholderText("Cerca")).toBeInTheDocument();
  });

  test("mostra il banner del match dettagliato (detailedMatch) per tipologie diverse", () => {
    mockSearchBarState.detailedMatch = {
      type: "numero_sentenza",
      query: "Cass. 100/2026",
      docs: [],
    };

    const { rerender } = render(<SearchBar />);

    expect(screen.getByText("Pronuncia Specifica")).toBeInTheDocument();
    expect(screen.getByText('Risultati per "Cass. 100/2026"')).toBeInTheDocument();

    mockSearchBarState.detailedMatch = {
      type: "sottocategoria",
      value: "Diritto Bancario",
      docs: [],
    };
    rerender(<SearchBar />);

    expect(screen.getByText("Categoria")).toBeInTheDocument();
    expect(screen.getByText('Risultati per "Diritto Bancario"')).toBeInTheDocument();
  });

  test("mostra il pulsante di ricerca semantica profonda (Deep Search) e invoca handleDeepSearch", () => {
    mockSearchBarState.isDeepSearchAvailable = true;

    render(<SearchBar />);

    const deepSearchBtn = screen.getByRole("button", { name: /Ricerca semantica/i });
    expect(deepSearchBtn).toBeInTheDocument();

    fireEvent.click(deepSearchBtn);
    expect(mockSearchBarState.handleDeepSearch).toHaveBeenCalledTimes(1);
  });

  test("renderizza il box di sintesi AI e ricerca estesa quando searchStatus è GEMINI_FALLBACK", () => {
    mockSearchBarState.searchStatus = "GEMINI_FALLBACK";
    mockSearchBarState.webFallback = {
      sintesi: "Sintesi dell'istituto giuridico elaborata dall'AI.",
      queryAlternativa: "clausole anatocistiche nullità",
    };

    render(<SearchBar />);

    expect(screen.getByText("Sintesi AI & Ricerca Estesa")).toBeInTheDocument();
    expect(screen.getByTestId("mock-typewriter")).toHaveTextContent(
      "Sintesi dell'istituto giuridico elaborata dall'AI."
    );
    expect(screen.getByText('"clausole anatocistiche nullità"')).toBeInTheDocument();
  });

  test("mostra lo spinner di caricamento centrale se loading è true e non ci sono risultati", () => {
    mockSearchBarState.loading = true;
    mockSearchBarState.topResults = [];
    mockSearchBarState.results = [];

    render(<SearchBar />);

    expect(screen.getByText("Ricerca in corso…")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ricerca in corso…")).toBeDisabled();
  });

  test("gestisce il menu mobile e l'apertura dei filtri su dispositivi a schermo ridotto", () => {
    window.innerWidth = 480;

    render(<SearchBar />);

    const mobileMenuBtn = screen.getByRole("button", { name: "Menu opzioni" });
    fireEvent.click(mobileMenuBtn);

    const advancedFiltersBtn = screen.getByRole("button", { name: /Filtri Avanzati/i });
    expect(advancedFiltersBtn).toBeInTheDocument();

    fireEvent.click(advancedFiltersBtn);

    expect(screen.getByRole("heading", { name: "Filtri di ricerca", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Applica filtri" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Chiudi filtri" }));
    expect(screen.queryByRole("heading", { name: "Filtri di ricerca" })).toBeNull();
  });
});