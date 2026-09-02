import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import type { FirebaseApp } from "firebase/app";

/* ---------- hoisted mocks ---------- */
const { mockInitializeApp, mockGetApps, mockGetApp } = vi.hoisted(() => ({
  mockInitializeApp: vi.fn(),
  mockGetApps: vi.fn(),
  mockGetApp: vi.fn(),
}));

/* ---------- mock modules ---------- */
vi.mock("firebase/app", () => ({
  __esModule: true,
  initializeApp: mockInitializeApp,
  getApps: mockGetApps,
  getApp: mockGetApp,
}));

describe("Firebase App Initialization Suite", () => {
  const fakeInitializedApp = { name: "[DEFAULT]", options: {} } as unknown as FirebaseApp;
  const fakeExistingApp = { name: "[EXISTING_DEFAULT]", options: {} } as unknown as FirebaseApp;

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.unstubAllEnvs();

    // Setup variabili d'ambiente standard per Jurio
    vi.stubEnv("VITE_FIREBASE_API_KEY", "test-api-key-2026");
    vi.stubEnv("VITE_FIREBASE_AUTH_DOMAIN", "jurio-app.firebaseapp.com");
    vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "jurio-app");
    vi.stubEnv("VITE_FIREBASE_STORAGE_BUCKET", "jurio-app.firebasestorage.app");
    vi.stubEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", "987654321");
    vi.stubEnv("VITE_FIREBASE_APP_ID", "1:987654321:web:abcdef123456");
    vi.stubEnv("VITE_FIREBASE_MEASUREMENT_ID", "G-JURIO2026");

    mockInitializeApp.mockReturnValue(fakeInitializedApp);
    mockGetApp.mockReturnValue(fakeExistingApp);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("inizializza una nuova app Firebase se getApps() è vuoto", async () => {
    mockGetApps.mockReturnValue([]);

    const { firebaseApp } = await import("@/services/firebase");

    expect(mockGetApps).toHaveBeenCalledTimes(1);
    expect(mockInitializeApp).toHaveBeenCalledTimes(1);
    expect(mockInitializeApp).toHaveBeenCalledWith({
      apiKey: "test-api-key-2026",
      authDomain: "jurio-app.firebaseapp.com",
      projectId: "jurio-app",
      storageBucket: "jurio-app.firebasestorage.app",
      messagingSenderId: "987654321",
      appId: "1:987654321:web:abcdef123456",
      measurementId: "G-JURIO2026",
    });
    expect(mockGetApp).not.toHaveBeenCalled();
    expect(firebaseApp).toBe(fakeInitializedApp);
  });

  test("recupera l'app già esistente tramite getApp() se getApps() ha elementi", async () => {
    mockGetApps.mockReturnValue([fakeExistingApp]);

    const { firebaseApp } = await import("@/services/firebase");

    expect(mockGetApps).toHaveBeenCalledTimes(1);
    expect(mockGetApp).toHaveBeenCalledTimes(1);
    expect(mockInitializeApp).not.toHaveBeenCalled();
    expect(firebaseApp).toBe(fakeExistingApp);
  });

  test("gestisce correttamente variabili d'ambiente non valorizzate mappandole a undefined", async () => {
    mockGetApps.mockReturnValue([]);

    vi.stubEnv("VITE_FIREBASE_API_KEY", "");
    vi.stubEnv("VITE_FIREBASE_MEASUREMENT_ID", "");

    const { firebaseApp } = await import("@/services/firebase");

    expect(mockInitializeApp).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "",
        measurementId: "",
        projectId: "jurio-app",
      })
    );
    expect(firebaseApp).toBe(fakeInitializedApp);
  });
});