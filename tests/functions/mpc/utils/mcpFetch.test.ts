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
      status: 503,
      ok: false,
      statusText: "Unavailable",
      json: vi.fn().mockRejectedValue(new Error("not JSON")),
      text: vi.fn().mockResolvedValue("backend maintenance"),
    };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response));

    const result = await mcpFetch("https://backend.example", "", {});

    expect(response.text).toHaveBeenCalledOnce();
    expect(result).toEqual({
      errorText: "Errore dal backend Jurio (503): backend maintenance",
      isError: true,
    });
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

    await expect(mcpFetch("https://backend.example", "", {})).resolves.toEqual({
      errorText: "Errore di rete o timeout: connection reset",
      isError: true,
    });
  });
});
