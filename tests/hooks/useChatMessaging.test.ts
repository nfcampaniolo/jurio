import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { User } from "firebase/auth";
import type { Message, AttachedDocument } from "@/interfaces/interfaces";
import type { MessagingProps } from "@/hooks/useChatMessaging"; // <-- adegua il path di import se necessario

/* ---------- hoisted mocks ---------- */
const {
  mockEnsureAnonAuth,
  mockGetSecurityTokens,
  mockGetDb,
  mockDoc,
  mockGetDoc,
  mockBuildGenkitFilters,
  mockToastError,
} = vi.hoisted(() => ({
  mockEnsureAnonAuth: vi.fn().mockResolvedValue(undefined),
  mockGetSecurityTokens: vi.fn().mockResolvedValue({
    authToken: "mock-auth-token",
    appCheckToken: "mock-app-check-token",
  }),
  mockGetDb: vi.fn().mockResolvedValue({ firestore: "mockDb" }),
  mockDoc: vi.fn((_db: unknown, col: string, id: string) => ({ col, id })),
  mockGetDoc: vi.fn(),
  mockBuildGenkitFilters: vi.fn(() => []),
  mockToastError: vi.fn(),
}));

/* ---------- mock modules ---------- */
vi.mock("@/config/env", () => ({
  __esModule: true,
  getChatUrl: () => "https://api.jurio.it/agent/legal-chat",
}));

vi.mock("react-hot-toast", () => ({
  toast: { error: mockToastError },
}));

let uuidIndex = 0;
vi.mock("uuid", () => ({
  v4: () => `test-uuid-${++uuidIndex}`,
}));

vi.mock("@/services/auth", () => ({
  __esModule: true,
  ensureAnonAuth: () => mockEnsureAnonAuth(),
}));

vi.mock("@/services/security", () => ({
  __esModule: true,
  getSecurityTokens: () => mockGetSecurityTokens(),
}));

vi.mock("@/services/db", () => ({
  __esModule: true,
  getDb: () => mockGetDb(),
}));

vi.mock("firebase/firestore", () => ({
  __esModule: true,
  doc: (...args: unknown[]) => mockDoc(args[0], args[1] as string, args[2] as string),
  getDoc: (ref: unknown) => mockGetDoc(ref),
}));

vi.mock("@/hooks/searchBarTypes", () => ({
  __esModule: true,
  buildGenkitFilters: () => mockBuildGenkitFilters(),
}));

/* ---------- helper per stream SSE ---------- */
function createSseStream(chunks: string[]) {
  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
}

/* ---------- subject under test ---------- */
import { useChatMessaging } from "@/hooks/useChatMessaging";

describe("useChatMessaging Hook Suite", () => {
  let messagesState: Message[] = [];
  let inputValueState = "Quali sono i termini per l'impugnazione?";
  let threadsState = [{ id: "thread-1", title: "Fascicolo Iniziale", createdAt: new Date() }];

  const defaultProps: MessagingProps = {
    user: { uid: "usr_flv_2026" } as User,
    inputValue: inputValueState,
    attachedDocs: [],
    activeQuote: [],
    activeFiltersCount: 0,
    filterState: {
      filterGrado: "",
      filterSezione: "",
      filterTipo: "",
      filterTipologia: "",
      startDate: "",
      endDate: "",
    },
    sessionType: "temporanea",
    chatId: "chat-100",
    threadId: "thread-1",
    fascicoloId: undefined,
    sessionTitle: "Nuova Sessione",
    activeThreadId: null,
    isStreaming: false,
    setMessages: vi.fn((update) => {
      messagesState = typeof update === "function" ? update(messagesState) : update;
    }),
    setInputValue: vi.fn((update) => {
      inputValueState = typeof update === "function" ? update(inputValueState) : update;
    }),
    setAgentState: vi.fn(),
    setAgentStatusText: vi.fn(),
    setShowFilters: vi.fn(),
    setDenyOpen: vi.fn(),
    setSessionTitle: vi.fn(),
    setThreadTitle: vi.fn(),
    setThreads: vi.fn((update) => {
      threadsState = typeof update === "function" ? update(threadsState) : update;
    }),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    uuidIndex = 0;
    messagesState = [];
    inputValueState = "Quali sono i termini per l'impugnazione?";
    threadsState = [{ id: "thread-1", title: "Fascicolo Iniziale", createdAt: new Date() }];
    globalThis.fetch = vi.fn();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Validazioni preliminari e guardie di invio", () => {
    test("ignora l'invio se input è vuoto, senza allegati e senza citazioni attive", async () => {
      const { result } = renderHook(() =>
        useChatMessaging({
          ...defaultProps,
          inputValue: "   ",
          attachedDocs: [],
          activeQuote: [],
        })
      );

      await act(async () => {
        await result.current.handleSendMessage();
      });

      expect(defaultProps.setMessages).not.toHaveBeenCalled();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    test("ignora l'invio se un'altra risposta è già in fase di streaming", async () => {
      const { result } = renderHook(() =>
        useChatMessaging({
          ...defaultProps,
          isStreaming: true,
        })
      );

      await act(async () => {
        await result.current.handleSendMessage();
      });

      expect(defaultProps.setMessages).not.toHaveBeenCalled();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });

    test("blocca l'invio con toast di errore se sono selezionati più di 2 filtri attivi", async () => {
      const { result } = renderHook(() =>
        useChatMessaging({
          ...defaultProps,
          activeFiltersCount: 3,
        })
      );

      await act(async () => {
        await result.current.handleSendMessage();
      });

      expect(mockToastError).toHaveBeenCalledWith("Puoi attivare al massimo 2 filtri contemporaneamente.");
      expect(defaultProps.setShowFilters).toHaveBeenCalledWith(true);
      expect(defaultProps.setMessages).not.toHaveBeenCalled();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });

  describe("Creazione del payload e invocazione endpoint", () => {
    test("invia prompt con documenti allegati e header di sicurezza completi", async () => {
      const attached: AttachedDocument[] = [
        { id: "doc-1", name: "ricorso.pdf", size: "1024" },
      ];

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: createSseStream(["data: [DONE]\n\n"]),
      });

      const { result } = renderHook(() =>
        useChatMessaging({
          ...defaultProps,
          attachedDocs: attached,
        })
      );

      await act(async () => {
        await result.current.handleSendMessage();
      });

      expect(mockEnsureAnonAuth).toHaveBeenCalled();
      expect(mockGetSecurityTokens).toHaveBeenCalled();

      expect(globalThis.fetch).toHaveBeenCalledWith(
        "https://api.jurio.it/agent/legal-chat",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer mock-auth-token",
            "X-Firebase-AppCheck": "mock-app-check-token",
          },
          body: expect.stringContaining('"docs":["doc-1"]'),
        })
      );

      // Inizializza messaggio utente e placeholder model
      expect(messagesState).toHaveLength(2);
      expect(messagesState[0]).toMatchObject({ role: "user", content: defaultProps.inputValue });
      expect(messagesState[1]).toMatchObject({ role: "model", content: "" });
    });

    test("include il testo citato nel prompt e azzera docs quando activeQuote è popolato", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: createSseStream(["data: [DONE]\n\n"]),
      });

      const { result } = renderHook(() =>
        useChatMessaging({
          ...defaultProps,
          attachedDocs: [{ id: "doc-9", name: "atto.docx", size: "2048" }],
          activeQuote: ["Art. 360 c.p.c. comma 1", "Violazione di legge"],
        })
      );

      await act(async () => {
        await result.current.handleSendMessage();
      });

      const fetchCallBody = JSON.parse(
        (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
      );

      expect(fetchCallBody.docs).toEqual([]);
      expect(fetchCallBody.prompt).toContain("[Testo selezionato in riferimento]:");
      expect(fetchCallBody.prompt).toContain("Art. 360 c.p.c. comma 1");
    });

    test("recupera i metadati del fascicolo da Firestore se fascicoloId è presente", async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ metadati: { rg: "1234/2026", giudice: "Dott. Rossi" } }),
      });

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: createSseStream(["data: [DONE]\n\n"]),
      });

      const { result } = renderHook(() =>
        useChatMessaging({
          ...defaultProps,
          sessionType: "fascicolo",
          fascicoloId: "fsc_999",
        })
      );

      await act(async () => {
        await result.current.handleSendMessage();
      });

      expect(mockDoc).toHaveBeenCalledWith({ firestore: "mockDb" }, "fascicoli", "fsc_999");
      const fetchCallBody = JSON.parse(
        (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1].body
      );
      expect(fetchCallBody.metadatiFascicolo).toEqual({
        rg: "1234/2026",
        giudice: "Dott. Rossi",
      });
    });
  });

  describe("Elaborazione del flusso SSE (Server-Sent Events)", () => {
    test("aggiorna status text, appende i chunk di testo e gestisce il [DONE] finale", async () => {
      const sseChunks = [
        `data: ${JSON.stringify({ message: { status: "Ricerca precedenti in corso..." } })}\n\n`,
        `data: ${JSON.stringify({ message: "In tema di prescrizione " })}\n\n`,
        `data: ${JSON.stringify({ message: "il termine ordinario è di dieci anni." })}\n\n`,
        `data: [DONE]\n\n`,
      ];

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: createSseStream(sseChunks),
      });

      const { result } = renderHook(() => useChatMessaging(defaultProps));

      await act(async () => {
        await result.current.handleSendMessage();
      });

      expect(defaultProps.setAgentState).toHaveBeenCalledWith("streaming");
      expect(defaultProps.setAgentStatusText).toHaveBeenCalledWith("Ricerca precedenti in corso...");

      const modelMessage = messagesState.find((m) => m.role === "model");
      expect(modelMessage?.content).toBe("In tema di prescrizione il termine ordinario è di dieci anni.");
      expect(defaultProps.setAgentState).toHaveBeenCalledWith("idle");
    });

    test("aggiorna il titolo sessione per sessionType 'temporanea'", async () => {
      const sseChunks = [
        `data: ${JSON.stringify({
          result: {
            titoloGenerato: "Prescrizione Crediti Professionali",
            risposta: "Risposta consolidata finale.",
            fonti: [{ id: "cass-100", titolo: "Cass. Civ. 100/2026" }],
          },
        })}\n\n`,
        `data: [DONE]\n\n`,
      ];

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: createSseStream(sseChunks),
      });

      const { result } = renderHook(() =>
        useChatMessaging({
          ...defaultProps,
          sessionType: "temporanea",
        })
      );

      await act(async () => {
        await result.current.handleSendMessage();
      });

      expect(defaultProps.setSessionTitle).toHaveBeenCalledWith("Prescrizione Crediti Professionali");
      const modelMessage = messagesState.find((m) => m.role === "model");
      expect(modelMessage?.content).toBe("Risposta consolidata finale.");
      expect(modelMessage?.sources).toEqual([{ id: "cass-100", titolo: "Cass. Civ. 100/2026" }]);
    });

    test("aggiorna titolo thread e array threads per sessionType 'fascicolo'", async () => {
      const sseChunks = [
        `data: ${JSON.stringify({
          result: {
            titoloGenerato: "Analisi Memoria 183 cpc",
            risposta: "Parere legale completato.",
          },
        })}\n\n`,
        `data: [DONE]\n\n`,
      ];

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: createSseStream(sseChunks),
      });

      const { result } = renderHook(() =>
        useChatMessaging({
          ...defaultProps,
          sessionType: "fascicolo",
          threadId: "thread-1",
        })
      );

      await act(async () => {
        await result.current.handleSendMessage();
      });

      expect(defaultProps.setThreadTitle).toHaveBeenCalledWith("Analisi Memoria 183 cpc");
      expect(threadsState[0].title).toBe("Analisi Memoria 183 cpc");
    });
  });

  describe("Gestione degli errori HTTP e di rete", () => {
    test("apre il modale di upgrade su HTTP 403 e imposta agentState a error", async () => {
      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 403,
      });

      const { result } = renderHook(() => useChatMessaging(defaultProps));

      await act(async () => {
        await result.current.handleSendMessage();
      });

      expect(defaultProps.setDenyOpen).toHaveBeenCalledWith(true);
      expect(defaultProps.setAgentState).toHaveBeenCalledWith("error");

      const modelMessage = messagesState.find((m) => m.role === "model");
      expect(modelMessage?.content).toContain("Accesso negato.");
    });

    test("gestisce errore 500 del server e ripristina agentState a idle dopo il timeout", async () => {
      vi.useFakeTimers();

      (globalThis.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 500,
        body: null,
      });

      const { result } = renderHook(() => useChatMessaging(defaultProps));

      await act(async () => {
        await result.current.handleSendMessage();
      });

      expect(defaultProps.setAgentState).toHaveBeenCalledWith("error");

      const modelMessage = messagesState.find((m) => m.role === "model");
      expect(modelMessage?.content).toContain("Errore API: 500");

      act(() => {
        vi.advanceTimersByTime(5000);
      });

      expect(defaultProps.setAgentState).toHaveBeenCalledWith("idle");
      expect(defaultProps.setAgentStatusText).toHaveBeenCalledWith("");
    });
  });
});