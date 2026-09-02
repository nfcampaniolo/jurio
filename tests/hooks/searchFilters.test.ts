import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { DocumentoGiurisprudenziale } from "@/interfaces/interfaces";

/* ---------- hoisted mocks ---------- */
const { mockToast, mockTimestampFromDate } = vi.hoisted(() => ({
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  mockTimestampFromDate: vi.fn((d: Date) => ({
    _type: "Timestamp",
    toDate: () => d,
    seconds: Math.floor(d.getTime() / 1000),
  })),
}));

/* ---------- mock modules ---------- */
vi.mock("react-hot-toast", () => ({
  __esModule: true,
  toast: mockToast,
}));

vi.mock("firebase/firestore", () => ({
  __esModule: true,
  Timestamp: {
    fromDate: mockTimestampFromDate,
  },
}));

/* ---------- subject under test ---------- */
import {
  useSearchFilters,
  SEARCH_FILTERS_CACHE_KEY,
  DEFAULT_FILTERS,
  isSerializedTimestamp,
  parseDataSentenzaMs,
  parseDocDateMs,
  hasSezione,
  mapGradoToDbFields,
} from "@/hooks/useSearchFilters";

describe("useSearchFilters & Search Utilities Suite", () => {
  const localStorageStore: Record<string, string> = {};

  beforeEach(() => {
    vi.clearAllMocks();

    Object.keys(localStorageStore).forEach((key) => {
      delete localStorageStore[key];
    });

    vi.spyOn(console, "error").mockImplementation(() => {});

    vi.stubGlobal("localStorage", {
      getItem: vi.fn((key: string) => localStorageStore[key] || null),

      setItem: vi.fn((key: string, value: string) => {
        localStorageStore[key] = value;
      }),

      removeItem: vi.fn((key: string) => {
        delete localStorageStore[key];
      }),

      clear: vi.fn(() => {
        Object.keys(localStorageStore).forEach((key) => {
          delete localStorageStore[key];
        });
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Funzioni Pure di Mappatura e Parsing", () => {
    test("mapGradoToDbFields restituisce l'organo giudicante e la materia corretti", () => {
      expect(mapGradoToDbFields("Cassazione Civile")).toEqual({
        organo_giudicante: "CORTE DI CASSAZIONE",
        materia: "Civile",
      });
      expect(mapGradoToDbFields("Cassazione Penale")).toEqual({
        organo_giudicante: "CORTE DI CASSAZIONE",
        materia: "Penale",
      });
      expect(mapGradoToDbFields("Corte Costituzionale")).toEqual({
        organo_giudicante: "CORTE COSTITUZIONALE",
        materia: null,
      });
      expect(mapGradoToDbFields("Consiglio di Stato")).toEqual({
        organo_giudicante: "CONSIGLIO DI STATO",
        materia: null,
      });
      expect(mapGradoToDbFields("Altro")).toEqual({
        organo_giudicante: null,
        materia: null,
      });
    });

    test("isSerializedTimestamp valida solo oggetti non nulli", () => {
      expect(isSerializedTimestamp({ seconds: 123 })).toBe(true);
      expect(isSerializedTimestamp(null)).toBe(false);
      expect(isSerializedTimestamp("string")).toBe(false);
    });

    test("parseDataSentenzaMs gestisce correttamente tutti i formati supportati", () => {
      const targetDate = new Date("2026-06-15T12:00:00Z");

      expect(parseDataSentenzaMs(null)).toBeNull();
      expect(parseDataSentenzaMs("data-invalida")).toBeNull();
      expect(parseDataSentenzaMs({ seconds: 1770000000 })).toBe(1770000000000);
      expect(parseDataSentenzaMs({ _seconds: 1780000000 })).toBe(1780000000000);
      expect(parseDataSentenzaMs({ toDate: () => targetDate })).toBe(targetDate.getTime());
      expect(parseDataSentenzaMs("2026-06-15T12:00:00Z")).toBe(targetDate.getTime());
      expect(parseDataSentenzaMs(targetDate.getTime())).toBe(targetDate.getTime());
      expect(parseDataSentenzaMs(targetDate)).toBe(targetDate.getTime());
    });

    test("parseDocDateMs estrae la data dal documento", () => {
      const doc = {
        dataSentenza: "2026-03-10T10:00:00Z",
      } as unknown as DocumentoGiurisprudenziale;

      expect(parseDocDateMs(doc)).toBe(new Date("2026-03-10T10:00:00Z").getTime());
    });

    test("hasSezione riconosce sia la proprietà 'sezione' che 'sez'", () => {
      expect(hasSezione({ sezione: "Sez. I" } as unknown as DocumentoGiurisprudenziale)).toBe(true);
      expect(hasSezione({ sez: "2" } as unknown as DocumentoGiurisprudenziale)).toBe(true);
      expect(hasSezione({} as unknown as DocumentoGiurisprudenziale)).toBe(false);
      expect(hasSezione(null as unknown as DocumentoGiurisprudenziale)).toBe(false);
    });
  });

  describe("Inizializzazione Hook e Cache LocalStorage", () => {
    test("inizializza con i valori di default se non ci sono dati salvati in localStorage", () => {
      const { result } = renderHook(() => useSearchFilters());
      expect(result.current.filterGrado).toBe(DEFAULT_FILTERS.filterGrado);
      expect(result.current.numberPages).toBe(DEFAULT_FILTERS.numberPages);
    });

    test("ripristina lo stato salvato nella cache di localStorage", () => {
      localStorageStore[SEARCH_FILTERS_CACHE_KEY] = JSON.stringify({
        filterGrado: "Cassazione Penale",
        filterTipo: "ufficiale",
        numberPages: 20,
      });

      const { result } = renderHook(() => useSearchFilters());
      expect(result.current.filterGrado).toBe("Cassazione Penale");
      expect(result.current.filterTipo).toBe("ufficiale");
      expect(result.current.numberPages).toBe(20);
    });

    test("gestisce JSON corrotto in localStorage ripristinando i default e loggando l'errore", () => {
      localStorageStore[SEARCH_FILTERS_CACHE_KEY] = "{invalid-json";
      const { result } = renderHook(() => useSearchFilters());
      expect(result.current.filterGrado).toBe(DEFAULT_FILTERS.filterGrado);
      expect(console.error).toHaveBeenCalled();
    });

    test("salva automaticamente le modifiche di stato in localStorage", () => {
      const { result } = renderHook(() => useSearchFilters());
      act(() => {
        result.current.setFilterTipologia("Sentenza");
      });
      const saved = JSON.parse(localStorageStore[SEARCH_FILTERS_CACHE_KEY]);
      expect(saved.filterTipologia).toBe("Sentenza");
    });
  });

  describe("Comportamento Setter Custom", () => {
    test("setFilterGrado azzera automaticamente filterSezione se il nuovo grado è stringa vuota", () => {
      const { result } = renderHook(() => useSearchFilters());

      act(() => {
        result.current.setFilterGrado("Consiglio di Stato");
        result.current.setFilterSezione("Sezione IV");
      });

      expect(result.current.filterGrado).toBe("Consiglio di Stato");
      expect(result.current.filterSezione).toBe("Sezione IV");

      act(() => {
        result.current.setFilterGrado("");
      });

      expect(result.current.filterGrado).toBe("");
      expect(result.current.filterSezione).toBe("");
    });

    test("setFilterGrado supporta il callback updater function", () => {
      const { result } = renderHook(() => useSearchFilters());
      act(() => {
        result.current.setFilterGrado(() => "Corte Costituzionale");
      });
      expect(result.current.filterGrado).toBe("Corte Costituzionale");
    });
  });

  describe("Costruzione Filtri Vettoriali (buildVectorFilters)", () => {
    test("restituisce array vuoto se non vi sono filtri attivi", () => {
      const { result } = renderHook(() => useSearchFilters());
      const filters = result.current.buildVectorFilters();
      expect(filters).toEqual([]);
    });

    test("compone correttamente i filtri con campi di testo e Timestamp Firebase per le date", () => {
      const { result } = renderHook(() => useSearchFilters());

      act(() => {
        result.current.setFilterGrado("Cassazione Civile");
        result.current.setFilterTipologia("sentenza");
        result.current.setFilterTipo("ufficiale");
        result.current.setFilterSezione("Sezione I");
        result.current.setStartDate("2026-01-01");
        result.current.setEndDate("2026-01-31");
      });

      const filters = result.current.buildVectorFilters();

      expect(filters).toEqual(
        expect.arrayContaining([
          { field: "organo_giudicante", operator: "==", value: "CORTE DI CASSAZIONE" },
          { field: "materia", operator: "==", value: "Civile" },
          { field: "tipo_documento", operator: "==", value: "sentenza" },
          { field: "tipo_massima", operator: "==", value: "ufficiale" },
          { field: "sezione", operator: "==", value: "Sezione I" },
          { field: "dataSentenza", operator: ">=", value: expect.anything() },
          { field: "dataSentenza", operator: "<=", value: expect.anything() },
        ])
      );

      expect(mockTimestampFromDate).toHaveBeenCalled();
    });
  });

  describe("Filtraggio e Ordinamento Client-Side (applyUiFiltersAndSort)", () => {
    const sampleDocs: DocumentoGiurisprudenziale[] = [
      {
        id: "doc_1",
        organo_giudicante: "CORTE DI CASSAZIONE",
        materia: "Civile",
        tipo_massima: "ufficiale",
        sezione: "Sez. I",
        tipo_documento: "sentenza",
        dataSentenza: "2026-04-01T10:00:00Z",
      } as unknown as DocumentoGiurisprudenziale,
      {
        id: "doc_2",
        organo_giudicante: "CORTE DI CASSAZIONE",
        materia: "Civile",
        tipo_massima: "redazionale",
        sez: "Sez. II",
        tipo_documento: "ordinanza",
        dataSentenza: "2026-05-01T10:00:00Z",
      } as unknown as DocumentoGiurisprudenziale,
    ];

    test("filtra per organo giudicante, tipo e sezione", () => {
      const { result } = renderHook(() => useSearchFilters());

      act(() => {
        result.current.setFilterGrado("Cassazione Civile");
        result.current.setFilterSezione("Sez. II");
      });

      const filtered = result.current.applyUiFiltersAndSort(sampleDocs);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("doc_2");
    });

    test("filtra per intervallo di date ed esclude documenti privi di data valida", () => {
      const { result } = renderHook(() => useSearchFilters());

      const docsWithNull = [
        ...sampleDocs,
        { id: "doc_null", dataSentenza: null } as unknown as DocumentoGiurisprudenziale,
      ];

      act(() => {
        result.current.setStartDate("2026-03-01");
        result.current.setEndDate("2026-04-15");
      });

      const filtered = result.current.applyUiFiltersAndSort(docsWithNull);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe("doc_1");
    });

    test("ordina per data decrescente (date_desc)", () => {
      const { result } = renderHook(() => useSearchFilters());
      act(() => {
        result.current.setSortBy("date_desc");
      });
      const sorted = result.current.applyUiFiltersAndSort(sampleDocs);
      expect(sorted[0].id).toBe("doc_2");
      expect(sorted[1].id).toBe("doc_1");
    });

    test("ordina per data crescente (date_asc)", () => {
      const { result } = renderHook(() => useSearchFilters());
      act(() => {
        result.current.setSortBy("date_asc");
      });
      const sorted = result.current.applyUiFiltersAndSort(sampleDocs);
      expect(sorted[0].id).toBe("doc_1");
      expect(sorted[1].id).toBe("doc_2");
    });
  });
});