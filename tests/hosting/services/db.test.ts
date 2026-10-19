import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

/* ---------- hoisted mocks ---------- */
const {
  mockFirebaseApp,
  mockFirestoreInstance,
  mockInitializeFirestore,
  mockPersistentLocalCache,
  mockPersistentMultipleTabManager,
} = vi.hoisted(() => {
  const fakeFirestore = { type: "FirestoreInstance" };
  return {
    mockFirebaseApp: { name: "[DEFAULT_APP]" },
    mockFirestoreInstance: fakeFirestore,
    mockInitializeFirestore: vi.fn(() => fakeFirestore),
    mockPersistentLocalCache: vi.fn((config: unknown) => ({
      _cacheType: "persistent",
      config,
    })),
    mockPersistentMultipleTabManager: vi.fn(() => ({
      _tabManagerType: "multiple",
    })),
  };
});

/* ---------- mock modules ---------- */
vi.mock("./firebase", () => ({
  __esModule: true,
  firebaseApp: mockFirebaseApp,
}));

vi.mock("@/infrastructure/firebase", () => ({
  __esModule: true,
  firebaseApp: mockFirebaseApp,
}));

vi.mock("firebase/firestore", () => ({
  __esModule: true,
  initializeFirestore: mockInitializeFirestore,
  persistentLocalCache: mockPersistentLocalCache,
  persistentMultipleTabManager: mockPersistentMultipleTabManager,
}));

describe("Database Service - getDb Suite", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("inizializza Firestore configurando cache persistente multi-tab e ritorna l'istanza corretta", async () => {
    const { getDb } = await import("@/infrastructure/db");

    const db = await getDb();

    expect(mockPersistentMultipleTabManager).toHaveBeenCalledTimes(1);
    expect(mockPersistentLocalCache).toHaveBeenCalledWith({
      tabManager: { _tabManagerType: "multiple" },
    });

    expect(mockInitializeFirestore).toHaveBeenCalledWith(
      mockFirebaseApp,
      {
        localCache: {
          _cacheType: "persistent",
          config: {
            tabManager: { _tabManagerType: "multiple" },
          },
        },
      }
    );

    expect(db).toBe(mockFirestoreInstance);
  });

  test("mantiene la stessa Promise e non re-inizializza Firestore nelle chiamate successive (singleton)", async () => {
    const { getDb } = await import("@/infrastructure/db");

    const promise1 = getDb();
    const promise2 = getDb();

    // Stesso riferimento della Promise prima della risoluzione
    expect(promise1).toBe(promise2);

    const [db1, db2] = await Promise.all([promise1, promise2]);

    expect(db1).toBe(mockFirestoreInstance);
    expect(db2).toBe(mockFirestoreInstance);
    expect(mockInitializeFirestore).toHaveBeenCalledTimes(1);
    expect(mockPersistentLocalCache).toHaveBeenCalledTimes(1);
    expect(mockPersistentMultipleTabManager).toHaveBeenCalledTimes(1);
  });

  test("propaga l'errore se l'inizializzazione o l'import di firestore fallisce", async () => {
    mockInitializeFirestore.mockImplementationOnce(() => {
      throw new Error("Failed to initialize Firestore cache");
    });

    const { getDb } = await import("@/infrastructure/db");

    await expect(getDb()).rejects.toThrow("Failed to initialize Firestore cache");
  });
});