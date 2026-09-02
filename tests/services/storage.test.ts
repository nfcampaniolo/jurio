import { describe, test, expect, vi, beforeEach } from "vitest";
import { FirebaseError } from "firebase/app";

/* ---------- hoisted mocks ---------- */
const {
  mockGetStorageClient,
  mockRef,
  mockUploadBytes,
  mockGetDownloadURL,
  mockListAll,
  mockDeleteObject,
} = vi.hoisted(() => ({
  mockGetStorageClient: vi.fn().mockResolvedValue("mock_storage"),
  mockRef: vi.fn((_storage: unknown, path: string) => path),
  mockUploadBytes: vi.fn().mockResolvedValue(undefined),
  mockGetDownloadURL: vi.fn().mockResolvedValue("https://example.com/file.jpg"),
  mockListAll: vi.fn().mockResolvedValue({ items: [] }),
  mockDeleteObject: vi.fn().mockResolvedValue(undefined),
}));

/* ---------- mock modules ---------- */
vi.mock("@/services/storageClient", () => ({
  getStorageClient: () => mockGetStorageClient(),
}));

vi.mock("firebase/app", () => ({
  FirebaseError: class FirebaseError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock("firebase/storage", () => ({
  ref: (storage: unknown, path: string) => mockRef(storage, path),
  uploadBytes: (ref: unknown, file: unknown) => mockUploadBytes(ref, file),
  getDownloadURL: (ref: unknown) => mockGetDownloadURL(ref),
  listAll: (ref: unknown) => mockListAll(ref),
  deleteObject: (ref: unknown) => mockDeleteObject(ref),
}));

/* ---------- subject under test ---------- */
import {
  uploadAvatar,
  loadSentence,
  deleteAccountFolder,
  getDocumentStorage,
  deleteDocumentStorage,
  getAvatar,
} from "@/services/storage";

describe("Storage Service Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("uploadAvatar", () => {
    test("carica il file dell'avatar e restituisce l'URL di download", async () => {
      const mockFile = {} as unknown as File;
      const url = await uploadAvatar(mockFile, "user_123");

      expect(mockGetStorageClient).toHaveBeenCalledTimes(1);
      expect(mockRef).toHaveBeenCalledWith("mock_storage", "users/user_123/image.jpeg");
      expect(mockUploadBytes).toHaveBeenCalledWith("users/user_123/image.jpeg", mockFile);
      expect(mockGetDownloadURL).toHaveBeenCalledWith("users/user_123/image.jpeg");
      expect(url).toBe("https://example.com/file.jpg");
    });
  });

  describe("loadSentence", () => {
    test("carica il file della sentenza nella collezione specificata e restituisce l'URL", async () => {
      const mockFile = {} as unknown as File;
      const url = await loadSentence(mockFile, "user_123", "sentences_pdf");

      expect(mockRef).toHaveBeenCalledWith("mock_storage", "sentences_pdf/user_123.pdf");
      expect(mockUploadBytes).toHaveBeenCalledWith("sentences_pdf/user_123.pdf", mockFile);
      expect(url).toBe("https://example.com/file.jpg");
    });
  });

  describe("deleteAccountFolder", () => {
    test("svuota ed elimina i file nelle cartelle dell'utente", async () => {
      const mockItemRef1 = "item_1";
      const mockItemRef2 = "item_2";
      mockListAll.mockResolvedValueOnce({
        items: [mockItemRef1],
      }).mockResolvedValueOnce({
        items: [mockItemRef2],
      });

      await deleteAccountFolder("user_123");

      expect(mockListAll).toHaveBeenCalledTimes(2);
      expect(mockDeleteObject).toHaveBeenCalledTimes(2);
      expect(mockDeleteObject).toHaveBeenCalledWith(mockItemRef1);
      expect(mockDeleteObject).toHaveBeenCalledWith(mockItemRef2);
    });

    test("gestisce e ignora gli errori se una cartella non esiste o fallisce", async () => {
      mockListAll.mockRejectedValueOnce(new Error("Folder not found"));

      await expect(deleteAccountFolder("user_123")).resolves.not.toThrow();
    });
  });

  describe("getDocumentStorage", () => {
    test("restituisce l'URL del documento se esiste", async () => {
      const url = await getDocumentStorage("doc_1", "sentences");
      expect(url).toBe("https://example.com/file.jpg");
      expect(mockRef).toHaveBeenCalledWith("mock_storage", "sentences/doc_1.pdf");
    });

    test("restituisce null se il file non viene trovato (storage/object-not-found)", async () => {
      mockGetDownloadURL.mockRejectedValueOnce(
        new FirebaseError("storage/object-not-found", "Not found")
      );

      const url = await getDocumentStorage("missing_doc", "sentences");
      expect(url).toBeNull();
    });

    test("propaga altri errori Firebase o generici", async () => {
      const otherError = new FirebaseError("storage/unauthorized", "Unauthorized");
      mockGetDownloadURL.mockRejectedValueOnce(otherError);

      await expect(getDocumentStorage("doc_1", "sentences")).rejects.toThrow(otherError);
    });
  });

  describe("deleteDocumentStorage", () => {
    test("elimina con successo il documento dallo storage", async () => {
      await deleteDocumentStorage("doc_1", "sentences");
      expect(mockDeleteObject).toHaveBeenCalledWith("sentences/doc_1.pdf");
    });

    test("ignora l'errore se il file non esiste (storage/object-not-found)", async () => {
      mockDeleteObject.mockRejectedValueOnce(
        new FirebaseError("storage/object-not-found", "Not found")
      );

      await expect(deleteDocumentStorage("missing_doc", "sentences")).resolves.not.toThrow();
    });

    test("lancia un errore con il messaggio Firebase se si verifica un altro errore Firebase", async () => {
      mockDeleteObject.mockRejectedValueOnce(
        new FirebaseError("storage/unauthorized", "Access denied")
      );

      await expect(deleteDocumentStorage("doc_1", "sentences")).rejects.toThrow("Access denied");
    });

    test("lancia un errore generico se si verifica un errore sconosciuto", async () => {
      mockDeleteObject.mockRejectedValueOnce("some unknown error");

      await expect(deleteDocumentStorage("doc_1", "sentences")).rejects.toThrow(
        "Errore sconosciuto durante l'eliminazione del file"
      );
    });
  });

  describe("getAvatar", () => {
    test("restituisce l'URL dell'avatar se il recupero ha successo", async () => {
      const avatarUrl = await getAvatar("user_123");
      expect(avatarUrl).toBe("https://example.com/file.jpg");
      expect(mockRef).toHaveBeenCalledWith("mock_storage", "users/user_123/image_1080x1080.jpeg");
    });

    test("restituisce il DEFAULT_AVATAR se si verifica un errore nel recupero", async () => {
      mockGetDownloadURL.mockRejectedValueOnce(new Error("Avatar not found"));

      const avatarUrl = await getAvatar("user_123");
      expect(avatarUrl).toBe("https://jurio-it.web.app/image.png");
    });
  });
});