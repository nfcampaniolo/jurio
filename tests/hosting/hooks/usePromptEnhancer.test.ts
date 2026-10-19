import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  usePromptEnhancer,
  type HistoryMessage,
} from "@/shared/hooks/usePromptEnhancer";
import { fetchWithSecurity } from "@/config/apiClient";
import { toast } from "react-hot-toast";

/* ---------- mock moduli esterni ---------- */
vi.mock("@/config/apiClient", () => ({
  fetchWithSecurity: vi.fn(),
}));

vi.mock("react-hot-toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockedFetchWithSecurity = vi.mocked(fetchWithSecurity);

const createMockResponse = (ok: boolean, status: number, bodyText: string) =>
  ({
    ok,
    status,
    text: async () => bodyText,
  }) as unknown as Response;

describe("usePromptEnhancer Hook Suite", () => {
  const mockEndpoint = "https://api.jurio.it/ai/prompt-enhancer";

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_PROMPT_ENHANCER_URL", mockEndpoint);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("stato iniziale corretto con isEnhancing a false", () => {
    const { result } = renderHook(() => usePromptEnhancer());

    expect(result.current.isEnhancing).toBe(false);
  });

  test("mostra errore e restituisce null se la variabile d'ambiente non è configurata", async () => {
    vi.stubEnv("VITE_PROMPT_ENHANCER_URL", "");

    const { result } = renderHook(() => usePromptEnhancer());

    let res: string | null = null;
    await act(async () => {
      res = await result.current.enhancePrompt("Quesito legale", "chat");
    });

    expect(res).toBeNull();
    expect(mockedFetchWithSecurity).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(
      "Si è verificato un errore: Endpoint non configurato"
    );
    expect(result.current.isEnhancing).toBe(false);
  });

  test("invia payload con history vuota di default e restituisce il prompt migliorato", async () => {
    const apiResponse = JSON.stringify({
      enhancedPrompt: "Analisi sistematica dell'art. 2043 c.c. con riferimenti giurisprudenziali.",
    });

    mockedFetchWithSecurity.mockResolvedValueOnce(
      createMockResponse(true, 200, apiResponse)
    );

    const { result } = renderHook(() => usePromptEnhancer());

    let res: string | null = null;
    await act(async () => {
      res = await result.current.enhancePrompt("Spiega la responsabilità civile", "chat");
    });

    expect(mockedFetchWithSecurity).toHaveBeenCalledWith(mockEndpoint, {
      prompt: "Spiega la responsabilità civile",
      type: "chat",
      history: [],
    });

    expect(res).toBe("Analisi sistematica dell'art. 2043 c.c. con riferimenti giurisprudenziali.");
    expect(toast.error).not.toHaveBeenCalled();
    expect(result.current.isEnhancing).toBe(false);
  });

  test("invia la cronologia della conversazione se specificata nel parametro history", async () => {
    const apiResponse = JSON.stringify({
      enhancedPrompt: "Prompt contestualizzato con la cronologia dei messaggi.",
    });

    mockedFetchWithSecurity.mockResolvedValueOnce(
      createMockResponse(true, 200, apiResponse)
    );

    const history: HistoryMessage[] = [
      { role: "user", content: "Parliamo di locazioni commerciali." },
      { role: "assistant", content: "La durata minima è di 6 anni ex L. 392/1978." },
    ];

    const { result } = renderHook(() => usePromptEnhancer());

    await act(async () => {
      await result.current.enhancePrompt(
        "Cosa accade in caso di recesso?",
        "approfondimento",
        history
      );
    });

    expect(mockedFetchWithSecurity).toHaveBeenCalledWith(mockEndpoint, {
      prompt: "Cosa accade in caso di recesso?",
      type: "approfondimento",
      history,
    });
  });

  test("gestisce lo status 403 (accesso negato) mostrando toast dedicato e restituendo null", async () => {
    mockedFetchWithSecurity.mockResolvedValueOnce(
      createMockResponse(false, 403, JSON.stringify({ error: "Forbidden" }))
    );

    const { result } = renderHook(() => usePromptEnhancer());

    let res: string | null = null;
    await act(async () => {
      res = await result.current.enhancePrompt("Quesito riservato", "chat");
    });

    expect(res).toBeNull();
    expect(toast.error).toHaveBeenCalledWith("Accesso negato.");
    expect(result.current.isEnhancing).toBe(false);
  });

  test("gestisce lo status 429 (rate limit) mostrando toast dedicato e restituendo null", async () => {
    mockedFetchWithSecurity.mockResolvedValueOnce(
      createMockResponse(false, 429, JSON.stringify({ error: "Too Many Requests" }))
    );

    const { result } = renderHook(() => usePromptEnhancer());

    let res: string | null = null;
    await act(async () => {
      res = await result.current.enhancePrompt("Troppi prompt in rapida successione", "chat");
    });

    expect(res).toBeNull();
    expect(toast.error).toHaveBeenCalledWith(
      "Limite di richieste superato. Riprova più tardi."
    );
    expect(result.current.isEnhancing).toBe(false);
  });

  test("gestisce errori HTTP con estrazione del messaggio JSON dell'API", async () => {
    mockedFetchWithSecurity.mockResolvedValueOnce(
      createMockResponse(
        false,
        500,
        JSON.stringify({ error: "Quota modello AI esaurita per l'istanza" })
      )
    );

    const { result } = renderHook(() => usePromptEnhancer());

    let res: string | null = null;
    await act(async () => {
      res = await result.current.enhancePrompt("Quesito", "chat");
    });

    expect(res).toBeNull();
    expect(toast.error).toHaveBeenCalledWith(
      "Si è verificato un errore: Invio fallito (500): Quota modello AI esaurita per l'istanza"
    );
    expect(result.current.isEnhancing).toBe(false);
  });

  test("gestisce errori HTTP con testo non parsabile come JSON", async () => {
    mockedFetchWithSecurity.mockResolvedValueOnce(
      createMockResponse(false, 502, "Bad Gateway: Cloudflare Error")
    );

    const { result } = renderHook(() => usePromptEnhancer());

    let res: string | null = null;
    await act(async () => {
      res = await result.current.enhancePrompt("Quesito", "chat");
    });

    expect(res).toBeNull();
    expect(toast.error).toHaveBeenCalledWith(
      "Si è verificato un errore: Invio fallito (502): Bad Gateway: Cloudflare Error"
    );
  });

  test("gestisce risposte 200 prive della proprietà enhancedPrompt", async () => {
    mockedFetchWithSecurity.mockResolvedValueOnce(
      createMockResponse(true, 200, JSON.stringify({ message: "OK ma senza prompt" }))
    );

    const { result } = renderHook(() => usePromptEnhancer());

    let res: string | null = null;
    await act(async () => {
      res = await result.current.enhancePrompt("Quesito", "chat");
    });

    expect(res).toBeNull();
    expect(toast.error).toHaveBeenCalledWith(
      "Si è verificato un errore: La risposta non contiene il prompt ottimizzato."
    );
  });

  test("intercetta errori di rete sollevati direttamente da fetchWithSecurity", async () => {
    mockedFetchWithSecurity.mockRejectedValueOnce(
      new Error("Connessione di rete interrotta")
    );

    const { result } = renderHook(() => usePromptEnhancer());

    let res: string | null = null;
    await act(async () => {
      res = await result.current.enhancePrompt("Quesito", "chat");
    });

    expect(res).toBeNull();
    expect(toast.error).toHaveBeenCalledWith(
      "Si è verificato un errore: Connessione di rete interrotta"
    );
    expect(result.current.isEnhancing).toBe(false);
  });
});