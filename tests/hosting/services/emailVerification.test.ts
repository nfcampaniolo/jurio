import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";
import type { User } from "firebase/auth";

const { mockAuth, mockApplyActionCode, mockFetchWithSecurity, mockTrackEvent } = vi.hoisted(() => ({
  mockAuth: { currentUser: null as unknown as User | null },
  mockApplyActionCode: vi.fn(),
  mockFetchWithSecurity: vi.fn(),
  mockTrackEvent: vi.fn(),
}));

vi.mock("@/infrastructure/appCheck", () => ({ initializeFirebaseAppCheck: vi.fn() }));
vi.mock("@/infrastructure/analytics", () => ({ trackEvent: mockTrackEvent }));
vi.mock("@/infrastructure/firebase", () => ({ firebaseApp: { name: "[AUTH_APP]" } }));
vi.mock("@/config/apiClient", () => ({ fetchWithSecurity: mockFetchWithSecurity }));
vi.mock("firebase/auth", () => ({
  getAuth: () => mockAuth,
  applyActionCode: mockApplyActionCode,
}));

import {
  needsEmailVerification,
  sendVerificationEmail,
  confirmEmailVerification,
  reloadCurrentUser,
} from "@/features/auth/hooks/auth";

const mkUser = (over: Partial<User>): User =>
  ({ isAnonymous: false, emailVerified: false, providerData: [{ providerId: "password" }], ...over }) as unknown as User;

describe("Email verification helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.stubEnv("VITE_SEND_VERIFICATION_EMAIL_URL", "https://send.example.test");
    mockAuth.currentUser = null;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  describe("needsEmailVerification", () => {
    test("true solo per account email/password non verificati", () => {
      expect(needsEmailVerification(mkUser({}))).toBe(true);
      expect(needsEmailVerification(mkUser({ emailVerified: true }))).toBe(false);
      expect(needsEmailVerification(mkUser({ isAnonymous: true }))).toBe(false);
      expect(needsEmailVerification(mkUser({ providerData: [{ providerId: "google.com" }] as User["providerData"] }))).toBe(false);
      expect(needsEmailVerification(null)).toBe(false);
    });
  });

  describe("sendVerificationEmail", () => {
    test("chiama l'endpoint e restituisce alreadyVerified", async () => {
      mockFetchWithSecurity.mockResolvedValue(new Response(JSON.stringify({ success: true, alreadyVerified: false }), { status: 200 }));

      await expect(sendVerificationEmail()).resolves.toEqual({ alreadyVerified: false });
      expect(mockFetchWithSecurity).toHaveBeenCalledWith("https://send.example.test", {});
      expect(mockTrackEvent).toHaveBeenCalledWith("verification_email_sent", {});
    });

    test("mappa 429 in rate_limited", async () => {
      mockFetchWithSecurity.mockResolvedValue(new Response("{}", { status: 429 }));
      await expect(sendVerificationEmail()).rejects.toThrow("rate_limited");
    });

    test("fallisce se l'endpoint non è configurato", async () => {
      vi.stubEnv("VITE_SEND_VERIFICATION_EMAIL_URL", "");
      await expect(sendVerificationEmail()).rejects.toThrow("non configurato");
      expect(mockFetchWithSecurity).not.toHaveBeenCalled();
    });
  });

  describe("confirmEmailVerification", () => {
    test("applica l'oobCode", async () => {
      mockApplyActionCode.mockResolvedValue(undefined);
      await confirmEmailVerification("CODE");
      expect(mockApplyActionCode).toHaveBeenCalledWith(mockAuth, "CODE");
      expect(mockTrackEvent).toHaveBeenCalledWith("email_verified", {});
    });

    test("propaga l'errore per codici non validi", async () => {
      mockApplyActionCode.mockRejectedValue(new Error("auth/invalid-action-code"));
      await expect(confirmEmailVerification("BAD")).rejects.toThrow("auth/invalid-action-code");
    });
  });

  describe("reloadCurrentUser", () => {
    test("ricarica l'utente e forza il refresh del token", async () => {
      const reload = vi.fn().mockResolvedValue(undefined);
      const getIdToken = vi.fn().mockResolvedValue("tok");
      mockAuth.currentUser = { reload, getIdToken } as unknown as User;

      await expect(reloadCurrentUser()).resolves.toBe(mockAuth.currentUser);
      expect(reload).toHaveBeenCalled();
      expect(getIdToken).toHaveBeenCalledWith(true);
    });

    test("restituisce null senza utente", async () => {
      await expect(reloadCurrentUser()).resolves.toBeNull();
    });
  });
});
