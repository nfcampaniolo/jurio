import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import type { SentenceMatch } from "@/features/search/hooks/vectorSearch";

/* ---------- hoisted mocks ---------- */
const { mockVectorSearch, mockCercaPrecedentiPerNorme } = vi.hoisted(() => ({
  mockVectorSearch: vi.fn(),
  mockCercaPrecedentiPerNorme: vi.fn(),
}));

/* ---------- mock modules ---------- */
vi.mock("@/features/search/hooks/vectorSearch", () => ({
  __esModule: true,
  vectorSearch: (...args: unknown[]) => mockVectorSearch(...args),
}));

vi.mock("@/features/document/hooks/cercaPrecedenti", () => ({
  __esModule: true,
  cercaPrecedentiPerNorme: (...args: unknown[]) => mockCercaPrecedentiPerNorme(...args),
}));

/* ---------- subject under test ---------- */
import { useRelatedDocuments } from "@/features/document/hooks/useRelatedDocuments"; // <-- adegua il path se necessario

describe("useRelatedDocuments Hook Suite", () => {
  const currentDocUid = "doc_target_100";
  const sampleMassima = "In tema di responsabilità civile della banca ex art. 2043 c.c.";
  const sampleNorms = ["Art. 2043 c.c.", "Art. 1218 c.c."];

  // Helper per generare match di test
  const createMockMatches = (count: number, includeTargetUid = false): SentenceMatch[] => {
    const list: SentenceMatch[] = Array.from({ length: count }, (_, i) => ({
      id: `sent_${i + 1}`,
      uid: `sent_${i + 1}`,
      massima: `Principio di diritto numero ${i + 1}`,
      similarity: 0.95 - i * 0.02,
    } as unknown as SentenceMatch));

    if (includeTargetUid) {
      list.unshift({
        id: currentDocUid,
        uid: currentDocUid,
        massima: "Sentenza corrente che deve essere esclusa",
        similarity: 1.0,
      } as unknown as SentenceMatch);
    }

    return list;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Inizializzazione e Guardie Preliminari", () => {
    test("non avvia la ricerca se shouldFetch è false", () => {
      const { result } = renderHook(() =>
        useRelatedDocuments({
          uid: currentDocUid,
          massima: sampleMassima,
          mode: "semantic",
          selectedNorms: sampleNorms,
          shouldFetch: false,
        })
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.relatedDocs).toEqual([]);
      expect(result.current.error).toBeNull();
      expect(mockVectorSearch).not.toHaveBeenCalled();
      expect(mockCercaPrecedentiPerNorme).not.toHaveBeenCalled();
    });

    test("interrompe l'esecuzione se l'UID del documento è vuoto", () => {
      const { result } = renderHook(() =>
        useRelatedDocuments({
          uid: "",
          massima: sampleMassima,
          mode: "semantic",
          selectedNorms: sampleNorms,
          shouldFetch: true,
        })
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.relatedDocs).toEqual([]);
      expect(mockVectorSearch).not.toHaveBeenCalled();
    });

    test("interrompe in modalità semantica se la massima è vuota", () => {
      const { result } = renderHook(() =>
        useRelatedDocuments({
          uid: currentDocUid,
          massima: "",
          mode: "semantic",
          selectedNorms: sampleNorms,
          shouldFetch: true,
        })
      );

      expect(result.current.loading).toBe(false);
      expect(mockVectorSearch).not.toHaveBeenCalled();
    });

    test("interrompe in modalità normativa se selectedNorms è un array vuoto", () => {
      const { result } = renderHook(() =>
        useRelatedDocuments({
          uid: currentDocUid,
          massima: sampleMassima,
          mode: "normative",
          selectedNorms: [],
          shouldFetch: true,
        })
      );

      expect(result.current.loading).toBe(false);
      expect(mockCercaPrecedentiPerNorme).not.toHaveBeenCalled();
    });
  });

  describe("Ricerca Semantica (mode: 'semantic')", () => {
    test("invoca vectorSearch, esclude il documento corrente e limita l'output a 10 risultati", async () => {
      // 12 match restituiti dal servizio (incluso il documento corrente)
      const matches = createMockMatches(11, true);
      mockVectorSearch.mockResolvedValueOnce({ allMatches: matches });

      const { result } = renderHook(() =>
        useRelatedDocuments({
          uid: currentDocUid,
          massima: sampleMassima,
          mode: "semantic",
          selectedNorms: [],
          shouldFetch: true,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockVectorSearch).toHaveBeenCalledWith(sampleMassima, [], 11);
      // Il documento corrente deve essere escluso
      expect(result.current.relatedDocs.some((d) => d.id === currentDocUid)).toBe(false);
      // Massimo 10 elementi restituiti
      expect(result.current.relatedDocs).toHaveLength(10);
      expect(result.current.error).toBeNull();
    });

    test("salva in localStorage i risultati filtrati con timestamp valido", async () => {
      const matches = createMockMatches(3);
      mockVectorSearch.mockResolvedValueOnce({ allMatches: matches });

      const dateNowSpy = vi.spyOn(Date, "now").mockReturnValue(1700000000000);

      renderHook(() =>
        useRelatedDocuments({
          uid: currentDocUid,
          massima: sampleMassima,
          mode: "semantic",
          selectedNorms: [],
          shouldFetch: true,
        })
      );

      await waitFor(() => {
        const cachedRaw = localStorage.getItem(`related_docs_data_${currentDocUid}_semantic`);
        expect(cachedRaw).not.toBeNull();
      });

      const cache = JSON.parse(localStorage.getItem(`related_docs_data_${currentDocUid}_semantic`)!);
      expect(cache.timestamp).toBe(1700000000000);
      expect(cache.documents).toHaveLength(3);

      dateNowSpy.mockRestore();
    });
  });

  describe("Ricerca Normativa (mode: 'normative')", () => {
    test("invoca cercaPrecedentiPerNorme e normalizza la cache key rimuovendo caratteri speciali", async () => {
      const matches = createMockMatches(5);
      mockCercaPrecedentiPerNorme.mockResolvedValueOnce(matches);

      const { result } = renderHook(() =>
        useRelatedDocuments({
          uid: currentDocUid,
          massima: "",
          mode: "normative",
          selectedNorms: ["Art. 2043 c.c.", "L. 241/90"],
          shouldFetch: true,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockCercaPrecedentiPerNorme).toHaveBeenCalledWith(["Art. 2043 c.c.", "L. 241/90"], 11);
      expect(result.current.relatedDocs).toHaveLength(5);

      // Cache key normalizzata senza punti, spazi o slash: Art2043ccL24190
      const expectedKey = `related_docs_data_${currentDocUid}_normative_Art2043ccL24190`;
      expect(localStorage.getItem(expectedKey)).not.toBeNull();
    });
  });

  describe("Gestione Cache Locale e Policy di Scadenza (7 Giorni)", () => {
    test("utilizza i documenti in cache senza interrogare le API se la cache è valida", async () => {
      const cachedDocs = createMockMatches(4);
      const cacheKey = `related_docs_data_${currentDocUid}_semantic`;

      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          timestamp: Date.now() - 1000 * 60 * 60, // 1 ora fa (< 7 giorni)
          documents: cachedDocs,
        })
      );

      const { result } = renderHook(() =>
        useRelatedDocuments({
          uid: currentDocUid,
          massima: sampleMassima,
          mode: "semantic",
          selectedNorms: [],
          shouldFetch: true,
        })
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.relatedDocs).toEqual(cachedDocs);
      expect(mockVectorSearch).not.toHaveBeenCalled();
    });

    test("ignora la cache ed esegue la fetch se sono trascorsi più di 7 giorni", async () => {
      const EIGHT_DAYS_MS = 8 * 24 * 60 * 60 * 1000;
      const cacheKey = `related_docs_data_${currentDocUid}_semantic`;

      localStorage.setItem(
        cacheKey,
        JSON.stringify({
          timestamp: Date.now() - EIGHT_DAYS_MS,
          documents: createMockMatches(2),
        })
      );

      const freshMatches = createMockMatches(6);
      mockVectorSearch.mockResolvedValueOnce({ allMatches: freshMatches });

      const { result } = renderHook(() =>
        useRelatedDocuments({
          uid: currentDocUid,
          massima: sampleMassima,
          mode: "semantic",
          selectedNorms: [],
          shouldFetch: true,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockVectorSearch).toHaveBeenCalledTimes(1);
      expect(result.current.relatedDocs).toHaveLength(6);
    });

    test("ignora la cache senza errori se il JSON in localStorage è corrotto", async () => {
      const cacheKey = `related_docs_data_${currentDocUid}_semantic`;
      localStorage.setItem(cacheKey, "JSON_NON_VALIDO_{{");

      mockVectorSearch.mockResolvedValueOnce({ allMatches: createMockMatches(2) });

      const { result } = renderHook(() =>
        useRelatedDocuments({
          uid: currentDocUid,
          massima: sampleMassima,
          mode: "semantic",
          selectedNorms: [],
          shouldFetch: true,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockVectorSearch).toHaveBeenCalled();
      expect(result.current.relatedDocs).toHaveLength(2);
      expect(console.warn).toHaveBeenCalledWith("Cache obsoleta o corrotta:", expect.any(Error));
    });

    test("elimina le chiavi di cache obsolete appartenenti ad altri documenti", async () => {
      // Chiave di un altro documento che deve essere ripulita
      localStorage.setItem("related_docs_data_other_doc_999_semantic", JSON.stringify({}));
      // Chiave dello stesso documento (es. normativa) che non deve essere eliminata
      localStorage.setItem(`related_docs_data_${currentDocUid}_normative_test`, JSON.stringify({}));

      mockVectorSearch.mockResolvedValueOnce({ allMatches: createMockMatches(2) });

      renderHook(() =>
        useRelatedDocuments({
          uid: currentDocUid,
          massima: sampleMassima,
          mode: "semantic",
          selectedNorms: [],
          shouldFetch: true,
        })
      );

      await waitFor(() => {
        expect(localStorage.getItem("related_docs_data_other_doc_999_semantic")).toBeNull();
      });

      expect(localStorage.getItem(`related_docs_data_${currentDocUid}_normative_test`)).not.toBeNull();
    });

    test("continua regolarmente se la scrittura in localStorage fallisce (es. quota piena)", async () => {
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

      mockVectorSearch.mockResolvedValueOnce({ allMatches: createMockMatches(3) });

      const { result } = renderHook(() =>
        useRelatedDocuments({
          uid: currentDocUid,
          massima: sampleMassima,
          mode: "semantic",
          selectedNorms: [],
          shouldFetch: true,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.relatedDocs).toHaveLength(3);
      expect(console.warn).toHaveBeenCalledWith("Impossibile salvare in cache:", expect.any(Error));
    });
  });

  describe("Gestione Fallimenti e Rete", () => {
    test("intercetta errori su vectorSearch impostando il messaggio di errore semantico", async () => {
      mockVectorSearch.mockRejectedValueOnce(new Error("Vector service timeout"));

      const { result } = renderHook(() =>
        useRelatedDocuments({
          uid: currentDocUid,
          massima: sampleMassima,
          mode: "semantic",
          selectedNorms: [],
          shouldFetch: true,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe("Impossibile caricare i documenti correlati in modalità semantic.");
      expect(result.current.relatedDocs).toEqual([]);
      expect(console.error).toHaveBeenCalledWith("Errore ricerca semantic:", expect.any(Error));
    });

    test("intercetta errori su cercaPrecedentiPerNorme impostando il messaggio di errore normativo", async () => {
      mockCercaPrecedentiPerNorme.mockRejectedValueOnce(new Error("Database connection lost"));

      const { result } = renderHook(() =>
        useRelatedDocuments({
          uid: currentDocUid,
          massima: "",
          mode: "normative",
          selectedNorms: sampleNorms,
          shouldFetch: true,
        })
      );

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe("Impossibile caricare i documenti correlati in modalità normative.");
      expect(result.current.relatedDocs).toEqual([]);
      expect(console.error).toHaveBeenCalledWith("Errore ricerca normative:", expect.any(Error));
    });
  });
});