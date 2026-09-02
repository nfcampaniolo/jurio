import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import type { ChatMessage, SourceItem } from "@/services/chatLogic";

/* ---------- hoisted mocks ---------- */
const { mockFetchWithAppCheckOnly, mockGetSupportUrl } = vi.hoisted(() => ({
  mockFetchWithAppCheckOnly: vi.fn(),
  mockGetSupportUrl: vi.fn(() => "https://api.jurio.it/support/chat"),
}));

/* ---------- mock modules ---------- */
vi.mock("@/config/apiClient", () => ({
  __esModule: true,
  fetchWithAppCheckOnly: mockFetchWithAppCheckOnly,
}));

vi.mock("@/config/env", () => ({
  __esModule: true,
  getSupportUrl: mockGetSupportUrl,
}));

/* ---------- subject under test ---------- */
import { chatCache, sendSupportMessage } from "@/services/chatLogic";

describe("Chat Support Logic & Cache Suite", () => {
  const CACHE_KEY = "jurio_support_chat_cache";
  let localStorageStore: Record<string, string> = {};

  const createMockStream = (chunks: string[]): ReadableStream<Uint8Array> => {
    const encoder = new TextEncoder();
    return new ReadableStream<Uint8Array>({
      start(controller) {
        for (const chunk of chunks) {
          controller.enqueue(encoder.encode(chunk));
        }
        controller.close();
      },
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorageStore = {};

    vi.spyOn(Storage.prototype, "getItem").mockImplementation((key: string) => {
      return localStorageStore[key] ?? null;
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation((key: string, value: string) => {
      localStorageStore[key] = value;
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation((key: string) => {
      delete localStorageStore[key];
    });

    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    mockGetSupportUrl.mockReturnValue("https://api.jurio.it/support/chat");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /* -------------------------------------------------------------------------- */
  /* CHAT CACHE UNIT TESTS                                                      */
  /* -------------------------------------------------------------------------- */
  describe("chatCache", () => {
    test("get restituisce un array vuoto se localStorage non contiene dati", () => {
      const messages = chatCache.get();
      expect(messages).toEqual([]);
    });

    test("get recupera e deserializza correttamente i messaggi memorizzati", () => {
      const storedMessages: ChatMessage[] = [
        { role: "user", content: "Come posso esportare una sentenza in Word?" },
        { role: "assistant", content: "Puoi usare il componente add-in integrato." },
      ];
      localStorageStore[CACHE_KEY] = JSON.stringify(storedMessages);

      const messages = chatCache.get();
      expect(messages).toEqual(storedMessages);
    });

    test("get intercetta errori di parsing JSON restituendo un array vuoto", () => {
      localStorageStore[CACHE_KEY] = "{ json-invalido";

      const messages = chatCache.get();

      expect(messages).toEqual([]);
      expect(console.error).toHaveBeenCalledWith(
        "Errore lettura cache chat:",
        expect.any(Error)
      );
    });

    test("set salva i messaggi serializzati in localStorage", () => {
      const messages: ChatMessage[] = [
        { role: "user", content: "Vorrei info sul piano Business" },
      ];

      chatCache.set(messages);

      expect(localStorageStore[CACHE_KEY]).toBe(JSON.stringify(messages));
    });

    test("set mantiene solo gli ultimi 10 messaggi (MAX_HISTORY_LENGTH)", () => {
      const messages: ChatMessage[] = Array.from({ length: 15 }, (_, i) => ({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Messaggio ${i + 1}`,
      }));

      chatCache.set(messages);

      const parsed = JSON.parse(localStorageStore[CACHE_KEY]) as ChatMessage[];
      expect(parsed).toHaveLength(10);
      expect(parsed[0].content).toBe("Messaggio 6");
      expect(parsed[9].content).toBe("Messaggio 15");
    });

    test("clear rimuove la chiave della chat da localStorage", () => {
      localStorageStore[CACHE_KEY] = JSON.stringify([
        { role: "user", content: "Test reset" },
      ]);

      chatCache.clear();

      expect(localStorageStore[CACHE_KEY]).toBeUndefined();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* SEND SUPPORT MESSAGE (STREAMING SSE)                                       */
  /* -------------------------------------------------------------------------- */
  describe("sendSupportMessage", () => {
    const inputMessages: ChatMessage[] = [
      { role: "user", content: "Quali requisiti servono per la verifica del grado di giudizio?" },
    ];

    test("solleva errore se l'endpoint di supporto non è valorizzato", async () => {
      vi.resetModules();
      mockGetSupportUrl.mockReturnValueOnce("");

      const { sendSupportMessage: dynamicSendSupport } = await import("@/services/chatLogic");

      await expect(dynamicSendSupport(inputMessages)).rejects.toThrow(
        "Servizio non disponibile"
      );
    });

    test("solleva errore quando il server restituisce risposta HTTP non ok", async () => {
      mockFetchWithAppCheckOnly.mockResolvedValueOnce({
        ok: false,
        status: 502,
      });

      await expect(sendSupportMessage(inputMessages)).rejects.toThrow("Errore server: 502");
    });

    test("solleva errore se la risposta è priva di body leggibile", async () => {
      mockFetchWithAppCheckOnly.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: null,
      });

      await expect(sendSupportMessage(inputMessages)).rejects.toThrow(
        "Impossibile leggere lo stream."
      );
    });

    test("processa stream con testo incrementale e termina regolarmente con [DONE]", async () => {
      const sseChunks = [
        "data: {\"message\":{\"text\":\"La verifica \"}}\n",
        "data: {\"message\":{\"text\":\"richiede l'indicazione \"}}\n\n",
        "data: {\"message\":{\"text\":\"dell'organo giudicante.\"}}\n\n",
        "data: [DONE]\n\n",
      ];

      mockFetchWithAppCheckOnly.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: createMockStream(sseChunks),
      });

      const response = await sendSupportMessage(inputMessages);

      expect(mockFetchWithAppCheckOnly).toHaveBeenCalledWith(
        "https://api.jurio.it/support/chat",
        { messages: inputMessages }
      );
      expect(response.botReply).toBe(
        "La verifica richiede l'indicazione dell'organo giudicante."
      );
      expect(response.fonti).toEqual([]);
    });

    test("invoca il callback onStatus quando riceve aggiornamenti di stato", async () => {
      const onStatusSpy = vi.fn();
      const sseChunks = [
        "data: {\"message\":{\"status\":\"Consultazione documentazione Jurio...\"}}\n\n",
        "data: {\"message\":{\"text\":\"Ecco le informazioni richieste.\"}}\n\n",
        "data: [DONE]\n\n",
      ];

      mockFetchWithAppCheckOnly.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: createMockStream(sseChunks),
      });

      const response = await sendSupportMessage(inputMessages, onStatusSpy);

      expect(onStatusSpy).toHaveBeenCalledWith("Consultazione documentazione Jurio...");
      expect(response.botReply).toBe("Ecco le informazioni richieste.");
    });

    test("estrae fonti e risposta da stream result finale se non c'è stato testo progressivo", async () => {
      const sampleSources: SourceItem[] = [
        {
          id: "src_guida_1",
          text: "Guida filtri e sentenze",
          links: ["https://jurio.it/docs/filtri"],
          _type: "manuale",
        },
      ];

      const sseChunks = [
        `data: ${JSON.stringify({
          result: {
            risposta: "Risposta finale aggregata direttamente dal backend.",
            fonti: sampleSources,
          },
        })}\n\n`,
        "data: [DONE]\n\n",
      ];

      mockFetchWithAppCheckOnly.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: createMockStream(sseChunks),
      });

      const response = await sendSupportMessage(inputMessages);

      expect(response.botReply).toBe("Risposta finale aggregata direttamente dal backend.");
      expect(response.fonti).toEqual(sampleSources);
    });

    test("non sovrascrive botReply con result.risposta se il testo era già stato accumulato", async () => {
      const sampleSources: SourceItem[] = [
        {
          id: "src_2",
          text: "Fonte addizionale",
          links: [],
          _type: "sentenza",
        },
      ];

      const sseChunks = [
        "data: {\"message\":{\"text\":\"Testo parziale accumulato via token.\"}}\n\n",
        `data: ${JSON.stringify({
          result: {
            risposta: "Risposta alternativa dal blocco result",
            fonti: sampleSources,
          },
        })}\n\n`,
        "data: [DONE]\n\n",
      ];

      mockFetchWithAppCheckOnly.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: createMockStream(sseChunks),
      });

      const response = await sendSupportMessage(inputMessages);

      expect(response.botReply).toBe("Testo parziale accumulato via token.");
      expect(response.fonti).toEqual(sampleSources);
    });

    test("intercetta chunk con errore o JSON malformato registrando warning senza bloccare lo stream", async () => {
      const sseChunks = [
        ": heartbeat comment\n",
        "data: non-un-json-valido\n\n",
        "data: {\"error\":\"Avviso non bloccante dal motore AI\"}\n\n",
        "data: {\"message\":{\"text\":\"Risposta dopo il chunk anomalo.\"}}\n\n",
        "data: [DONE]\n\n",
      ];

      mockFetchWithAppCheckOnly.mockResolvedValueOnce({
        ok: true,
        status: 200,
        body: createMockStream(sseChunks),
      });

      const response = await sendSupportMessage(inputMessages);

      expect(console.warn).toHaveBeenCalledWith(
        "Errore parsing chunk JSON:",
        expect.any(String)
      );
      expect(console.warn).toHaveBeenCalledWith(
        "Errore parsing chunk JSON:",
        "Avviso non bloccante dal motore AI"
      );
      expect(response.botReply).toBe("Risposta dopo il chunk anomalo.");
    });
  });
});