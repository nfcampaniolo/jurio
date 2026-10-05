import { describe, test, expect, vi, beforeEach } from "vitest";
import type { UserData, RegisterDoc } from "@/interfaces/interfaces";

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
vi.mock("@/infrastructure/db", () => ({
  getDb: () => mockGetDb(),
}));

vi.mock("@/infrastructure/storageClient", () => ({
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
} from "@/shared/services/user";

describe("User Service Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Mock delle API URL per JSDOM / Node
    global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
    global.URL.revokeObjectURL = vi.fn();
  });

  describe("userExists", () => {
    test("restituisce true se il documento esiste e tutti i campi anagrafici essenziali sono valorizzati", async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          email: "nicoloflavio@example.com",
          name: "Flavio",
          surname: "Campaniolo",
        }),
      });

      const exists = await userExists("user_123");
      expect(exists).toBe(true);
      expect(mockGetDoc).toHaveBeenCalledTimes(1);
    });

    test("restituisce false se il documento esiste ma mancano campi anagrafici (profilo non completato)", async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          email: "nicoloflavio@example.com",
          name: "Flavio",
          surname: "", // Cognome vuoto
        }),
      });

      const exists = await userExists("user_123");
      expect(exists).toBe(false);
    });

    test("restituisce false se il documento utente non esiste su Firestore", async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
        data: () => null,
      });

      const exists = await userExists("user_123");
      expect(exists).toBe(false);
    });
  });

  describe("getUser", () => {
    test("restituisce i dati completi dell'utente", async () => {
      const mockUserData: Partial<UserData> = {
        email: "nicoloflavio@example.com",
        name: "Flavio",
      };
      mockGetDoc.mockResolvedValueOnce({ data: () => mockUserData });

      const data = await getUser("user_123");
      expect(data).toEqual(mockUserData);
    });
  });

  describe("saveUserData", () => {
    test("lancia un errore se l'uid passato è una stringa vuota", async () => {
      await expect(saveUserData("", {} as UserData)).rejects.toThrow("UID mancante");
    });

    test("salva o aggiorna i dati utente con l'opzione merge abilitata", async () => {
      const mockData = { name: "Flavio" } as unknown as UserData;
      await saveUserData("user_123", mockData);

      expect(mockSetDoc).toHaveBeenCalledWith("users/user_123", mockData, { merge: true });
    });
  });

  describe("deleteUser", () => {
    test("lancia un errore se l'utente non è autenticato in sessione", async () => {
      mockGetAuth.mockReturnValueOnce({ currentUser: null });

      await expect(deleteUser("user_123")).rejects.toThrow("Utente non autenticato.");
    });

    test("lancia un errore se l'uid dell'utente autenticato non corrisponde al target", async () => {
      mockGetAuth.mockReturnValueOnce({ currentUser: { uid: "different_uid" } });

      await expect(deleteUser("user_123")).rejects.toThrow(
        "Non puoi eliminare un account diverso da quello autenticato."
      );
    });

    test("blocca la cancellazione se l'utente risulta membro di un team (member_ids)", async () => {
      mockGetAuth.mockReturnValueOnce({ currentUser: { uid: "user_123" } });
      mockGetDocs
        .mockResolvedValueOnce({ docs: [{ id: "team_member_1" }] }) // member_ids
        .mockResolvedValueOnce({ docs: [] }); // owners

      await expect(deleteUser("user_123")).rejects.toThrow(
        "ACCOUNT_DELETION_BLOCKED_BY_TEAM_MEMBERSHIP"
      );
      expect(mockToastError).toHaveBeenCalledWith(
        "Prima di eliminare il tuo account devi uscire da tutti i team di cui fai parte."
      );
    });

    test("blocca la cancellazione se l'utente risulta owner di un team (owners)", async () => {
      mockGetAuth.mockReturnValueOnce({ currentUser: { uid: "user_123" } });
      mockGetDocs
        .mockResolvedValueOnce({ docs: [] }) // member_ids
        .mockResolvedValueOnce({ docs: [{ id: "team_owner_1" }] }); // owners

      await expect(deleteUser("user_123")).rejects.toThrow(
        "ACCOUNT_DELETION_BLOCKED_BY_TEAM_MEMBERSHIP"
      );
      expect(mockToastError).toHaveBeenCalledWith(
        "Prima di eliminare il tuo account devi uscire da tutti i team di cui fai parte."
      );
    });

    test("elimina a cascata tutte le entità correlate e il documento utente", async () => {
      const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      mockGetAuth.mockReturnValueOnce({ currentUser: { uid: "user_123" } });

      mockGetDocs
        .mockResolvedValueOnce({ docs: [] }) // team member_ids
        .mockResolvedValueOnce({ docs: [] }) // team owners
        .mockResolvedValueOnce({ docs: [{ ref: "chat_ref_1" }] }) // chats
        .mockResolvedValueOnce({ docs: [{ ref: "msg_ref_1" }] }) // chat messages
        .mockResolvedValueOnce({ docs: [{ ref: "fascicolo_ref_1" }] }) // fascicoli
        .mockResolvedValueOnce({ docs: [{ ref: "thread_ref_1" }] }) // threads
        .mockResolvedValueOnce({ docs: [{ ref: "thread_msg_ref_1" }] }) // thread messages
        .mockResolvedValueOnce({ docs: [{ ref: "chunk_ref_1" }] }) // document_chunks
        .mockResolvedValueOnce({ docs: [{ ref: "doc_ref_1" }] }) // documents
        .mockResolvedValueOnce({ docs: [{ ref: "term_ref_1" }] }) // search_terms
        .mockResolvedValueOnce({ docs: [{ ref: "saved_ref_1" }] }); // savedSentenze

      await expect(deleteUser("user_123")).resolves.not.toThrow();

      // Verifica eliminazioni mirate
      expect(mockDeleteDoc).toHaveBeenCalledWith("msg_ref_1");
      expect(mockDeleteDoc).toHaveBeenCalledWith("chat_ref_1");
      expect(mockDeleteDoc).toHaveBeenCalledWith("thread_msg_ref_1");
      expect(mockDeleteDoc).toHaveBeenCalledWith("thread_ref_1");
      expect(mockDeleteDoc).toHaveBeenCalledWith("fascicolo_ref_1");
      expect(mockDeleteDoc).toHaveBeenCalledWith("chunk_ref_1");
      expect(mockDeleteDoc).toHaveBeenCalledWith("doc_ref_1");
      expect(mockDeleteDoc).toHaveBeenCalledWith("term_ref_1");
      expect(mockDeleteDoc).toHaveBeenCalledWith("saved_ref_1");
      expect(mockDeleteDoc).toHaveBeenCalledWith("users/user_123");

      consoleLogSpy.mockRestore();
    });
  });

  describe("getRegisterPlanId", () => {
    test("restituisce planId quando presente ed è una stringa valida", async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ planId: "professional" }),
      });

      const planId = await getRegisterPlanId("user_123");
      expect(planId).toBe("professional");
    });

    test("restituisce stringa vuota se il documento non esiste", async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });

      const planId = await getRegisterPlanId("user_123");
      expect(planId).toBe("");
    });

    test("restituisce stringa vuota se planId è di tipo non stringa o mancante", async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ planId: 100 }),
      });

      const planId = await getRegisterPlanId("user_123");
      expect(planId).toBe("");
    });
  });

  describe("fetchRegisterDoc", () => {
    test("restituisce il documento di register tipizzato", async () => {
      const mockRegDoc: RegisterDoc = {
        planId: "enterprise",
        createdAt: "2026-01-01",
      } as unknown as RegisterDoc;

      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => mockRegDoc,
      });

      const result = await fetchRegisterDoc("user_123");
      expect(result).toEqual(mockRegDoc);
    });

    test("restituisce null se il record register non esiste", async () => {
      mockGetDoc.mockResolvedValueOnce({ exists: () => false });

      const result = await fetchRegisterDoc("user_123");
      expect(result).toBeNull();
    });
  });

  describe("exportUserData", () => {
    test("raccoglie le collezioni e i file storage, innescando i relativi download", async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ name: "Flavio", email: "nicoloflavio@example.com" }),
      });

      // Mock collezioni annidate (1 chat con 1 messaggio)
      mockGetDocs
        .mockResolvedValueOnce({
          docs: [
            {
              id: "chat_01",
              ref: "chats/chat_01",
              data: () => ({ title: "Chat preliminare" }),
            },
          ],
        })
        .mockResolvedValueOnce({
          docs: [
            {
              id: "msg_01",
              data: () => ({ content: "Richiesta perizia" }),
            },
          ],
        })
        .mockResolvedValueOnce({ docs: [] }) // fascicoli
        .mockResolvedValueOnce({ docs: [] }) // documents
        .mockResolvedValueOnce({ docs: [] }) // document_chunks
        .mockResolvedValueOnce({ docs: [] }); // teams

      // Storage mock: 1 file nella prima cartella, 0 nella seconda
      mockListAll
        .mockResolvedValueOnce({
          items: [{ name: "documento_identita.pdf" }],
        })
        .mockResolvedValueOnce({
          items: [],
        });

      const originalFetch = global.fetch;
      global.fetch = vi.fn().mockResolvedValue({
        blob: () => Promise.resolve(new Blob(["mock file content"])),
      });

      const appendChildSpy = vi
        .spyOn(document.body, "appendChild")
        .mockImplementation(() => document.createElement("a"));
      const removeChildSpy = vi
        .spyOn(document.body, "removeChild")
        .mockImplementation(() => document.createElement("a"));

      await exportUserData("user_123");

      expect(mockGetStorageClient).toHaveBeenCalledTimes(1);
      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(mockGetDownloadURL).toHaveBeenCalled();
      expect(appendChildSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalled();
      expect(global.URL.revokeObjectURL).toHaveBeenCalled();

      global.fetch = originalFetch;
    });

    test("completa l'export del JSON anche se lo scaricamento da Storage fallisce", async () => {
      const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      mockGetDoc.mockResolvedValueOnce({ exists: () => false });
      mockGetDocs
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] });

      mockListAll.mockRejectedValueOnce(new Error("Storage bucket non raggiungibile"));

      await expect(exportUserData("user_123")).resolves.not.toThrow();
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Impossibile scaricare file da users/user_123"),
        expect.any(Error)
      );

      consoleWarnSpy.mockRestore();
    });
  });
});