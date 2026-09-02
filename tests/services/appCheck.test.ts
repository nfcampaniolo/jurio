import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import type { AppCheck } from "firebase/app-check";

/* ---------- hoisted mocks ---------- */
const { mockInitializeAppCheck, mockReCaptchaV3ProviderInstance, mockFirebaseApp } = vi.hoisted(() => {
  const providerInstance = { isReCaptchaV3: true };
  return {
    mockInitializeAppCheck: vi.fn(),
    mockReCaptchaV3ProviderInstance: providerInstance,
    mockFirebaseApp: { name: "[DEFAULT]" },
  };
});

/* ---------- mock modules ---------- */
vi.mock("firebase/app-check", () => ({
  __esModule: true,
  initializeAppCheck: (...args: unknown[]) => mockInitializeAppCheck(...args),
  ReCaptchaV3Provider: vi.fn().mockImplementation(function (siteKey: string) {
    return { ...mockReCaptchaV3ProviderInstance, siteKey };
  }),
}));

vi.mock("@/services/firebase", () => ({
  __esModule: true,
  firebaseApp: mockFirebaseApp,
}));

describe("Firebase App Check Service Suite", () => {
  const fakeAppCheckInstance = { app: mockFirebaseApp } as unknown as AppCheck;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "info").mockImplementation(() => {});

    mockInitializeAppCheck.mockReturnValue(fakeAppCheckInstance);

    // Pulizia del token di debug su window prima di ogni test
    delete (window as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string })
      .FIREBASE_APPCHECK_DEBUG_TOKEN;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("restituisce undefined in ambiente SSR quando window non è definito", async () => {
    const originalWindow = globalThis.window;
    // @ts-expect-error simulazione runtime server-side
    delete globalThis.window;

    try {
      const { initializeFirebaseAppCheck } = await import("@/services/appCheck");
      const instance = initializeFirebaseAppCheck();

      expect(instance).toBeUndefined();
      expect(mockInitializeAppCheck).not.toHaveBeenCalled();
    } finally {
      globalThis.window = originalWindow;
    }
  });

  test("emette un warning e restituisce undefined se VITE_RECAPTCHA_SITE_KEY manca", async () => {
    vi.stubEnv("VITE_RECAPTCHA_SITE_KEY", "");

    const { initializeFirebaseAppCheck } = await import("@/services/appCheck");
    const instance = initializeFirebaseAppCheck();

    expect(instance).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(
      "⚠️ VITE_RECAPTCHA_SITE_KEY mancante: App Check ignorato."
    );
    expect(mockInitializeAppCheck).not.toHaveBeenCalled();
  });

  test("in DEV configura FIREBASE_APPCHECK_DEBUG_TOKEN su window se presente", async () => {
    vi.stubEnv("VITE_RECAPTCHA_SITE_KEY", "recaptcha-key-test-123");
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_APPCHECK_DEBUG_TOKEN", "debug-token-guid-456");

    const { initializeFirebaseAppCheck } = await import("@/services/appCheck");
    const instance = initializeFirebaseAppCheck();

    expect(
      (window as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN: string })
        .FIREBASE_APPCHECK_DEBUG_TOKEN
    ).toBe("debug-token-guid-456");

    expect(console.info).toHaveBeenCalledWith(
      "🛡️ App Check DEBUG token configurato:",
      "debug-token-guid-456"
    );
    expect(instance).toBe(fakeAppCheckInstance);
  });

  test("in DEV emette un warning se VITE_APPCHECK_DEBUG_TOKEN è assente", async () => {
    vi.stubEnv("VITE_RECAPTCHA_SITE_KEY", "recaptcha-key-test-123");
    vi.stubEnv("DEV", true);
    vi.stubEnv("VITE_APPCHECK_DEBUG_TOKEN", "");

    const { initializeFirebaseAppCheck } = await import("@/services/appCheck");
    initializeFirebaseAppCheck();

    expect(console.warn).toHaveBeenCalledWith("⚠️ VITE_APPCHECK_DEBUG_TOKEN mancante.");
    expect(
      (window as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string })
        .FIREBASE_APPCHECK_DEBUG_TOKEN
    ).toBeUndefined();
  });

  test("in ambiente di produzione (DEV = false) non tocca FIREBASE_APPCHECK_DEBUG_TOKEN", async () => {
    vi.stubEnv("VITE_RECAPTCHA_SITE_KEY", "recaptcha-key-prod");
    vi.stubEnv("DEV", false);
    vi.stubEnv("VITE_APPCHECK_DEBUG_TOKEN", "debug-token-ignorato");

    const { initializeFirebaseAppCheck } = await import("@/services/appCheck");
    initializeFirebaseAppCheck();

    expect(
      (window as unknown as { FIREBASE_APPCHECK_DEBUG_TOKEN?: string })
        .FIREBASE_APPCHECK_DEBUG_TOKEN
    ).toBeUndefined();
  });

  test("inizializza AppCheck con il provider ReCaptchaV3 e autoRefresh abilitato", async () => {
    vi.stubEnv("VITE_RECAPTCHA_SITE_KEY", "recaptcha-v3-public-key");
    vi.stubEnv("DEV", false);

    const { initializeFirebaseAppCheck } = await import("@/services/appCheck");
    const instance = initializeFirebaseAppCheck();

    expect(mockInitializeAppCheck).toHaveBeenCalledWith(
      mockFirebaseApp,
      expect.objectContaining({
        isTokenAutoRefreshEnabled: true,
        provider: expect.objectContaining({
          siteKey: "recaptcha-v3-public-key",
        }),
      })
    );

    expect(console.info).toHaveBeenCalledWith("🛡️ Firebase App Check inizializzato.");
    expect(instance).toBe(fakeAppCheckInstance);
  });

  test("riutilizza l'istanza singleton creata senza re-inizializzare nelle chiamate successive", async () => {
    vi.stubEnv("VITE_RECAPTCHA_SITE_KEY", "recaptcha-key-singleton");

    const { initializeFirebaseAppCheck } = await import("@/services/appCheck");

    const firstCall = initializeFirebaseAppCheck();
    const secondCall = initializeFirebaseAppCheck();

    expect(firstCall).toBe(fakeAppCheckInstance);
    expect(secondCall).toBe(fakeAppCheckInstance);
    expect(mockInitializeAppCheck).toHaveBeenCalledTimes(1);
  });
});