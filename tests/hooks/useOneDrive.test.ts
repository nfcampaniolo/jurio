import { describe, test, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";

/* ---------- hoisted mocks ---------- */
const {
  mockMsalInitialize,
  mockMsalLoginPopup,
  mockAuthState,
  mockToast,
  mockFetchWithSecurity,
} = vi.hoisted(() => ({
  mockMsalInitialize: vi.fn().mockResolvedValue(undefined),
  mockMsalLoginPopup: vi.fn(),
  mockAuthState: {
    user: null as User | null,
  },
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  mockFetchWithSecurity: vi.fn(),
}));

/* ---------- mock modules ---------- */
vi.mock("@azure/msal-browser", () => {
  class MockPublicClientApplication {
    initialize = mockMsalInitialize;
    loginPopup = mockMsalLoginPopup;
  }

  return {
    __esModule: true,
    PublicClientApplication: MockPublicClientApplication,
  };
});

vi.mock("@/context/useAuth", () => ({
  __esModule: true,
  useAuth: () => mockAuthState,
}));

vi.mock("react-hot-toast", () => ({
  toast: mockToast,
}));

vi.mock("@/config/apiClient", () => ({
  __esModule: true,
  fetchWithSecurity: (...args: unknown[]) => mockFetchWithSecurity(...args),
}));

/* ---------- subject under test ---------- */
import { useOneDrive, type OneDriveFile } from "@/hooks/useOneDrive";

describe("useOneDrive Hook Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthState.user = { uid: "usr_flv_2026" } as User;
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("Inizializzazione e Stato Autenticazione", () => {
    test("istanzia il client e invoca initialize() al mount", () => {
      const { result } = renderHook(() => useOneDrive());

      expect(mockMsalInitialize).toHaveBeenCalledTimes(1);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.files).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });

    test("riflette isAuthenticated solo quando sia l'utente app che il token Microsoft sono presenti", async () => {
      mockMsalLoginPopup.mockResolvedValueOnce({
        accessToken: "ms_graph_token_valid",
      });
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({ files: [] }),
      });

      const { result, rerender } = renderHook(() => useOneDrive());

      expect(result.current.isAuthenticated).toBe(false);

      await act(async () => {
        await result.current.authenticate();
      });

      expect(result.current.isAuthenticated).toBe(true);

      mockAuthState.user = null;
      rerender();

      expect(result.current.isAuthenticated).toBe(false);
    });
  });

  describe("Workflow Autenticazione Microsoft (authenticate)", () => {
    test("completa il loginPopup con gli scope corretti e mostra toast di successo", async () => {
      mockMsalLoginPopup.mockResolvedValueOnce({
        accessToken: "ms_access_token_123",
      });
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({ files: [] }),
      });

      const { result } = renderHook(() => useOneDrive());

      await act(async () => {
        await result.current.authenticate();
      });

      expect(mockMsalLoginPopup).toHaveBeenCalledWith({
        scopes: ["Files.Read", "Sites.Read.All"],
      });
      expect(mockToast.success).toHaveBeenCalledWith("OneDrive connesso con successo!");
      expect(result.current.error).toBeNull();
    });

    test("intercetta risposta popup priva di accessToken impostando l'errore", async () => {
      mockMsalLoginPopup.mockResolvedValueOnce({
        accessToken: null,
      });

      const { result } = renderHook(() => useOneDrive());

      await act(async () => {
        await result.current.authenticate();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBe("Impossibile ottenere il token di accesso Microsoft.");
      expect(mockToast.error).toHaveBeenCalledWith("Impossibile ottenere il token di accesso Microsoft.");
    });

    test("gestisce eccezione durante il login popup (es. popup chiuso dall'utente)", async () => {
      mockMsalLoginPopup.mockRejectedValueOnce(new Error("User cancelled the flow."));

      const { result } = renderHook(() => useOneDrive());

      await act(async () => {
        await result.current.authenticate();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.error).toBe("User cancelled the flow.");
      expect(mockToast.error).toHaveBeenCalledWith("User cancelled the flow.");
    });
  });

  describe("Elenco File (fetchFiles)", () => {
    test("invoca automaticamente fetchFiles al recupero del token Microsoft", async () => {
      const sampleFiles: OneDriveFile[] = [
        {
          id: "one-1",
          name: "Contratto_Locazione.docx",
          mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
        { id: "one-2", name: "Ricorso_Tribunale.pdf", mimeType: "application/pdf" },
      ];

      mockMsalLoginPopup.mockResolvedValueOnce({
        accessToken: "token_for_files",
      });

      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({ files: sampleFiles }),
      });

      const { result } = renderHook(() => useOneDrive());

      await act(async () => {
        await result.current.authenticate();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockFetchWithSecurity).toHaveBeenCalledWith("/api/listCloudFiles", {
        provider: "microsoft",
        providerToken: "token_for_files",
      });
      expect(result.current.files).toEqual(sampleFiles);
      expect(result.current.error).toBeNull();
    });

    test("ignora la chiamata fetchFiles se l'utente o il token sono assenti", async () => {
      const { result } = renderHook(() => useOneDrive());

      await act(async () => {
        await result.current.fetchFiles();
      });

      expect(mockFetchWithSecurity).not.toHaveBeenCalled();
      expect(result.current.loading).toBe(false);
    });

    test("solleva errore se l'endpoint risponde con Content-Type diverso da JSON", async () => {
      mockMsalLoginPopup.mockResolvedValueOnce({
        accessToken: "token_abc",
      });

      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "text/html" }),
      });

      const { result } = renderHook(() => useOneDrive());

      await act(async () => {
        await result.current.authenticate();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe("Il server ha risposto in modo anomalo.");
      expect(mockToast.error).toHaveBeenCalledWith("Il server ha risposto in modo anomalo.");
    });

    test("gestisce errore HTTP dal server (res.ok: false) durante il recupero file", async () => {
      mockMsalLoginPopup.mockResolvedValueOnce({
        accessToken: "token_xyz",
      });

      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: false,
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({}),
      });

      const { result } = renderHook(() => useOneDrive());

      await act(async () => {
        await result.current.authenticate();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe("Impossibile recuperare i file da OneDrive.");
      expect(mockToast.error).toHaveBeenCalledWith("Impossibile recuperare i file da OneDrive.");
    });
  });

  describe("Download File (downloadFile)", () => {
    test("solleva errore se richiamato senza aver prima effettuato l'autenticazione", async () => {
      const { result } = renderHook(() => useOneDrive());

      await expect(
        result.current.downloadFile("file-10", "memoria.pdf", "application/pdf")
      ).rejects.toThrow("Devi autenticarti prima di poter scaricare un file.");
    });

    test("esegue il download del file e restituisce un'istanza File valida", async () => {
      mockMsalLoginPopup.mockResolvedValueOnce({
        accessToken: "valid_download_token",
      });
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({ files: [] }),
      });

      const { result } = renderHook(() => useOneDrive());

      await act(async () => {
        await result.current.authenticate();
      });

      const mockBlob = new Blob(["contenuto binario onedrive"], { type: "application/pdf" });
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        blob: vi.fn().mockResolvedValue(mockBlob),
      });

      let downloadedFile: File | undefined;
      await act(async () => {
        downloadedFile = await result.current.downloadFile(
          "file-one-99",
          "Atto_Giudiziario.pdf",
          "application/pdf"
        );
      });

      expect(mockFetchWithSecurity).toHaveBeenCalledWith("/api/downloadCloudFile", {
        provider: "microsoft",
        providerToken: "valid_download_token",
        fileId: "file-one-99",
      });

      expect(downloadedFile).toBeInstanceOf(File);
      expect(downloadedFile?.name).toBe("Atto_Giudiziario.pdf");
      expect(downloadedFile?.type).toBe("application/pdf");
    });

    test("solleva errore se l'endpoint di download risponde con esito non-ok", async () => {
      mockMsalLoginPopup.mockResolvedValueOnce({
        accessToken: "valid_token",
      });
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        headers: new Headers({ "content-type": "application/json" }),
        json: vi.fn().mockResolvedValue({ files: [] }),
      });

      const { result } = renderHook(() => useOneDrive());

      await act(async () => {
        await result.current.authenticate();
      });

      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      await expect(
        act(async () => {
          await result.current.downloadFile("file-err", "doc.pdf", "application/pdf");
        })
      ).rejects.toThrow("Impossibile scaricare il file dal cloud.");
    });
  });
});