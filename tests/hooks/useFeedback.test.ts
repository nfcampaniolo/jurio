import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

/* ---------- hoisted mocks ---------- */
const {
  mockAuthState,
  mockToast,
  mockFetchWithSecurity,
  mockGetFeedback,
} = vi.hoisted(() => ({
  mockAuthState: {
    user: null as { uid: string; email?: string } | null,
  },
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  mockFetchWithSecurity: vi.fn(),
  mockGetFeedback: vi.fn(() => "https://api.jurio.it/feedback"),
}));

/* ---------- mock modules ---------- */
vi.mock("@/context/useAuth", () => ({
  __esModule: true,
  useAuth: () => mockAuthState,
}));

vi.mock("react-hot-toast", () => ({
  toast: mockToast,
}));

vi.mock("@/config/apiClient", () => ({
  __esModule: true,
  fetchWithSecurity: (...args: unknown[]) => mockFetchWithSecurity(...args),
}));

vi.mock("@/config/env", () => ({
  __esModule: true,
  getFeedback: () => mockGetFeedback(),
}));

/* ---------- subject under test ---------- */
import { useFeedback } from "@/hooks/useFeedback"; // <-- adegua il path di import se necessario

describe("useFeedback Hook Suite", () => {
  const defaultEndpoint = "https://api.jurio.it/feedback";

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.user = { uid: "usr_flv_2026" };
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("Stato iniziale e Gestione ID", () => {
    test("inizializza gli stati con i valori di default corretti", () => {
      const { result } = renderHook(() => useFeedback("doc-123"));

      expect(result.current.vote).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(result.current.isModalOpen).toBe(false);
      expect(result.current.notes).toBe("");
    });

    test("normalizza sia ID singolo che array di ID nella richiesta al backend", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({ ok: true });

      const { result } = renderHook(() => useFeedback(["source-1", "source-2"]));

      await act(async () => {
        await result.current.submitFeedback(true);
      });

      expect(mockFetchWithSecurity).toHaveBeenCalledWith(
        defaultEndpoint,
        expect.objectContaining({
          ids: ["source-1", "source-2"],
          isThumbsUp: true,
        })
      );
    });
  });

  describe("Controllo del Modale (openModal / closeModal)", () => {
    test("openModal apre il modale e setNotes aggiorna il testo delle note", () => {
      const { result } = renderHook(() => useFeedback("doc-1"));

      act(() => {
        result.current.openModal();
        result.current.setNotes("Motivazione del feedback negativo");
      });

      expect(result.current.isModalOpen).toBe(true);
      expect(result.current.notes).toBe("Motivazione del feedback negativo");
    });

    test("closeModal chiude il modale solo se loading è false", () => {
      const { result } = renderHook(() => useFeedback("doc-1"));

      act(() => {
        result.current.openModal();
      });
      expect(result.current.isModalOpen).toBe(true);

      act(() => {
        result.current.closeModal();
      });
      expect(result.current.isModalOpen).toBe(false);
    });
  });

  describe("Guardie di Autenticazione e Invio", () => {
    test("impedisce l'invio e mostra toast di errore se l'utente non è autenticato", async () => {
      mockAuthState.user = null;

      const { result } = renderHook(() => useFeedback("doc-1"));

      await act(async () => {
        await result.current.submitFeedback(true);
      });

      expect(mockToast.error).toHaveBeenCalledWith(
        "Devi essere autenticato per inviare un feedback."
      );
      expect(mockFetchWithSecurity).not.toHaveBeenCalled();
      expect(result.current.vote).toBeNull();
      expect(result.current.loading).toBe(false);
    });

    test("non invoca la fetch se un voto è già stato espresso in precedenza", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({ ok: true });

      const { result } = renderHook(() => useFeedback("doc-1"));

      // Primo voto (positivo)
      await act(async () => {
        await result.current.submitFeedback(true);
      });
      expect(result.current.vote).toBe("up");
      expect(mockFetchWithSecurity).toHaveBeenCalledTimes(1);

      // Secondo tentativo di voto (negativo)
      await act(async () => {
        await result.current.submitFeedback(false, "Nota superflua");
      });

      // La chiamata API non viene ripetuta e il voto originale rimane intatto
      expect(mockFetchWithSecurity).toHaveBeenCalledTimes(1);
      expect(result.current.vote).toBe("up");
    });
  });

  describe("Invio Feedback Positivo (Thumbs Up)", () => {
    test("invia voto positivo, imposta lo stato 'up' e mostra il toast corrispondente", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({ ok: true });

      const { result } = renderHook(() => useFeedback("doc-1"));

      await act(async () => {
        await result.current.submitFeedback(true);
      });

      expect(mockFetchWithSecurity).toHaveBeenCalledWith(defaultEndpoint, {
        isThumbsUp: true,
        ids: ["doc-1"],
        notes: "",
      });
      expect(result.current.vote).toBe("up");
      expect(result.current.loading).toBe(false);
      expect(mockToast.success).toHaveBeenCalledWith("Grazie per il feedback positivo!");
    });
  });

  describe("Invio Feedback Negativo (Thumbs Down)", () => {
    test("invia voto negativo con note, chiude il modale e resetta le note", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({ ok: true });

      const { result } = renderHook(() => useFeedback("doc-2"));

      act(() => {
        result.current.openModal();
        result.current.setNotes("La sentenza citata non corrisponde al principio");
      });

      await act(async () => {
        await result.current.submitFeedback(false, result.current.notes);
      });

      expect(mockFetchWithSecurity).toHaveBeenCalledWith(defaultEndpoint, {
        isThumbsUp: false,
        ids: ["doc-2"],
        notes: "La sentenza citata non corrisponde al principio",
      });
      expect(result.current.vote).toBe("down");
      expect(result.current.isModalOpen).toBe(false);
      expect(result.current.notes).toBe("");
      expect(mockToast.success).toHaveBeenCalledWith("Segnalazione inviata con successo.");
    });
  });

  describe("Gestione Errori di Rete e Risposte HTTP non valide", () => {
    test("gestisce risposta HTTP non-ok mostrando toast di errore e lasciando vote a null", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({ ok: false, status: 500 });

      const { result } = renderHook(() => useFeedback("doc-3"));

      await act(async () => {
        await result.current.submitFeedback(true);
      });

      expect(result.current.vote).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(mockToast.error).toHaveBeenCalledWith("Errore durante l'invio. Riprova più tardi.");
      expect(console.error).toHaveBeenCalledWith(
        "Impossibile salvare il feedback al momento.",
        expect.any(Error)
      );
    });

    test("intercetta eccezioni di rete mantenendo il caricamento a false", async () => {
      mockFetchWithSecurity.mockRejectedValueOnce(new Error("Network Error"));

      const { result } = renderHook(() => useFeedback("doc-3"));

      await act(async () => {
        await result.current.submitFeedback(false, "Test note");
      });

      expect(result.current.vote).toBeNull();
      expect(result.current.loading).toBe(false);
      expect(mockToast.error).toHaveBeenCalledWith("Errore durante l'invio. Riprova più tardi.");
    });
  });
});