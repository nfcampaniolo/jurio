
import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { act, renderHook } from "@testing-library/react";

type UserLike = {
  uid: string;
  email: string | null;
  displayName?: string | null;
};

/* =========================
   MOCKS
========================= */

const {
  toastError,
  toastSuccess,
  toastMock,
  saveUserDataMock,
  trackEventMock,
  navigateMock,
  fetchWithSecurityMock,
  useAuthMock,
} = vi.hoisted(() => {
  const toastError = vi.fn();
  const toastSuccess = vi.fn();

  return {
    toastError,
    toastSuccess,
    toastMock: Object.assign(vi.fn(), {
      error: toastError,
      success: toastSuccess,
    }),
    saveUserDataMock: vi.fn(),
    trackEventMock: vi.fn(),
    navigateMock: vi.fn(),
    fetchWithSecurityMock: vi.fn(),
    useAuthMock: vi.fn(),
  };
});

vi.mock("react-hot-toast", () => ({
  default: toastMock,
  toast: toastMock,
}));

vi.mock("@/shared/services/user", () => ({
  saveUserData: saveUserDataMock,
}));

vi.mock("@/infrastructure/analytics", () => ({
  trackEvent: trackEventMock,
}));

vi.mock("react-router-dom", async () => {
  const actual =
    await vi.importActual<typeof import("react-router-dom")>(
      "react-router-dom"
    );

  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock("@/config/apiClient", () => ({
  fetchWithSecurity: fetchWithSecurityMock,
}));

vi.mock("@/context/useAuth", () => ({
  useAuth: useAuthMock,
}));

/* =========================
   HELPERS
========================= */

function makeResponse(
  ok: boolean,
  status: number,
  body: string
): Response {
  return {
    ok,
    status,
    text: async () => body,
  } as unknown as Response;
}

async function getHook() {
  const mod = await import(
    "@/features/auth/hooks/useRegisterPageLogic"
  );

  return mod.useRegisterPageLogic;
}

function prepareValidForm(
  result: {
    current: {
      setName: (value: string) => void;
      setIsAdult: (value: boolean) => void;
      handleConsentChange: (
        key: "privacy" | "terms" | "comms" | "marketing"
      ) => void;
    };
  }
) {
  act(() => {
    result.current.setName("Mario");
    result.current.setIsAdult(true);
    result.current.handleConsentChange("privacy");
    result.current.handleConsentChange("terms");
  });
}

/* =========================
   LIFECYCLE
========================= */

beforeEach(() => {
  vi.clearAllMocks();

  vi.stubEnv(
    "VITE_GET_REGISTER_URL",
    "https://example.test/registrati"
  );

  useAuthMock.mockReturnValue({ user: null });

  saveUserDataMock.mockResolvedValue(undefined);
  fetchWithSecurityMock.mockResolvedValue(
    makeResponse(true, 200, "ok")
  );

  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

/* =========================
   TESTS
========================= */

describe("useRegisterPageLogic", () => {
  it("initializes name and surname from user context", async () => {
    const user: UserLike = {
      uid: "u1",
      email: "a@b.com",
      displayName: "Mario Rossi",
    };

    useAuthMock.mockReturnValue({ user });

    const useRegisterPageLogic = await getHook();
    const { result } = renderHook(() => useRegisterPageLogic());

    expect(result.current.name).toBe("Mario");
    expect(result.current.surname).toBe("Rossi");
    expect(result.current.isAdult).toBe(false);
    expect(result.current.isSaving).toBe(false);
  });

  it("handles consent changes correctly", async () => {
    const useRegisterPageLogic = await getHook();
    const { result } = renderHook(() => useRegisterPageLogic());

    expect(result.current.consents.privacy).toBe(false);

    act(() => {
      result.current.handleConsentChange("privacy");
    });

    expect(result.current.consents.privacy).toBe(true);

    act(() => {
      result.current.handleConsentChange("privacy");
    });

    expect(result.current.consents.privacy).toBe(false);
  });

  describe("validation checks in saveToDb", () => {
    it("fails when name is missing", async () => {
      const useRegisterPageLogic = await getHook();
      const { result } = renderHook(() => useRegisterPageLogic());

      await act(async () => {
        await result.current.saveToDb();
      });

      expect(toastError).toHaveBeenCalledWith(
        "Inserisci il tuo nome per procedere."
      );
      expect(saveUserDataMock).not.toHaveBeenCalled();
      expect(fetchWithSecurityMock).not.toHaveBeenCalled();
    });

    it("fails when the user is not an adult", async () => {
      const useRegisterPageLogic = await getHook();
      const { result } = renderHook(() => useRegisterPageLogic());

      act(() => {
        result.current.setName("Mario");
      });

      await act(async () => {
        await result.current.saveToDb();
      });

      expect(toastError).toHaveBeenCalledWith(
        "Devi dichiarare di avere più di 18 anni per proseguire."
      );
      expect(saveUserDataMock).not.toHaveBeenCalled();
    });

    it("fails when required privacy or terms consent is missing", async () => {
      const useRegisterPageLogic = await getHook();
      const { result } = renderHook(() => useRegisterPageLogic());

      act(() => {
        result.current.setName("Mario");
        result.current.setIsAdult(true);
      });

      await act(async () => {
        await result.current.saveToDb();
      });

      expect(toastError).toHaveBeenCalledWith(
        "Accetta privacy e termini per proseguire."
      );
      expect(saveUserDataMock).not.toHaveBeenCalled();
    });

    it("fails when user is not logged in", async () => {
      useAuthMock.mockReturnValue({ user: null });

      const useRegisterPageLogic = await getHook();
      const { result } = renderHook(() => useRegisterPageLogic());

      prepareValidForm(result);

      await act(async () => {
        await result.current.saveToDb();
      });

      expect(toastError).toHaveBeenCalledWith(
        "Utente non loggato."
      );
      expect(saveUserDataMock).not.toHaveBeenCalled();
      expect(fetchWithSecurityMock).not.toHaveBeenCalled();
    });
  });

  describe("saveToDb execution", () => {
    it("saves user data, calls the endpoint, tracks events and navigates", async () => {
      const user: UserLike = {
        uid: "u1",
        email: "a@b.com",
        displayName: "Mario Rossi",
      };

      useAuthMock.mockReturnValue({ user });

      const useRegisterPageLogic = await getHook();
      const { result } = renderHook(() => useRegisterPageLogic());

      prepareValidForm(result);

      act(() => {
        result.current.setSurname("Rossi");
        result.current.setRole("altro");
        result.current.setRoleOther("Praticante");
      });

      await act(async () => {
        await result.current.saveToDb();
      });

      expect(saveUserDataMock).toHaveBeenCalledWith("u1", {
        name: "Mario",
        surname: "Rossi",
        isAdult: true,
        email: "a@b.com",
        consents: {
          privacy: true,
          terms: true,
          comms: false,
          marketing: false,
        },
        role: "Praticante",
      });

      expect(fetchWithSecurityMock).toHaveBeenCalledWith(
        "https://example.test/registrati",
        {}
      );

      expect(trackEventMock).toHaveBeenCalledWith("sign_up", {
        method: "email",
        success: true,
      });

      expect(trackEventMock).toHaveBeenCalledWith(
        "profile_updated",
        { type: true }
      );

      expect(trackEventMock).toHaveBeenCalledWith(
        "free_trial_start",
        {}
      );

      expect(toastSuccess).toHaveBeenCalledWith(
        "Dati salvati e prova gratuita attivata!"
      );

      expect(navigateMock).toHaveBeenCalledWith("/profilo", {
        replace: true,
      });

      expect(result.current.isSaving).toBe(false);
    });

    it("saves a standard role", async () => {
      const user: UserLike = {
        uid: "u1",
        email: "a@b.com",
        displayName: "Mario Rossi",
      };

      useAuthMock.mockReturnValue({ user });

      const useRegisterPageLogic = await getHook();
      const { result } = renderHook(() => useRegisterPageLogic());

      prepareValidForm(result);

      act(() => {
        result.current.setRole("Avvocato");
      });

      await act(async () => {
        await result.current.saveToDb();
      });

      expect(saveUserDataMock).toHaveBeenCalledWith(
        "u1",
        expect.objectContaining({
          name: "Mario",
          isAdult: true,
          role: "Avvocato",
        })
      );
    });

    it("omits role when no role is selected", async () => {
      const user: UserLike = {
        uid: "u1",
        email: "a@b.com",
        displayName: "Mario Rossi",
      };

      useAuthMock.mockReturnValue({ user });

      const useRegisterPageLogic = await getHook();
      const { result } = renderHook(() => useRegisterPageLogic());

      prepareValidForm(result);

      await act(async () => {
        await result.current.saveToDb();
      });

      expect(saveUserDataMock).toHaveBeenCalledWith(
        "u1",
        expect.not.objectContaining({
          role: expect.anything(),
        })
      );
    });

    it("omits role when 'altro' is selected but the custom role is empty", async () => {
      const user: UserLike = {
        uid: "u1",
        email: "a@b.com",
        displayName: "Mario Rossi",
      };

      useAuthMock.mockReturnValue({ user });

      const useRegisterPageLogic = await getHook();
      const { result } = renderHook(() => useRegisterPageLogic());

      prepareValidForm(result);

      act(() => {
        result.current.setRole("altro");
        result.current.setRoleOther("   ");
      });

      await act(async () => {
        await result.current.saveToDb();
      });

      expect(saveUserDataMock).toHaveBeenCalledWith(
        "u1",
        expect.not.objectContaining({
          role: expect.anything(),
        })
      );
    });

    it("handles database save failure", async () => {
      const user: UserLike = {
        uid: "u1",
        email: "a@b.com",
        displayName: "Mario Rossi",
      };

      useAuthMock.mockReturnValue({ user });
      saveUserDataMock.mockRejectedValueOnce(
        new Error("database unavailable")
      );

      const useRegisterPageLogic = await getHook();
      const { result } = renderHook(() => useRegisterPageLogic());

      prepareValidForm(result);

      await act(async () => {
        await result.current.saveToDb();
      });

      expect(fetchWithSecurityMock).not.toHaveBeenCalled();

      expect(trackEventMock).toHaveBeenCalledWith(
        "analytics_error",
        {
          name: "register_flow",
          reason: "database unavailable",
        }
      );

      expect(toastError).toHaveBeenCalledWith(
        "Errore durante il salvataggio dei dati."
      );

      expect(result.current.isSaving).toBe(false);
    });

    it("handles API failure and logs error analytics", async () => {
      const user: UserLike = {
        uid: "u1",
        email: "a@b.com",
        displayName: "Mario Rossi",
      };

      useAuthMock.mockReturnValue({ user });

      fetchWithSecurityMock.mockResolvedValueOnce(
        makeResponse(false, 500, "internal server error")
      );

      const useRegisterPageLogic = await getHook();
      const { result } = renderHook(() => useRegisterPageLogic());

      prepareValidForm(result);

      await act(async () => {
        await result.current.saveToDb();
      });

      expect(trackEventMock).toHaveBeenCalledWith(
        "analytics_error",
        {
          name: "register_flow",
          reason:
            "getRegister failed (500): internal server error",
        }
      );

      expect(toastError).toHaveBeenCalledWith(
        "Errore durante il salvataggio dei dati."
      );

      expect(navigateMock).not.toHaveBeenCalled();
      expect(toastSuccess).not.toHaveBeenCalled();
      expect(result.current.isSaving).toBe(false);
    });

    it("prevents concurrent save requests", async () => {
      const user: UserLike = {
        uid: "u1",
        email: "a@b.com",
        displayName: "Mario Rossi",
      };

      useAuthMock.mockReturnValue({ user });

      let resolveSave!: () => void;

      saveUserDataMock.mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            resolveSave = resolve;
          })
      );

      const useRegisterPageLogic = await getHook();
      const { result } = renderHook(() => useRegisterPageLogic());

      prepareValidForm(result);

      let firstSave!: ReturnType<typeof result.current.saveToDb>

      act(() => {
        firstSave = result.current.saveToDb();
      });

      expect(result.current.isSaving).toBe(true);

      await act(async () => {
        await result.current.saveToDb();
      });

      expect(saveUserDataMock).toHaveBeenCalledTimes(1);
      expect(fetchWithSecurityMock).not.toHaveBeenCalled();

      await act(async () => {
        resolveSave();
        await firstSave;
      });

      expect(saveUserDataMock).toHaveBeenCalledTimes(1);
      expect(fetchWithSecurityMock).toHaveBeenCalledTimes(1);
      expect(result.current.isSaving).toBe(false);
    });
  });
});