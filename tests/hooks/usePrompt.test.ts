import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { PromptBuilderForm, SavedPrompt } from "@/interfaces/interfaces";

/* ---------- hoisted mocks ---------- */
const {
  mockNavigate,
  mockToast,
  mockFetchWithSecurity,
  mockGetPrompt,
  mockAuthState,
  mockFirestoreDb,
  mockCollection,
  mockDoc,
  mockQuery,
  mockOrderBy,
  mockOnSnapshot,
  mockDeleteDoc,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  mockFetchWithSecurity: vi.fn(),
  mockGetPrompt: vi.fn(() => "https://api.jurio.it/prompt"),
  mockAuthState: {
    currentUser: { uid: "usr_flv_2026" } as { uid: string } | null,
  },
  mockFirestoreDb: { firestore: "mockDb" },
  mockCollection: vi.fn((...args: unknown[]) => ({ type: "collection", path: args.slice(1).join("/") })),
  mockDoc: vi.fn((...args: unknown[]) => ({ type: "doc", path: args.slice(1).join("/") })),
  mockQuery: vi.fn((...args: unknown[]) => ({ type: "query", args })),
  mockOrderBy: vi.fn((field: string, dir?: string) => ({ field, dir })),
  mockOnSnapshot: vi.fn(),
  mockDeleteDoc: vi.fn().mockResolvedValue(undefined),
}));

/* ---------- mock modules ---------- */
vi.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
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
  getPrompt: () => mockGetPrompt(),
}));

vi.mock("firebase/auth", () => ({
  __esModule: true,
  getAuth: () => mockAuthState,
}));

vi.mock("firebase/firestore", () => ({
  __esModule: true,
  getFirestore: () => mockFirestoreDb,
  collection: (...args: unknown[]) => mockCollection(...args),
  doc: (...args: unknown[]) => mockDoc(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  orderBy: (field: string, dir?: "asc" | "desc") => mockOrderBy(field, dir),
  onSnapshot: (...args: unknown[]) => mockOnSnapshot(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
}));

/* ---------- helper per stream SSE ---------- */
const createMockSseResponse = (chunks: string[], status = 200) => {
  let index = 0;
  const encoder = new TextEncoder();

  return {
    ok: status >= 200 && status < 300,
    status,
    body: {
      getReader: () => ({
        read: async () => {
          if (index < chunks.length) {
            return { value: encoder.encode(chunks[index++]), done: false };
          }
          return { value: undefined, done: true };
        },
      }),
    },
  };
};

/* ---------- subject under test ---------- */
import { usePromptGenerator, usePromptDashboard } from "@/features/prompt/hooks/usePromptGenerator"; // <-- adegua il path di import se necessario

describe("Prompt Hooks Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.currentUser = { uid: "usr_flv_2026" };
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  /* ============================================================
     1) usePromptGenerator
  ============================================================ */
  describe("usePromptGenerator", () => {
    const sampleFormData: PromptBuilderForm = {
      title: "Atto di Citazione Bancario",
      objective: "Redigere atto per anatocismo e usura",
      notes: "Includere riferimenti Cassazione 2026",
      fields: [{ id: "1", label: "Tribunale", value: "Torino" }],
    } as unknown as PromptBuilderForm;

    test("inizializza gli stati ai valori di default", () => {
      const { result } = renderHook(() => usePromptGenerator());

      expect(result.current.generatedPrompt).toBeNull();
      expect(result.current.isGenerating).toBe(false);
      expect(result.current.isAccessDenied).toBe(false);
    });

    test("consuma lo stream SSE, imposta generatedPrompt e mostra toast di successo", async () => {
      const sseChunks = [
        "data: {\"result\": \"Prompt generato con formula giuridica\"}\n\n",
        "data: [DONE]\n\n",
      ];

      mockFetchWithSecurity.mockResolvedValueOnce(createMockSseResponse(sseChunks));

      const { result } = renderHook(() => usePromptGenerator());

      await act(async () => {
        await result.current.generatePrompt(sampleFormData);
      });

      expect(mockFetchWithSecurity).toHaveBeenCalledWith(
        "https://api.jurio.it/prompt",
        {
          title: sampleFormData.title,
          objective: sampleFormData.objective,
          notes: sampleFormData.notes,
          fields: sampleFormData.fields,
        }
      );

      expect(result.current.generatedPrompt).toBe("Prompt generato con formula giuridica");
      expect(result.current.isGenerating).toBe(false);
      expect(mockToast.success).toHaveBeenCalledWith("Prompt generato con successo!");
    });

    test("intercetta risposta 403 impostando isAccessDenied a true", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({
        status: 403,
        ok: false,
      });

      const { result } = renderHook(() => usePromptGenerator());

      await act(async () => {
        await result.current.generatePrompt(sampleFormData);
      });

      expect(result.current.isAccessDenied).toBe(true);
      expect(result.current.generatedPrompt).toBeNull();
      expect(result.current.isGenerating).toBe(false);
      expect(mockToast.error).not.toHaveBeenCalled();
    });

    test("intercetta errori HTTP o assenza di body mostrando toast di errore", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({
        status: 500,
        ok: false,
      });

      const { result } = renderHook(() => usePromptGenerator());

      await act(async () => {
        await result.current.generatePrompt(sampleFormData);
      });

      expect(result.current.generatedPrompt).toBeNull();
      expect(result.current.isGenerating).toBe(false);
      expect(mockToast.error).toHaveBeenCalledWith("Errore durante la generazione del prompt.");
    });

    test("intercetta chunk SSE con errore registrando il warning su console", async () => {
      const sseChunks = [
        "data: {\"error\": {\"message\": \"Quota token AI esaurita per il mese corrente\"}}\n\n",
      ];

      mockFetchWithSecurity.mockResolvedValueOnce(createMockSseResponse(sseChunks));

      const { result } = renderHook(() => usePromptGenerator());

      await act(async () => {
        await result.current.generatePrompt(sampleFormData);
      });

      expect(result.current.generatedPrompt).toBeNull();
      expect(result.current.isGenerating).toBe(false);
      expect(console.warn).toHaveBeenCalledWith(
        "Errore parsing chunk SSE:",
        expect.any(Error)
      );
    });

    test("clearPrompt azzera il prompt generato", async () => {
      const sseChunks = ["data: {\"result\": \"Prompt attivo\"}\n\n"];
      mockFetchWithSecurity.mockResolvedValueOnce(createMockSseResponse(sseChunks));

      const { result } = renderHook(() => usePromptGenerator());

      await act(async () => {
        await result.current.generatePrompt(sampleFormData);
      });
      expect(result.current.generatedPrompt).toBe("Prompt attivo");

      act(() => {
        result.current.clearPrompt();
      });

      expect(result.current.generatedPrompt).toBeNull();
    });
  });

  /* ============================================================
     2) usePromptDashboard
  ============================================================ */
  describe("usePromptDashboard", () => {
    let mockUnsubscribe: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      mockUnsubscribe = vi.fn();
      mockOnSnapshot.mockImplementation((_query: unknown, onNext: (snap: unknown) => void) => {
        onNext({
          docs: [
            { id: "p-1", data: () => ({ title: "Prompt Appello", objective: "Impugnazione" }) },
            { id: "p-2", data: () => ({ title: "Prompt Ricorso", objective: "Tar Lazio" }) },
          ],
        });
        return mockUnsubscribe;
      });
    });

    test("sottoscrive Firestore al mount, popola i prompt e rimuove il listener all'unmount", () => {
      const { result, unmount } = renderHook(() => usePromptDashboard());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.prompts).toEqual([
        { id: "p-1", title: "Prompt Appello", objective: "Impugnazione" },
        { id: "p-2", title: "Prompt Ricorso", objective: "Tar Lazio" },
      ]);
      expect(result.current.view).toBe("list");
      expect(result.current.isDeleteModalOpen).toBe(false);

      unmount();
      expect(mockUnsubscribe).toHaveBeenCalledTimes(1);
    });

    test("gestisce errore nel listener onSnapshot mostrando toast", () => {
      mockOnSnapshot.mockImplementationOnce((_q: unknown, _onNext: unknown, onError: (err: unknown) => void) => {
        onError(new Error("Permission denied"));
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => usePromptDashboard());

      expect(result.current.isLoading).toBe(false);
      expect(result.current.prompts).toEqual([]);
      expect(mockToast.error).toHaveBeenCalledWith("Impossibile caricare i prompt.");
    });

    test("non avvia la sottoscrizione se auth.currentUser è nullo", () => {
      mockAuthState.currentUser = null;

      const { result } = renderHook(() => usePromptDashboard());

      expect(mockOnSnapshot).not.toHaveBeenCalled();
      expect(result.current.prompts).toEqual([]);
    });

    test("handleOpenCreator apre la schermata di creazione e aggiunge (Copia) al titolo se riceve un template", () => {
      const { result } = renderHook(() => usePromptDashboard());

      const baseTemplate: SavedPrompt = {
        id: "tpl-1",
        title: "Formula Decreto Ingiuntivo",
        objective: "Recupero crediti bancari",
      } as unknown as SavedPrompt;

      act(() => {
        result.current.handleOpenCreator(baseTemplate);
      });

      expect(result.current.view).toBe("create");
      expect(result.current.selectedTemplate).toEqual({
        ...baseTemplate,
        title: "Formula Decreto Ingiuntivo (Copia)",
      });

      act(() => {
        result.current.handleOpenCreator();
      });

      expect(result.current.view).toBe("create");
      expect(result.current.selectedTemplate).toBeUndefined();
    });

    test("handleBackToList reimposta la vista a 'list', resetta il template e naviga indietro (-1)", () => {
      const { result } = renderHook(() => usePromptDashboard());

      act(() => {
        result.current.handleOpenCreator();
      });
      expect(result.current.view).toBe("create");

      act(() => {
        result.current.handleBackToList();
      });

      expect(result.current.view).toBe("list");
      expect(result.current.selectedTemplate).toBeUndefined();
      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });

    test("gestisce l'apertura e l'annullamento del modale di cancellazione", () => {
      const { result } = renderHook(() => usePromptDashboard());

      act(() => {
        result.current.requestDelete("prompt-to-del");
      });
      expect(result.current.isDeleteModalOpen).toBe(true);

      act(() => {
        result.current.cancelDelete();
      });
      expect(result.current.isDeleteModalOpen).toBe(false);
    });

    test("confirmDelete elimina il documento da Firestore, mostra il toast e chiude il modale", async () => {
      const { result } = renderHook(() => usePromptDashboard());

      act(() => {
        result.current.requestDelete("prompt-to-del-123");
      });

      await act(async () => {
        await result.current.confirmDelete();
      });

      expect(mockDoc).toHaveBeenCalledWith(
        mockFirestoreDb,
        "register",
        "usr_flv_2026",
        "prompts",
        "prompt-to-del-123"
      );
      expect(mockDeleteDoc).toHaveBeenCalled();
      expect(mockToast.success).toHaveBeenCalledWith("Prompt eliminato con successo.");
      expect(result.current.isDeleteModalOpen).toBe(false);
    });

    test("confirmDelete mostra toast di errore e chiude comunque il modale se la cancellazione fallisce", async () => {
      mockDeleteDoc.mockRejectedValueOnce(new Error("Firestore delete denied"));

      const { result } = renderHook(() => usePromptDashboard());

      act(() => {
        result.current.requestDelete("prompt-err");
      });

      await act(async () => {
        await result.current.confirmDelete();
      });

      expect(mockToast.error).toHaveBeenCalledWith("Errore durante l'eliminazione.");
      expect(result.current.isDeleteModalOpen).toBe(false);
    });
  });
});