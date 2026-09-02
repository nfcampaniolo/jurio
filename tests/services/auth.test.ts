import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import type { User, UserCredential, ConfirmationResult, ApplicationVerifier } from "firebase/auth";
import type { DocumentSnapshot } from "firebase/firestore";

/* ---------- hoisted mocks ---------- */
const {
  mockInitializeFirebaseAppCheck,
  mockTrackEvent,
  mockGetDb,
  mockAuth,
  mockGetAuth,
  mockCreateUserWithEmailAndPassword,
  mockSignInWithEmailAndPassword,
  mockSignInWithPopup,
  mockGoogleAuthProvider,
  mockSignOut,
  mockSendPasswordResetEmail,
  mockSignInAnonymously,
  mockRecaptchaVerifier,
  mockLinkWithPhoneNumber,
  mockOnAuthStateChanged,
  mockDoc,
  mockGetDoc,
  mockUpdateDoc,
  mockOnSnapshot,
} = vi.hoisted(() => {
  const authInstance = {
    currentUser: null as unknown as User | null,
  };

  return {
    mockInitializeFirebaseAppCheck: vi.fn(),
    mockTrackEvent: vi.fn(),
    mockGetDb: vi.fn(),
    mockAuth: authInstance,
    mockGetAuth: vi.fn(() => authInstance),
    mockCreateUserWithEmailAndPassword: vi.fn(),
    mockSignInWithEmailAndPassword: vi.fn(),
    mockSignInWithPopup: vi.fn(),
    mockGoogleAuthProvider: vi.fn(),
    mockSignOut: vi.fn(),
    mockSendPasswordResetEmail: vi.fn(),
    mockSignInAnonymously: vi.fn(),
    mockRecaptchaVerifier: vi.fn(),
    mockLinkWithPhoneNumber: vi.fn(),
    mockOnAuthStateChanged: vi.fn(),
    mockDoc: vi.fn((...args: unknown[]) => ({ path: args.slice(1).join("/") })),
    mockGetDoc: vi.fn(),
    mockUpdateDoc: vi.fn(),
    mockOnSnapshot: vi.fn(),
  };
});

/* ---------- mock modules ---------- */
vi.mock("@/services/appCheck", () => ({
  __esModule: true,
  initializeFirebaseAppCheck: mockInitializeFirebaseAppCheck,
}));

vi.mock("@/services/analytics", () => ({
  __esModule: true,
  trackEvent: mockTrackEvent,
}));

vi.mock("@/services/firebase", () => ({
  __esModule: true,
  firebaseApp: { name: "[AUTH_APP]" },
}));

vi.mock("@/services/db", () => ({
  __esModule: true,
  getDb: mockGetDb,
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
  RecaptchaVerifier: mockRecaptchaVerifier,
  linkWithPhoneNumber: mockLinkWithPhoneNumber,
  onAuthStateChanged: mockOnAuthStateChanged,
}));

vi.mock("firebase/firestore", () => ({
  __esModule: true,
  doc: mockDoc,
  getDoc: mockGetDoc,
  updateDoc: mockUpdateDoc,
  onSnapshot: mockOnSnapshot,
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
  setupRecaptcha,
  sendPhoneVerification,
  confirmPhoneVerification,
} from "@/services/auth";

describe("Auth Service Suite", () => {
  const fakeDbInstance = { id: "mock-firestore" };
  const mockUser = {
    uid: "usr_flv_2026",
    email: "flavio@jurio.it",
  } as unknown as User;

  const mockUserCredential = {
    user: mockUser,
  } as unknown as UserCredential;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    delete window.recaptchaVerifier;
    mockAuth.currentUser = null;

    mockGetDb.mockResolvedValue(fakeDbInstance);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /* -------------------------------------------------------------------------- */
  /* GET AUTH CLIENT                                                            */
  /* -------------------------------------------------------------------------- */
  describe("getAuthClient", () => {
    test("inizializza Firebase App Check e restituisce l'istanza di autenticazione", async () => {
      const client = await getAuthClient();

      expect(mockInitializeFirebaseAppCheck).toHaveBeenCalledTimes(1);
      expect(mockGetAuth).toHaveBeenCalledWith({ name: "[AUTH_APP]" });
      expect(client).toBe(mockAuth);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* REGISTRAZIONE EMAIL & PASSWORD                                             */
  /* -------------------------------------------------------------------------- */
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

  /* -------------------------------------------------------------------------- */
  /* LOGIN EMAIL & PASSWORD E SINCRONIZZAZIONE SESSIONE                        */
  /* -------------------------------------------------------------------------- */
  describe("loginWithEmail & syncSession", () => {
    test("esegue il login, sincronizza la sessione su firestore/localStorage e traccia il successo", async () => {
      mockSignInWithEmailAndPassword.mockResolvedValueOnce(mockUserCredential);
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
      });

      const cred = await loginWithEmail("flavio@jurio.it", "ValidPassword2026!");

      expect(mockSignInWithEmailAndPassword).toHaveBeenCalledWith(
        mockAuth,
        "flavio@jurio.it",
        "ValidPassword2026!"
      );

      expect(mockGetDoc).toHaveBeenCalled();
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          currentSessionId: expect.any(String),
        })
      );
      expect(localStorage.getItem("active_session_id")).toBeTruthy();

      expect(mockTrackEvent).toHaveBeenCalledWith("login", {
        method: "email",
        success: true,
      });
      expect(cred).toBe(mockUserCredential);
    });

    test("avverte in console e non aggiorna firestore se il documento utente non esiste durante syncSession", async () => {
      mockSignInWithEmailAndPassword.mockResolvedValueOnce(mockUserCredential);
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      await loginWithEmail("nuovo@jurio.it", "Pass!");

      expect(console.warn).toHaveBeenCalledWith(
        "Documento utente non trovato. Sincronizzazione sessione annullata."
      );
      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(localStorage.getItem("active_session_id")).toBeNull();
    });

    test("traccia il fallimento se signInWithEmailAndPassword rigetta", async () => {
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

  /* -------------------------------------------------------------------------- */
  /* LOGIN GOOGLE                                                               */
  /* -------------------------------------------------------------------------- */
  describe("loginWithGoogle", () => {
    test("esegue login con popup Google, sincronizza sessione e restituisce l'utente", async () => {
      mockSignInWithPopup.mockResolvedValueOnce(mockUserCredential);
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
      });

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

  /* -------------------------------------------------------------------------- */
  /* LOGOUT                                                                     */
  /* -------------------------------------------------------------------------- */
  describe("logout", () => {
    test("disconnette l'utente, rimuove la sessione locale e traccia l'evento", async () => {
      localStorage.setItem("active_session_id", "session_token_123");
      mockSignOut.mockResolvedValueOnce(undefined);

      await logout();

      expect(mockSignOut).toHaveBeenCalledWith(mockAuth);
      expect(localStorage.getItem("active_session_id")).toBeNull();
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

  /* -------------------------------------------------------------------------- */
  /* GESTIONE STATO UTENTE & CONFLITTO DI SESSIONE (onUserStateChange)          */
  /* -------------------------------------------------------------------------- */
  describe("onUserStateChange & verifySessionStatus", () => {
    test("invoca il callback con null e nessun conflitto se l'utente non è autenticato", async () => {
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

      authCallback(null);

      expect(callbackSpy).toHaveBeenCalledWith(null, false);
    });

    test("rileva assenza di conflitto se non è presente un sessionId in localStorage", async () => {
      let authCallback: (u: User | null) => void = () => {};
      let snapshotCallback: (snap: DocumentSnapshot) => void = () => {};

      mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
        authCallback = cb;
        return vi.fn();
      });

      mockOnSnapshot.mockImplementation((_ref, cb) => {
        snapshotCallback = cb;
        return vi.fn();
      });

      const callbackSpy = vi.fn();
      onUserStateChange(callbackSpy);

      await vi.waitFor(() => {
        expect(mockOnAuthStateChanged).toHaveBeenCalled();
      });

      authCallback(mockUser);

      localStorage.removeItem("active_session_id");

      const mockSnap = {
        data: () => ({ currentSessionId: "session_remota_999" }),
      } as unknown as DocumentSnapshot;

      snapshotCallback(mockSnap);

      expect(callbackSpy).toHaveBeenCalledWith(mockUser, false);
    });

    test("rileva conflitto (true) se currentSessionId remoto è diverso dal token in localStorage", async () => {
      let authCallback: (u: User | null) => void = () => {};
      let snapshotCallback: (snap: DocumentSnapshot) => void = () => {};

      mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
        authCallback = cb;
        return vi.fn();
      });

      mockOnSnapshot.mockImplementation((_ref, cb) => {
        snapshotCallback = cb;
        return vi.fn();
      });

      const callbackSpy = vi.fn();
      onUserStateChange(callbackSpy);

      await vi.waitFor(() => {
        expect(mockOnAuthStateChanged).toHaveBeenCalled();
      });

      authCallback(mockUser);

      localStorage.setItem("active_session_id", "sessione_locale_attiva");

      const conflictSnap = {
        data: () => ({ currentSessionId: "sessione_acquisita_da_altro_dispositivo" }),
      } as unknown as DocumentSnapshot;

      snapshotCallback(conflictSnap);

      expect(callbackSpy).toHaveBeenCalledWith(mockUser, true);
    });

    test("rileva assenza di conflitto (false) se il codice remoto coincide con quello locale", async () => {
      let authCallback: (u: User | null) => void = () => {};
      let snapshotCallback: (snap: DocumentSnapshot) => void = () => {};

      mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
        authCallback = cb;
        return vi.fn();
      });

      mockOnSnapshot.mockImplementation((_ref, cb) => {
        snapshotCallback = cb;
        return vi.fn();
      });

      const callbackSpy = vi.fn();
      onUserStateChange(callbackSpy);

      await vi.waitFor(() => {
        expect(mockOnAuthStateChanged).toHaveBeenCalled();
      });

      authCallback(mockUser);

      localStorage.setItem("active_session_id", "sessione_condivisa_456");

      const matchingSnap = {
        data: () => ({ currentSessionId: "sessione_condivisa_456" }),
      } as unknown as DocumentSnapshot;

      snapshotCallback(matchingSnap);

      expect(callbackSpy).toHaveBeenCalledWith(mockUser, false);
    });

    test("la funzione di cleanup annulla gli ascolti di auth e firestore", async () => {
      const unsubAuthMock = vi.fn();
      const unsubFirestoreMock = vi.fn();

      mockOnAuthStateChanged.mockImplementation((_auth, cb) => {
        cb(mockUser);
        return unsubAuthMock;
      });

      mockOnSnapshot.mockReturnValue(unsubFirestoreMock);

      const unsubscribe = onUserStateChange(vi.fn());

      await vi.waitFor(() => {
        expect(mockOnSnapshot).toHaveBeenCalled();
      });

      unsubscribe();

      expect(unsubAuthMock).toHaveBeenCalled();
      expect(unsubFirestoreMock).toHaveBeenCalled();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* RESET PASSWORD                                                             */
  /* -------------------------------------------------------------------------- */
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

  /* -------------------------------------------------------------------------- */
  /* AUTENTICAZIONE ANONIMA                                                     */
  /* -------------------------------------------------------------------------- */
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

  /* -------------------------------------------------------------------------- */
  /* VERIFICA TELEFONICA E RECAPTCHA                                            */
  /* -------------------------------------------------------------------------- */
  describe("setupRecaptcha, sendPhoneVerification, confirmPhoneVerification", () => {
    test("setupRecaptcha crea l'istanza se assente su window e la restituisce", async () => {
      const mockVerifierInstance = { render: vi.fn() };
      mockRecaptchaVerifier.mockImplementation(function () {
        return mockVerifierInstance;
      });

      const verifier = await setupRecaptcha("recaptcha-container");

      expect(mockRecaptchaVerifier).toHaveBeenCalledWith(
        mockAuth,
        "recaptcha-container",
        expect.objectContaining({ size: "invisible" })
      );
      expect(window.recaptchaVerifier).toBe(mockVerifierInstance);
      expect(verifier).toBe(mockVerifierInstance);

      const secondVerifier = await setupRecaptcha("recaptcha-container");
      expect(secondVerifier).toBe(mockVerifierInstance);
      expect(mockRecaptchaVerifier).toHaveBeenCalledTimes(1);
    });

    test("sendPhoneVerification collega il telefono e restituisce confirmationResult", async () => {
      const mockConfirmation = { verificationId: "otp_req_123" } as unknown as ConfirmationResult;
      mockLinkWithPhoneNumber.mockResolvedValueOnce(mockConfirmation);

      const appVerifier = {} as ApplicationVerifier;
      const res = await sendPhoneVerification(mockUser, "+393400000000", appVerifier);

      expect(mockLinkWithPhoneNumber).toHaveBeenCalledWith(mockUser, "+393400000000", appVerifier);
      expect(res).toBe(mockConfirmation);
    });

    test("sendPhoneVerification traccia analytics_error in caso di eccezione", async () => {
      mockLinkWithPhoneNumber.mockRejectedValueOnce(new Error("auth/invalid-phone-number"));

      await expect(
        sendPhoneVerification(mockUser, "invalid-num", {} as ApplicationVerifier)
      ).rejects.toThrow("auth/invalid-phone-number");

      expect(mockTrackEvent).toHaveBeenCalledWith("analytics_error", {
        name: "phone_verification_requested",
        reason: "auth/invalid-phone-number",
      });
    });

    test("confirmPhoneVerification conferma il codice OTP e restituisce l'utente", async () => {
      const mockConfirmFn = vi.fn().mockResolvedValueOnce({ user: mockUser });
      const mockConfirmation = { confirm: mockConfirmFn } as unknown as ConfirmationResult;

      const confirmedUser = await confirmPhoneVerification(mockConfirmation, "123456");

      expect(mockConfirmFn).toHaveBeenCalledWith("123456");
      expect(confirmedUser).toBe(mockUser);
    });

    test("confirmPhoneVerification traccia analytics_error in caso di OTP non valido", async () => {
      const mockConfirmFn = vi.fn().mockRejectedValueOnce(new Error("auth/invalid-verification-code"));
      const mockConfirmation = { confirm: mockConfirmFn } as unknown as ConfirmationResult;

      await expect(
        confirmPhoneVerification(mockConfirmation, "000000")
      ).rejects.toThrow("auth/invalid-verification-code");

      expect(mockTrackEvent).toHaveBeenCalledWith("analytics_error", {
        name: "phone_verified",
        reason: "auth/invalid-verification-code",
      });
    });
  });
});