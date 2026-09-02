import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { AttachedDocument, PastChat, PastFascicolo } from "@/interfaces/interfaces";
import type { EntityOperationsProps } from "@/hooks/useEntityOperations"; // <-- adegua il path se necessario

/* ---------- hoisted mocks ---------- */
const {
  mockToast,
  mockGetDb,
  mockGetCurrentUserId,
  mockDeleteDocument,
  mockRenameDocument,
  mockDeleteDocumentStorage,
  mockTrackEvent,
  mockDoc,
  mockUpdateDoc,
  mockServerTimestamp,
  mockCollection,
  mockQuery,
  mockWhere,
  mockGetDocs,
  mockWriteBatch,
  mockBatchUpdate,
  mockBatchDelete,
  mockBatchCommit,
  mockArrayUnion,
  mockArrayRemove,
} = vi.hoisted(() => {
  const batchUpdate = vi.fn();
  const batchDelete = vi.fn();
  const batchCommit = vi.fn().mockResolvedValue(undefined);

  return {
    mockToast: {
      success: vi.fn(),
      error: vi.fn(),
    },
    mockGetDb: vi.fn().mockResolvedValue({ firestore: "mockDb" }),
    mockGetCurrentUserId: vi.fn().mockResolvedValue("usr_flv_2026"),
    mockDeleteDocument: vi.fn().mockResolvedValue(undefined),
    mockRenameDocument: vi.fn().mockResolvedValue(undefined),
    mockDeleteDocumentStorage: vi.fn().mockResolvedValue(undefined),
    mockTrackEvent: vi.fn(),
    mockDoc: vi.fn((...args: unknown[]) => ({
      id: args[2] as string || "mock-doc-id",
      path: args.slice(1).join("/"),
    })),
    mockUpdateDoc: vi.fn().mockResolvedValue(undefined),
    mockServerTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
    mockCollection: vi.fn((...args: unknown[]) => ({ path: args.slice(1).join("/") })),
    mockQuery: vi.fn((...args: unknown[]) => ({ isQuery: true, args })),
    mockWhere: vi.fn((field: string, op: string, val: unknown) => ({ field, op, val })),
    mockGetDocs: vi.fn(),
    mockBatchUpdate: batchUpdate,
    mockBatchDelete: batchDelete,
    mockBatchCommit: batchCommit,
    mockWriteBatch: vi.fn(() => ({
      update: batchUpdate,
      delete: batchDelete,
      commit: batchCommit,
    })),
    mockArrayUnion: vi.fn((val: unknown) => ({ op: "arrayUnion", val })),
    mockArrayRemove: vi.fn((val: unknown) => ({ op: "arrayRemove", val })),
  };
});

/* ---------- mock modules ---------- */
vi.mock("react-hot-toast", () => ({
  toast: mockToast,
}));

vi.mock("@/services/db", () => ({
  __esModule: true,
  getDb: () => mockGetDb(),
}));

vi.mock("@/services/security", () => ({
  __esModule: true,
  getCurrentUserId: () => mockGetCurrentUserId(),
}));

vi.mock("@/services/document", () => ({
  __esModule: true,
  deleteDocument: (col: string, id: string) => mockDeleteDocument(col, id),
  renameDocument: (id: string, name: string) => mockRenameDocument(id, name),
}));

vi.mock("@/services/storage", () => ({
  __esModule: true,
  deleteDocumentStorage: (id: string, path: string) => mockDeleteDocumentStorage(id, path),
}));

vi.mock("@/services/analytics", () => ({
  __esModule: true,
  trackEvent: (event: string, payload?: Record<string, unknown>) =>
    mockTrackEvent(event, payload),
}));

vi.mock("firebase/firestore", () => ({
  __esModule: true,
  doc: (...args: unknown[]) => mockDoc(...args),
  updateDoc: (ref: unknown, data: unknown) => mockUpdateDoc(ref, data),
  serverTimestamp: () => mockServerTimestamp(),
  collection: (...args: unknown[]) => mockCollection(...args),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (field: string, op: string, val: unknown) => mockWhere(field, op, val),
  getDocs: (q: unknown) => mockGetDocs(q),
  writeBatch: () => mockWriteBatch(),
  arrayUnion: (val: unknown) => mockArrayUnion(val),
  arrayRemove: (val: unknown) => mockArrayRemove(val),
}));

/* ---------- subject under test ---------- */
import { useEntityOperations } from "@/hooks/useEntityOperations";

describe("useEntityOperations Hook Suite", () => {
  let pastFascicoliState: PastFascicolo[] = [];
  let pastChatsState: PastChat[] = [];
  let threadsState: { id: string; title: string; createdAt: Date }[] = [];
  let archiveDocsState: AttachedDocument[] = [];

  const setupProps = (): EntityOperationsProps => ({
    archiveDocs: archiveDocsState,
    setPastFascicoli: vi.fn((update) => {
      pastFascicoliState = typeof update === "function" ? update(pastFascicoliState) : update;
    }),
    setPastChats: vi.fn((update) => {
      pastChatsState = typeof update === "function" ? update(pastChatsState) : update;
    }),
    setThreads: vi.fn((update) => {
      threadsState = typeof update === "function" ? update(threadsState) : update;
    }),
    setArchiveDocs: vi.fn((update) => {
      archiveDocsState = typeof update === "function" ? update(archiveDocsState) : update;
    }),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    pastFascicoliState = [
      { id: "fsc-1", title: "Fascicolo Civile 2026", updatedAt: new Date("2026-01-01") } as PastFascicolo,
    ];
    pastChatsState = [
      { id: "chat-1", title: "Sessione Parere", updatedAt: new Date("2026-01-01") } as PastChat,
    ];
    threadsState = [{ id: "thread-1", title: "Primo Atto", createdAt: new Date("2026-01-01") }];
    archiveDocsState = [
      { id: "doc-1", name: "memoria.pdf", size: "1024", fascicoloIds: [] },
    ];
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("renameFascicolo & renameChat", () => {
    test("aggiorna il titolo del fascicolo su Firestore e aggiorna lo stato locale", async () => {
      const props = setupProps();
      const { result } = renderHook(() => useEntityOperations(props));

      await act(async () => {
        await result.current.renameFascicolo("fsc-1", "Nuovo Fascicolo Ridenominato");
      });

      expect(mockDoc).toHaveBeenCalledWith({ firestore: "mockDb" }, "fascicoli", "fsc-1");
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ id: "fsc-1" }),
        { title: "Nuovo Fascicolo Ridenominato", updatedAt: "SERVER_TIMESTAMP" }
      );
      expect(props.setPastFascicoli).toHaveBeenCalled();
      expect(pastFascicoliState[0].title).toBe("Nuovo Fascicolo Ridenominato");
    });

    test("mostra toast di errore se la rinomina del fascicolo fallisce", async () => {
      mockUpdateDoc.mockRejectedValueOnce(new Error("Update failed"));
      const props = setupProps();
      const { result } = renderHook(() => useEntityOperations(props));

      await act(async () => {
        await result.current.renameFascicolo("fsc-1", "Titolo Errato");
      });

      expect(mockToast.error).toHaveBeenCalledWith("Errore durante la rinomina del fascicolo.");
    });

    test("aggiorna il titolo della chat su Firestore e aggiorna lo stato locale", async () => {
      const props = setupProps();
      const { result } = renderHook(() => useEntityOperations(props));

      await act(async () => {
        await result.current.renameChat("chat-1", "Nuova Chat Ricerca");
      });

      expect(mockDoc).toHaveBeenCalledWith({ firestore: "mockDb" }, "chats", "chat-1");
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.objectContaining({ id: "chat-1" }),
        { title: "Nuova Chat Ricerca", updatedAt: "SERVER_TIMESTAMP" }
      );
      expect(pastChatsState[0].title).toBe("Nuova Chat Ricerca");
    });
  });

  describe("deleteFascicolo", () => {
    test("blocca l'operazione con toast se l'utente non è autenticato", async () => {
      mockGetCurrentUserId.mockResolvedValueOnce(null);
      const props = setupProps();
      const { result } = renderHook(() => useEntityOperations(props));

      await act(async () => {
        await result.current.deleteFascicolo("fsc-1");
      });

      expect(mockToast.error).toHaveBeenCalledWith("Utente non autenticato.");
      expect(mockWriteBatch).not.toHaveBeenCalled();
    });

    test("rimuove il fascicolo da documenti, chunk, thread, messaggi ed esegue il batch commit", async () => {
      const mockDocSnap = { ref: { path: "documents/doc-1" } };
      const mockChunkSnap = { ref: { path: "document_chunks/chunk-1" } };
      const mockThreadSnap = { id: "thread-1", ref: { path: "fascicoli/fsc-1/threads/thread-1" } };
      const mockMessageSnap = { ref: { path: "fascicoli/fsc-1/threads/thread-1/messages/msg-1" } };

      mockGetDocs
        .mockResolvedValueOnce({ forEach: (cb: (d: unknown) => void) => cb(mockDocSnap) }) // documents
        .mockResolvedValueOnce({ forEach: (cb: (d: unknown) => void) => cb(mockChunkSnap) }) // chunks
        .mockResolvedValueOnce({ docs: [mockThreadSnap] }) // threads
        .mockResolvedValueOnce({ forEach: (cb: (d: unknown) => void) => cb(mockMessageSnap) }); // messages

      const props = setupProps();
      const { result } = renderHook(() => useEntityOperations(props));

      await act(async () => {
        await result.current.deleteFascicolo("fsc-1");
      });

      expect(mockBatchUpdate).toHaveBeenCalledTimes(2); // 1 document + 1 chunk
      expect(mockBatchDelete).toHaveBeenCalledTimes(3); // 1 message + 1 thread + 1 fascicolo doc
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
      expect(pastFascicoliState).toHaveLength(0);
      expect(mockToast.success).toHaveBeenCalledWith("Fascicolo eliminato correttamente.");
    });
  });

  describe("deleteChat & deleteThread", () => {
    test("deleteChat elimina tutti i messaggi della subcollection e la chat stessa in batch", async () => {
      const mockMessageSnap = { ref: { path: "chats/chat-1/messages/msg-1" } };
      mockGetDocs.mockResolvedValueOnce({
        forEach: (cb: (d: unknown) => void) => cb(mockMessageSnap),
      });

      const props = setupProps();
      const { result } = renderHook(() => useEntityOperations(props));

      await act(async () => {
        await result.current.deleteChat("chat-1");
      });

      expect(mockBatchDelete).toHaveBeenCalledTimes(2); // 1 msg + 1 chat
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
      expect(pastChatsState).toHaveLength(0);
      expect(mockToast.success).toHaveBeenCalledWith("Chat e messaggi eliminati.");
    });

    test("deleteThread elimina i messaggi del thread, il record del thread e aggiorna lo stato locale", async () => {
      const mockMessageSnap = { ref: { path: "fascicoli/fsc-1/threads/thread-1/messages/msg-1" } };
      mockGetDocs.mockResolvedValueOnce({
        forEach: (cb: (d: unknown) => void) => cb(mockMessageSnap),
      });

      const props = setupProps();
      const { result } = renderHook(() => useEntityOperations(props));

      await act(async () => {
        await result.current.deleteThread("fsc-1", "thread-1");
      });

      expect(mockBatchDelete).toHaveBeenCalledTimes(2); // msg + thread
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
      expect(threadsState).toHaveLength(0);
      expect(mockToast.success).toHaveBeenCalledWith("Conversazione eliminata con successo.");
    });
  });

  describe("handleToggleFascicoloLink", () => {
    test("collega il documento al fascicolo e aggiorna i chunk correlati", async () => {
      const targetDoc: AttachedDocument = {
        id: "doc-1",
        name: "atto.pdf",
        size: "512",
        fascicoloIds: [],
      };

      const mockChunkSnap = { ref: { path: "document_chunks/chunk-1" } };
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        forEach: (cb: (d: unknown) => void) => cb(mockChunkSnap),
      });

      const props = setupProps();
      const { result } = renderHook(() => useEntityOperations(props));

      await act(async () => {
        await result.current.handleToggleFascicoloLink(targetDoc, "fsc-100", true);
      });

      expect(mockArrayUnion).toHaveBeenCalledWith("fsc-100");
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ fascicoloIds: expect.objectContaining({ op: "arrayUnion" }) })
      );
      expect(mockBatchUpdate).toHaveBeenCalledTimes(1);
      expect(mockBatchCommit).toHaveBeenCalledTimes(1);
      expect(archiveDocsState[0].fascicoloIds).toContain("fsc-100");
      expect(mockToast.success).toHaveBeenCalledWith("Documento copiato nel fascicolo.");
    });

    test("effettua il rollback dello stato locale e mostra toast di errore in caso di fallimento", async () => {
      const targetDoc: AttachedDocument = {
        id: "doc-1",
        name: "atto.pdf",
        size: "512",
        fascicoloIds: [],
      };

      mockUpdateDoc.mockRejectedValueOnce(new Error("Permission denied"));

      const props = setupProps();
      const { result } = renderHook(() => useEntityOperations(props));

      await act(async () => {
        await result.current.handleToggleFascicoloLink(targetDoc, "fsc-100", true);
      });

      expect(mockToast.error).toHaveBeenCalledWith("Errore durante lo spostamento.");
      // Rollback veridico dello stato precedente
      expect(archiveDocsState[0].fascicoloIds).toEqual([]);
    });
  });

  describe("handleDeleteDocumento & handleRenameDocumento", () => {
    test("elimina il documento da storage e database e traccia l'evento analytics", async () => {
      const props = setupProps();
      const { result } = renderHook(() => useEntityOperations(props));

      await act(async () => {
        await result.current.handleDeleteDocumento("doc-1");
      });

      expect(mockDeleteDocument).toHaveBeenCalledWith("documents", "doc-1");
      expect(mockDeleteDocumentStorage).toHaveBeenCalledWith(
        "doc-1",
        "users/usr_flv_2026/documents"
      );
      expect(mockTrackEvent).toHaveBeenCalledWith("document_deleted", {});
      expect(archiveDocsState).toHaveLength(0);
      expect(mockToast.success).toHaveBeenCalledWith("Documento eliminato");
    });

    test("rinomina il documento aggiornando lo stato locale e invocando renameDocument", async () => {
      const props = setupProps();
      const { result } = renderHook(() => useEntityOperations(props));

      await act(async () => {
        await result.current.handleRenameDocumento("doc-1", "memoria_aggiornata.pdf");
      });

      expect(mockRenameDocument).toHaveBeenCalledWith("doc-1", "memoria_aggiornata.pdf");
      expect(archiveDocsState[0].name).toBe("memoria_aggiornata.pdf");
      expect(mockToast.success).toHaveBeenCalledWith("Documento rinominato");
    });
  });
});