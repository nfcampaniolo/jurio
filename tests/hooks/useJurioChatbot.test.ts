import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

/* ---------- hoisted mocks ---------- */
const {
  mockChatCacheGet,
  mockChatCacheSet,
  mockChatCacheClear,
  mockSendSupportMessage,
} = vi.hoisted(() => ({
  mockChatCacheGet: vi.fn(),
  mockChatCacheSet: vi.fn(),
  mockChatCacheClear: vi.fn(),
  mockSendSupportMessage: vi.fn(),
}));

/* ---------- mock modules ---------- */
vi.mock("@/services/chatLogic", () => ({
  __esModule: true,
  chatCache: {
    get: () => mockChatCacheGet(),
    set: (msgs: unknown) => mockChatCacheSet(msgs),
    clear: () => mockChatCacheClear(),
  },
  sendSupportMessage: (...args: unknown[]) => mockSendSupportMessage(...args),
}));

/* ---------- subject under test ---------- */
import { useJurioChatbot } from "@/hooks/useJurioChatbot"; // <-- adegua il path di import se necessario

describe("useJurioChatbot Hook Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockChatCacheGet.mockReturnValue([]);
  });

  describe("Inizializzazione e Gestione Cache", () => {
    test("inizializza la chat con il messaggio di benvenuto predefinito se la cache è vuota", () => {
      mockChatCacheGet.mockReturnValueOnce([]);

      const { result } = renderHook(() => useJurioChatbot());

      expect(result.current.isOpen).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.inputValue).toBe("");
      expect(result.current.currentStatus).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]).toMatchObject({
        role: "assistant",
        content: expect.stringContaining("Benvenuto nel supporto **Jurio**"),
      });
    });

    test("ripristina la cronologia messaggi esistente se presente nella cache", () => {
      const cachedMessages = [
        { role: "user", content: "Come funziona l'Add-in Word?" },
        { role: "assistant", content: "L'Add-in consente di cercare sentenze direttamente da Word." },
      ];
      mockChatCacheGet.mockReturnValueOnce(cachedMessages);

      const { result } = renderHook(() => useJurioChatbot());

      expect(result.current.messages).toEqual(cachedMessages);
      expect(mockChatCacheGet).toHaveBeenCalledTimes(1);
    });
  });

  describe("Stato Locale e Visibilità", () => {
    test("aggiorna correttamente lo stato di apertura del widget e l'input value", () => {
      const { result } = renderHook(() => useJurioChatbot());

      act(() => {
        result.current.setIsOpen(true);
        result.current.setInputValue("Quali sono i prezzi?");
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.inputValue).toBe("Quali sono i prezzi?");
    });
  });

  describe("handleSend", () => {
    test("ignora l'invio se l'input è vuoto o composto solo da spazi", async () => {
      const { result } = renderHook(() => useJurioChatbot());

      act(() => {
        result.current.setInputValue("   ");
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(mockSendSupportMessage).not.toHaveBeenCalled();
      expect(result.current.isLoading).toBe(false);
      expect(mockChatCacheSet).not.toHaveBeenCalled();
    });

    test("completa il flusso di invio con successo, aggiorna lo stato temporale e appende la risposta del bot", async () => {
      mockSendSupportMessage.mockImplementationOnce(
        async (_history: unknown, onStatus: (status: string) => void) => {
          onStatus("Consultazione linee guida...");
          return {
            botReply: "Puoi attivare il periodo di prova dalla sezione account.",
            fonti: [
              {
                id: "guida-prova",
                text: "Periodo di Prova Gratuita",
                links: ["/guida/prova-gratuita"],
                _type: "guide",
              },
            ],
          };
        }
      );

      const { result } = renderHook(() => useJurioChatbot());

      act(() => {
        result.current.setInputValue("Come provo la piattaforma?");
      });

      await act(async () => {
        await result.current.handleSend();
      });

      // 1 messaggio iniziale + 1 utente + 1 assistant
      expect(result.current.messages).toHaveLength(3);
      expect(result.current.messages[1]).toEqual({
        role: "user",
        content: "Come provo la piattaforma?",
      });
      expect(result.current.messages[2]).toMatchObject({
        role: "assistant",
        content: "Puoi attivare il periodo di prova dalla sezione account.",
        sources: [
          expect.objectContaining({
            id: "guida-prova",
            links: ["/guida/prova-gratuita"],
          }),
        ],
      });

      expect(result.current.inputValue).toBe("");
      expect(result.current.isLoading).toBe(false);
      expect(result.current.currentStatus).toBeNull();
      expect(result.current.error).toBeNull();
      expect(mockChatCacheSet).toHaveBeenCalledTimes(2); // salvataggio utente + salvataggio risposta
    });

test("esegue il rollback della cronologia e ripristina l'input dell'utente in caso di eccezione", async () => {
      mockSendSupportMessage.mockRejectedValueOnce(new Error("Timeout server di supporto"));

      const { result } = renderHook(() => useJurioChatbot());

      act(() => {
        result.current.setInputValue("Domanda che fallisce");
      });

      await act(async () => {
        await result.current.handleSend();
      });

      // Errore valorizzato
      expect(result.current.error).toBe("Timeout server di supporto");
      expect(result.current.isLoading).toBe(false);
      expect(result.current.currentStatus).toBeNull();

      // Ripristino del testo digitato per non far perdere il prompt all'utente
      expect(result.current.inputValue).toBe("Domanda che fallisce");

      // La lista messaggi torna allo stato iniziale pre-invio
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0].role).toBe("assistant");
      
      // NUOVO: Verifichiamo che anche la cache sia stata ripristinata allo snapshot iniziale
      expect(mockChatCacheSet).toHaveBeenLastCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: "assistant" })
        ])
      );
    });

    test("imposta il messaggio di errore fallback se l'eccezione non è un'istanza di Error", async () => {
      mockSendSupportMessage.mockRejectedValueOnce("Errore primitivo");

      const { result } = renderHook(() => useJurioChatbot());

      act(() => {
        result.current.setInputValue("Altra domanda");
      });

      await act(async () => {
        await result.current.handleSend();
      });

      expect(result.current.error).toBe("Si è verificato un errore imprevisto.");
      expect(result.current.inputValue).toBe("Altra domanda");
      expect(result.current.messages).toHaveLength(1); // Controllo di coerenza aggiuntivo
    });
  });

  describe("clearChat", () => {
    test("pulisce la cache, reimposta il messaggio di accoglienza e azzera errori e status", () => {
      const { result } = renderHook(() => useJurioChatbot());

      act(() => {
        result.current.clearChat();
      });

      expect(mockChatCacheClear).toHaveBeenCalledTimes(1);
      expect(result.current.messages).toEqual([
        { role: "assistant", content: "Cronologia pulita. Come posso aiutarti?" },
      ]);
      expect(result.current.error).toBeNull();
      expect(result.current.currentStatus).toBeNull();
    });
  });
});