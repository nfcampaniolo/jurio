import { beforeEach, describe, expect, it, vi } from "vitest";
import { mcpFetch } from "@functions/mpc/utils/mcpFetch";

describe("mcpFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("POSTs JSON with content type and an optional authorization header", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: vi.fn().mockResolvedValue({ results: [1] }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const body = { query: "responsabilità civile" };

    const result = await mcpFetch("https://backend.example/search", "Bearer token", body);

    expect(result).toEqual({ data: { results: [1] } });
    expect(fetchMock).toHaveBeenCalledWith("https://backend.example/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token" },
      body: JSON.stringify(body),
      signal: expect.any(AbortSignal),
    });
  });

  it("omits authorization when no auth header is supplied", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: vi.fn().mockResolvedValue({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    await mcpFetch("https://backend.example", "", {});

    expect(fetchMock.mock.calls[0][1].headers).toEqual({ "Content-Type": "application/json" });
  });

  it.each([
    [401, "Sessione Jurio non valida o scaduta", true],
    [403, "Accesso non consentito", false],
    [404, "Risorsa o documento non trovato", true],
    [429, "limite di richieste", false],
  ])("maps HTTP %i into a handled service error", async (status, text, isError) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ status }));

    const result = await mcpFetch("https://backend.example", "", {});

    expect(result.errorText).toContain(text);
    expect(result.isError).toBe(isError);
  });

  it("returns backend errors and falls back to response text for invalid JSON", async () => {
    const response = {
      status: 500,
      ok: false,
      statusText: "Internal Server Error",
      json: vi.fn().mockRejectedValue(new Error("not JSON")),
      text: vi.fn().mockResolvedValue("backend maintenance"),
    };
    const fetchMock = vi.fn().mockResolvedValue(response);
    vi.stubGlobal("fetch", fetchMock);

    const result = await mcpFetch("https://backend.example", "", {});

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(response.text).toHaveBeenCalledOnce();
    expect(result).toEqual({
      errorText: "Errore dal backend Jurio (500): backend maintenance",
      isError: true,
    });
  });

  it("retries once on a transient gateway error and returns the second response", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ status: 502, ok: false })
      .mockResolvedValueOnce({ status: 200, ok: true, json: vi.fn().mockResolvedValue({ results: [] }) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await mcpFetch("https://backend.example", "", {}, { retryDelayMs: 0 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ data: { results: [] } });
  });

  it("returns a friendly message when every attempt hits a gateway error", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      status: 503,
      ok: false,
      statusText: "Unavailable",
      json: vi.fn().mockResolvedValue({}),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await mcpFetch("https://backend.example", "", {}, { retryDelayMs: 0 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      errorText: "Il servizio Jurio è temporaneamente non disponibile (503). Riprova tra qualche secondo.",
      isError: true,
    });
  });

  it("does not retry non-transient errors such as 401", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ status: 401 });
    vi.stubGlobal("fetch", fetchMock);

    await mcpFetch("https://backend.example", "", {}, { retryDelayMs: 0 });

    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("reports a timeout after the last attempt", async () => {
    const timeout = Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" });
    const fetchMock = vi.fn().mockRejectedValue(timeout);
    vi.stubGlobal("fetch", fetchMock);

    const result = await mcpFetch("https://backend.example", "", {}, { retryDelayMs: 0 });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.errorText).toContain("non ha risposto in tempo");
    expect(result.isError).toBe(true);
  });

  it("uses an error field from valid JSON for unsuccessful backend responses", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      status: 500,
      ok: false,
      statusText: "Internal Server Error",
      json: vi.fn().mockResolvedValue({ error: "failed" }),
    }));

    await expect(mcpFetch("https://backend.example", "", {})).resolves.toEqual({
      errorText: "Errore dal backend Jurio (500): failed",
      isError: true,
    });
  });

  it("converts network exceptions into a user-facing result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connection reset")));

    await expect(mcpFetch("https://backend.example", "", {}, { retryDelayMs: 0 })).resolves.toEqual({
      errorText: "Errore di rete o timeout: connection reset",
      isError: true,
    });
  });
});
