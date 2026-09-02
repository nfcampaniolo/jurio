import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";
import type { AttachedDocument, PastChat, PastFascicolo, DBThreadPayload, Source } from "@/interfaces/interfaces";

/* ---------- hoisted mocks ---------- */
const {
  mockNavigate,
  mockParams,
  mockAuthState,
  mockToast,
  mockListDocumentsByUser,
  mockListFascicoliByUser,
  mockListChatsByUser,
  mockFetchChatMessages,
  mockFetchFascicoloData,
  mockGetSecurityTokens,
  mockGetChatUrl,
  mockGetReasonUrl,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockParams: {
    chatId: undefined as string | undefined,
    fascicoloId: undefined as string | undefined,
    threadId: undefined as string | undefined,
  },
  mockAuthState: {
    user: null as User | null,
  },
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  mockListDocumentsByUser: vi.fn().mockResolvedValue([]),
  mockListFascicoliByUser: vi.fn().mockResolvedValue([]),
  mockListChatsByUser: vi.fn().mockResolvedValue([]),
  mockFetchChatMessages: vi.fn().mockResolvedValue([]),
  mockFetchFascicoloData: vi.fn().mockResolvedValue([]),
  mockGetSecurityTokens: vi.fn().mockResolvedValue({
    authToken: "mock-auth-token",
    appCheckToken: "mock-app-check",
  }),
  mockGetChatUrl: vi.fn(() => "https://api.jurio.it/legal-chat"),
  mockGetReasonUrl: vi.fn(() => "https://api.jurio.it/reason"),
}));

/* ---------- mock routing & globals ---------- */
vi.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
  useParams: () => mockParams,
}));

vi.mock("react-hot-toast", () => ({
  toast: mockToast,
}));

let uuidCounter = 0;
vi.mock("uuid", () => ({
  v4: () => `mock-uuid-${++uuidCounter}`,
}));

vi.mock("@/context/useAuth", () => ({
  __esModule: true,
  useAuth: () => mockAuthState,
}));

vi.mock("@/config/env", () => ({
  __esModule: true,
  getChatUrl: () => mockGetChatUrl(),
  getReasonUrl: () => mockGetReasonUrl(),
}));

vi.mock("@/services/document", () => ({
  __esModule: true,
  listDocumentsByUser: (...args: unknown[]) => mockListDocumentsByUser(...args),
  listFascicoliByUser: (...args: unknown[]) => mockListFascicoliByUser(...args),
  listChatsByUser: (...args: unknown[]) => mockListChatsByUser(...args),
  fetchChatMessages: (...args: unknown[]) => mockFetchChatMessages(...args),
  fetchFascicoloData: (...args: unknown[]) => mockFetchFascicoloData(...args),
}));

vi.mock("@/services/security", () => ({
  __esModule: true,
  getSecurityTokens: () => mockGetSecurityTokens(),
}));

/* ---------- mock sub-hooks (delegazione testata nei relativi file di suite) ---------- */
const mockSubHookHandlers = {
  renameFascicolo: vi.fn(),
  renameChat: vi.fn(),
  deleteChat: vi.fn(),
  deleteFascicolo: vi.fn(),
  deleteThread: vi.fn(),
  handleToggleFascicoloLink: vi.fn(),
  handleDeleteDocumento: vi.fn(),
  handleRenameDocumento: vi.fn(),
  processFilesParallel: vi.fn(),
  handleSendMessage: vi.fn(),
};

vi.mock("./useEntityOperations", () => ({
  __esModule: true,
  useEntityOperations: () => ({
    renameFascicolo: mockSubHookHandlers.renameFascicolo,
    renameChat: mockSubHookHandlers.renameChat,
    deleteChat: mockSubHookHandlers.deleteChat,
    deleteFascicolo: mockSubHookHandlers.deleteFascicolo,
    deleteThread: mockSubHookHandlers.deleteThread,
    handleToggleFascicoloLink: mockSubHookHandlers.handleToggleFascicoloLink,
    handleDeleteDocumento: mockSubHookHandlers.handleDeleteDocumento,
    handleRenameDocumento: mockSubHookHandlers.handleRenameDocumento,
  }),
}));

vi.mock("./useFileProcessor", () => ({
  __esModule: true,
  useFileProcessor: () => ({
    processFilesParallel: mockSubHookHandlers.processFilesParallel,
  }),
}));

vi.mock("./useChatMessaging", () => ({
  __esModule: true,
  useChatMessaging: () => ({
    handleSendMessage: mockSubHookHandlers.handleSendMessage,
  }),
}));

/* ---------- subject under test ---------- */
import { useLegalChat } from "@/hooks/useLegalChat";

describe("useLegalChat Orchestrator Suite", () => {
  const originalWindowOpen = window.open;
  const originalInnerWidth = window.innerWidth;
  const mockWindowOpen = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
    mockParams.chatId = undefined;
    mockParams.fascicoloId = undefined;
    mockParams.threadId = undefined;
    mockAuthState.user = { uid: "usr_flv_2026" } as User;

    window.open = mockWindowOpen;
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1024 });
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    globalThis.fetch = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    window.open = originalWindowOpen;
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: originalInnerWidth });
  });

  describe("Inizializzazione e Caricamento Dati Utente", () => {
    test("inizializza gli stati di default corretti e accetta documenti iniziali opzionali", () => {
      const initialDocs: AttachedDocument[] = [
        { id: "doc-init", name: "ricorso.pdf", size: "12 KB" },
      ];

      const { result } = renderHook(() => useLegalChat({ docs: initialDocs }));

      expect(result.current.sessionType).toBe("seleziona");
      expect(result.current.isSetupComplete).toBe(false);
      expect(result.current.isStreaming).toBe(false);
      expect(result.current.agentState).toBe("idle");
      expect(result.current.attachedDocs).toEqual(initialDocs);
      expect(result.current.activeFiltersCount).toBe(0);
      expect(result.current.isReadOnly).toBe(false);
    });

    test("recupera documenti, fascicoli e chat dell'utente al mount popolando archiveDocs", async () => {
      const mockDocs = [
        {
          id: "doc-1",
          nome_file: "Sentenza Cassazione 2026.pdf",
          tipo_documento: "Sentenza",
          massima: "In tema di compensazione dei crediti...",
          dataSentenza: "2026-02-15",
          fascicoloIds: ["fsc-1"],
          user: "usr_flv_2026",
        },
      ];
      const mockFascicoli = [{ id: "fsc-1", title: "Fascicolo Societario", ownerId: "usr_flv_2026" }] as unknown as PastFascicolo[];
      const mockChats = [{ id: "chat-1", title: "Chat Risoluzione Contrattuale" }] as unknown as PastChat[];

      mockListDocumentsByUser.mockResolvedValueOnce(mockDocs);
      mockListFascicoliByUser.mockResolvedValueOnce(mockFascicoli);
      mockListChatsByUser.mockResolvedValueOnce(mockChats);

      const { result } = renderHook(() => useLegalChat());

      await waitFor(() => {
        expect(result.current.isLoadingData).toBe(false);
      });

      expect(mockListDocumentsByUser).toHaveBeenCalledWith("usr_flv_2026");
      expect(mockListFascicoliByUser).toHaveBeenCalledWith("usr_flv_2026");
      expect(mockListChatsByUser).toHaveBeenCalledWith("usr_flv_2026");

      expect(result.current.archiveDocs).toHaveLength(1);
      expect(result.current.archiveDocs[0]).toEqual({
        id: "doc-1",
        name: "Sentenza Cassazione 2026.pdf",
        metadata: "In tema di compensazione dei crediti...",
        type: "pdf",
        dataSentenza: "2026-02-15",
        fascicoloIds: ["fsc-1"],
        user: "usr_flv_2026",
      });
      expect(result.current.pastFascicoli).toEqual(mockFascicoli);
      expect(result.current.pastChats).toEqual(mockChats);
    });
  });

  describe("Sincronizzazione URL e Sessioni (Chat Temporanea vs Fascicolo)", () => {
    test("configura sessionType 'temporanea', carica la cronologia ordinata e azzera allegati per chatId", async () => {
      mockParams.chatId = "chat-100";
      const sampleChat = { id: "chat-100", title: "Parere Termini Notifica" } as PastChat;
      mockListChatsByUser.mockResolvedValueOnce([sampleChat]);

      const unsortedMessages = [
        { id: "m2", role: "model", content: "I termini ordinari sono...", timestamp: 2000 },
        { id: "m1", role: "user", content: "Quali sono i termini?", timestamp: 1000 },
      ];
      mockFetchChatMessages.mockResolvedValueOnce(unsortedMessages);

      const { result } = renderHook(() => useLegalChat());

      await waitFor(() => {
        expect(result.current.sessionTitle).toBe("Parere Termini Notifica");
      });

      expect(result.current.sessionType).toBe("temporanea");
      expect(result.current.isSetupComplete).toBe(true);
      expect(result.current.attachedDocs).toEqual([]);
      expect(result.current.messages).toEqual([
        { id: "m1", role: "user", content: "Quali sono i termini?", timestamp: 1000, isHistorical: true },
        { id: "m2", role: "model", content: "I termini ordinari sono...", timestamp: 2000, isHistorical: true },
      ]);
      expect(mockNavigate).toHaveBeenCalledWith("/chat/chat-100");
    });

    test("configura sessionType 'fascicolo', imposta isReadOnly in base al proprietario e carica i thread", async () => {
      mockParams.fascicoloId = "fsc-200";
      const sampleFascicolo = {
        id: "fsc-200",
        title: "Contenzioso Banca Intesa",
        ownerId: "another_user_uid",
      } as unknown as PastFascicolo;
      mockListFascicoliByUser.mockResolvedValueOnce([sampleFascicolo]);

      const mockDate = { toDate: () => new Date("2026-03-01T08:00:00Z") } as never;

      const mockThreadsPayload: DBThreadPayload[] = [
        {
          threadId: "thr-1",
          threadData: {
            title: "Analisi Clausole Vessatorie",
            createdAt: mockDate,
            updatedAt: mockDate,
          },
          messages: [{ id: "msg-1", role: "user", content: "Clausola 4 valida?" } as never],
        },
      ];
      mockFetchFascicoloData.mockResolvedValueOnce(mockThreadsPayload);

      const { result } = renderHook(() => useLegalChat());

      await waitFor(() => {
        expect(result.current.sessionTitle).toBe("Contenzioso Banca Intesa");
      });

      expect(result.current.sessionType).toBe("fascicolo");
      expect(result.current.isReadOnly).toBe(true);
      expect(result.current.activeThreadId).toBe("thr-1");
      expect(result.current.threadTitle).toBe("Analisi Clausole Vessatorie");
      expect(result.current.threads).toHaveLength(1);
      expect(mockNavigate).toHaveBeenCalledWith("/fascicolo/fsc-200/thr-1");
    });
  });

  describe("Navigazione, Workflow Fascicoli e Thread", () => {
    test("startTempChat naviga su un nuovo UUID di chat", () => {
      const { result } = renderHook(() => useLegalChat());

      act(() => {
        result.current.startTempChat();
      });

      expect(mockNavigate).toHaveBeenCalledWith("/chat/mock-uuid-1");
    });

    test("startFascicoloSetup e finalizeFascicoloCreation gestiscono la transizione di creazione", () => {
      const { result } = renderHook(() => useLegalChat());

      act(() => {
        result.current.startFascicoloSetup();
      });

      expect(result.current.sessionType).toBe("fascicolo");
      expect(result.current.isSetupComplete).toBe(false);
      expect(mockNavigate).toHaveBeenCalledWith("/crea-nuovo-fascicolo");

      act(() => {
        result.current.finalizeFascicoloCreation();
      });

      expect(result.current.isSetupComplete).toBe(true);
      expect(mockNavigate).toHaveBeenCalledWith("/fascicolo/mock-uuid-1/mock-uuid-2");
    });

    test("createNewThread genera una nuova conversazione e naviga al nuovo thread del fascicolo", () => {
      mockParams.fascicoloId = "fsc-current";
      const { result } = renderHook(() => useLegalChat());

      act(() => {
        result.current.createNewThread();
      });

      expect(result.current.threadTitle).toBe("Nuova conversazione");
      expect(result.current.messages).toEqual([]);
      expect(result.current.activeThreadId).toBe("mock-uuid-1");
      expect(mockNavigate).toHaveBeenCalledWith("/fascicolo/fsc-current/mock-uuid-1");
    });

    test("createNewThread segnala errore con toast se non vi è un fascicolo attivo", () => {
      mockParams.fascicoloId = undefined;
      const { result } = renderHook(() => useLegalChat());

      act(() => {
        result.current.createNewThread();
      });

      expect(mockToast.error).toHaveBeenCalledWith("Nessun fascicolo attivo.");
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    test("closeSession invoca navigate(-1)", () => {
      const { result } = renderHook(() => useLegalChat());

      act(() => {
        result.current.closeSession();
      });

      expect(mockNavigate).toHaveBeenCalledWith(-1);
    });
  });

  describe("Filtri e Selezione Documenti", () => {
    test("calcola activeFiltersCount e azzera tutti i campi con clearFilters", () => {
      const { result } = renderHook(() => useLegalChat());

      expect(result.current.activeFiltersCount).toBe(0);

      act(() => {
        result.current.setFilterState.setFilterGrado("Cassazione Civile");
        result.current.setFilterState.setFilterTipo("conforme");
        result.current.setFilterState.setStartDate("2026-01-01");
      });

      expect(result.current.activeFiltersCount).toBe(3);

      act(() => {
        result.current.clearFilters();
      });

      expect(result.current.activeFiltersCount).toBe(0);
      expect(result.current.filterState.filterGrado).toBe("");
      expect(result.current.filterState.filterTipo).toBe("");
    });

    test("toggleDocSelection aggiunge o rimuove il documento tra gli allegati", () => {
      const { result } = renderHook(() => useLegalChat());
      const docItem: AttachedDocument = { id: "doc-toggle", name: "memoria.pdf", size: "20 KB" };

      act(() => {
        result.current.toggleDocSelection(docItem);
      });
      expect(result.current.attachedDocs).toContainEqual(docItem);

      act(() => {
        result.current.toggleDocSelection(docItem);
      });
      expect(result.current.attachedDocs).toHaveLength(0);
    });

    test("removeAttachment rimuove l'allegato per ID", () => {
      const { result } = renderHook(() =>
        useLegalChat({
          docs: [
            { id: "d-1", name: "doc1.pdf", size: "1 KB" },
            { id: "d-2", name: "doc2.pdf", size: "2 KB" },
          ],
        })
      );

      act(() => {
        result.current.removeAttachment("d-1");
      });

      expect(result.current.attachedDocs).toHaveLength(1);
      expect(result.current.attachedDocs[0].id).toBe("d-2");
    });
  });

  describe("Migrazione Chat -> Fascicolo (convertChatToFascicolo)", () => {
    test("migra la chat temporanea in fascicolo chiamando l'endpoint di backend e reindirizza", async () => {
      mockParams.chatId = "chat-temp-123";
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
      });

      const { result } = renderHook(() => useLegalChat());

      act(() => {
        result.current.setSessionTitle("Parere Esistente");
      });

      await act(async () => {
        await result.current.convertChatToFascicolo("Nuovo Fascicolo Notifiche");
      });

      expect(mockGetSecurityTokens).toHaveBeenCalled();
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.jurio.it/legal-chat",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer mock-auth-token",
            "X-Firebase-AppCheck": "mock-app-check",
          },
          body: JSON.stringify({
            action: "migrate",
            old_chat_uuid: "chat-temp-123",
            new_fascicolo_uuid: "mock-uuid-1",
            title: "Nuovo Fascicolo Notifiche",
            metadatiFascicolo: {},
          }),
        })
      );
      expect(mockNavigate).toHaveBeenCalledWith("/fascicolo/mock-uuid-1/chat-temp-123");
    });
  });

  describe("Interazione Fonti (handleSourceClick) e Metadati SEO", () => {
    const createMockMouseEvent = () =>
      ({
        stopPropagation: vi.fn(),
      }) as unknown as React.MouseEvent;

    test("apre url esterno in _blank per fonti di tipo web_search", async () => {
      const { result } = renderHook(() => useLegalChat());
      const event = createMockMouseEvent();
      const webSource: Source = {
        _type: "web_search",
        url_riferimento: "https://www.gazzettaufficiale.it/atto/123",
      } as Source;

      await act(async () => {
        await result.current.handleSourceClick(event, webSource);
      });

      expect(event.stopPropagation).toHaveBeenCalled();
      expect(mockWindowOpen).toHaveBeenCalledWith(
        "https://www.gazzettaufficiale.it/atto/123",
        "_blank",
        "noopener,noreferrer"
      );
    });

    test("apre documento privato su /documento/:id e giurisprudenza su /giurisprudenza/:id", async () => {
      const { result } = renderHook(() => useLegalChat());
      const event = createMockMouseEvent();

      const docChunkSource: Source = {
        _type: "document_chunk",
        documento_id: "doc-chunk-99",
      } as Source;

      await act(async () => {
        await result.current.handleSourceClick(event, docChunkSource);
      });

      expect(mockWindowOpen).toHaveBeenCalledWith("/documento/doc-chunk-99", "_blank", "noopener,noreferrer");

      const sentenzaSource: Source = {
        _type: "sentence",
        documento_id: "cass-2026-555",
      } as Source;

      await act(async () => {
        await result.current.handleSourceClick(event, sentenzaSource);
      });

      expect(mockWindowOpen).toHaveBeenCalledWith("/giurisprudenza/cass-2026-555", "_blank", "noopener,noreferrer");
    });

    test("utilizza il target _self per la navigazione fonti su schermi mobili (< 768px)", async () => {
      Object.defineProperty(window, "innerWidth", { value: 500, configurable: true });

      const { result } = renderHook(() => useLegalChat());
      const event = createMockMouseEvent();
      const sentenzaSource: Source = {
        _type: "sentence",
        documento_id: "cass-mob-1",
      } as Source;

      await act(async () => {
        await result.current.handleSourceClick(event, sentenzaSource);
      });

      expect(mockWindowOpen).toHaveBeenCalledWith("/giurisprudenza/cass-mob-1", "_self", "noopener,noreferrer");
    });

    test("restituisce i tag SEO appropriati per ogni stato di sessionType", () => {
      const { result } = renderHook(() => useLegalChat());

      expect(result.current.seo.title).toBe("Consultazione | Jurio");

      act(() => {
        result.current.setSessionType("fascicolo");
      });
      expect(result.current.seo.title).toBe("Consulente Legale | Jurio");

      act(() => {
        result.current.setSessionType("storico");
      });
      expect(result.current.seo.title).toBe("Archivio | Jurio");
    });
  });
});