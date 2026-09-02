import { describe, test, expect, vi, beforeEach } from "vitest";

/* ---------- hoisted mocks ---------- */
const {
  mockGetVectorSearchUrl,
  mockEnsureAnonAuth,
  mockGetSecurityTokens,
  mockFetch,
} = vi.hoisted(() => ({
  mockGetVectorSearchUrl: vi.fn().mockReturnValue("https://api.vectorsearch.test/query"),
  mockEnsureAnonAuth: vi.fn().mockResolvedValue(undefined),
  mockGetSecurityTokens: vi.fn().mockResolvedValue({
    authToken: "mock_auth_token",
    appCheckToken: "mock_app_check_token",
  }),
  mockFetch: vi.fn(),
}));

/* ---------- mock modules ---------- */
vi.mock("@/config/env", () => ({
  getVectorSearchUrl: () => mockGetVectorSearchUrl(),
}));

vi.mock("@/services/auth", () => ({
  ensureAnonAuth: () => mockEnsureAnonAuth(),
}));

vi.mock("@/services/security", () => ({
  getSecurityTokens: () => mockGetSecurityTokens(),
}));

vi.stubGlobal("fetch", mockFetch);

/* ---------- subject under test ---------- */
import { vectorSearch } from "@/services/vectorSearch";

describe("VectorSearch Service Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetVectorSearchUrl.mockReturnValue("https://api.vectorsearch.test/query");
  });

  test("esegue con successo la ricerca vettoriale e restituisce i risultati normalizzati", async () => {
    const mockApiResponse = {
      ids: ["id_1", "id_2"],
      allMatches: [{ id: "id_1", _distance: 0.1, _rankingDistance: 0.1, _matchCount: 1, _source: "db" }],
      topMatches: [{ id: "id_1", _distance: 0.1, _rankingDistance: 0.1, _matchCount: 1, _source: "db" }],
      status: "SUCCESS",
      webFallback: null,
      metadata: {
        total: 2,
        keywords: ["responsabilità", "civile"],
        threshold: 0.5,
        bestDistance: 0.1,
      },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockApiResponse),
    });

    const result = await vectorSearch("responsabilità civile", [{ field: "materia", operator: "==", value: "civile" }], 10);

    expect(mockEnsureAnonAuth).toHaveBeenCalledTimes(1);
    expect(mockGetSecurityTokens).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.vectorsearch.test/query",
      expect.objectContaining({
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer mock_auth_token",
          "X-Firebase-AppCheck": "mock_app_check_token",
        },
        body: JSON.stringify({
          query: "responsabilità civile",
          limit: 10,
          filters: [{ field: "materia", operator: "==", value: "civile" }],
        }),
      })
    );

    expect(result).toEqual({
      ids: ["id_1", "id_2"],
      allMatches: mockApiResponse.allMatches,
      topMatches: mockApiResponse.topMatches,
      keywords: ["responsabilità", "civile"],
      status: "SUCCESS",
      bestDistance: 0.1,
      webFallback: null,
    });
  });

  test("gestisce correttamente lo status GEMINI_FALLBACK e i metadati mancanti", async () => {
    const mockApiResponse = {
      ids: [],
      allMatches: [],
      topMatches: [],
      status: "GEMINI_FALLBACK",
      webFallback: { sintesi: "Sintesi web", queryAlternativa: "altra query" },
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockApiResponse),
    });

    const result = await vectorSearch("query complessa");

    expect(result.status).toBe("GEMINI_FALLBACK");
    expect(result.webFallback).toEqual({ sintesi: "Sintesi web", queryAlternativa: "altra query" });
    expect(result.keywords).toEqual([]);
    expect(result.bestDistance).toBeNull();
    expect(result.ids).toEqual([]);
  });

  test("non include l'header X-Firebase-AppCheck se appCheckToken è vuoto", async () => {
    mockGetSecurityTokens.mockResolvedValueOnce({
      authToken: "mock_auth_token",
      appCheckToken: "",
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ status: "SUCCESS", ids: [], allMatches: [], topMatches: [] }),
    });

    await vectorSearch("test appcheck");

    expect(mockFetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer mock_auth_token",
        },
      })
    );
  });

  test("lancia un errore se VECTOR_SEARCH_ENDPOINT non è configurato", async () => {
    mockGetVectorSearchUrl.mockReturnValueOnce("");
    vi.resetModules();
    const { vectorSearch: dynamicVectorSearch } = await import("@/services/vectorSearch");

    await expect(dynamicVectorSearch("test")).rejects.toThrow(
      "VECTOR_SEARCH_ENDPOINT non configurato."
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  test("lancia un errore se la fetch restituisce una risposta non ok", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    await expect(vectorSearch("test")).rejects.toThrow("Errore API: 500");
  });

  test("propaga gli errori imprevisti o di rete", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network failure"));

    await expect(vectorSearch("test")).rejects.toThrow("Network failure");
  });
});