import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { User } from "firebase/auth";

/* ---------- hoisted mocks ---------- */
const {
  mockAuthState,
  mockToast,
  mockFetchWithSecurity,
  mockGetCloudUrl,
  mockGetGoogleConfig,
  mockLoadScript,
  mockLoadGoogleLibraries,
} = vi.hoisted(() => ({
  mockAuthState: {
    user: null as User | null,
  },
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  mockFetchWithSecurity: vi.fn(),
  mockGetCloudUrl: vi.fn(() => ({
    DOWNLOAD_CLOUD_ENDPOINT: "https://api.jurio.it/cloud/download",
  })),
  mockGetGoogleConfig: vi.fn(() => ({
    clientId: "mock-client-id.apps.googleusercontent.com",
    apiKey: "mock-api-key",
    appId: "mock-app-id",
  })),
  mockLoadScript: vi.fn().mockResolvedValue(undefined),
  mockLoadGoogleLibraries: vi.fn().mockResolvedValue(undefined),
}));

/* ---------- mock modules ---------- */
vi.mock("@/context/useAuth", () => ({
  __esModule: true,
  useAuth: () => mockAuthState,
}));

vi.mock("react-hot-toast", () => ({
  __esModule: true,
  toast: mockToast,
}));

vi.mock("@/config/apiClient", () => ({
  __esModule: true,
  fetchWithSecurity: (...args: unknown[]) => mockFetchWithSecurity(...args),
}));

vi.mock("@/config/env", () => ({
  __esModule: true,
  getCloudUrl: () => mockGetCloudUrl(),
}));

vi.mock("@/hooks/utilsGoogleDrive", () => ({
  __esModule: true,
  GOOGLE_DRIVE_SCOPE: "https://www.googleapis.com/auth/drive.readonly",
  GOOGLE_TOKEN_SCRIPT: "https://accounts.google.com/gsi/client",
  GOOGLE_TOKEN_SCRIPT_ID: "google-gis-token-script",
  getGoogleConfig: () => mockGetGoogleConfig(),
  loadScript: (...args: unknown[]) => mockLoadScript(...args),
  loadGoogleLibraries: () => mockLoadGoogleLibraries(),
}));

vi.mock("./utilsGoogleDrive", () => ({
  __esModule: true,
  GOOGLE_DRIVE_SCOPE: "https://www.googleapis.com/auth/drive.readonly",
  GOOGLE_TOKEN_SCRIPT: "https://accounts.google.com/gsi/client",
  GOOGLE_TOKEN_SCRIPT_ID: "google-gis-token-script",
  getGoogleConfig: () => mockGetGoogleConfig(),
  loadScript: (...args: unknown[]) => mockLoadScript(...args),
  loadGoogleLibraries: () => mockLoadGoogleLibraries(),
}));

/* ---------- subject under test ---------- */
import { useGoogleDrive } from "@/hooks/useGoogleDrive";

describe("useGoogleDrive Hook Suite", () => {
  let tokenCallback: ((resp: Record<string, unknown>) => void) | null = null;
  let pickerCallback: ((data: Record<string, unknown>) => void) | null = null;

  const mockRequestAccessToken = vi.fn();
  const mockInitTokenClient = vi.fn((config: { callback: (resp: Record<string, unknown>) => void }) => {
    tokenCallback = config.callback;
    return { requestAccessToken: mockRequestAccessToken };
  });

  const mockDocsViewInstance = {
    setMimeTypes: vi.fn(),
  };

  const mockPickerSetVisible = vi.fn();
  const mockPickerBuilderInstance = {
    addView: vi.fn().mockReturnThis(),
    setOAuthToken: vi.fn().mockReturnThis(),
    setDeveloperKey: vi.fn().mockReturnThis(),
    setAppId: vi.fn().mockReturnThis(),
    setCallback: vi.fn((cb: (data: Record<string, unknown>) => void) => {
      pickerCallback = cb;
      return mockPickerBuilderInstance;
    }),
    build: vi.fn(() => ({
      setVisible: mockPickerSetVisible,
    })),
  };

  // Funzioni costruttore compatibili con new
  function MockDocsView() {
    return mockDocsViewInstance;
  }

  function MockPickerBuilder() {
    return mockPickerBuilderInstance;
  }

  const setupWindowGoogle = () => {
    (window as unknown as { google: unknown }).google = {
      accounts: {
        oauth2: {
          initTokenClient: mockInitTokenClient,
        },
      },
      picker: {
        ViewId: { DOCS: "DOCS" },
        Action: { PICKED: "picked", CANCEL: "cancel" },
        DocsView: MockDocsView,
        PickerBuilder: MockPickerBuilder,
      },
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tokenCallback = null;
    pickerCallback = null;
    mockAuthState.user = { uid: "usr_flv_2026" } as User;
    setupWindowGoogle();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    delete (window as unknown as { google?: unknown }).google;
  });

  /* -------------------------------------------------------------------------- */
  /* STATO AUTENTICAZIONE                                                       */
  /* -------------------------------------------------------------------------- */
  describe("Inizializzazione e Stato Autenticazione", () => {
    test("riflette isAuthenticated in base allo stato utente del contesto", () => {
      const { result, rerender } = renderHook(() => useGoogleDrive());
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.googleToken).toBeNull();
      expect(result.current.loading).toBe(false);

      mockAuthState.user = null;
      rerender();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* GOOGLE PICKER & GIS                                                        */
  /* -------------------------------------------------------------------------- */
  describe("openPicker & Google Identity Services (GIS)", () => {
    test("blocca l'apertura del picker se l'utente non è autenticato nell'applicazione", async () => {
      mockAuthState.user = null;
      const { result } = renderHook(() => useGoogleDrive());

      await act(async () => {
        await result.current.openPicker(vi.fn());
      });

      expect(mockToast.error).toHaveBeenCalledWith("Devi essere autenticato nell'applicazione.");
      expect(mockLoadGoogleLibraries).not.toHaveBeenCalled();
    });

    test("intercetta assenza di Google Identity Services gestendo l'eccezione con toast", async () => {
      (window as unknown as { google: { accounts?: unknown } }).google.accounts = undefined;

      const { result } = renderHook(() => useGoogleDrive());

      await act(async () => {
        await result.current.openPicker(vi.fn());
      });

      expect(mockToast.error).toHaveBeenCalledWith(
        "Google Drive: Google Identity Services non disponibile."
      );
    });

    test("richiede il token con prompt 'consent' al primo avvio e gestisce errore da Google", async () => {
      const { result } = renderHook(() => useGoogleDrive());

      let pickerPromise!: Promise<void>;
      act(() => {
        pickerPromise = result.current.openPicker(vi.fn());
      });

      await vi.waitFor(() => {
        expect(mockInitTokenClient).toHaveBeenCalledWith(
          expect.objectContaining({
            client_id: "mock-client-id.apps.googleusercontent.com",
            scope: "https://www.googleapis.com/auth/drive.readonly",
          })
        );
      });
      expect(mockRequestAccessToken).toHaveBeenCalledWith({ prompt: "consent" });

      // Simula rifiuto consenso da Google
      act(() => {
        tokenCallback?.({ error: "access_denied", error_description: "Utente ha negato il consenso" });
      });

      await act(async () => {
        await pickerPromise;
      });

      expect(mockToast.error).toHaveBeenCalledWith("Google Drive: Utente ha negato il consenso");
    });

    test("apre Google Picker con filtri MIME corretti e invoca onSelectFile alla selezione", async () => {
      const onSelectFileSpy = vi.fn();
      const { result } = renderHook(() => useGoogleDrive());

      let openPickerPromise!: Promise<void>;
      act(() => {
        openPickerPromise = result.current.openPicker(onSelectFileSpy);
      });

      await vi.waitFor(() => {
        expect(mockInitTokenClient).toHaveBeenCalled();
      });

      // Simula token da GIS
      act(() => {
        tokenCallback?.({ access_token: "ya29.mock_token_drive" });
      });

      await act(async () => {
        await openPickerPromise;
      });

      expect(mockDocsViewInstance.setMimeTypes).toHaveBeenCalledWith(
        "application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      );
      expect(mockPickerBuilderInstance.setOAuthToken).toHaveBeenCalledWith("ya29.mock_token_drive");
      expect(mockPickerBuilderInstance.setDeveloperKey).toHaveBeenCalledWith("mock-api-key");
      expect(mockPickerBuilderInstance.setAppId).toHaveBeenCalledWith("mock-app-id");
      expect(mockPickerSetVisible).toHaveBeenCalledWith(true);
      expect(result.current.googleToken).toBe("ya29.mock_token_drive");

      // Simula selezione file da Picker
      act(() => {
        pickerCallback?.({
          action: "picked",
          docs: [
            {
              id: "google-file-101",
              name: "Memoria_Difensiva.pdf",
              mimeType: "application/pdf",
            },
          ],
        });
      });

      expect(onSelectFileSpy).toHaveBeenCalledWith(
        "google-file-101",
        "Memoria_Difensiva.pdf",
        "application/pdf"
      );
    });

    test("ignora callback di tipo cancel e gestisce payload picked privo di documenti", async () => {
      const onSelectFileSpy = vi.fn();
      const { result } = renderHook(() => useGoogleDrive());

      let openPickerPromise!: Promise<void>;
      act(() => {
        openPickerPromise = result.current.openPicker(onSelectFileSpy);
      });

      await vi.waitFor(() => {
        expect(mockInitTokenClient).toHaveBeenCalled();
      });

      act(() => {
        tokenCallback?.({ access_token: "ya29.mock_token_drive" });
      });

      await act(async () => {
        await openPickerPromise;
      });

      // Azione Annulla
      act(() => {
        pickerCallback?.({ action: "cancel" });
      });
      expect(onSelectFileSpy).not.toHaveBeenCalled();

      // Azione Picked senza docs
      act(() => {
        pickerCallback?.({ action: "picked", docs: [] });
      });
      expect(mockToast.error).toHaveBeenCalledWith("Nessun file selezionato.");
      expect(onSelectFileSpy).not.toHaveBeenCalled();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* DOWNLOAD FILE                                                              */
  /* -------------------------------------------------------------------------- */
  describe("downloadFile", () => {
    test("solleva errore se l'utente non è autenticato o se il token Google non è disponibile", async () => {
      mockAuthState.user = null;
      const { result } = renderHook(() => useGoogleDrive());

      await expect(
        result.current.downloadFile("file-1", "atto.pdf", "application/pdf")
      ).rejects.toThrow("Utente non autenticato.");

      mockAuthState.user = { uid: "usr_flv_2026" } as User;
      const { result: authResult } = renderHook(() => useGoogleDrive());

      await expect(
        authResult.current.downloadFile("file-1", "atto.pdf", "application/pdf")
      ).rejects.toThrow("Token Google Drive non disponibile.");
    });

    test("scarica il file dal backend di download cloud e restituisce un'istanza File valida", async () => {
      const { result } = renderHook(() => useGoogleDrive());

      // 1. Popola il token tramite openPicker
      let openPromise!: Promise<void>;
      act(() => {
        openPromise = result.current.openPicker(vi.fn());
      });
      await vi.waitFor(() => {
        expect(mockInitTokenClient).toHaveBeenCalled();
      });
      act(() => {
        tokenCallback?.({ access_token: "token_autenticato_valido" });
      });
      await act(async () => {
        await openPromise;
      });

      // 2. Simula download endpoint
      const mockBlob = new Blob(["contenuto binario file pdf"], { type: "application/pdf" });
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        status: 200,
        blob: vi.fn().mockResolvedValue(mockBlob),
      });

      let downloadedFile!: File;
      await act(async () => {
        downloadedFile = await result.current.downloadFile(
          "file-remote-123",
          "Atto_Notificato.pdf",
          "application/pdf"
        );
      });

      expect(mockFetchWithSecurity).toHaveBeenCalledWith(
        "https://api.jurio.it/cloud/download",
        {
          provider: "google",
          providerToken: "token_autenticato_valido",
          fileId: "file-remote-123",
        }
      );

      expect(downloadedFile).toBeInstanceOf(File);
      expect(downloadedFile.name).toBe("Atto_Notificato.pdf");
      expect(downloadedFile.type).toBe("application/pdf");
      expect(result.current.loading).toBe(false);
    });

    test("solleva eccezione e ripristina loading a false se il server risponde con errore HTTP", async () => {
      const { result } = renderHook(() => useGoogleDrive());

      let openPromise!: Promise<void>;
      act(() => {
        openPromise = result.current.openPicker(vi.fn());
      });
      await vi.waitFor(() => {
        expect(mockInitTokenClient).toHaveBeenCalled();
      });
      act(() => {
        tokenCallback?.({ access_token: "token_test" });
      });
      await act(async () => {
        await openPromise;
      });

      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue("File not found on Drive"),
      });

      await expect(
        act(async () => {
          await result.current.downloadFile("file-err", "file.pdf", "application/pdf");
        })
      ).rejects.toThrow("Download Google Drive fallito (404).");

      expect(result.current.loading).toBe(false);
    });
  });
});