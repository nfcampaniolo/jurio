import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

/* ---------- hoisted mocks ---------- */
const {
  mockGetDocumentMassima,
  mockGetDocumentStorage,
  mockTrackEvent,
} = vi.hoisted(() => ({
  mockGetDocumentMassima: vi.fn(),
  mockGetDocumentStorage: vi.fn(),
  mockTrackEvent: vi.fn(),
}));

/* ---------- mock services ---------- */
vi.mock("@/services/document", () => ({
  __esModule: true,
  getDocumentMassima: (id: string, col: string) => mockGetDocumentMassima(id, col),
}));

vi.mock("@/services/storage", () => ({
  __esModule: true,
  getDocumentStorage: (id: string, path: string) => mockGetDocumentStorage(id, path),
}));

vi.mock("@/services/analytics", () => ({
  __esModule: true,
  trackEvent: (event: string, payload?: Record<string, unknown>) =>
    mockTrackEvent(event, payload),
}));

/* ---------- subject under test ---------- */
import { useDocumento } from "@/hooks/useDocumento"; // <-- adegua il path di import se necessario

describe("useDocumento Hook Suite", () => {
  const setLocationHref = (url: string) => {
    window.history.pushState({}, "", url);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setLocationHref("/documenti/doc-123");
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("Inizializzazione e guardie sull'ID", () => {
    test("non avvia il fetch e mantiene lo stato resettato se l'id è null o undefined", () => {
      const { result } = renderHook(() => useDocumento(null));

      expect(result.current.loading).toBe(false);
      expect(result.current.selectedDoc).toBeNull();
      expect(result.current.pdfUrl).toBeNull();
      expect(result.current.deny).toBe(false);
      expect(mockGetDocumentMassima).not.toHaveBeenCalled();
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    test("resetta lo stato se l'id passa da valorizzato a undefined", async () => {
      mockGetDocumentMassima.mockResolvedValueOnce({ id: "doc-1", user: "usr_1" });
      mockGetDocumentStorage.mockResolvedValueOnce("https://storage.jurio.it/doc-1.pdf");

      const { result, rerender } = renderHook(
        ({ id }) => useDocumento(id),
        {
          initialProps: { id: "doc-1" as string | null },
        }
      );

      await waitFor(() => {
        expect(result.current.selectedDoc).toEqual({ id: "doc-1", user: "usr_1" });
      });

      rerender({ id: null });

      expect(result.current.selectedDoc).toBeNull();
      expect(result.current.pdfUrl).toBeNull();
      expect(result.current.deny).toBe(false);
    });
  });

  describe("Routing e Risoluzione Storage (Giurisprudenza vs Documenti Utente)", () => {
    test("carica una sentenza (URL con /giurisprudenza/) usando la collection 'sentences' e storage 'sentences'", async () => {
      setLocationHref("/giurisprudenza/cass-2026-100");

      const mockSentenza = {
        id: "cass-2026-100",
        numero_sentenza: "100/2026",
        organo_giudicante: "CORTE DI CASSAZIONE",
      };

      mockGetDocumentMassima.mockResolvedValueOnce(mockSentenza);
      mockGetDocumentStorage.mockResolvedValueOnce("https://storage.jurio.it/sentences/cass-100.pdf");

      const { result } = renderHook(() => useDocumento("cass-2026-100"));

      expect(result.current.isGiurisprudenza).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockTrackEvent).toHaveBeenCalledWith("sentence_opened", { source: "direct" });
      expect(mockGetDocumentMassima).toHaveBeenCalledWith("cass-2026-100", "sentences");
      expect(mockGetDocumentStorage).toHaveBeenCalledWith("cass-2026-100", "sentences");
      expect(result.current.selectedDoc).toEqual(mockSentenza);
      expect(result.current.pdfUrl).toBe("https://storage.jurio.it/sentences/cass-100.pdf");
      expect(result.current.deny).toBe(false);
    });

    test("carica un documento privato costruendo lo storage path tramite il campo 'user'", async () => {
      setLocationHref("/archivio/doc-private-42");

      const mockAtto = {
        id: "doc-private-42",
        user: "usr_flv_2026",
        titolo: "Atto di citazione",
      };

      mockGetDocumentMassima.mockResolvedValueOnce(mockAtto);
      mockGetDocumentStorage.mockResolvedValueOnce("https://storage.jurio.it/users/usr_flv_2026/documents/doc-private-42.pdf");

      const { result } = renderHook(() => useDocumento("doc-private-42"));

      expect(result.current.isGiurisprudenza).toBe(false);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockTrackEvent).toHaveBeenCalledWith("document_opened", { source: "direct" });
      expect(mockGetDocumentMassima).toHaveBeenCalledWith("doc-private-42", "documents");
      expect(mockGetDocumentStorage).toHaveBeenCalledWith("doc-private-42", "users/usr_flv_2026/documents");
      expect(result.current.selectedDoc).toEqual(mockAtto);
      expect(result.current.pdfUrl).toBe("https://storage.jurio.it/users/usr_flv_2026/documents/doc-private-42.pdf");
    });
  });

  describe("Controllo degli Accessi (Denial Handling)", () => {
    test("imposta deny a true e traccia l'errore analytics se il documento restituisce 'denied'", async () => {
      setLocationHref("/giurisprudenza/sentenza-riservata");

      mockGetDocumentMassima.mockResolvedValueOnce("denied");

      const { result } = renderHook(() => useDocumento("sentenza-riservata"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.deny).toBe(true);
      expect(result.current.selectedDoc).toBeNull();
      expect(result.current.pdfUrl).toBeNull();
      expect(mockTrackEvent).toHaveBeenCalledWith("analytics_error", {
        name: "sentence_opened",
        reason: "denied",
      });
      expect(mockGetDocumentStorage).not.toHaveBeenCalled();
    });
  });

  describe("Deduplicazione delle Chiamate e Error Handling", () => {
    test("non ripete il fetch né il tracking se il hook si ri-renderizza con lo stesso ID", async () => {
      mockGetDocumentMassima.mockResolvedValueOnce({ id: "doc-stable", user: "usr_1" });
      mockGetDocumentStorage.mockResolvedValueOnce("https://storage.jurio.it/doc.pdf");

      const { result, rerender } = renderHook(({ id }: { id: string }) => useDocumento(id), {
        initialProps: { id: "doc-stable" },
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockGetDocumentMassima).toHaveBeenCalledTimes(1);
      expect(mockTrackEvent).toHaveBeenCalledTimes(1);

      // Trigger di re-render con lo stesso id
      rerender({ id: "doc-stable" });

      expect(mockGetDocumentMassima).toHaveBeenCalledTimes(1);
      expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    });

    test("intercetta eccezioni di rete, resetta lo stato e traccia analytics_error", async () => {
      mockGetDocumentMassima.mockRejectedValueOnce(new Error("Firestore connection drop"));

      const { result } = renderHook(() => useDocumento("doc-fail"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.selectedDoc).toBeNull();
      expect(result.current.pdfUrl).toBeNull();
      expect(result.current.deny).toBe(false);
      expect(mockTrackEvent).toHaveBeenCalledWith("analytics_error", {
        name: "useDocumento",
        reason: "Firestore connection drop",
      });
    });

    test("gestisce il caso in cui il documento restituito sia null o non valido", async () => {
      mockGetDocumentMassima.mockResolvedValueOnce(null);

      const { result } = renderHook(() => useDocumento("doc-missing"));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.selectedDoc).toBeNull();
      expect(result.current.pdfUrl).toBeNull();
      expect(mockGetDocumentStorage).not.toHaveBeenCalled();
    });
  });
});