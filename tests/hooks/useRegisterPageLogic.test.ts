import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook } from "@testing-library/react";

/* =========================
   MOCKS
========================= */

const toastError = vi.fn();
const toastSuccess = vi.fn();
vi.mock("react-hot-toast", () => ({
  toast: Object.assign(vi.fn(), { error: toastError, success: toastSuccess }),
}));

const saveUserDataMock = vi.fn();
vi.mock("@/shared/services/user", () => ({
  saveUserData: (...args: unknown[]) => saveUserDataMock(...args),
}));

const trackEventMock = vi.fn();
vi.mock("@/infrastructure/analytics", () => ({
  trackEvent: (...args: unknown[]) => trackEventMock(...args),
}));

const navigateMock = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

const fetchWithSecurityMock = vi.fn();
vi.mock("@/config/apiClient", () => ({
  fetchWithSecurity: (...args: unknown[]) => fetchWithSecurityMock(...args),
}));

const setupRecaptchaMock = vi.fn().mockResolvedValue(undefined);
const sendPhoneVerificationMock = vi.fn();
const confirmPhoneVerificationMock = vi.fn();
vi.mock("@/features/auth/hooks/auth", () => ({
  setupRecaptcha: () => setupRecaptchaMock(),
  sendPhoneVerification: (...args: unknown[]) => sendPhoneVerificationMock(...args),
  confirmPhoneVerification: (...args: unknown[]) => confirmPhoneVerificationMock(...args),
}));

type UserLike = {
  uid: string;
  email: string | null;
  displayName?: string | null;
  phoneNumber?: string | null;
  getIdToken?: () => Promise<string>;
};

const useAuthMock = vi.fn<() => { user: UserLike | null }>();
vi.mock("@/context/useAuth", () => ({
  useAuth: () => useAuthMock(),
}));

/* =========================
   HELPERS
========================= */

function makeResponse(ok: boolean, status: number, body: string): Response {
  return {
    ok,
    status,
    text: async () => body,
  } as unknown as Response;
}

async function importFreshHook() {
  vi.resetModules();
  return import("@/features/auth/hooks/useRegisterPageLogic");
}

/* =========================
   LIFECYCLE & SETUP
========================= */

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("VITE_GET_REGISTER_URL", "https://example.test/registrati");

  // Reset del recaptchaVerifier globale
  (window as unknown as { recaptchaVerifier: unknown }).recaptchaVerifier = undefined;

  useAuthMock.mockReturnValue({ user: null });
  navigateMock.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

/* =========================
   TESTS
========================= */

describe("useRegisterPageLogic", () => {
  it("initializes name/surname and phone from user context", async () => {
    const user: UserLike = {
      uid: "u1",
      email: "a@b.com",
      displayName: "Mario Rossi",
      phoneNumber: "+393331234567",
    };
    useAuthMock.mockReturnValue({ user });

    const { useRegisterPageLogic } = await importFreshHook();
    const { result } = renderHook(() => useRegisterPageLogic());

    expect(result.current.name).toBe("Mario");
    expect(result.current.surname).toBe("Rossi");
    expect(result.current.phoneNumber).toBe("3331234567");
    expect(result.current.isPhoneVerified).toBe(true);
  });

  it("handlePhoneChange strips non-digits and resets verification states", async () => {
    const { useRegisterPageLogic } = await importFreshHook();
    const { result } = renderHook(() => useRegisterPageLogic());

    act(() => {
      result.current.handlePhoneChange("abc333-123");
    });

    expect(result.current.phoneNumber).toBe("333123");
    expect(result.current.isOtpSent).toBe(false);
    expect(result.current.isPhoneVerified).toBe(false);
    expect(result.current.otpCode).toBe("");
    expect(result.current.countdown).toBe(0);
  });

  it("sendOtp: success flow sets countdown and isOtpSent", async () => {
    const user: UserLike = { uid: "u1", email: "a@b.com" };
    useAuthMock.mockReturnValue({ user });

    // Inizializza il recaptcha mock globale
    (window as unknown as { recaptchaVerifier: unknown }).recaptchaVerifier = {};
    sendPhoneVerificationMock.mockResolvedValueOnce("mock-confirmation");

    const { useRegisterPageLogic } = await importFreshHook();
    const { result } = renderHook(() => useRegisterPageLogic());

    act(() => {
      result.current.handlePhoneChange("3331234567");
    });

    await act(async () => {
      await result.current.sendOtp();
    });

    // Rimosso `user`: sendPhoneVerification riceve solo (phoneNumber, recaptchaVerifier)
    expect(sendPhoneVerificationMock).toHaveBeenCalledWith(
      "+393331234567",
      (window as unknown as { recaptchaVerifier: unknown }).recaptchaVerifier
    );
    expect(result.current.isOtpSent).toBe(true);
    expect(result.current.countdown).toBe(60);
    expect(toastSuccess).toHaveBeenCalledWith(expect.stringContaining("inviato un codice via SMS"));
  });

  it("verifyOtp: success flow sets isPhoneVerified and clears countdown", async () => {
    const user: UserLike = { uid: "u1", email: "a@b.com" };
    useAuthMock.mockReturnValue({ user });

    (window as unknown as { recaptchaVerifier: unknown }).recaptchaVerifier = {};
    sendPhoneVerificationMock.mockResolvedValueOnce("mock-confirmation");
    confirmPhoneVerificationMock.mockResolvedValueOnce(undefined);

    const { useRegisterPageLogic } = await importFreshHook();
    const { result } = renderHook(() => useRegisterPageLogic());

    act(() => result.current.handlePhoneChange("3331234567"));

    await act(async () => {
      await result.current.sendOtp();
    });

    act(() => result.current.setOtpCode("123456"));

    await act(async () => {
      await result.current.verifyOtp();
    });

    expect(confirmPhoneVerificationMock).toHaveBeenCalledWith("mock-confirmation", "123456");
    expect(result.current.isPhoneVerified).toBe(true);
    expect(result.current.countdown).toBe(0);
    expect(toastSuccess).toHaveBeenCalledWith("Numero verificato con successo!");
  });

  it("verifyOtp: handles auth/credential-already-in-use error", async () => {
    const user: UserLike = { uid: "u1", email: "a@b.com" };
    useAuthMock.mockReturnValue({ user });

    (window as unknown as { recaptchaVerifier: unknown }).recaptchaVerifier = {};
    sendPhoneVerificationMock.mockResolvedValueOnce("mock-confirmation");
    confirmPhoneVerificationMock.mockRejectedValueOnce({ code: "auth/credential-already-in-use" });

    const { useRegisterPageLogic } = await importFreshHook();
    const { result } = renderHook(() => useRegisterPageLogic());

    act(() => result.current.handlePhoneChange("3331234567"));
    await act(async () => {
      await result.current.sendOtp();
    });
    act(() => result.current.setOtpCode("123456"));

    await act(async () => {
      await result.current.verifyOtp();
    });

    expect(toastError).toHaveBeenCalledWith(
      expect.stringContaining("già associato a un altro account"),
      expect.any(Object)
    );
    expect(result.current.isPhoneVerified).toBe(false);
    expect(result.current.isOtpSent).toBe(false);
  });

  it("saveToDb: validates name, phone verification, and required consents", async () => {
    // 1. Fallimento: Nome mancante
    const { useRegisterPageLogic } = await importFreshHook();
    const { result } = renderHook(() => useRegisterPageLogic());

    await act(async () => {
      await result.current.saveToDb();
    });
    expect(toastError).toHaveBeenCalledWith("Inserisci il tuo nome per procedere.");

    // 2. Fallimento: Nome presente ma telefono non verificato
    act(() => result.current.setName("Mario"));
    await act(async () => {
      await result.current.saveToDb();
    });
    expect(toastError).toHaveBeenCalledWith("Devi verificare il tuo numero di telefono prima di proseguire.");

    // 3. Fallimento: Telefono verificato ma consensi mancanti
    useAuthMock.mockReturnValue({
      user: {
        uid: "u1",
        email: "a@b.com",
        displayName: "Mario Rossi",
        phoneNumber: "+393331234567", // Fa inizializzare isPhoneVerified a true
      },
    });

    const { result: verifiedResult } = renderHook(() => useRegisterPageLogic());

    // Nome e telefono verificato sono pronti; manca il consenso a Termini e Privacy
    await act(async () => {
      await verifiedResult.current.saveToDb();
    });

    expect(toastError).toHaveBeenCalledWith(
      expect.stringMatching(/termini|privacy/i)
    );
    expect(saveUserDataMock).not.toHaveBeenCalled();
  });

  it("saveToDb: success flow calls saveUserData, fetchWithSecurity, tracking, toast, navigate", async () => {
    const user: UserLike = {
      uid: "u1",
      email: "a@b.com",
      displayName: "Mario Rossi",
      phoneNumber: "+393331234567",
    };
    useAuthMock.mockReturnValue({ user });

    saveUserDataMock.mockResolvedValueOnce(undefined);
    fetchWithSecurityMock.mockResolvedValueOnce(makeResponse(true, 200, "ok"));

    const { useRegisterPageLogic } = await importFreshHook();
    const { result } = renderHook(() => useRegisterPageLogic());

    act(() => {
      result.current.handleConsentChange("privacy");
      result.current.handleConsentChange("terms");
      result.current.setRole("altro");
      result.current.setRoleOther("Praticante");
    });

    await act(async () => {
      await result.current.saveToDb();
    });

    expect(saveUserDataMock).toHaveBeenCalledTimes(1);
    const [uidArg, payloadArg] = saveUserDataMock.mock.calls[0] as [string, Record<string, unknown>];
    expect(uidArg).toBe("u1");
    expect(payloadArg).toMatchObject({
      name: "Mario",
      surname: "Rossi",
      email: "a@b.com",
      role: "Praticante",
      phoneNumber: "+393331234567",
    });

    expect(fetchWithSecurityMock).toHaveBeenCalledTimes(1);
    expect(fetchWithSecurityMock).toHaveBeenCalledWith("https://example.test/registrati", {});

    expect(trackEventMock).toHaveBeenCalledWith("sign_up", { method: "email", success: true });
    expect(trackEventMock).toHaveBeenCalledWith("free_trial_start", {});

    expect(toastSuccess).toHaveBeenCalledWith("Dati salvati e prova gratuita attivata!");
    expect(navigateMock).toHaveBeenCalledWith("/profilo", { replace: true });
  });

  it("saveToDb: fetch not ok triggers catch -> analytics_error + toast.error", async () => {
    const user: UserLike = { uid: "u1", email: "a@b.com", phoneNumber: "+393331234567" };
    useAuthMock.mockReturnValue({ user });

    saveUserDataMock.mockResolvedValueOnce(undefined);
    fetchWithSecurityMock.mockResolvedValueOnce(makeResponse(false, 500, "bad server"));

    const { useRegisterPageLogic } = await importFreshHook();
    const { result } = renderHook(() => useRegisterPageLogic());

    act(() => {
      result.current.setName("Mario");
      result.current.handleConsentChange("privacy");
      result.current.handleConsentChange("terms");
    });

    await act(async () => {
      await result.current.saveToDb();
    });

    expect(trackEventMock).toHaveBeenCalledWith(
      "analytics_error",
      expect.objectContaining({ name: "register_flow" })
    );
    expect(toastError).toHaveBeenCalledWith("Errore durante il salvataggio dei dati.");
    expect(result.current.isSaving).toBe(false);
  });
});