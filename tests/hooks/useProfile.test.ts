import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";
import type { UserData } from "@/interfaces/interfaces";

/* ---------- hoisted mocks ---------- */
const {
  mockNavigate,
  mockAuthState,
  mockToast,
  mockGetUser,
  mockSaveUserData,
  mockDeleteUser,
  mockUserExists,
  mockGetRegisterPlanId,
  mockExportUserData,
  mockLogout,
  mockDeleteAccountFolder,
  mockUploadAvatar,
  mockGetStorageClient,
  mockRef,
  mockGetDownloadURL,
  mockTrackEvent,
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockAuthState: {
    user: null as User | null,
    loading: false,
  },
  mockToast: {
    error: vi.fn(),
    success: vi.fn(),
  },
  mockGetUser: vi.fn(),
  mockSaveUserData: vi.fn(),
  mockDeleteUser: vi.fn(),
  mockUserExists: vi.fn(),
  mockGetRegisterPlanId: vi.fn(),
  mockExportUserData: vi.fn(),
  mockLogout: vi.fn(),
  mockDeleteAccountFolder: vi.fn(),
  mockUploadAvatar: vi.fn(),
  mockGetStorageClient: vi.fn().mockReturnValue({ storage: "mockStorage" }),
  mockRef: vi.fn((_storage: unknown, path: string) => ({ path })),
  mockGetDownloadURL: vi.fn(),
  mockTrackEvent: vi.fn(),
}));

/* ---------- mock router, context & toast ---------- */
vi.mock("react-router-dom", () => ({
  __esModule: true,
  useNavigate: () => mockNavigate,
}));

vi.mock("@/context/useAuth", () => ({
  __esModule: true,
  useAuth: () => mockAuthState,
}));

vi.mock("react-hot-toast", () => ({
  toast: mockToast,
}));

vi.mock("@/infrastructure/analytics", () => ({
  __esModule: true,
  trackEvent: (name: string, payload?: Record<string, unknown>) => mockTrackEvent(name, payload),
}));

/* ---------- mock user & auth services ---------- */
vi.mock("@/shared/services/user", () => ({
  __esModule: true,
  getUser: (uid: string) => mockGetUser(uid),
  saveUserData: (uid: string, data: unknown) => mockSaveUserData(uid, data),
  deleteUser: (uid: string) => mockDeleteUser(uid),
  userExists: (uid: string) => mockUserExists(uid),
  getRegisterPlanId: (uid: string) => mockGetRegisterPlanId(uid),
  exportUserData: (uid: string) => mockExportUserData(uid),
}));

vi.mock("@/features/auth/hooks/auth", () => ({
  __esModule: true,
  logout: () => mockLogout(),
}));

/* ---------- mock storage & dynamic imports ---------- */
vi.mock("@/shared/services/storage", () => ({
  __esModule: true,
  deleteAccountFolder: (uid: string) => mockDeleteAccountFolder(uid),
  uploadAvatar: (file: File, uid: string) => mockUploadAvatar(file, uid),
}));

vi.mock("@/infrastructure/storageClient", () => ({
  __esModule: true,
  getStorageClient: () => mockGetStorageClient(),
}));

vi.mock("firebase/storage", () => ({
  __esModule: true,
  ref: (storage: unknown, path: string) => mockRef(storage, path),
  getDownloadURL: (refObj: unknown) => mockGetDownloadURL(refObj),
}));

vi.mock("@/interfaces/interfaces", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/interfaces/interfaces")>();
  return {
    ...actual,
    roleOptions: [
      { value: "avvocato", label: "Avvocato" },
      { value: "magistrato", label: "Magistrato" },
      { value: "praticante", label: "Praticante" },
    ],
  };
});

/* ---------- subject under test ---------- */
import { useProfile } from "@/features/profile/hooks/useProfile"; // <-- adegua il path di import se necessario

describe("useProfile Hook Suite", () => {
  const mockUserInstance = {
    uid: "usr_flv_2026",
    email: "flavio@jurio.it",
    photoURL: "https://lh3.googleusercontent.com/avatar.jpg",
  } as unknown as User;

  const mockValidUserData: UserData = {
    name: "Flavio",
    surname: "Campaniolo",
    assignedTeamId: "team_legal_1",
    role: "avvocato",
    consents: {
      privacy: true,
      terms: true,
      comms: true,
      marketing: false,
    },
    avatar: "https://lh3.googleusercontent.com/avatar.jpg",
    email: "flavio@jurio.it",
  } as unknown as UserData;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.user = mockUserInstance;
    mockAuthState.loading = false;
    mockUserExists.mockResolvedValue(true);
    mockGetUser.mockResolvedValue(mockValidUserData);
    mockGetRegisterPlanId.mockResolvedValue("plan_pro_annual");
    mockSaveUserData.mockResolvedValue(undefined);
    mockDeleteAccountFolder.mockResolvedValue(undefined);
    mockDeleteUser.mockResolvedValue(undefined);
    mockLogout.mockResolvedValue(undefined);
    mockExportUserData.mockResolvedValue(undefined);
    mockUploadAvatar.mockResolvedValue(undefined);
    mockGetDownloadURL.mockResolvedValue("https://storage.jurio.it/downloaded_avatar.jpg");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("Inizializzazione e Guardie di Reindirizzamento", () => {
    test("non intraprende alcuna azione se lo stato di autenticazione è in loading", () => {
      mockAuthState.loading = true;
      mockAuthState.user = null;

      const { result } = renderHook(() => useProfile());

      expect(result.current.loading).toBe(true);
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockUserExists).not.toHaveBeenCalled();
    });

    test("reindirizza al login se l'utente non è autenticato", () => {
      mockAuthState.loading = false;
      mockAuthState.user = null;

      renderHook(() => useProfile());

      expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
      expect(mockUserExists).not.toHaveBeenCalled();
    });

    test("reindirizza a /registrati se l'account Firebase non ha ancora il record su database", async () => {
      mockUserExists.mockResolvedValueOnce(false);

      renderHook(() => useProfile());

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/registrati", { replace: true });
      });

      expect(mockGetUser).not.toHaveBeenCalled();
    });
  });

  describe("Caricamento Profilo e Normalizzazione Ruoli", () => {
    test("popola i dati utente, il piano e seleziona un ruolo standard esistente", async () => {
      const { result } = renderHook(() => useProfile());

      await waitFor(() => {
        expect(result.current.userData).toEqual(mockValidUserData);
      });

      expect(result.current.name).toBe("Flavio");
      expect(result.current.surname).toBe("Campaniolo");
      expect(result.current.assignedTeamId).toBe("team_legal_1");
      expect(result.current.planId).toBe("plan_pro_annual");
      expect(result.current.role).toBe("avvocato");
      expect(result.current.roleOther).toBe("");
      expect(result.current.consents).toEqual(mockValidUserData.consents);
    });

    test("normalizza un ruolo personalizzato impostando role su 'altro' e roleOther sul valore originale", async () => {
      mockGetUser.mockResolvedValueOnce({
        ...mockValidUserData,
        role: "Consulente Tecnico d'Ufficio",
      });

      const { result } = renderHook(() => useProfile());

      await waitFor(() => {
        expect(result.current.userData).not.toBeNull();
      });

      expect(result.current.role).toBe("altro");
      expect(result.current.roleOther).toBe("Consulente Tecnico d'Ufficio");
    });

    test("azzera role e roleOther se il campo role è vuoto o non impostato", async () => {
      mockGetUser.mockResolvedValueOnce({
        ...mockValidUserData,
        role: "",
      });

      const { result } = renderHook(() => useProfile());

      await waitFor(() => {
        expect(result.current.userData).not.toBeNull();
      });

      expect(result.current.role).toBe("");
      expect(result.current.roleOther).toBe("");
    });

    test("mostra toast di errore in caso di fallimento della chiamata di recupero utente", async () => {
      mockGetUser.mockRejectedValueOnce(new Error("Firestore fetch failed"));

      renderHook(() => useProfile());

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith("Errore caricamento dati utente");
      });
    });
  });

  describe("Risoluzione Avatar da Storage", () => {
    test("utilizza direttamente l'avatar se è già un URL http/https senza invocare Storage", async () => {
      mockGetUser.mockResolvedValueOnce({
        ...mockValidUserData,
        avatar: "https://cdn.jurio.it/avatars/custom.png",
      });

      const { result } = renderHook(() => useProfile());

      await waitFor(() => {
        expect(result.current.avatar).toBe("https://cdn.jurio.it/avatars/custom.png");
      });

      expect(mockGetDownloadURL).not.toHaveBeenCalled();
    });

    test("recupera l'URL di download da Storage se l'avatar è un percorso relativo", async () => {
      // 1. Disinnesca il photoURL di default dell'oggetto Auth per questo specifico test
      mockAuthState.user = {
        ...mockUserInstance,
        photoURL: null,
      } as unknown as User;

      // 2. Inietta il percorso relativo simulando il ritorno da Firestore
      mockGetUser.mockResolvedValueOnce({
        ...mockValidUserData,
        avatar: "users/usr_flv_2026/image_1080x1080.jpeg",
      });

      const { result } = renderHook(() => useProfile());

      // 3. Verifica la corretta risoluzione asincrona tramite Firebase Storage
      await waitFor(() => {
        expect(result.current.avatar).toBe("https://storage.jurio.it/downloaded_avatar.jpg");
      });

      expect(mockRef).toHaveBeenCalledWith({ storage: "mockStorage" }, "users/usr_flv_2026/image_1080x1080.jpeg");
      expect(mockGetDownloadURL).toHaveBeenCalled();
    });
  });

  describe("Modifica Consensi e Salvataggio (handleSave)", () => {
    test("handleConsentChange inverte il singolo consenso specificato", async () => {
      const { result } = renderHook(() => useProfile());

      await waitFor(() => {
        expect(result.current.userData).not.toBeNull();
      });

      expect(result.current.consents.marketing).toBe(false);

      act(() => {
        result.current.handleConsentChange("marketing");
      });

      expect(result.current.consents.marketing).toBe(true);
    });

test("blocca il salvataggio con toast se nome o cognome sono vuoti", async () => {
      const { result } = renderHook(() => useProfile());

      await waitFor(() => {
        expect(result.current.userData).not.toBeNull();
      });

      act(() => {
        result.current.setName("   ");
      });

      await act(async () => {
        await result.current.handleSave();
      });

      expect(mockToast.error).toHaveBeenCalledWith("Nome e cognome obbligatori");
      expect(mockSaveUserData).not.toHaveBeenCalled();
    });

    test("blocca il salvataggio se privacy o terms non sono accettati", async () => {
      const { result } = renderHook(() => useProfile());

      await waitFor(() => {
        expect(result.current.userData).not.toBeNull();
      });

      act(() => {
        result.current.handleConsentChange("terms"); // inverte da true a false
      });
      
      await act(async () => {
        await result.current.handleSave();
      });

      expect(mockToast.error).toHaveBeenCalledWith("Accetta privacy e termini");
      expect(mockSaveUserData).not.toHaveBeenCalled();
    });

    test("salva correttamente i dati anagrafici e traccia l'evento analytics di successo", async () => {
      const { result } = renderHook(() => useProfile());

      await waitFor(() => {
        expect(result.current.userData).not.toBeNull();
      });

      act(() => {
        result.current.setName("Nicolò Flavio");
      });

      let success = false;
      await act(async () => {
        success = Boolean(await result.current.handleSave());
      });

      expect(success).toBe(true);
      expect(mockSaveUserData).toHaveBeenCalledWith("usr_flv_2026", {
        name: "Nicolò Flavio",
        surname: "Campaniolo",
        avatar: "https://lh3.googleusercontent.com/avatar.jpg",
        consents: result.current.consents,
        email: "flavio@jurio.it",
      });
      expect(mockTrackEvent).toHaveBeenCalledWith("profile_updated", { type: true });
      expect(mockToast.success).toHaveBeenCalledWith("Dati salvati correttamente");
      expect(result.current.saving).toBe(false);
    });

    test("effettua l'upload di un nuovo file avatar se presente e aggiorna il path dell'immagine", async () => {
      const { result } = renderHook(() => useProfile());

      await waitFor(() => {
        expect(result.current.userData).not.toBeNull();
      });

      const newAvatarFile = new File(["img-bytes"], "nuovo_avatar.png", { type: "image/png" });

      act(() => {
        result.current.setAvatarFile(newAvatarFile);
      });

      await act(async () => {
        await result.current.handleSave();
      });

      expect(mockUploadAvatar).toHaveBeenCalledWith(newAvatarFile, "usr_flv_2026");
      expect(mockSaveUserData).toHaveBeenCalledWith(
        "usr_flv_2026",
        expect.objectContaining({
          avatar: "users/usr_flv_2026/image_1080x1080.jpeg",
        })
      );
      expect(result.current.avatarFile).toBeNull();
    });

    test("gestisce errori durante il salvataggio tracciando analytics_error", async () => {
      mockSaveUserData.mockRejectedValueOnce(new Error("Database write failure"));

      const { result } = renderHook(() => useProfile());

      await waitFor(() => {
        expect(result.current.userData).not.toBeNull();
      });

      let success = true;
      await act(async () => {
        success = Boolean(await result.current.handleSave());
      });

      expect(success).toBe(false);
      expect(mockTrackEvent).toHaveBeenCalledWith("analytics_error", {
        name: "profile_updated",
        reason: "Database write failure",
      });
      expect(mockToast.error).toHaveBeenCalledWith("Errore durante il salvataggio");
      expect(result.current.saving).toBe(false);
    });
  });

  describe("Cancellazione Account (deleteAccount)", () => {
    test("elimina la cartella Storage, cancella l'utente, effettua il logout e reindirizza a /ricerca", async () => {
      const { result } = renderHook(() => useProfile());

      await act(async () => {
        await result.current.deleteAccount();
      });

      expect(mockDeleteAccountFolder).toHaveBeenCalledWith("usr_flv_2026");
      expect(mockDeleteUser).toHaveBeenCalledWith("usr_flv_2026");
      expect(mockLogout).toHaveBeenCalledTimes(1);
      expect(mockToast.success).toHaveBeenCalledWith("Profilo eliminato correttamente");
      expect(mockNavigate).toHaveBeenCalledWith("/ricerca", { replace: true });
    });

    test("mostra messaggio specifico se Firebase richiede un login recente prima della cancellazione", async () => {
      mockDeleteUser.mockRejectedValueOnce({ code: "auth/requires-recent-login" });

      const { result } = renderHook(() => useProfile());

      await act(async () => {
        await result.current.deleteAccount();
      });

      expect(mockToast.error).toHaveBeenCalledWith("Devi rifare il login per eliminare l'account.");
      expect(mockNavigate).not.toHaveBeenCalledWith("/ricerca", { replace: true });
    });

    test("gestisce errore generico durante l'eliminazione dell'account", async () => {
      mockDeleteAccountFolder.mockRejectedValueOnce(new Error("Storage delete failed"));

      const { result } = renderHook(() => useProfile());

      await act(async () => {
        await result.current.deleteAccount();
      });

      expect(mockToast.error).toHaveBeenCalledWith("Errore durante l'eliminazione del profilo.");
    });
  });

  describe("Esportazione Dati Account (exportAccount)", () => {
    test("esporta i dati dell'account con successo", async () => {
      const { result } = renderHook(() => useProfile());

      await act(async () => {
        await result.current.exportAccount();
      });

      expect(mockExportUserData).toHaveBeenCalledWith("usr_flv_2026");
      expect(mockToast.success).toHaveBeenCalledWith("Profilo esportato correttamente");
    });

    test("mostra messaggio specifico se Firebase richiede re-autenticazione per l'export", async () => {
      mockExportUserData.mockRejectedValueOnce({ code: "auth/requires-recent-login" });

      const { result } = renderHook(() => useProfile());

      await act(async () => {
        await result.current.exportAccount();
      });

      expect(mockToast.error).toHaveBeenCalledWith("Devi rifare il login per esportare l'account.");
    });

    test("gestisce errore generico durante l'esportazione dei dati", async () => {
      mockExportUserData.mockRejectedValueOnce(new Error("Export worker timeout"));

      const { result } = renderHook(() => useProfile());

      await act(async () => {
        await result.current.exportAccount();
      });

      expect(mockToast.error).toHaveBeenCalledWith("Errore durante l'esportazione del profilo.");
    });
  });
});