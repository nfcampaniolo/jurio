import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  initializeApp: vi.fn(() => ({ name: "app" })),
  initializeAppCheck: vi.fn(() => ({ appCheck: true })),
  provider: vi.fn(),
}));

vi.mock("firebase/app", () => ({ initializeApp: mocks.initializeApp }));
vi.mock("firebase/app-check", () => ({
  initializeAppCheck: mocks.initializeAppCheck,
  ReCaptchaEnterpriseProvider: class {
    constructor(key: string) {
      mocks.provider(key);
    }
  },
}));

describe("firebase/config", () => {
  it("inizializza Firebase con la configurazione dell'ambiente e App Check con reCAPTCHA Enterprise", async () => {
    const mod = await import("@word/firebase/config");
    expect(mocks.initializeApp).toHaveBeenCalledWith(expect.objectContaining({ projectId: "jurio-test" }));
    expect(mocks.provider).toHaveBeenCalledWith("test-site-key");
    expect(mocks.initializeAppCheck).toHaveBeenCalledWith({ name: "app" }, expect.objectContaining({ isTokenAutoRefreshEnabled: true }));
    expect(mod.appCheckInstance).toEqual({ appCheck: true });
  });

  it("setupAppCheck attiva App Check anche su altre istanze (finestra di login)", async () => {
    const { setupAppCheck } = await import("@word/firebase/appCheck");
    const other = { name: "google-dialog" } as never;
    setupAppCheck(other);
    expect(mocks.initializeAppCheck).toHaveBeenLastCalledWith(other, expect.objectContaining({ isTokenAutoRefreshEnabled: true }));
  });

  it("senza token debug non imposta FIREBASE_APPCHECK_DEBUG_TOKEN", () => {
    expect(window.FIREBASE_APPCHECK_DEBUG_TOKEN).toBeUndefined();
  });
});
