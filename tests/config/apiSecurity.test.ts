import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

/* ---------- mocks ---------- */
const mockGetIdToken = vi.fn();
let mockCurrentUser: { getIdToken: typeof mockGetIdToken } | null = {
  getIdToken: mockGetIdToken,
};

vi.mock("@/services/firebase", () => ({
  __esModule: true,
  firebaseApp: {},
}));

vi.mock("firebase/auth", () => ({
  __esModule: true,
  getAuth: vi.fn(() => ({
    currentUser: mockCurrentUser,
  })),
}));

const mockInitializeFirebaseAppCheck = vi.fn();
vi.mock("@/services/appCheck", () => ({
  __esModule: true,
  initializeFirebaseAppCheck: () => mockInitializeFirebaseAppCheck(),
}));

const mockGetToken = vi.fn();
vi.mock("firebase/app-check", () => ({
  __esModule: true,
  getToken: (...args: unknown[]) => mockGetToken(...args),
}));

/* ---------- module under test ---------- */
import {
  fetchWithSecurity,
  fetchWithoutContent,
  fetchWithAppCheckOnly,
} from "@/config/apiClient"; // <-- adegua il path del file se necessario

describe("apiSecurity Service Suite", () => {
  const originalFetch = global.fetch;
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
    mockFetch.mockResolvedValue(new Response(JSON.stringify({ ok: true })));

    mockCurrentUser = {
      getIdToken: mockGetIdToken,
    };
    mockGetIdToken.mockResolvedValue("mock-auth-id-token");
    mockInitializeFirebaseAppCheck.mockReturnValue({ appId: "test-app-id" });
    mockGetToken.mockResolvedValue({ token: "mock-app-check-token" });
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  /* ---------- fetchWithSecurity ---------- */
  describe("fetchWithSecurity", () => {
    test("invia richiesta POST con Auth Bearer, AppCheck e Content-Type json", async () => {
      const payload = { query: "Cassazione penale", limit: 10 };
      await fetchWithSecurity("/api/search", payload);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];

      expect(url).toBe("/api/search");
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({
        "Content-Type": "application/json",
        Authorization: "Bearer mock-auth-id-token",
        "X-Firebase-AppCheck": "mock-app-check-token",
      });
      expect(init.body).toBe(JSON.stringify(payload));
    });

    test("solleva errore se l'utente non è autenticato", async () => {
      mockCurrentUser = null;

      await expect(
        fetchWithSecurity("/api/protected", { data: 123 })
      ).rejects.toThrow("Utente non autenticato");

      expect(mockFetch).not.toHaveBeenCalled();
    });

    test("utilizza stringa vuota per AppCheck se initializeFirebaseAppCheck restituisce null", async () => {
      mockInitializeFirebaseAppCheck.mockReturnValue(null);

      await fetchWithSecurity("/api/test", { key: "val" });

      const [, init] = mockFetch.mock.calls[0];
      expect(init.headers["X-Firebase-AppCheck"]).toBe("");
    });

    test("utilizza stringa vuota per AppCheck e registra warning se getToken fallisce", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      mockGetToken.mockRejectedValue(new Error("AppCheck network failure"));

      await fetchWithSecurity("/api/test", { key: "val" });

      const [, init] = mockFetch.mock.calls[0];
      expect(init.headers["X-Firebase-AppCheck"]).toBe("");
      expect(consoleWarnSpy).toHaveBeenCalled();

      consoleWarnSpy.mockRestore();
    });
  });

  /* ---------- fetchWithoutContent ---------- */
  describe("fetchWithoutContent", () => {
    test("invia richiesta con opzioni di default quando il body è omesso", async () => {
      await fetchWithoutContent("/api/ping");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];

      expect(url).toBe("/api/ping");
      expect(init.method).toBe("POST");

      const headers = init.headers as Headers;
      expect(headers.get("Authorization")).toBe("Bearer mock-auth-id-token");
      expect(headers.get("X-Firebase-AppCheck")).toBe("mock-app-check-token");
    });

    test("rispetta il metodo specificato (es. GET, DELETE) preservando gli headers di sicurezza", async () => {
      await fetchWithoutContent("/api/items/1", {
        method: "DELETE",
        headers: { "X-Custom-Header": "CustomValue" },
      });

      const [, init] = mockFetch.mock.calls[0];
      expect(init.method).toBe("DELETE");

      const headers = init.headers as Headers;
      expect(headers.get("Authorization")).toBe("Bearer mock-auth-id-token");
      expect(headers.get("X-Firebase-AppCheck")).toBe("mock-app-check-token");
      expect(headers.get("X-Custom-Header")).toBe("CustomValue");
    });

    test("elimina Content-Type se il body è istanza di FormData per consentire il boundary automatico", async () => {
      const formData = new FormData();
      formData.append("file", "dummy-content");

      await fetchWithoutContent("/api/upload", {
        body: formData,
        headers: { "Content-Type": "application/json" },
      });

      const [, init] = mockFetch.mock.calls[0];
      const headers = init.headers as Headers;

      expect(headers.get("Content-Type")).toBeNull();
      expect(headers.get("Authorization")).toBe("Bearer mock-auth-id-token");
      expect(init.body).toBe(formData);
    });

    test("serializza in JSON e imposta Content-Type se il body è un oggetto non-stringa", async () => {
      const rawObject = { action: "sync", targetId: 42 };

      await fetchWithoutContent("/api/sync", {
        body: rawObject as unknown as BodyInit,
      });

      const [, init] = mockFetch.mock.calls[0];
      const headers = init.headers as Headers;

      expect(headers.get("Content-Type")).toBe("application/json");
      expect(init.body).toBe(JSON.stringify(rawObject));
    });
  });

  /* ---------- fetchWithAppCheckOnly ---------- */
  describe("fetchWithAppCheckOnly", () => {
    test("invia richiesta POST includendo solo AppCheck senza richiedere token di autenticazione", async () => {
      mockCurrentUser = null; // Nessun utente loggato

      const payload = { publicQuery: "articoli codice civile" };
      await fetchWithAppCheckOnly("/api/public-search", payload);

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, init] = mockFetch.mock.calls[0];

      expect(url).toBe("/api/public-search");
      expect(init.method).toBe("POST");
      expect(init.headers).toEqual({
        "Content-Type": "application/json",
        "X-Firebase-AppCheck": "mock-app-check-token",
      });
      expect(init.headers).not.toHaveProperty("Authorization");
      expect(init.body).toBe(JSON.stringify(payload));
    });
  });
});