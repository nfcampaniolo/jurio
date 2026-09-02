import { describe, test, expect, vi, beforeEach } from "vitest";

/* ---------- hoisted mocks ---------- */
const { mockGetFirestore } = vi.hoisted(() => ({
  mockGetFirestore: vi.fn().mockReturnValue("mock_firestore_lite_instance"),
}));

/* ---------- mock modules ---------- */
vi.mock("@/services/firebase", () => ({
  firebaseApp: "mock_firebase_app",
}));

vi.mock("firebase/firestore/lite", () => ({
  getFirestore: (app: unknown) => mockGetFirestore(app),
}));

describe("getPromptDb Service Suite", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  test("inizializza e restituisce l'istanza Firestore Lite usando firebaseApp", async () => {
    const { getPromptDb } = await import("@/services/promptDb");
    const db = await getPromptDb();

    expect(db).toBe("mock_firestore_lite_instance");
    expect(mockGetFirestore).toHaveBeenCalledTimes(1);
    expect(mockGetFirestore).toHaveBeenCalledWith("mock_firebase_app");
  });

  test("restituisce la stessa istanza cachata nelle chiamate successive", async () => {
    const { getPromptDb } = await import("@/services/promptDb");
    const db1 = await getPromptDb();
    const db2 = await getPromptDb();

    expect(db1).toBe(db2);
    expect(mockGetFirestore).toHaveBeenCalledTimes(1);
  });
});