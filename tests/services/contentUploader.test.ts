import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

/* ---------- hoisted mocks ---------- */
const {
  mockGetAdminUrl,
  mockGetSecurityTokens,
} = vi.hoisted(() => ({
  mockGetAdminUrl: vi.fn(),
  mockGetSecurityTokens: vi.fn().mockResolvedValue({
    authToken: "mock_auth_token",
    appCheckToken: "mock_app_check_token",
  }),
}));

/* ---------- mock modules ---------- */
vi.mock("@/config/env", () => ({
  getAdminUrl: () => mockGetAdminUrl(),
}));

vi.mock("@/services/security", () => ({
  getSecurityTokens: () => mockGetSecurityTokens(),
}));

/* ---------- subject under test ---------- */
import {
  executeAdminMaintenanceTask,
  executeAdminMergeCategoryTask,
  useContentUploader,
} from "@/services/admin";

describe("Admin Maintenance & Content Uploader Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("executeAdminMaintenanceTask", () => {
    test("lancia errore se l'endpoint di manutenzione non è configurato", async () => {
      mockGetAdminUrl.mockReturnValue({});

      await expect(executeAdminMaintenanceTask({})).rejects.toThrow(
        "Endpoint manutenzione non configurato"
      );
    });

    test("lancia errore se la risposta API non è ok", async () => {
      mockGetAdminUrl.mockReturnValue({
        ADMIN_MAINTENANCE_TASK_ENDPOINT: "https://api.jurio.it/maintenance",
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: vi.fn().mockResolvedValue({ error: "Bad Request" }),
      });

      await expect(executeAdminMaintenanceTask({})).rejects.toThrow("Bad Request");
    });

    test("lancia errore se il body della risposta non contiene uno stream", async () => {
      mockGetAdminUrl.mockReturnValue({
        ADMIN_MAINTENANCE_TASK_ENDPOINT: "https://api.jurio.it/maintenance",
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: null,
      });

      await expect(executeAdminMaintenanceTask({})).rejects.toThrow(
        "La risposta non contiene uno stream decodificabile."
      );
    });

    test("elabora correttamente lo stream SSE e invoca onProgress", async () => {
      mockGetAdminUrl.mockReturnValue({
        ADMIN_MAINTENANCE_TASK_ENDPOINT: "https://api.jurio.it/maintenance",
      });

      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode("data: {\"step\": 1, \"message\": \"In progress\"}\n\n"));
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: stream,
      });

      const onProgress = vi.fn();
      await executeAdminMaintenanceTask({}, onProgress);

      expect(onProgress).toHaveBeenCalledWith({ step: 1, message: "In progress" });
    });
  });

  describe("executeAdminMergeCategoryTask", () => {
    test("lancia errore se l'endpoint di sostituzione non è configurato", async () => {
      mockGetAdminUrl.mockReturnValue({});

      await expect(executeAdminMergeCategoryTask("Vecchia", "Nuova")).rejects.toThrow(
        "Endpoint sostituzione tassonomia non configurato"
      );
    });

    test("esegue con successo il merge delle categorie", async () => {
      mockGetAdminUrl.mockReturnValue({
        ADMIN_SUBSTITUTION_TASK_ENDPOINT: "https://api.jurio.it/merge",
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true, message: "Merge completato" }),
      });

      const res = await executeAdminMergeCategoryTask("Vecchia", "Nuova");
      expect(res).toEqual({ success: true, message: "Merge completato" });
    });

    test("lancia errore se la risposta API fallisce", async () => {
      mockGetAdminUrl.mockReturnValue({
        ADMIN_SUBSTITUTION_TASK_ENDPOINT: "https://api.jurio.it/merge",
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: vi.fn().mockResolvedValue({ error: "Internal Server Error" }),
      });

      await expect(executeAdminMergeCategoryTask("Vecchia", "Nuova")).rejects.toThrow(
        "Internal Server Error"
      );
    });
  });

  describe("useContentUploader Hook", () => {
    test("inizializza gli stati correttamente", () => {
      const { result } = renderHook(() => useContentUploader());

      expect(result.current.id).toBe("");
      expect(result.current.text).toBe("");
      expect(result.current.linksText).toBe("");
      expect(result.current.images).toBe("");
      expect(result.current.status).toBe("idle");
      expect(result.current.errorMessage).toBe("");
    });

    test("blocca l'upload se mancano i campi obbligatori (es. ID)", async () => {
      const { result } = renderHook(() => useContentUploader());

      await act(async () => {
        await result.current.handleUpload();
      });

      expect(result.current.status).toBe("error");
      expect(result.current.errorMessage).toBe("Il campo ID è obbligatorio.");
    });

    test("esegue con successo l'upload del contenuto e resetta i campi dopo il timeout", async () => {
      mockGetAdminUrl.mockReturnValue({
        ADMIN_CONTENT_UPLOAD_ENDPOINT: "https://api.jurio.it/upload",
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ success: true }),
      });

      const { result } = renderHook(() => useContentUploader());

      act(() => {
        result.current.setId("doc_001");
        result.current.setText("Testo di prova");
        result.current.setLinksText("https://link1.it");
        result.current.setImages("https://img1.it/image.png");
      });

      await act(async () => {
        await result.current.handleUpload();
      });

      expect(result.current.status).toBe("success");

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(result.current.status).toBe("idle");
      expect(result.current.id).toBe("");
      expect(result.current.text).toBe("");
    });

    test("gestisce errori restituiti dall'API durante l'upload", async () => {
      mockGetAdminUrl.mockReturnValue({
        ADMIN_CONTENT_UPLOAD_ENDPOINT: "https://api.jurio.it/upload",
      });

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: vi.fn().mockResolvedValue({ error: "Accesso negato" }),
      });

      const { result } = renderHook(() => useContentUploader());

      act(() => {
        result.current.setId("doc_001");
        result.current.setText("Testo di prova");
        result.current.setLinksText("https://link1.it");
        result.current.setImages("https://img1.it/image.png");
      });

      await act(async () => {
        await result.current.handleUpload();
      });

      expect(result.current.status).toBe("error");
      expect(result.current.errorMessage).toBe("Accesso negato");
    });
  });
});