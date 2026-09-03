import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import type { Analytics } from "firebase/analytics";

/* ---------- hoisted mocks ---------- */
const {
  mockLogEvent,
  mockInitializeOptionalServices,
  mockGetAnalyticsInstance,
} = vi.hoisted(() => ({
  mockLogEvent: vi.fn(),
  mockInitializeOptionalServices: vi.fn(),
  mockGetAnalyticsInstance: vi.fn(),
}));

/* ---------- mock modules ---------- */
vi.mock("firebase/analytics", () => ({
  __esModule: true,
  logEvent: (...args: unknown[]) => mockLogEvent(...args),
}));

vi.mock("@/infrastructure/optionalService", () => ({
  __esModule: true,
  initializeOptionalServices: () => mockInitializeOptionalServices(),
  getAnalyticsInstance: () => mockGetAnalyticsInstance(),
}));

describe("Analytics Service Suite", () => {
  const fakeAnalyticsInstance = { app: { name: "jurio-app" } } as unknown as Analytics;
  let trackEvent: typeof import("@/infrastructure/analytics").trackEvent;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});

    mockInitializeOptionalServices.mockResolvedValue(undefined);
    mockGetAnalyticsInstance.mockReturnValue(fakeAnalyticsInstance);

    // Import dinamico per garantire un modulo isolato con cachedAnalytics resettato ad undefined
    const analyticsModule = await import("@/infrastructure/analytics");
    trackEvent = analyticsModule.trackEvent;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Inizializzazione e Tracciamento Eventi", () => {
    test("inizializza il servizio facoltativo e invia l'evento con logEvent", async () => {
      await trackEvent("login", {
        method: "google",
        success: true,
      });

      expect(mockInitializeOptionalServices).toHaveBeenCalledTimes(1);
      expect(mockGetAnalyticsInstance).toHaveBeenCalledTimes(1);
      expect(mockLogEvent).toHaveBeenCalledWith(
        fakeAnalyticsInstance,
        "login",
        { method: "google", success: true }
      );
    });

    test("gestisce correttamente payload per diversi eventi del dominio Jurio", async () => {
      await trackEvent("sentence_searched", {
        query_length: 28,
        filters_used: true,
        results_count: 14,
      });

      expect(mockLogEvent).toHaveBeenCalledWith(
        fakeAnalyticsInstance,
        "sentence_searched",
        {
          query_length: 28,
          filters_used: true,
          results_count: 14,
        }
      );

      await trackEvent("subscription_start", {
        plan_type: "business",
        billing_period: "yearly",
        price: 490,
        currency: "EUR",
        source: "landing",
      });

      expect(mockLogEvent).toHaveBeenCalledWith(
        fakeAnalyticsInstance,
        "subscription_start",
        {
          plan_type: "business",
          billing_period: "yearly",
          price: 490,
          currency: "EUR",
          source: "landing",
        }
      );

      await trackEvent("logout", {});

      expect(mockLogEvent).toHaveBeenCalledWith(
        fakeAnalyticsInstance,
        "logout",
        {}
      );
    });
  });

  describe("Meccanismo di Caching del Singleton", () => {
    test("riutilizza l'istanza in cache senza re-invocare initializeOptionalServices nelle chiamate successive", async () => {
      await trackEvent("sentence_opened", { source: "search" });
      await trackEvent("document_opened", { source: "profile" });
      await trackEvent("sentence_saved", {});

      expect(mockInitializeOptionalServices).toHaveBeenCalledTimes(1);
      expect(mockGetAnalyticsInstance).toHaveBeenCalledTimes(1);
      expect(mockLogEvent).toHaveBeenCalledTimes(3);
    });
  });

  describe("Resilienza e Gestione Errori", () => {
    test("intercetta l'eccezione di inizializzazione, emette un warning e non invoca logEvent", async () => {
      const initError = new Error("Firebase Analytics non supportato nell'ambiente corrente");
      mockInitializeOptionalServices.mockRejectedValueOnce(initError);

      await trackEvent("login", {
        method: "email",
        success: false,
      });

      expect(console.warn).toHaveBeenCalledWith(
        "Firebase Analytics non disponibile:",
        initError
      );
      expect(mockLogEvent).not.toHaveBeenCalled();
    });

    test("salva in cache il valore null a seguito di fallimento ed evita tentativi ripetuti", async () => {
      mockInitializeOptionalServices.mockRejectedValueOnce(new Error("Network offline"));

      // Primo tentativo: fallisce e memorizza cachedAnalytics = null
      await trackEvent("free_trial_start", {});

      expect(mockInitializeOptionalServices).toHaveBeenCalledTimes(1);
      expect(mockLogEvent).not.toHaveBeenCalled();

      // Secondo tentativo: cachedAnalytics è null (diverso da undefined), quindi ritorna subito null
      await trackEvent("sign_up", {
        method: "apple",
        success: true,
      });

      expect(mockInitializeOptionalServices).toHaveBeenCalledTimes(1);
      expect(mockGetAnalyticsInstance).not.toHaveBeenCalled();
      expect(mockLogEvent).not.toHaveBeenCalled();
    });

    test("non invoca logEvent se getAnalyticsInstance restituisce null pur senza generare errori", async () => {
      mockGetAnalyticsInstance.mockReturnValueOnce(null);

      await trackEvent("password_reset_requested", {
        method: "email",
      });

      expect(mockInitializeOptionalServices).toHaveBeenCalledTimes(1);
      expect(mockGetAnalyticsInstance).toHaveBeenCalledTimes(1);
      expect(mockLogEvent).not.toHaveBeenCalled();
    });
  });
});