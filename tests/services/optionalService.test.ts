import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import type { Analytics } from "firebase/analytics";
import type { FirebasePerformance } from "firebase/performance";

// --- TIPIZZAZIONE IUBENDA PER I TEST ---
interface IubendaPreferences {
  purposes?: Record<number, boolean>;
}
interface IubendaObject {
  cs?: {
    api?: {
      getPreferences: () => IubendaPreferences;
    };
  };
  csConfiguration?: {
    callback?: {
      onPreferenceExpressedOrNotNeeded?: (preference: IubendaPreferences) => void;
    };
  };
}

declare global {
  interface Window {
    _iub?: IubendaObject;
  }
}
// --------------------------------------

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
vi.mock("@/infrastructure/firebase", () => ({
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

describe("Optional Services Suite (Analytics & Performance - Iubenda)", () => {
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

    delete window._iub;
  });

  afterEach(() => {
    delete window._iub;
  });

  /* -------------------------------------------------------------------------- */
  /* SSR ENVIRONMENT                                                            */
  /* -------------------------------------------------------------------------- */
  describe("Ambiente Server-Side (SSR)", () => {
    test("restituisce subito undefined e non attiva alcun servizio se window non esiste", async () => {
      const originalWindow = globalThis.window;
      // @ts-expect-error simulazione SSR
      delete globalThis.window;

      try {
        const { initializeOptionalServices, getAnalyticsInstance, getPerf } =
          await import("@/infrastructure/optionalService");

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
        "@/infrastructure/optionalService"
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
        "@/infrastructure/optionalService"
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
  /* IUBENDA CONSENT & ANALYTICS INITIALIZATION                                 */
  /* -------------------------------------------------------------------------- */
  describe("Consenso Iubenda e Inizializzazione Analytics", () => {
    test("inizializza Analytics se Iubenda restituisce il consenso per purposes[4] (Statistiche)", async () => {
      window._iub = {
        cs: {
          api: {
            getPreferences: () => ({ purposes: { 4: true } }),
          },
        },
      };

      const { initializeOptionalServices, getAnalyticsInstance } = await import(
        "@/infrastructure/optionalService"
      );

      await initializeOptionalServices();

      await vi.waitFor(() => {
        expect(mockIsSupported).toHaveBeenCalled();
        expect(mockGetAnalytics).toHaveBeenCalledWith(mockFirebaseApp);
        expect(getAnalyticsInstance()).toBe(fakeAnalytics);
      });
    });

    test("non inizializza Analytics se Iubenda riporta purposes[4] false o mancante", async () => {
      window._iub = {
        cs: {
          api: {
            getPreferences: () => ({ purposes: { 1: true, 4: false } }),
          },
        },
      };

      const { initializeOptionalServices, getAnalyticsInstance } = await import(
        "@/infrastructure/optionalService"
      );

      await initializeOptionalServices();

      await vi.waitFor(() => {
        expect(mockGetPerformance).toHaveBeenCalled();
      });

      expect(mockIsSupported).not.toHaveBeenCalled();
      expect(mockGetAnalytics).not.toHaveBeenCalled();
      expect(getAnalyticsInstance()).toBeNull();
    });

    test("attende il callback di Iubenda se l'utente non ha ancora interagito col banner", async () => {
      const { initializeOptionalServices, getAnalyticsInstance } = await import(
        "@/infrastructure/optionalService"
      );

      await initializeOptionalServices();

      // Verifica che Analytics non sia stato chiamato
      expect(getAnalyticsInstance()).toBeNull();

      // Verifica che la funzione di callback sia stata iniettata
      const iubCallback = window._iub?.csConfiguration?.callback?.onPreferenceExpressedOrNotNeeded;
      expect(typeof iubCallback).toBe("function");

      // Simuliamo l'utente che clicca su "Accetta Statistiche" sul banner
      if (iubCallback) {
        iubCallback({ purposes: { 4: true } });
      }

      await vi.waitFor(() => {
        expect(mockGetAnalytics).toHaveBeenCalledWith(mockFirebaseApp);
        expect(getAnalyticsInstance()).toBe(fakeAnalytics);
      });
    });

    test("preserva ed esegue un eventuale callback preesistente su window._iub", async () => {
      const originalCallbackMock = vi.fn();
      window._iub = {
        csConfiguration: {
          callback: {
            onPreferenceExpressedOrNotNeeded: originalCallbackMock,
          },
        },
      };

      const { initializeOptionalServices } = await import(
        "@/infrastructure/optionalService"
      );

      await initializeOptionalServices();

      const newCallback = window._iub?.csConfiguration?.callback?.onPreferenceExpressedOrNotNeeded;
      const fakePreference = { purposes: { 4: true } };
      
      if (newCallback) {
        newCallback(fakePreference);
      }

      // Verifica che il callback originale (che avevamo salvato) sia stato comunque invocato
      expect(originalCallbackMock).toHaveBeenCalledWith(fakePreference);
    });

    test("non inizializza Analytics se isSupported() restituisce false", async () => {
      window._iub = {
        cs: {
          api: {
            getPreferences: () => ({ purposes: { 4: true } }),
          },
        },
      };
      mockIsSupported.mockResolvedValueOnce(false);

      const { initializeOptionalServices, getAnalyticsInstance } = await import(
        "@/infrastructure/optionalService"
      );

      await initializeOptionalServices();

      await vi.waitFor(() => {
        expect(mockIsSupported).toHaveBeenCalled();
      });

      expect(mockGetAnalytics).not.toHaveBeenCalled();
      expect(getAnalyticsInstance()).toBeNull();
    });

    test("intercetta eccezioni di inizializzazione Analytics registrandole su console.error", async () => {
      window._iub = {
        cs: {
          api: {
            getPreferences: () => ({ purposes: { 4: true } }),
          },
        },
      };
      mockGetAnalytics.mockImplementationOnce(() => {
        throw new Error("IndexedDB bloccato dal browser");
      });

      const { initializeOptionalServices, getAnalyticsInstance } = await import(
        "@/infrastructure/optionalService"
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

    test("evita inizializzazioni multiple consecutive di Analytics", async () => {
      window._iub = {
        cs: {
          api: {
            getPreferences: () => ({ purposes: { 4: true } }),
          },
        },
      };

      const { initializeOptionalServices } = await import(
        "@/infrastructure/optionalService"
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