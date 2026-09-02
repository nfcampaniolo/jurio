import { describe, test, expect, vi, beforeEach } from "vitest";

/* ---------- hoisted mocks ---------- */
const { mockGetStorage } = vi.hoisted(() => ({
  mockGetStorage: vi.fn().mockReturnValue("mock_storage_instance"),
}));

/* ---------- mock modules ---------- */
vi.mock("@/services/firebase", () => ({
  firebaseApp: "mock_firebase_app",
}));

vi.mock("firebase/storage", () => ({
  getStorage: (app: unknown) => mockGetStorage(app),
}));

/* ---------- subject under test ---------- */
import { getStorageClient } from "@/services/storageClient";

describe("StorageClient Service Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("inizializza e restituisce il client di storage utilizzando firebaseApp", async () => {
    const storage = await getStorageClient();

    expect(mockGetStorage).toHaveBeenCalledTimes(1);
    expect(mockGetStorage).toHaveBeenCalledWith("mock_firebase_app");
    expect(storage).toBe("mock_storage_instance");
  });
});