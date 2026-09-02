import { describe, test, expect, vi, beforeEach } from "vitest";
import type { UserData } from "@/interfaces/interfaces";

/* ---------- hoisted mocks ---------- */
const {
  mockGetDb,
  mockGetStorageClient,
  mockToastError,
  mockGetAuth,
  mockDoc,
  mockGetDoc,
  mockSetDoc,
  mockDeleteDoc,
  mockCollection,
  mockQuery,
  mockWhere,
  mockGetDocs,
  mockRef,
  mockListAll,
  mockGetDownloadURL,
} = vi.hoisted(() => ({
  mockGetDb: vi.fn().mockResolvedValue("mock_db"),
  mockGetStorageClient: vi.fn().mockResolvedValue("mock_storage"),
  mockToastError: vi.fn(),
  mockGetAuth: vi.fn(),
  mockDoc: vi.fn((_db: unknown, ...pathSegments: string[]) => pathSegments.join("/")),
  mockGetDoc: vi.fn(),
  mockSetDoc: vi.fn().mockResolvedValue(undefined),
  mockDeleteDoc: vi.fn().mockResolvedValue(undefined),
  mockCollection: vi.fn((_db: unknown, ...pathSegments: string[]) => pathSegments.join("/")),
  mockQuery: vi.fn((col: unknown) => col),
  mockWhere: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  mockGetDocs: vi.fn(),
  mockRef: vi.fn((_storage: unknown, path: string) => path),
  mockListAll: vi.fn().mockResolvedValue({ items: [] }),
  mockGetDownloadURL: vi.fn().mockResolvedValue("https://example.com/file.json"),
}));

/* ---------- mock modules ---------- */
vi.mock("@/services/db", () => ({
  getDb: () => mockGetDb(),
}));

vi.mock("@/services/storageClient", () => ({
  getStorageClient: () => mockGetStorageClient(),
}));

vi.mock("react-hot-toast", () => ({
  toast: {
    error: (msg: string) => mockToastError(msg),
  },
}));

vi.mock("firebase/auth", () => ({
  getAuth: () => mockGetAuth(),
}));

vi.mock("firebase/firestore", () => ({
  doc: (_db: unknown, ...pathSegments: string[]) => mockDoc(_db, ...pathSegments),
  getDoc: (ref: unknown) => mockGetDoc(ref),
  setDoc: (ref: unknown, data: unknown, options: unknown) => mockSetDoc(ref, data, options),
  deleteDoc: (ref: unknown) => mockDeleteDoc(ref),
  collection: (_db: unknown, ...pathSegments: string[]) => mockCollection(_db, ...pathSegments),
  query: (col: unknown) => mockQuery(col),
  where: (field: string, op: string, val: unknown) => mockWhere(field, op, val),
  getDocs: (queryRef: unknown) => mockGetDocs(queryRef),
}));

vi.mock("firebase/storage", () => ({
  ref: (storage: unknown, path: string) => mockRef(storage, path),
  listAll: (ref: unknown) => mockListAll(ref),
  getDownloadURL: (ref: unknown) => mockGetDownloadURL(ref),
}));

/* ---------- subject under test ---------- */
import {
  userExists,
  getUser,
  saveUserData,
  deleteUser,
  getRegisterPlanId,
  fetchRegisterDoc,
  exportUserData,
} from "@/services/user";

describe("User Service Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("userExists", () => {
    test("restituisce true se il documento utente esiste", async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => true });
      const exists = await userExists("user_123");
      expect(exists).toBe(true);
      expect(mockGetDoc).toHaveBeenCalledTimes(1);
    });

    test("restituisce false se il documento utente non esiste", async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      const exists = await userExists("user_123");
      expect(exists).toBe(false);
    });
  });

  describe("getUser", () => {
    test("restituisce i dati dell'utente", async () => {
      const mockUserData = { email: "test@example.com" };
      mockGetDoc.mockResolvedValueOnce({ data: () => mockUserData });

      const data = await getUser("user_123");
      expect(data).toEqual(mockUserData);
    });
  });

  describe("saveUserData", () => {
    test("lancia un errore se l'uid è mancante", async () => {
      await expect(saveUserData("", {} as UserData)).rejects.toThrow("UID mancante");
    });

    test("salva i dati utente con merge", async () => {
      const mockData = { name: "Flavio" } as unknown as UserData;
      await saveUserData("user_123", mockData);

      expect(mockSetDoc).toHaveBeenCalledWith("users/user_123", mockData, { merge: true });
    });
  });

  describe("deleteUser", () => {
    test("lancia un errore se l'utente non è autenticato", async () => {
      mockGetAuth.mockReturnValueOnce({ currentUser: null });

      await expect(deleteUser("user_123")).rejects.toThrow("Utente non autenticato.");
    });

    test("lancia un errore se l'uid corrente non corrisponde all'uid da eliminare", async () => {
      mockGetAuth.mockReturnValueOnce({ currentUser: { uid: "other_user" } });

      await expect(deleteUser("user_123")).rejects.toThrow(
        "Non puoi eliminare un account diverso da quello autenticato."
      );
    });

    test("blocca la cancellazione se l'utente appartiene a un team", async () => {
      mockGetAuth.mockReturnValueOnce({ currentUser: { uid: "user_123" } });
      mockGetDocs.mockResolvedValueOnce({
        docs: [{ id: "team_1" }],
      }).mockResolvedValueOnce({
        docs: [],
      });

      await expect(deleteUser("user_123")).rejects.toThrow(
        "ACCOUNT_DELETION_BLOCKED_BY_TEAM_MEMBERSHIP"
      );
      expect(mockToastError).toHaveBeenCalledWith(
        "Prima di eliminare il tuo account devi uscire da tutti i team di cui fai parte."
      );
    });

    test("elimina correttamente chats, fascicoli, chunks, documenti e sottocollezioni quando non ci sono team", async () => {
      mockGetAuth.mockReturnValueOnce({ currentUser: { uid: "user_123" } });
      
      mockGetDocs.mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({
          docs: [{ ref: "chat_ref_1", docs: [] }],
        })
        .mockResolvedValueOnce({
          docs: [{ ref: "msg_ref_1" }],
        })
        .mockResolvedValueOnce({
          docs: [{ ref: "fascicolo_ref_1" }],
        })
        .mockResolvedValueOnce({
          docs: [{ ref: "thread_ref_1" }],
        })
        .mockResolvedValueOnce({
          docs: [{ ref: "thread_msg_ref_1" }],
        })
        .mockResolvedValueOnce({
          docs: [{ ref: "chunk_ref_1" }],
        })
        .mockResolvedValueOnce({
          docs: [{ ref: "doc_ref_1" }],
        })
        .mockResolvedValueOnce({
          docs: [{ ref: "term_ref_1" }],
        })
        .mockResolvedValueOnce({
          docs: [{ ref: "saved_ref_1" }],
        });

      await expect(deleteUser("user_123")).resolves.not.toThrow();
      expect(mockDeleteDoc).toHaveBeenCalled();
    });
  });

  describe("getRegisterPlanId", () => {
    test("restituisce planId se il documento register esiste", async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ planId: "premium" }),
      });

      const planId = await getRegisterPlanId("user_123");
      expect(planId).toBe("premium");
    });

    test("restituisce stringa vuota se il documento non esiste o planId non è stringa", async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const planId = await getRegisterPlanId("user_123");
      expect(planId).toBe("");
    });
  });

  describe("fetchRegisterDoc", () => {
    test("restituisce il documento di register se esiste", async () => {
      const mockRegDoc = { planId: "free" };
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => mockRegDoc,
      });

      const result = await fetchRegisterDoc("user_123");
      expect(result).toEqual(mockRegDoc);
    });

    test("restituisce null se il documento non esiste", async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await fetchRegisterDoc("user_123");
      expect(result).toBeNull();
    });
  });

  describe("exportUserData", () => {
    test("raccoglie i dati, crea il blob JSON e scarica i file dallo storage", async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ name: "Flavio" }),
      });

      mockGetDocs
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] });

      mockListAll.mockResolvedValueOnce({
        items: [{ name: "doc1.pdf" }],
      }).mockResolvedValueOnce({
        items: [],
      });

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        blob: () => Promise.resolve(new Blob(["file data"])),
      });

      const appendChildSpy = vi.spyOn(document.body, "appendChild").mockImplementation(() => document.createElement("div"));
      const removeChildSpy = vi.spyOn(document.body, "removeChild").mockImplementation(() => document.createElement("div"));

      await exportUserData("user_123");

      expect(mockGetStorageClient).toHaveBeenCalledTimes(1);
      expect(mockGetDownloadURL).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();

      global.fetch = originalFetch;
    });
  });
});