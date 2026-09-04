import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

/* ---------- hoisted mocks ---------- */
const {
  mockGetAuthClient,
  mockGetDb,
  mockDoc,
  mockUpdateDoc,
  mockSignOut,
} = vi.hoisted(() => ({
  mockGetAuthClient: vi.fn(),
  mockGetDb: vi.fn().mockResolvedValue("mock_db"),
  mockDoc: vi.fn((_db: unknown, ...pathSegments: string[]) => pathSegments.join("/")),
  mockUpdateDoc: vi.fn().mockResolvedValue(undefined),
  mockSignOut: vi.fn().mockResolvedValue(undefined),
}));

/* ---------- mock modules ---------- */
vi.mock("@/features/auth/hooks/auth", () => ({
  getAuthClient: () => mockGetAuthClient(),
}));

vi.mock("@/infrastructure/db", () => ({
  getDb: () => mockGetDb(),
}));

vi.mock("firebase/firestore", () => ({
  doc: (db: unknown, ...pathSegments: string[]) => mockDoc(db, ...pathSegments),
  updateDoc: (ref: unknown, data: unknown) => mockUpdateDoc(ref, data),
}));

vi.mock("firebase/auth", () => ({
  signOut: (auth: unknown) => mockSignOut(auth),
}));

vi.mock("@/infrastructure/appCheck", () => ({
  initializeFirebaseAppCheck: vi.fn(() => null),
}));

/* ---------- subject under test ---------- */
import { forceSessionTakeover, clearLocalSession } from "@/features/auth/hooks/sessionLogic";

describe("session Service Suite", () => {
  let setItemSpy: ReturnType<typeof vi.spyOn>;
  let removeItemSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {});
    removeItemSpy = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {});

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ newSessionId: "server-session-uuid-999" }),
      })
    );

    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("forceSessionTakeover", () => {
    test("lancia un errore 'no_user' se non c'è un utente autenticato", async () => {
      mockGetAuthClient.mockResolvedValueOnce({ currentUser: null });

      await expect(forceSessionTakeover()).rejects.toThrow("no_user");
    });

    test("richiede il token ID, invoca il server di takeover e salva la nuova sessione nel localStorage", async () => {
      const mockUser = {
        uid: "user_123",
        getIdToken: vi.fn().mockResolvedValue("mock_id_token"),
      };
      mockGetAuthClient.mockResolvedValueOnce({ currentUser: mockUser });

      await forceSessionTakeover();

      expect(mockUser.getIdToken).toHaveBeenCalledTimes(1);
      expect(fetch).toHaveBeenCalledWith(
        "https://forcetakeoversession-vqoobrenua-ew.a.run.app",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Authorization": "Bearer mock_id_token",
          }),
        })
      );
      expect(setItemSpy).toHaveBeenCalledWith("active_session_id", "server-session-uuid-999");
    });
  });

  describe("clearLocalSession", () => {
    test("rimuove il session id da localStorage ed effettua il signOut", async () => {
      const mockAuth = "mock_auth_instance";
      mockGetAuthClient.mockResolvedValueOnce(mockAuth);

      await clearLocalSession();

      expect(removeItemSpy).toHaveBeenCalledWith("active_session_id");
      expect(mockSignOut).toHaveBeenCalledWith(mockAuth);
    });
  });
});