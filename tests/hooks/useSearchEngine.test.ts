import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import type { DocumentoGiurisprudenziale } from "@/interfaces/interfaces";
import type { useSearchFilters } from "@/hooks/useSearchFilters";

/* ---------- hoisted mocks ---------- */
const {
  mockToast,
  mockTrackEvent,
  mockWithTrace,
  mockVectorSearch,
  mockLoadUserSearchTerms,
  mockSaveUserSearchTerm,
  mockFindByNumeroSentenza,
  mockFindNormativaFromUserQuery,
  mockFindBySottocategoria,
  mockIsAuthzError,
  mockIsUnavailableError,
  mockIsNetworkError,
  mockFetchCortePaginata,
  mockMapGradoToDbFields,
} = vi.hoisted(() => ({
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  mockTrackEvent: vi.fn(),
  mockWithTrace: vi.fn(
    async (_name: string, _meta: unknown, fn: () => Promise<unknown> | unknown) => await fn()
  ),
  mockVectorSearch: vi.fn(),
  mockLoadUserSearchTerms: vi.fn(),
  mockSaveUserSearchTerm: vi.fn(),
  mockFindByNumeroSentenza: vi.fn(),
  mockFindNormativaFromUserQuery: vi.fn(),
  mockFindBySottocategoria: vi.fn(),
  mockIsAuthzError: vi.fn(() => false),
  mockIsUnavailableError: vi.fn(() => false),
  mockIsNetworkError: vi.fn(() => false),
  mockFetchCortePaginata: vi.fn(),
  mockMapGradoToDbFields: vi.fn((grado?: string) => {
    if (grado === "Cassazione") {
      return { organo_giudicante: "Corte di Cassazione", materia: "Civile" };
    }
    return { organo_giudicante: undefined, materia: undefined };
  }),
}));

/* ---------- mock modules ---------- */
vi.mock("react-hot-toast", () => ({
  toast: mockToast,
}));

vi.mock("firebase/app", () => {
  class FirebaseError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "FirebaseError";
      this.code = code;
    }
  }
  return { FirebaseError };
});

vi.mock("@/services/analytics", () => ({
  __esModule: true,
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

vi.mock("@/services/perf", () => ({
  __esModule: true,
  withTrace: (...args: unknown[]) =>
    mockWithTrace(args[0] as string, args[1], args[2] as () => Promise<unknown>),
}));

vi.mock("@/services/vectorSearch", () => ({
  __esModule: true,
  vectorSearch: (...args: unknown[]) => mockVectorSearch(...args),
}));

vi.mock("@/services/search", () => ({
  __esModule: true,
  loadUserSearchTerms: (...args: unknown[]) => mockLoadUserSearchTerms(...args),
  saveUserSearchTerm: (...args: unknown[]) => mockSaveUserSearchTerm(...args),
  findByNumeroSentenza: (...args: unknown[]) => mockFindByNumeroSentenza(...args),
  findNormativaFromUserQuery: (...args: unknown[]) => mockFindNormativaFromUserQuery(...args),
  findBySottocategoria: (...args: unknown[]) => mockFindBySottocategoria(...args),
  isAuthzError: () => mockIsAuthzError(),
  isUnavailableError: () => mockIsUnavailableError(),
  isNetworkError: () => mockIsNetworkError(),
  fetchCortePaginata: (...args: unknown[]) => mockFetchCortePaginata(...args),
}));

vi.mock("./useSearchFilters", () => ({
  __esModule: true,
  mapGradoToDbFields: (grado?: string) => mockMapGradoToDbFields(grado),
  useSearchFilters: vi.fn(),
}));

vi.mock("@/hooks/useSearchFilters", () => ({
  __esModule: true,
  mapGradoToDbFields: (grado?: string) => mockMapGradoToDbFields(grado),
  useSearchFilters: vi.fn(),
}));

/* ---------- subject under test ---------- */
import { useSearchHistory, useSearchEngine } from "@/hooks/useSearchEngine";

describe("useSearchHistory Hook Suite", () => {
  const currentUid = "usr_flv_2026";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  test("carica la cronologia ricerche dell'utente al mount", async () => {
    mockLoadUserSearchTerms.mockResolvedValueOnce(["anatocismo", "fideiussione", "usura"]);

    const { result } = renderHook(() => useSearchHistory(currentUid, ""));

    await waitFor(() => {
      expect(result.current.userTerms).toHaveLength(3);
    });

    expect(mockLoadUserSearchTerms).toHaveBeenCalledWith(currentUid, 50);
    expect(result.current.filteredSuggestions).toEqual(["anatocismo", "fideiussione", "usura"]);
  });

  test("azzera la cronologia senza interrogare il servizio se uid è nullo", async () => {
    const { result } = renderHook(() => useSearchHistory(null, ""));

    await waitFor(() => {
      expect(result.current.userTerms).toEqual([]);
    });

    expect(mockLoadUserSearchTerms).not.toHaveBeenCalled();
    expect(result.current.filteredSuggestions).toEqual([]);
  });

  test("filtra i suggerimenti in base all'input utente in modalità case-insensitive", async () => {
    mockLoadUserSearchTerms.mockResolvedValueOnce([
      "Responsabilità Civile Banca",
      "Clausola Floor",
      "Responsabilità Sanitaria",
      "Contratto Derivato",
    ]);

    const { result, rerender } = renderHook(
      ({ input }) => useSearchHistory(currentUid, input),
      { initialProps: { input: "resp" } }
    );

    await waitFor(() => {
      expect(result.current.userTerms).toHaveLength(4);
    });

    expect(result.current.filteredSuggestions).toEqual([
      "Responsabilità Civile Banca",
      "Responsabilità Sanitaria",
    ]);

    rerender({ input: "FLOOR" });
    expect(result.current.filteredSuggestions).toEqual(["Clausola Floor"]);
  });

  test("traccia l'errore analytics se il recupero dei termini fallisce", async () => {
    mockLoadUserSearchTerms.mockRejectedValueOnce(new Error("Firestore connection timeout"));

    const { result } = renderHook(() => useSearchHistory(currentUid, ""));

    await waitFor(() => {
      expect(result.current.userTerms).toEqual([]);
    });

    expect(mockTrackEvent).toHaveBeenCalledWith("analytics_error", {
      name: "loadUserSearchTerms",
      reason: "Firestore connection timeout",
    });
  });

  test("addTermToHistory persiste il termine ed evita duplicati in testa all'elenco", async () => {
    mockLoadUserSearchTerms.mockResolvedValueOnce(["fideiussione", "mutuo"]);
    mockSaveUserSearchTerm.mockResolvedValueOnce(undefined);

    const { result } = renderHook(() => useSearchHistory(currentUid, ""));

    await waitFor(() => {
      expect(result.current.userTerms).toHaveLength(2);
    });

    await act(async () => {
      await result.current.addTermToHistory("mutuo");
    });

    expect(mockSaveUserSearchTerm).toHaveBeenCalledWith(currentUid, "mutuo");
    expect(result.current.userTerms).toEqual(["mutuo", "fideiussione"]);
  });
});

describe("useSearchEngine Hook Suite", () => {
  const createMockDoc = (
    id: string,
    overrides: Record<string, unknown> = {}
  ): DocumentoGiurisprudenziale =>
    ({
      id,
      numero: "1234",
      anno: 2026,
      organo_giudicante: "Corte di Cassazione",
      materia: "Civile",
      massima: "Principio giurisprudenziale di test",
      sottotipo_documento: "",
      ...overrides,
    } as unknown as DocumentoGiurisprudenziale);

  const createMockFilters = (
    overrides: Record<string, unknown> = {}
  ): ReturnType<typeof useSearchFilters> =>
    ({
      filterGrado: "",
      filterTipo: "",
      filterTipologia: "",
      filterSezione: "",
      startDate: "",
      endDate: "",
      sortBy: "relevance",
      numberPages: 1,
      buildVectorFilters: vi.fn(() => []),
      applyUiFiltersAndSort: vi.fn((docs: DocumentoGiurisprudenziale[]) => docs),
      ...overrides,
    } as unknown as ReturnType<typeof useSearchFilters>);

  const createMockHistory = (): ReturnType<typeof useSearchHistory> =>
    ({
      userTerms: [],
      filteredSuggestions: [],
      addTermToHistory: vi.fn().mockResolvedValue(undefined),
    } as unknown as ReturnType<typeof useSearchHistory>);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    mockFindByNumeroSentenza.mockResolvedValue([]);
    mockFindNormativaFromUserQuery.mockResolvedValue({ docs: [], keys: [] });
    mockFindBySottocategoria.mockResolvedValue([]);
    mockVectorSearch.mockResolvedValue({
      topMatches: [],
      allMatches: [],
      status: "SUCCESS",
      webFallback: null,
    });
  });

  describe("Guardie Preliminari e Modalità Browse Database", () => {
    test("restituisce array vuoto se la query è vuota e non vi sono filtri di navigazione attivi", async () => {
      const filters = createMockFilters();
      const history = createMockHistory();

      const { result } = renderHook(() => useSearchEngine(filters, history));

      let res: DocumentoGiurisprudenziale[] = [];
      await act(async () => {
        res = await result.current.handleSearch("");
      });

      expect(res).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(mockFetchCortePaginata).not.toHaveBeenCalled();
    });

    test("attiva isDbPaginatedMode e interroga fetchCortePaginata se la query è vuota ma i filtri sono attivi", async () => {
      const dbDocs = [createMockDoc("doc_db_1"), createMockDoc("doc_db_2")];
      const mockLastDoc = { id: "snap_last" } as unknown as QueryDocumentSnapshot<DocumentData>;

      mockFetchCortePaginata.mockResolvedValueOnce({
        docs: dbDocs,
        lastVisible: mockLastDoc,
      });

      const filters = createMockFilters({ filterGrado: "Cassazione" });
      const history = createMockHistory();

      const { result } = renderHook(() => useSearchEngine(filters, history));

      let res: DocumentoGiurisprudenziale[] = [];
      await act(async () => {
        res = await result.current.handleSearch("");
      });

      expect(result.current.isDbPaginatedMode).toBe(true);
      expect(mockFetchCortePaginata).toHaveBeenCalledWith(
        null,
        null,
        "Corte di Cassazione",
        "Civile",
        "",
        null,
        null,
        null,
        null,
        1
      );
      expect(res).toHaveLength(2);
      expect(result.current.results).toEqual(dbDocs);
    });
  });

  describe("Corrispondenze Esatte e Specific Matches", () => {
    test("identifica ricerca per numero di sentenza impostando detailedMatch senza ricerca vettoriale", async () => {
      const targetDoc = createMockDoc("doc_num_1", { numero: "500/2026" });
      mockFindByNumeroSentenza.mockResolvedValueOnce([targetDoc]);

      const filters = createMockFilters();
      const history = createMockHistory();

      const { result } = renderHook(() => useSearchEngine(filters, history));

      await act(async () => {
        await result.current.handleSearch("500/2026");
      });

      expect(mockFindByNumeroSentenza).toHaveBeenCalledWith("500/2026");
      expect(mockVectorSearch).not.toHaveBeenCalled();
      expect(result.current.detailedMatch).toEqual({
        type: "numero_sentenza",
        query: "500/2026",
        docs: [targetDoc],
      });
      expect(result.current.isDeepSearchAvailable).toBe(false);
      expect(result.current.results).toEqual([targetDoc]);
    });

    test("identifica ricerca per normativa impostando detailedMatch e abilitando deepSearch", async () => {
      const normaDoc = createMockDoc("doc_norma_1");
      mockFindNormativaFromUserQuery.mockResolvedValueOnce({
        docs: [normaDoc],
        keys: ["art_2043_cc"],
      });

      const filters = createMockFilters();
      const history = createMockHistory();

      const { result } = renderHook(() => useSearchEngine(filters, history));

      await act(async () => {
        await result.current.handleSearch("art 2043 cc");
      });

      expect(result.current.detailedMatch).toEqual({
        type: "normativa",
        query: "art 2043 cc",
        key: "art_2043_cc",
        docs: [normaDoc],
      });
      expect(result.current.isDeepSearchAvailable).toBe(true);
      expect(mockVectorSearch).not.toHaveBeenCalled();
    });

    test("identifica query per sottocategoria tramite prefisso esplicito", async () => {
      const subcatDoc = createMockDoc("doc_sub_1");
      mockFindBySottocategoria.mockResolvedValueOnce([subcatDoc]);

      const filters = createMockFilters();
      const history = createMockHistory();

      const { result } = renderHook(() => useSearchEngine(filters, history));

      await act(async () => {
        await result.current.handleSearch("sottocategoria: anatocismo bancario");
      });

      expect(mockFindBySottocategoria).toHaveBeenCalledWith("anatocismo bancario");
      expect(result.current.detailedMatch).toEqual({
        type: "sottocategoria",
        query: "sottocategoria: anatocismo bancario",
        value: "anatocismo bancario",
        docs: [subcatDoc],
      });
      expect(result.current.results).toEqual([subcatDoc]);
    });
  });

  describe("Ricerca Vettoriale Ibrida e Web Fallback", () => {
    test("esegue vectorSearch quando non vi sono specific match e unifica i risultati senza duplicati", async () => {
      const vectorTop = [createMockDoc("doc_top_1")];
      const vectorAll = [createMockDoc("doc_top_1"), createMockDoc("doc_all_2")];

      mockVectorSearch.mockResolvedValueOnce({
        topMatches: vectorTop,
        allMatches: vectorAll,
        status: "SUCCESS",
        webFallback: null,
      });

      const filters = createMockFilters();
      const history = createMockHistory();

      const { result } = renderHook(() => useSearchEngine(filters, history));

      await act(async () => {
        await result.current.handleSearch("usura sopravvenuta nei mutui a tasso fisso");
      });

      expect(mockVectorSearch).toHaveBeenCalled();
      expect(result.current.topResults).toEqual(vectorTop);
      expect(result.current.results).toEqual([createMockDoc("doc_all_2")]);
      expect(result.current.searchStatus).toBe("SUCCESS");
      expect(result.current.webFallback).toBeNull();
    });

    test("gestisce status GEMINI_FALLBACK valorizzando i dati di webFallback", async () => {
      const mockFallback = {
        summary: "Sintesi giurisprudenziale generata da ricerca web",
        sources: [{ title: "Corte Cassazione", url: "https://cassazione.it" }],
      };

      mockVectorSearch.mockResolvedValueOnce({
        topMatches: [],
        allMatches: [],
        status: "GEMINI_FALLBACK",
        webFallback: mockFallback,
      });

      const filters = createMockFilters();
      const history = createMockHistory();

      const { result } = renderHook(() => useSearchEngine(filters, history));

      await act(async () => {
        await result.current.handleSearch("tema giuridico recente senza sentenze in locale");
      });

      expect(result.current.searchStatus).toBe("GEMINI_FALLBACK");
      expect(result.current.webFallback).toEqual(mockFallback);
    });
  });

  describe("Ricerca Approfondita (handleDeepSearch)", () => {
    test("esegue la vectorSearch sui documenti generici e disabilita isDeepSearchAvailable", async () => {
      const deepTop = [createMockDoc("deep_top_1")];
      const deepAll = [createMockDoc("deep_all_1")];

      mockVectorSearch.mockResolvedValueOnce({
        topMatches: deepTop,
        allMatches: deepAll,
        status: "SUCCESS",
        webFallback: null,
      });

      const filters = createMockFilters();
      const history = createMockHistory();

      const { result } = renderHook(() => useSearchEngine(filters, history));

      await act(async () => {
        await result.current.handleDeepSearch("responsabilità precontrattuale");
      });

      expect(mockVectorSearch).toHaveBeenCalled();
      expect(result.current.topResults).toEqual(deepTop);
      expect(result.current.isDeepSearchAvailable).toBe(false);
      expect(result.current.loading).toBe(false);
    });

    test("ignora la chiamata se la stringa di ricerca è vuota", async () => {
      const filters = createMockFilters();
      const history = createMockHistory();

      const { result } = renderHook(() => useSearchEngine(filters, history));

      await act(async () => {
        await result.current.handleDeepSearch("   ");
      });

      expect(mockVectorSearch).not.toHaveBeenCalled();
    });
  });

  describe("Paginazione e Caricamento Successivo (handleLoadMore)", () => {
    test("in modalità standard incrementa visibleCount di 10", async () => {
      const filters = createMockFilters();
      const history = createMockHistory();

      const { result } = renderHook(() => useSearchEngine(filters, history));

      expect(result.current.visibleCount).toBe(10);

      act(() => {
        result.current.handleLoadMore();
      });

      expect(result.current.visibleCount).toBe(20);
    });

    test("in modalità isDbPaginatedMode richiede la pagina successiva passando lastDbDoc", async () => {
      const initialDocs = Array.from({ length: 10 }, (_, i) => createMockDoc(`doc_${i}`));
      const secondPageDocs = [createMockDoc("doc_page_2_1")];
      const mockSnapshot1 = { id: "snap_1" } as unknown as QueryDocumentSnapshot<DocumentData>;
      const mockSnapshot2 = { id: "snap_2" } as unknown as QueryDocumentSnapshot<DocumentData>;

      mockFetchCortePaginata
        .mockResolvedValueOnce({ docs: initialDocs, lastVisible: mockSnapshot1 })
        .mockResolvedValueOnce({ docs: secondPageDocs, lastVisible: mockSnapshot2 });

      const filters = createMockFilters({ filterGrado: "Cassazione" });
      const history = createMockHistory();

      const { result } = renderHook(() => useSearchEngine(filters, history));

      await act(async () => {
        await result.current.handleSearch("");
      });

      expect(result.current.isDbPaginatedMode).toBe(true);
      expect(result.current.hasMoreDbResults).toBe(true);

      await act(async () => {
        await result.current.handleLoadMore();
      });

      expect(mockFetchCortePaginata).toHaveBeenLastCalledWith(
        null,
        null,
        "Corte di Cassazione",
        "Civile",
        "",
        null,
        null,
        null,
        mockSnapshot1,
        1
      );
      expect(result.current.results).toHaveLength(11);
      expect(result.current.hasMoreDbResults).toBe(false);
    });
  });

  describe("Gestione degli Errori e Notifiche", () => {
    test("imposta deny a true se l'errore è di autorizzazione (isAuthzError)", async () => {
      mockFindByNumeroSentenza.mockRejectedValueOnce(new Error("Unauthorized access"));
      mockIsAuthzError.mockReturnValueOnce(true);

      const filters = createMockFilters();
      const history = createMockHistory();

      const { result } = renderHook(() => useSearchEngine(filters, history));

      await act(async () => {
        await result.current.handleSearch("123/2026");
      });

      expect(result.current.deny).toBe(true);
      expect(result.current.loading).toBe(false);
    });

    test("mostra toast di servizio non disponibile se isUnavailableError è vero", async () => {
      mockFindByNumeroSentenza.mockRejectedValueOnce(new Error("Service unavailable"));
      mockIsUnavailableError.mockReturnValueOnce(true);

      const filters = createMockFilters();
      const history = createMockHistory();

      const { result } = renderHook(() => useSearchEngine(filters, history));

      await act(async () => {
        await result.current.handleSearch("test query");
      });

      expect(mockToast.error).toHaveBeenCalledWith("Servizio non disponibile. Riprova.");
    });

    test("mostra toast di errore rete se isNetworkError è vero", async () => {
      mockFindByNumeroSentenza.mockRejectedValueOnce(new Error("Network failed"));
      mockIsNetworkError.mockReturnValueOnce(true);

      const filters = createMockFilters();
      const history = createMockHistory();

      const { result } = renderHook(() => useSearchEngine(filters, history));

      await act(async () => {
        await result.current.handleSearch("test query");
      });

      expect(mockToast.error).toHaveBeenCalledWith("Errore di rete. Controlla la connessione.");
    });
  });
});