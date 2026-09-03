import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { SavedPrompt } from "@/interfaces/interfaces";

/* ---------- hoisted mocks ---------- */
const {
  mockAuthState,
  mockFirestoreDb,
  mockCollection,
  mockQuery,
  mockOrderBy,
  mockGetDocs,
} = vi.hoisted(() => ({
  mockAuthState: {
    currentUser: { uid: "usr_flv_2026" } as { uid: string } | null,
  },
  mockFirestoreDb: { firestore: "mockDb" },
  mockCollection: vi.fn((...args: unknown[]) => ({
    type: "collection",
    path: args.slice(1).join("/"),
  })),
  mockQuery: vi.fn((...args: unknown[]) => ({ type: "query", args })),
  mockOrderBy: vi.fn((field: string, dir?: string) => ({ field, dir })),
  mockGetDocs: vi.fn(),
}));

/* ---------- mock modules ---------- */
vi.mock("firebase/auth", () => ({
  __esModule: true,
  getAuth: () => mockAuthState,
}));

vi.mock("firebase/firestore", () => ({
  __esModule: true,
  getFirestore: () => mockFirestoreDb,
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  orderBy: (field: string, dir?: "asc" | "desc") => mockOrderBy(field, dir),
  getDocs: (q: unknown) => mockGetDocs(q),
}));

/* ---------- subject under test ---------- */
import { usePromptSelector } from "@/shared/hooks/usePromptSelector"; // <-- adegua il path di import se necessario

describe("usePromptSelector Hook Suite", () => {
  const originalWindowOpen = window.open;
  const mockWindowOpen = vi.fn();

  const samplePersonalPrompts: SavedPrompt[] = [
    {
      id: "prompt-pers-1",
      title: "Ricorso Tributario Personalizzato",
      objective: "Annullamento cartella esattoriale",
    } as unknown as SavedPrompt,
    {
      id: "prompt-pers-2",
      title: "Atto di Citazione Clausole Bancarie",
      objective: "Verifica anatocismo",
    } as unknown as SavedPrompt,
  ];

  const samplePublicPrompts: SavedPrompt[] = [
    {
      id: "prompt-pub-1",
      title: "Contratto di Locazione Standard",
      objective: "Locazione ad uso abitativo 4+4",
    } as unknown as SavedPrompt,
    {
      id: "prompt-pub-2",
      title: "Diffida ad Adempiere",
      objective: "Messa in mora contrattuale",
    } as unknown as SavedPrompt,
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    window.open = mockWindowOpen;
    mockAuthState.currentUser = { uid: "usr_flv_2026" };

    mockGetDocs.mockImplementation(async (q: { args?: unknown[] }) => {
      const collectionTarget = q?.args?.[0] as { path?: string } | undefined;
      const path = collectionTarget?.path || "";

      if (path.includes("register/usr_flv_2026/prompts")) {
        return {
          docs: samplePersonalPrompts.map((p) => ({
            id: p.id,
            data: () => ({ title: p.title, objective: p.objective }),
          })),
        };
      }

      if (path.includes("prompt_list")) {
        return {
          docs: samplePublicPrompts.map((p) => ({
            id: p.id,
            data: () => ({ title: p.title, objective: p.objective }),
          })),
        };
      }

      return { docs: [] };
    });

    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    window.open = originalWindowOpen;
  });

  describe("Caricamento Dati e Inizializzazione", () => {
    test("recupera sia i prompt personali che quelli pubblici per un utente autenticato", async () => {
      const onChangeMock = vi.fn();
      const { result } = renderHook(() =>
        usePromptSelector({ value: "", onChange: onChangeMock })
      );

      await waitFor(() => {
        expect(result.current.savedPrompts).toHaveLength(2);
        expect(result.current.publicPrompts).toHaveLength(2);
      });

      expect(mockCollection).toHaveBeenCalledWith(
        mockFirestoreDb,
        "register",
        "usr_flv_2026",
        "prompts"
      );
      expect(mockOrderBy).toHaveBeenCalledWith("createdAt", "desc");

      expect(mockCollection).toHaveBeenCalledWith(mockFirestoreDb, "prompt_list");
      expect(mockOrderBy).toHaveBeenCalledWith("title", "asc");

      expect(result.current.savedPrompts).toEqual(samplePersonalPrompts);
      expect(result.current.publicPrompts).toEqual(samplePublicPrompts);
    });

    test("recupera esclusivamente i prompt pubblici se l'utente non è autenticato", async () => {
      mockAuthState.currentUser = null;
      const onChangeMock = vi.fn();

      const { result } = renderHook(() =>
        usePromptSelector({ value: "", onChange: onChangeMock })
      );

      await waitFor(() => {
        expect(result.current.publicPrompts).toHaveLength(2);
      });

      expect(result.current.savedPrompts).toEqual([]);
      expect(mockCollection).not.toHaveBeenCalledWith(
        mockFirestoreDb,
        "register",
        expect.anything(),
        "prompts"
      );
      expect(mockCollection).toHaveBeenCalledWith(mockFirestoreDb, "prompt_list");
    });

    test("intercetta errori di rete o permessi durante il caricamento senza mandare in crash l'hook", async () => {
      mockGetDocs.mockRejectedValueOnce(new Error("Firestore offline"));
      const onChangeMock = vi.fn();

      const { result } = renderHook(() =>
        usePromptSelector({ value: "", onChange: onChangeMock })
      );

      await waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          "Errore caricamento prompt:",
          expect.any(Error)
        );
      });

      expect(result.current.savedPrompts).toEqual([]);
      expect(result.current.publicPrompts).toEqual([]);
    });
  });

  describe("Risoluzione Prompt Selezionato (selectedCustomPrompt)", () => {
    test("individua correttamente un prompt appartenente alla lista dei prompt salvati personali", async () => {
      const onChangeMock = vi.fn();
      const { result } = renderHook(() =>
        usePromptSelector({ value: "prompt-pers-2", onChange: onChangeMock })
      );

      await waitFor(() => {
        expect(result.current.savedPrompts).toHaveLength(2);
      });

      expect(result.current.selectedCustomPrompt).toEqual(samplePersonalPrompts[1]);
    });

    test("individua correttamente un prompt appartenente alla lista pubblica", async () => {
      const onChangeMock = vi.fn();
      const { result } = renderHook(() =>
        usePromptSelector({ value: "prompt-pub-1", onChange: onChangeMock })
      );

      await waitFor(() => {
        expect(result.current.publicPrompts).toHaveLength(2);
      });

      expect(result.current.selectedCustomPrompt).toEqual(samplePublicPrompts[0]);
    });

    test("restituisce undefined se il valore selezionato non corrisponde ad alcun prompt", async () => {
      const onChangeMock = vi.fn();
      const { result } = renderHook(() =>
        usePromptSelector({ value: "prompt-inesistente", onChange: onChangeMock })
      );

      await waitFor(() => {
        expect(result.current.publicPrompts).toHaveLength(2);
      });

      expect(result.current.selectedCustomPrompt).toBeUndefined();
    });
  });

  describe("Gestione Modifiche (handleChange)", () => {
    test("apre una nuova scheda sul prompt-builder quando il valore è 'create_new'", async () => {
      const onChangeMock = vi.fn();
      const { result } = renderHook(() =>
        usePromptSelector({ value: "", onChange: onChangeMock })
      );

      act(() => {
        result.current.handleChange("create_new");
      });

      expect(mockWindowOpen).toHaveBeenCalledWith(
        "/profilo/prompt-builder#crea",
        "_blank",
        "noopener,noreferrer"
      );
      expect(onChangeMock).not.toHaveBeenCalled();
    });

    test("invoca la callback onChange per qualsiasi valore ordinario diverso da 'create_new'", async () => {
      const onChangeMock = vi.fn();
      const { result } = renderHook(() =>
        usePromptSelector({ value: "", onChange: onChangeMock })
      );

      act(() => {
        result.current.handleChange("prompt-pub-2");
      });

      expect(onChangeMock).toHaveBeenCalledWith("prompt-pub-2");
      expect(mockWindowOpen).not.toHaveBeenCalled();
    });
  });
});