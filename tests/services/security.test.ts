import { describe, test, expect, vi, beforeEach } from "vitest";

/* ---------- hoisted mocks ---------- */
const {
  mockGetAuth,
  mockGetIdToken,
  mockInitAppCheck,
  mockGetToken,
} = vi.hoisted(() => ({
  mockGetAuth: vi.fn(),
  mockGetIdToken: vi.fn().mockResolvedValue("mock_auth_token"),
  mockInitAppCheck: vi.fn(),
  mockGetToken: vi.fn().mockResolvedValue({ token: "mock_app_check_token" }),
}));

/* ---------- mock modules ---------- */
vi.mock("@/services/firebase", () => ({
  firebaseApp: "mock_firebase_app",
}));

vi.mock("firebase/auth", () => ({
  getAuth: (app: unknown) => mockGetAuth(app),
}));

vi.mock("@/services/appCheck", () => ({
  initializeFirebaseAppCheck: () => mockInitAppCheck(),
}));

vi.mock("firebase/app-check", () => ({
  getToken: (appCheck: unknown, forceRefresh: boolean) =>
    mockGetToken(appCheck, forceRefresh),
}));

/* ---------- subject under test ---------- */
import {
  getCurrentUser,
  getCurrentUserId,
  getSecurityTokens,
} from "@/services/security";

describe("Security Service Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getCurrentUser", () => {
    test("restituisce l'utente corrente da auth", async () => {
      const mockUser = { uid: "user_123", getIdToken: mockGetIdToken };
      mockGetAuth.mockReturnValueOnce({ currentUser: mockUser });

      const user = await getCurrentUser();
      expect(user).toBe(mockUser);
      expect(mockGetAuth).toHaveBeenCalledWith("mock_firebase_app");
    });

    test("restituisce null se non c'è nessun utente autenticato", async () => {
      mockGetAuth.mockReturnValueOnce({ currentUser: null });

      const user = await getCurrentUser();
      expect(user).toBeNull();
    });
  });

  describe("getCurrentUserId", () => {
    test("restituisce l'uid dell'utente corrente", async () => {
      const mockUser = { uid: "user_123", getIdToken: mockGetIdToken };
      mockGetAuth.mockReturnValueOnce({ currentUser: mockUser });

      const uid = await getCurrentUserId();
      expect(uid).toBe("user_123");
    });

    test("restituisce null se l'utente non è autenticato", async () => {
      mockGetAuth.mockReturnValueOnce({ currentUser: null });

      const uid = await getCurrentUserId();
      expect(uid).toBeNull();
    });
  });

  describe("getSecurityTokens", () => {
    test("lancia un errore se l'utente non è autenticato", async () => {
      mockGetAuth.mockReturnValueOnce({ currentUser: null });

      await expect(getSecurityTokens()).rejects.toThrow("Utente non autenticato");
    });

    test("restituisce authToken e appCheckToken validi quando tutto è configurato", async () => {
      const mockUser = { uid: "user_123", getIdToken: mockGetIdToken };
      mockGetAuth.mockReturnValueOnce({ currentUser: mockUser });
      mockInitAppCheck.mockReturnValueOnce("mock_app_check_instance");

      const tokens = await getSecurityTokens();

      expect(tokens).toEqual({
        authToken: "mock_auth_token",
        appCheckToken: "mock_app_check_token",
      });
      expect(mockGetIdToken).toHaveBeenCalledTimes(1);
      expect(mockGetToken).toHaveBeenCalledWith("mock_app_check_instance", false);
    });

    test("gestisce il fallimento di App Check restituendo appCheckToken vuoto", async () => {
      const mockUser = { uid: "user_123", getIdToken: mockGetIdToken };
      mockGetAuth.mockReturnValueOnce({ currentUser: mockUser });
      mockInitAppCheck.mockReturnValueOnce("mock_app_check_instance");
      mockGetToken.mockRejectedValueOnce(new Error("App Check error"));

      const tokens = await getSecurityTokens();

      expect(tokens).toEqual({
        authToken: "mock_auth_token",
        appCheckToken: "",
      });
    });
  });
});