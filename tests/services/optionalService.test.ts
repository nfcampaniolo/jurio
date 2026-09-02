import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import type { Analytics } from "firebase/analytics";
import type { FirebasePerformance } from "firebase/performance";

/* ---------- hoisted mocks ---------- */
const {
  mockFirebaseApp,
  mockGetAnalytics,
  mockIsSupported,
  mockGetPerformance,
} = vi.hoisted(() => ({
  mockFirebaseApp: { name: "[FIREBASE_APP]" },
  mockGetAnalytics: vi.fn(),
  mockIsSupported: vi.fn(),
  mockGetPerformance: vi.fn(),
}));

/* ---------- mock modules ---------- */
vi.mock("@/services/firebase", () => ({
  __esModule: true,
  firebaseApp: mockFirebaseApp,
}));

vi.mock("firebase/analytics", () => ({
  __esModule: true,
  getAnalytics: mockGetAnalytics,
  isSupported: mockIsSupported,
}));

vi.mock("firebase/performance", () => ({
  __esModule: true,
  getPerformance: mockGetPerformance,
}));

describe("Optional Services Suite (Analytics & Performance)", () => {
  const fakeAnalytics = { app: mockFirebaseApp } as unknown as Analytics;
  const fakePerformance = { app: mockFirebaseApp } as unknown as FirebasePerformance;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    mockIsSupported.mockResolvedValue(true);
    mockGetAnalytics.mockReturnValue(fakeAnalytics);
    mockGetPerformance.mockReturnValue(fakePerformance);

    delete (window as unknown as { Cookiebot?: unknown }).Cookiebot;
  });

  afterEach(() => {
    delete (window as unknown as { Cookiebot?: unknown }).Cookiebot;
  });

  /* -------------------------------------------------------------------------- */
  /* SSR ENVIRONMENT                                                            */
  /* -------------------------------------------------------------------------- */
  describe("Ambiente Server-Side (SSR)", () => {
    test("restituisce subito undefined e non attiva alcun listener o servizio se window non esiste", async () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error simulazione SSR
      delete globalThis.window;

      try {
        const { initializeOptionalServices, getAnalyticsInstance, getPerf } =
          await import("@/services/optionalService");

        await initializeOptionalServices();

        expect(getAnalyticsInstance()).toBeNull();
        expect(getPerf()).toBeNull();
        expect(mockGetPerformance).not.toHaveBeenCalled();
        expect(mockGetAnalytics).not.toHaveBeenCalled();
      } finally {
        globalThis.window = originalWindow;
      }
    });
  });

  /* -------------------------------------------------------------------------- */
  /* FIREBASE PERFORMANCE INITIALIZATION                                        */
  /* -------------------------------------------------------------------------- */
  describe("Inizializzazione Firebase Performance", () => {
    test("inizializza Performance immediatamente e popola il getter getPerf()", async () => {
      const { initializeOptionalServices, getPerf } = await import(
        "@/services/optionalService"
      );

      await initializeOptionalServices();

      await vi.waitFor(() => {
        expect(mockGetPerformance).toHaveBeenCalledWith(mockFirebaseApp);
        expect(getPerf()).toBe(fakePerformance);
      });
    });

    test("intercetta errori in initPerformance e mantiene getPerf() a null", async () => {
      mockGetPerformance.mockImplementationOnce(() => {
        throw new Error("Performance non supportato");
      });

      const { initializeOptionalServices, getPerf } = await import(
        "@/services/optionalService"
      );

      await initializeOptionalServices();

      await vi.waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          "Errore durante l'inizializzazione di Performance:",
          expect.any(Error)
        );
        expect(getPerf()).toBeNull();
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* COOKIEBOT CONSENT & ANALYTICS INITIALIZATION                               */
  /* -------------------------------------------------------------------------- */
  describe("Consenso Cookiebot e Inizializzazione Analytics", () => {
    test("inizializza Analytics se Cookiebot è già caricato con statistics: true", async () => {
      (window as unknown as { Cookiebot: { consent: { statistics: boolean } } }).Cookiebot = {
        consent: { statistics: true },
      };

      const { initializeOptionalServices, getAnalyticsInstance } = await import(
        "@/services/optionalService"
      );

      await initializeOptionalServices();

      await vi.waitFor(() => {
        expect(mockIsSupported).toHaveBeenCalled();
        expect(mockGetAnalytics).toHaveBeenCalledWith(mockFirebaseApp);
        expect(getAnalyticsInstance()).toBe(fakeAnalytics);
      });
    });

    test("non inizializza Analytics se Cookiebot ha statistics: false", async () => {
      (window as unknown as { Cookiebot: { consent: { statistics: boolean } } }).Cookiebot = {
        consent: { statistics: false },
      };

      const { initializeOptionalServices, getAnalyticsInstance } = await import(
        "@/services/optionalService"
      );

      await initializeOptionalServices();

      await vi.waitFor(() => {
        expect(mockGetPerformance).toHaveBeenCalled();
      });

      expect(mockIsSupported).not.toHaveBeenCalled();
      expect(mockGetAnalytics).not.toHaveBeenCalled();
      expect(getAnalyticsInstance()).toBeNull();
    });

    test("attende l'evento CookiebotOnAccept se Cookiebot non è ancora pronto", async () => {
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");

      const { initializeOptionalServices, getAnalyticsInstance } = await import(
        "@/services/optionalService"
      );

      await initializeOptionalServices();

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "CookiebotOnAccept",
        expect.any(Function)
      );
      expect(getAnalyticsInstance()).toBeNull();

      // L'utente accetta i cookie statistici in un secondo momento
      (window as unknown as { Cookiebot: { consent: { statistics: boolean } } }).Cookiebot = {
        consent: { statistics: true },
      };
      window.dispatchEvent(new Event("CookiebotOnAccept"));

      await vi.waitFor(() => {
        expect(mockGetAnalytics).toHaveBeenCalledWith(mockFirebaseApp);
        expect(getAnalyticsInstance()).toBe(fakeAnalytics);
      });
    });

    test("non inizializza Analytics se isSupported() restituisce false", async () => {
      (window as unknown as { Cookiebot: { consent: { statistics: boolean } } }).Cookiebot = {
        consent: { statistics: true },
      };
      mockIsSupported.mockResolvedValueOnce(false);

      const { initializeOptionalServices, getAnalyticsInstance } = await import(
        "@/services/optionalService"
      );

      await initializeOptionalServices();

      await vi.waitFor(() => {
        expect(mockIsSupported).toHaveBeenCalled();
      });

      expect(mockGetAnalytics).not.toHaveBeenCalled();
      expect(getAnalyticsInstance()).toBeNull();
    });

    test("intercetta eccezioni di inizializzazione Analytics registrandole su console.error", async () => {
      (window as unknown as { Cookiebot: { consent: { statistics: boolean } } }).Cookiebot = {
        consent: { statistics: true },
      };
      mockGetAnalytics.mockImplementationOnce(() => {
        throw new Error("IndexedDB bloccato dal browser");
      });

      const { initializeOptionalServices, getAnalyticsInstance } = await import(
        "@/services/optionalService"
      );

      await initializeOptionalServices();

      await vi.waitFor(() => {
        expect(console.error).toHaveBeenCalledWith(
          "Errore durante l'inizializzazione di Analytics:",
          expect.any(Error)
        );
        expect(getAnalyticsInstance()).toBeNull();
      });
    });

    test("evita inizializzazioni multiple consecutive dei servizi opzionali", async () => {
      (window as unknown as { Cookiebot: { consent: { statistics: boolean } } }).Cookiebot = {
        consent: { statistics: true },
      };

      const { initializeOptionalServices } = await import(
        "@/services/optionalService"
      );

      await initializeOptionalServices();
      await initializeOptionalServices();

      await vi.waitFor(() => {
        expect(mockGetPerformance).toHaveBeenCalledTimes(1);
        expect(mockGetAnalytics).toHaveBeenCalledTimes(1);
      });
    });
  });
});