import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { KeyboardEvent } from "react";
import type { DocumentoGiurisprudenziale } from "@/interfaces/interfaces";

/* ---------- hoisted mocks ---------- */
const {
  mockUseAuth,
  mockTrackEvent,
  mockLoadDistinctSottocategorie,
  mockFilters,
  mockHistory,
  mockEngine,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockTrackEvent: vi.fn(),
  mockLoadDistinctSottocategorie: vi.fn(),
  mockFilters: {
    applyUiFiltersAndSort: vi.fn((docs: unknown[]) => docs),
  },
  mockHistory: {
    filteredSuggestions: ["anatocismo bancario", "usura contrattuale", "interessi moratori"],
    historyList: ["precedente 1", "precedente 2"],
    addToHistory: vi.fn(),
  },
  mockEngine: {
    handleSearch: vi.fn().mockResolvedValue(undefined),
    handleDeepSearch: vi.fn().mockResolvedValue(undefined),
  },
}));

/* ---------- mock modules ---------- */
vi.mock("@/context/useAuth", () => ({
  __esModule: true,
  useAuth: () => mockUseAuth(),
}));

vi.mock("@/services/analytics", () => ({
  __esModule: true,
  trackEvent: (...args: unknown[]) => mockTrackEvent(...args),
}));

vi.mock("@/services/search", () => ({
  __esModule: true,
  loadDistinctSottocategorie: mockLoadDistinctSottocategorie,
}));

vi.mock("@/hooks/useSearchFilters", () => ({
  __esModule: true,
  useSearchFilters: () => mockFilters,
}));

vi.mock("@/hooks/useSearchEngine", () => ({
  __esModule: true,
  useSearchHistory: () => mockHistory,
  useSearchEngine: () => mockEngine,
}));

// Fallback per risoluzione percorsi relativi interni al modulo
vi.mock("./useSearchFilters", () => ({
  __esModule: true,
  useSearchFilters: () => mockFilters,
}));

vi.mock("./useSearchEngine", () => ({
  __esModule: true,
  useSearchHistory: () => mockHistory,
  useSearchEngine: () => mockEngine,
}));

/* ---------- subject under test ---------- */
import { useSearchBar } from "@/hooks/useSearchBar";

describe("useSearchBar Hook Suite", () => {
  const originalWindowOpen = window.open;
  const originalWindowFocus = window.focus;
  const originalInnerWidth = window.innerWidth;

  const mockWindowOpen = vi.fn();
  const mockWindowFocus = vi.fn();

  const setWindowWidth = (width: number) => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: width,
    });
  };

  const createKeyboardEvent = (key: string): KeyboardEvent<HTMLInputElement> =>
    ({
      key,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent<HTMLInputElement>);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({ user: { uid: "usr_flv_2026" } });
    window.open = mockWindowOpen;
    window.focus = mockWindowFocus;
    setWindowWidth(1024);
  });

  afterEach(() => {
    window.open = originalWindowOpen;
    window.focus = originalWindowFocus;
    setWindowWidth(originalInnerWidth);
  });

  describe("Inizializzazione e Composizione", () => {
    test("inizializza gli stati locali ed espone metodi e proprietà derivate", () => {
      const { result } = renderHook(() => useSearchBar());

      expect(result.current.searchInput).toBe("");
      expect(result.current.activeIndex).toBe(-1);
      expect(result.current.showSuggestions).toBe(false);

      expect(result.current.filteredSuggestions).toEqual([
        "anatocismo bancario",
        "usura contrattuale",
        "interessi moratori",
      ]);
      expect(result.current.applyUiFiltersAndSort).toBeDefined();
      expect(result.current.loadDistinctSottocategorie).toBe(mockLoadDistinctSottocategorie);
    });

    test("gestisce il caso in cui l'utente auth sia nullo", () => {
      mockUseAuth.mockReturnValue({ user: null });

      const { result } = renderHook(() => useSearchBar());

      expect(result.current.searchInput).toBe("");
      expect(result.current.activeIndex).toBe(-1);
    });
  });

  describe("Gestione Tastiera dei Suggerimenti (handleKeyDown)", () => {
    test("ignora i tasti se i suggerimenti non sono visibili", async () => {
      const { result } = renderHook(() => useSearchBar());
      const event = createKeyboardEvent("ArrowDown");

      await act(async () => {
        await result.current.handleKeyDown(event);
      });

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(result.current.activeIndex).toBe(-1);
    });

    test("ArrowDown incrementa activeIndex fino all'ultimo suggerimento", async () => {
      const { result } = renderHook(() => useSearchBar());

      act(() => {
        result.current.setShowSuggestions(true);
      });

      const event1 = createKeyboardEvent("ArrowDown");
      await act(async () => {
        await result.current.handleKeyDown(event1);
      });
      expect(event1.preventDefault).toHaveBeenCalled();
      expect(result.current.activeIndex).toBe(0);

      const event2 = createKeyboardEvent("ArrowDown");
      await act(async () => {
        await result.current.handleKeyDown(event2);
      });
      expect(result.current.activeIndex).toBe(1);

      const event3 = createKeyboardEvent("ArrowDown");
      await act(async () => {
        await result.current.handleKeyDown(event3);
      });
      expect(result.current.activeIndex).toBe(2);

      // Si ferma all'ultimo elemento
      const event4 = createKeyboardEvent("ArrowDown");
      await act(async () => {
        await result.current.handleKeyDown(event4);
      });
      expect(result.current.activeIndex).toBe(2);
    });

    test("ArrowUp decrementa activeIndex fino a -1", async () => {
      const { result } = renderHook(() => useSearchBar());

      act(() => {
        result.current.setShowSuggestions(true);
        result.current.setActiveIndex(1);
      });

      const event1 = createKeyboardEvent("ArrowUp");
      await act(async () => {
        await result.current.handleKeyDown(event1);
      });
      expect(event1.preventDefault).toHaveBeenCalled();
      expect(result.current.activeIndex).toBe(0);

      const event2 = createKeyboardEvent("ArrowUp");
      await act(async () => {
        await result.current.handleKeyDown(event2);
      });
      expect(result.current.activeIndex).toBe(-1);

      // Non scende sotto -1
      const event3 = createKeyboardEvent("ArrowUp");
      await act(async () => {
        await result.current.handleKeyDown(event3);
      });
      expect(result.current.activeIndex).toBe(-1);
    });

    test("Escape chiude i suggerimenti e resetta activeIndex a -1", async () => {
      const { result } = renderHook(() => useSearchBar());

      act(() => {
        result.current.setShowSuggestions(true);
        result.current.setActiveIndex(2);
      });

      const event = createKeyboardEvent("Escape");
      await act(async () => {
        await result.current.handleKeyDown(event);
      });

      expect(result.current.showSuggestions).toBe(false);
      expect(result.current.activeIndex).toBe(-1);
    });

    test("Enter con activeIndex >= 0 seleziona il suggerimento evidenziato ed esegue la ricerca", async () => {
      const { result } = renderHook(() => useSearchBar());

      act(() => {
        result.current.setShowSuggestions(true);
        result.current.setActiveIndex(1); // "usura contrattuale"
      });

      const event = createKeyboardEvent("Enter");
      await act(async () => {
        await result.current.handleKeyDown(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(result.current.showSuggestions).toBe(false);
      expect(result.current.activeIndex).toBe(-1);
      expect(mockEngine.handleSearch).toHaveBeenCalledWith("usura contrattuale");
    });

    test("Enter con activeIndex a -1 esegue la ricerca con searchInput", async () => {
      const { result } = renderHook(() => useSearchBar());

      act(() => {
        result.current.setSearchInput("clausola floor leasing");
        result.current.setShowSuggestions(true);
        result.current.setActiveIndex(-1);
      });

      const event = createKeyboardEvent("Enter");
      await act(async () => {
        await result.current.handleKeyDown(event);
      });

      expect(event.preventDefault).toHaveBeenCalled();
      expect(result.current.showSuggestions).toBe(false);
      expect(result.current.activeIndex).toBe(-1);
      expect(mockEngine.handleSearch).toHaveBeenCalledWith("clausola floor leasing");
    });
  });

  describe("Apertura Documento e Tracciamento (handleClick)", () => {
    const mockDocument = { id: "cass_civ_2026_99" } as DocumentoGiurisprudenziale;

    test("su desktop apre in nuova scheda (_blank), traccia l'evento e chiama window.focus", () => {
      setWindowWidth(1280);
      const mockWindowInstance = { focus: vi.fn() };
      mockWindowOpen.mockReturnValue(mockWindowInstance);

      const { result } = renderHook(() => useSearchBar());

      act(() => {
        result.current.handleClick(mockDocument);
      });

      expect(mockTrackEvent).toHaveBeenCalledWith("sentence_opened", { source: "search" });
      expect(mockWindowOpen).toHaveBeenCalledWith("/giurisprudenza/cass_civ_2026_99", "_blank");
      expect(mockWindowFocus).toHaveBeenCalled();
    });

    test("su desktop non manda in crash né chiama window.focus se window.open restituisce null", () => {
      setWindowWidth(1280);
      mockWindowOpen.mockReturnValue(null);

      const { result } = renderHook(() => useSearchBar());

      act(() => {
        result.current.handleClick(mockDocument);
      });

      expect(mockTrackEvent).toHaveBeenCalledWith("sentence_opened", { source: "search" });
      expect(mockWindowOpen).toHaveBeenCalledWith("/giurisprudenza/cass_civ_2026_99", "_blank");
      expect(mockWindowFocus).not.toHaveBeenCalled();
    });

    test("su mobile (< 768px) apre nella stessa finestra (_self) e non chiama window.focus", () => {
      setWindowWidth(480);

      const { result } = renderHook(() => useSearchBar());

      act(() => {
        result.current.handleClick(mockDocument);
      });

      expect(mockTrackEvent).toHaveBeenCalledWith("sentence_opened", { source: "search" });
      expect(mockWindowOpen).toHaveBeenCalledWith("/giurisprudenza/cass_civ_2026_99", "_self");
      expect(mockWindowFocus).not.toHaveBeenCalled();
    });
  });

  describe("Metodi Wrapper di Ricerca", () => {
    test("handleDeepSearch inoltra il valore corrente di searchInput ad engine.handleDeepSearch", () => {
      const { result } = renderHook(() => useSearchBar());

      act(() => {
        result.current.setSearchInput("ammortamento alla francese");
      });

      act(() => {
        result.current.handleDeepSearch();
      });

      expect(mockEngine.handleDeepSearch).toHaveBeenCalledWith("ammortamento alla francese");
    });

    test("handleSearch inoltra il termine passato ad engine.handleSearch", () => {
      const { result } = renderHook(() => useSearchBar());

      act(() => {
        result.current.handleSearch("fideiussione omnibus");
      });

      expect(mockEngine.handleSearch).toHaveBeenCalledWith("fideiussione omnibus");
    });
  });
});