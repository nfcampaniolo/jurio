import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";
import type { User, UserCredential } from "firebase/auth";

/* ---------- hoisted mocks ---------- */
const {
  mockInitializeFirebaseAppCheck,
  mockTrackEvent,
  mockAuth,
  mockGetAuth,
  mockCreateUserWithEmailAndPassword,
  mockSignInWithEmailAndPassword,
  mockSignInWithPopup,
  mockGoogleAuthProvider,
  mockSignOut,
  mockSendPasswordResetEmail,
  mockSignInAnonymously,
  mockOnAuthStateChanged,
} = vi.hoisted(() => {
  const authInstance = {
    currentUser: null as unknown as User | null,
  };

  return {
    mockInitializeFirebaseAppCheck: vi.fn(),
    mockTrackEvent: vi.fn(),
    mockAuth: authInstance,
    mockGetAuth: vi.fn(() => authInstance),
    mockCreateUserWithEmailAndPassword: vi.fn(),
    mockSignInWithEmailAndPassword: vi.fn(),
    mockSignInWithPopup: vi.fn(),
    mockGoogleAuthProvider: vi.fn(),
    mockSignOut: vi.fn(),
    mockSendPasswordResetEmail: vi.fn(),
    mockSignInAnonymously: vi.fn(),
    mockOnAuthStateChanged: vi.fn(),
  };
});

/* ---------- mock modules ---------- */
vi.mock("@/infrastructure/appCheck", () => ({
  __esModule: true,
  initializeFirebaseAppCheck: mockInitializeFirebaseAppCheck,
}));

vi.mock("@/infrastructure/analytics", () => ({
  __esModule: true,
  trackEvent: mockTrackEvent,
}));

vi.mock("@/infrastructure/firebase", () => ({
  __esModule: true,
  firebaseApp: { name: "[AUTH_APP]" },
}));

vi.mock("firebase/auth", () => ({
  __esModule: true,
  getAuth: mockGetAuth,
  createUserWithEmailAndPassword: mockCreateUserWithEmailAndPassword,
  signInWithEmailAndPassword: mockSignInWithEmailAndPassword,
  signInWithPopup: mockSignInWithPopup,
  GoogleAuthProvider: mockGoogleAuthProvider,
  signOut: mockSignOut,
  sendPasswordResetEmail: mockSendPasswordResetEmail,
  signInAnonymously: mockSignInAnonymously,
  onAuthStateChanged: mockOnAuthStateChanged,
}));

/* ---------- subject under test ---------- */
import {
  getAuthClient,
  registerWithEmail,
  loginWithEmail,
  loginWithGoogle,
  logout,
  onUserStateChange,
  resetPassword,
  ensureAnonAuth,
} from "@/features/auth/hooks/auth";

describe("Auth Service Suite", () => {
  const mockUser = {
    uid: "usr_flv_2026",
    email: "flavio@jurio.it",
  } as unknown as User;

  const mockUserCredential = {
    user: mockUser,
  } as unknown as UserCredential;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.currentUser = mockUser;

    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getAuthClient", () => {
    test("inizializza Firebase App Check e restituisce l'istanza di autenticazione", async () => {
      const client = await getAuthClient();

      expect(mockInitializeFirebaseAppCheck).toHaveBeenCalledTimes(1);
      expect(mockGetAuth).toHaveBeenCalledWith({ name: "[AUTH_APP]" });
      expect(client).toBe(mockAuth);
    });
  });

  describe("registerWithEmail", () => {
    test("registra un nuovo utente con successo e traccia l'evento analytics", async () => {
      mockCreateUserWithEmailAndPassword.mockResolvedValueOnce(mockUserCredential);

      const result = await registerWithEmail("flavio@jurio.it", "SecurePassword2026!");

      expect(mockCreateUserWithEmailAndPassword).toHaveBeenCalledWith(
        mockAuth,
        "flavio@jurio.it",
        "SecurePassword2026!"
      );
      expect(mockTrackEvent).toHaveBeenCalledWith("sign_up", {
        method: "email",
        success: true,
      });
      expect(result).toBe(mockUserCredential);
    });

    test("traccia errore analytics e rilancia l'eccezione se la registrazione fallisce", async () => {
      const authErr = new Error("auth/email-already-in-use");
      mockCreateUserWithEmailAndPassword.mockRejectedValueOnce(authErr);

      await expect(
        registerWithEmail("flavio@jurio.it", "DuplicatePwd!")
      ).rejects.toThrow("auth/email-already-in-use");

      expect(mockTrackEvent).toHaveBeenCalledWith("sign_up", {
        method: "email",
        success: false,
      });
      expect(mockTrackEvent).toHaveBeenCalledWith("analytics_error", {
        name: "sign_up",
        reason: "auth/email-already-in-use",
      });
    });
  });

  describe("loginWithEmail", () => {
    test("esegue il login ed effettua il tracciamento analytics in caso di successo", async () => {
      mockSignInWithEmailAndPassword.mockResolvedValueOnce(mockUserCredential);

      const cred = await loginWithEmail("flavio@jurio.it", "ValidPassword2026!");

      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
        mockAuth,
        "flavio@jurio.it",
        "ValidPassword2026!"
      );
      expect(mockTrackEvent).toHaveBeenCalledWith("login", {
        method: "email",
        success: true,
      });
      expect(cred).toBe(mockUserCredential);
    });

    test("traccia il fallimento e rilancia l'eccezione se signInWithEmailAndPassword rigetta", async () => {
      mockSignInWithEmailAndPassword.mockRejectedValueOnce(new Error("auth/wrong-password"));

      await expect(
        loginWithEmail("flavio@jurio.it", "WrongPass")
      ).rejects.toThrow("auth/wrong-password");

      expect(mockTrackEvent).toHaveBeenCalledWith("login", {
        method: "email",
        success: false,
      });
      expect(mockTrackEvent).toHaveBeenCalledWith("analytics_error", {
        name: "login",
        reason: "auth/wrong-password",
      });
    });
  });

  describe("loginWithGoogle", () => {
    test("esegue login con popup Google, traccia l'evento e restituisce l'utente", async () => {
      mockSignInWithPopup.mockResolvedValueOnce(mockUserCredential);

      const user = await loginWithGoogle();

      expect(mockSignInWithPopup).toHaveBeenCalledWith(mockAuth, expect.any(Object));
      expect(mockTrackEvent).toHaveBeenCalledWith("login", {
        method: "google",
        success: true,
      });
      expect(user).toBe(mockUser);
    });

    test("gestisce annullamento del popup Google tracciando l'errore", async () => {
      mockSignInWithPopup.mockRejectedValueOnce(new Error("auth/popup-closed-by-user"));

      await expect(loginWithGoogle()).rejects.toThrow("auth/popup-closed-by-user");

      expect(mockTrackEvent).toHaveBeenCalledWith("login", {
        method: "google",
        success: false,
      });
      expect(mockTrackEvent).toHaveBeenCalledWith("analytics_error", {
        name: "login",
        reason: "auth/popup-closed-by-user",
      });
    });
  });

  describe("logout", () => {
    test("disconnette l'utente e traccia l'evento di disconnessione", async () => {
      mockSignOut.mockResolvedValueOnce(undefined);

      await logout();

      expect(mockSignOut).toHaveBeenCalledWith(mockAuth);
      expect(mockTrackEvent).toHaveBeenCalledWith("logout", {});
    });

    test("traccia errore analytics se signOut rigetta", async () => {
      mockSignOut.mockRejectedValueOnce(new Error("auth/network-request-failed"));

      await expect(logout()).rejects.toThrow("auth/network-request-failed");

      expect(mockTrackEvent).toHaveBeenCalledWith("analytics_error", {
        name: "logout",
        reason: "auth/network-request-failed",
      });
    });
  });

  describe("onUserStateChange", () => {
    test("registra il listener di stato e invoca il callback con user e hasConflict=false", async () => {
      let authCallback: (u: User | null) => void = () => {};
      mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
        authCallback = cb;
        return vi.fn();
      });

      const callbackSpy = vi.fn();
      onUserStateChange(callbackSpy);

      await vi.waitFor(() => {
        expect(mockOnAuthStateChanged).toHaveBeenCalled();
      });

      authCallback(mockUser);
      expect(callbackSpy).toHaveBeenCalledWith(mockUser, false);

      authCallback(null);
      expect(callbackSpy).toHaveBeenCalledWith(null, false);
    });

    test("la funzione di cleanup annulla l'ascolto di auth", async () => {
      const unsubAuthMock = vi.fn();
      mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
        cb(mockUser);
        return unsubAuthMock;
      });

      const unsubscribe = onUserStateChange(vi.fn());

      await vi.waitFor(() => {
        expect(mockOnAuthStateChanged).toHaveBeenCalled();
      });

      unsubscribe();
      expect(unsubAuthMock).toHaveBeenCalled();
    });

    test("interrompe il setup se la pulizia viene invocata prima della risoluzione dell'import asincrono", async () => {
      let authCallback: ((u: User | null) => void) | undefined;
      mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
        authCallback = cb;
        return vi.fn();
      });

      const callbackSpy = vi.fn();
      const unsubscribe = onUserStateChange(callbackSpy);
      unsubscribe();

      await vi.waitFor(() => {
        expect(mockInitializeFirebaseAppCheck).toHaveBeenCalled();
      });

      if (authCallback) {
        authCallback(mockUser);
      }
      expect(callbackSpy).not.toHaveBeenCalled();
    });
  });

  describe("resetPassword", () => {
    test("solleva errore se l'email non è fornita", async () => {
      await expect(resetPassword("")).rejects.toThrow(
        "Inserisci un indirizzo email valido"
      );
    });

    test("invia l'email di recupero e traccia l'evento", async () => {
      mockSendPasswordResetEmail.mockResolvedValueOnce(undefined);

      await resetPassword("recupero@jurio.it");

      expect(mockSendPasswordResetEmail).toHaveBeenCalledWith(mockAuth, "recupero@jurio.it");
      expect(mockTrackEvent).toHaveBeenCalledWith("password_reset_requested", {
        method: "email",
      });
    });

    test("traccia errore se l'invio della mail fallisce", async () => {
      mockSendPasswordResetEmail.mockRejectedValueOnce(new Error("auth/user-not-found"));

      await expect(resetPassword("inesistente@jurio.it")).rejects.toThrow("auth/user-not-found");

      expect(mockTrackEvent).toHaveBeenCalledWith("analytics_error", {
        name: "reset_password",
        reason: "auth/user-not-found",
      });
    });
  });

  describe("ensureAnonAuth", () => {
    test("esegue signInAnonymously se auth.currentUser è null", async () => {
      mockAuth.currentUser = null;
      mockSignInAnonymously.mockResolvedValueOnce(mockUserCredential);

      await ensureAnonAuth();

      expect(mockSignInAnonymously).toHaveBeenCalledWith(mockAuth);
    });

    test("ignora la chiamata se auth.currentUser è già presente", async () => {
      mockAuth.currentUser = mockUser;

      await ensureAnonAuth();

      expect(mockSignInAnonymously).not.toHaveBeenCalled();
    });

    test("traccia errore analytics e rilancia se signInAnonymously fallisce", async () => {
      mockAuth.currentUser = null;
      mockSignInAnonymously.mockRejectedValueOnce(new Error("auth/operation-not-allowed"));

      await expect(ensureAnonAuth()).rejects.toThrow("auth/operation-not-allowed");

      expect(mockTrackEvent).toHaveBeenCalledWith("analytics_error", {
        name: "ensure_anon_auth",
        reason: "auth/operation-not-allowed",
      });
    });
  });
});