import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";

/* ---------- mock firebase/app FirebaseError ---------- */
vi.mock("firebase/app", () => {
  class MockFirebaseError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.name = "FirebaseError";
      this.code = code;
      Object.setPrototypeOf(this, MockFirebaseError.prototype);
    }
  }
  return {
    FirebaseError: MockFirebaseError,
  };
});

import { FirebaseError } from "firebase/app";

/* ---------- hoisted mocks ---------- */
const {
  mockAuthState,
  mockListDocumentsByUser,
  mockDeleteDocument,
  mockRenameDocument,
  mockListSavedSentenzeByUser,
  mockDeleteSaveSentence,
  mockDeleteDocumentStorage,
  mockTrackEvent,
} = vi.hoisted(() => ({
  mockAuthState: {
    user: null as { uid: string } | null,
  },
  mockListDocumentsByUser: vi.fn(),
  mockDeleteDocument: vi.fn(),
  mockRenameDocument: vi.fn(),
  mockListSavedSentenzeByUser: vi.fn(),
  mockDeleteSaveSentence: vi.fn(),
  mockDeleteDocumentStorage: vi.fn(),
  mockTrackEvent: vi.fn(),
}));

/* ---------- mock services and context ---------- */
vi.mock("@/context/useAuth", () => ({
  __esModule: true,
  useAuth: () => mockAuthState,
}));

vi.mock("@/shared/services/document", () => ({
  __esModule: true,
  listDocumentsByUser: (uid: string) => mockListDocumentsByUser(uid),
  deleteDocument: (col: string, id: string) => mockDeleteDocument(col, id),
  renameDocument: (id: string, name: string) => mockRenameDocument(id, name),
}));

vi.mock("@/features/document/hooks/saveSentences", () => ({
  __esModule: true,
  listSavedSentenzeByUser: (uid: string) => mockListSavedSentenzeByUser(uid),
  deleteSaveSentence: (uid: string, sentenceId: string) =>
    mockDeleteSaveSentence(uid, sentenceId),
}));

vi.mock("@/shared/services/storage", () => ({
  __esModule: true,
  deleteDocumentStorage: (id: string, path: string) =>
    mockDeleteDocumentStorage(id, path),
}));

vi.mock("@/infrastructure/analytics", () => ({
  __esModule: true,
  trackEvent: (event: string, payload?: Record<string, unknown>) =>
    mockTrackEvent(event, payload),
}));

/* ---------- subjects under test ---------- */
import { useDocuments, useSavedSentenze } from "@/shared/hooks/useDocuments"; // <-- adegua il path se necessario

describe("Document & Saved Sentences Hooks Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.user = null;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("useDocuments", () => {
    test("imposta documenti a lista vuota e interrompe loading se l'utente non è autenticato", async () => {
      mockAuthState.user = null;

      const { result } = renderHook(() => useDocuments());

      expect(result.current.loading).toBe(false);
      expect(result.current.documents).toEqual([]);
      expect(result.current.error).toBeNull();
      expect(mockListDocumentsByUser).not.toHaveBeenCalled();
    });

    test("recupera l'elenco dei documenti dell'utente autenticato al mount", async () => {
      mockAuthState.user = { uid: "usr_flv_2026" };
      const sampleDocs = [
        { id: "doc-1", titolo: "Ricorso Tar" },
        { id: "doc-2", titolo: "Atto di Citazione" },
      ];
      mockListDocumentsByUser.mockResolvedValueOnce(sampleDocs);

      const { result } = renderHook(() => useDocuments());

      expect(result.current.loading).toBe(true);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockListDocumentsByUser).toHaveBeenCalledWith("usr_flv_2026");
      expect(result.current.documents).toEqual(sampleDocs);
      expect(result.current.error).toBeNull();
    });

    test("gestisce errori durante il caricamento documenti e traccia analytics_error", async () => {
      mockAuthState.user = { uid: "usr_flv_2026" };
      mockListDocumentsByUser.mockRejectedValueOnce(new Error("Firestore network timeout"));

      const { result } = renderHook(() => useDocuments());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.documents).toEqual([]);
      expect(result.current.error).toBe("Errore nel caricamento dei documenti");
      expect(mockTrackEvent).toHaveBeenCalledWith("analytics_error", {
        name: "listDocumentsByUser",
        reason: "Firestore network timeout",
      });
    });

    test("reload permette di forzare una nuova sincronizzazione dei documenti", async () => {
      mockAuthState.user = { uid: "usr_flv_2026" };
      mockListDocumentsByUser
        .mockResolvedValueOnce([{ id: "doc-1", titolo: "Doc A" }])
        .mockResolvedValueOnce([
          { id: "doc-1", titolo: "Doc A" },
          { id: "doc-2", titolo: "Doc B" },
        ]);

      const { result } = renderHook(() => useDocuments());

      await waitFor(() => {
        expect(result.current.documents).toHaveLength(1);
      });

      await act(async () => {
        await result.current.reload();
      });

      expect(mockListDocumentsByUser).toHaveBeenCalledTimes(2);
      expect(result.current.documents).toHaveLength(2);
    });

    test("deleteDocumento rimuove il record da Firestore e da Storage, tracciando l'evento", async () => {
      mockAuthState.user = { uid: "usr_flv_2026" };
      mockListDocumentsByUser.mockResolvedValueOnce([]);
      mockDeleteDocument.mockResolvedValueOnce(undefined);
      mockDeleteDocumentStorage.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useDocuments());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.deleteDocumento("doc-to-delete");
      });

      expect(mockDeleteDocument).toHaveBeenCalledWith("documents", "doc-to-delete");
      expect(mockDeleteDocumentStorage).toHaveBeenCalledWith(
        "doc-to-delete",
        "users/usr_flv_2026/documents"
      );
      expect(mockTrackEvent).toHaveBeenCalledWith("document_deleted", {});
    });

    test("deleteDocumento traccia analytics_error e rilancia l'errore se la cancellazione fallisce", async () => {
      mockAuthState.user = { uid: "usr_flv_2026" };
      mockListDocumentsByUser.mockResolvedValueOnce([]);
      mockDeleteDocument.mockRejectedValueOnce(new Error("Storage delete failed"));

      const { result } = renderHook(() => useDocuments());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.deleteDocumento("doc-err");
        })
      ).rejects.toThrow("Storage delete failed");

      expect(mockTrackEvent).toHaveBeenCalledWith("analytics_error", {
        name: "deleteDocumento",
        reason: "Storage delete failed",
      });
    });

    test("handleRenameDocumento invoca renameDocument e gestisce gli errori senza sollevarli", async () => {
      mockAuthState.user = { uid: "usr_flv_2026" };
      mockListDocumentsByUser.mockResolvedValueOnce([]);
      mockRenameDocument.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useDocuments());

      await act(async () => {
        await result.current.handleRenameDocumento("doc-1", "Nuovo Nome.docx");
      });

      expect(mockRenameDocument).toHaveBeenCalledWith("doc-1", "Nuovo Nome.docx");

      // Simula errore: non deve bloccare o lanciare eccezioni
      mockRenameDocument.mockRejectedValueOnce(new Error("Rename failure"));
      await expect(
        act(async () => {
          await result.current.handleRenameDocumento("doc-1", "Nome Errato.docx");
        })
      ).resolves.not.toThrow();

      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("useSavedSentenze", () => {
    test("imposta isUnauthorized a true e azzera le sentenze se l'utente non è autenticato", async () => {
      mockAuthState.user = null;

      const { result } = renderHook(() => useSavedSentenze());

      expect(result.current.loading).toBe(false);
      expect(result.current.isUnauthorized).toBe(true);
      expect(result.current.savedSentenze).toEqual([]);
      expect(mockListSavedSentenzeByUser).not.toHaveBeenCalled();
    });

    test("recupera le sentenze salvate e traccia 'saved_sentence_opened' per utente autenticato", async () => {
      mockAuthState.user = { uid: "usr_flv_2026" };
      const sampleSentenze = [
        { id: "sent-1", numero_sentenza: "1234/2026", organo_giudicante: "CORTE DI CASSAZIONE" },
      ];
      mockListSavedSentenzeByUser.mockResolvedValueOnce(sampleSentenze);

      const { result } = renderHook(() => useSavedSentenze());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockListSavedSentenzeByUser).toHaveBeenCalledWith("usr_flv_2026");
      expect(result.current.savedSentenze).toEqual(sampleSentenze);
      expect(result.current.isUnauthorized).toBe(false);
      expect(result.current.error).toBeNull();
      expect(mockTrackEvent).toHaveBeenCalledWith("saved_sentence_opened", {});
    });

    test("intercetta permessi mancanti di Firestore (FirebaseError) impostando isUnauthorized e messaggio ad hoc", async () => {
      mockAuthState.user = { uid: "usr_flv_2026" };
      const permError = new FirebaseError("permission-denied", "Missing read rights");
      mockListSavedSentenzeByUser.mockRejectedValueOnce(permError);

      const { result } = renderHook(() => useSavedSentenze());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isUnauthorized).toBe(true);
      expect(result.current.error).toBe("Non sei autorizzato a visualizzare queste sentenze.");
      expect(mockTrackEvent).toHaveBeenCalledWith("analytics_error", {
        name: "listSavedSentenzeByUser",
        reason: "permission-denied",
      });
    });

    test("gestisce errori generici di rete impostando il messaggio di fallback", async () => {
      mockAuthState.user = { uid: "usr_flv_2026" };
      mockListSavedSentenzeByUser.mockRejectedValueOnce(new Error("Server offline"));

      const { result } = renderHook(() => useSavedSentenze());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe("Errore nel caricamento dei documenti");
      expect(result.current.isUnauthorized).toBe(false);
      expect(mockTrackEvent).toHaveBeenCalledWith("analytics_error", {
        name: "listSavedSentenzeByUser",
        reason: "Server offline",
      });
    });

    test("unsaveSentence rimuove la sentenza salvata invocando deleteSaveSentence", async () => {
      mockAuthState.user = { uid: "usr_flv_2026" };
      mockListSavedSentenzeByUser.mockResolvedValueOnce([]);
      mockDeleteSaveSentence.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useSavedSentenze());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.unsaveSentence("sent-100");
      });

      expect(mockDeleteSaveSentence).toHaveBeenCalledWith("usr_flv_2026", "sent-100");
    });

    test("unsaveSentence gestisce l'assenza di sessione tracciando errore senza chiamare il servizio", async () => {
      mockAuthState.user = null;

      const { result } = renderHook(() => useSavedSentenze());

      await act(async () => {
        await result.current.unsaveSentence("sent-100");
      });

      expect(result.current.isUnauthorized).toBe(true);
      expect(mockDeleteSaveSentence).not.toHaveBeenCalled();
      expect(mockTrackEvent).toHaveBeenCalledWith("analytics_error", {
        name: "unsaveSentence",
        reason: "unauthenticated",
      });
    });

    test("unsaveSentence traccia analytics_error e rilancia l'errore se la rimozione fallisce", async () => {
      mockAuthState.user = { uid: "usr_flv_2026" };
      mockListSavedSentenzeByUser.mockResolvedValueOnce([]);
      mockDeleteSaveSentence.mockRejectedValueOnce(new Error("Firestore delete rejected"));

      const { result } = renderHook(() => useSavedSentenze());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.unsaveSentence("sent-fail");
        })
      ).rejects.toThrow("Firestore delete rejected");

      expect(mockTrackEvent).toHaveBeenCalledWith("analytics_error", {
        name: "unsaveSentence",
        reason: "Firestore delete rejected",
      });
    });
  });
});