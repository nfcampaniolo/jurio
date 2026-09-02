import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

/* ---------- hoisted mocks ---------- */
const {
  mockGetDb,
  mockCollection,
  mockGetDocs,
  mockQuery,
  mockWhere,
  mockOrderBy,
} = vi.hoisted(() => ({
  mockGetDb: vi.fn(),
  mockCollection: vi.fn((...args: unknown[]) => ({ _type: "collection", path: args.slice(1).join("/") })),
  mockGetDocs: vi.fn(),
  mockQuery: vi.fn((col: unknown, ...constraints: unknown[]) => ({ col, constraints })),
  mockWhere: vi.fn((field: string, op: string, val: unknown) => ({ field, op, val })),
  mockOrderBy: vi.fn((field: string, dir: string) => ({ field, dir })),
}));

/* ---------- mock modules ---------- */
vi.mock("@/services/db", () => ({
  __esModule: true,
  getDb: mockGetDb,
}));

vi.mock("firebase/firestore", () => ({
  __esModule: true,
  collection: mockCollection,
  getDocs: mockGetDocs,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
}));

/* ---------- subject under test ---------- */
// Adeguare il path se il file si chiama documentsChats.ts o chatService.ts
import { listChatsByUser, fetchChatMessages } from "@/services/documentsChats";

describe("Documents & Chats Service Suite", () => {
  const fakeDbInstance = { _db: "firestore_mock" };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDb.mockResolvedValue(fakeDbInstance);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "table").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /* -------------------------------------------------------------------------- */
  /* LIST CHATS BY USER                                                         */
  /* -------------------------------------------------------------------------- */
  describe("listChatsByUser", () => {
    test("interroga la collection 'chats' con filtri corretti e mappa i documenti", async () => {
      const date1 = new Date("2026-05-10T10:00:00Z");
      const date2 = new Date("2026-05-12T15:30:00Z");

      const mockDocs = [
        {
          id: "chat_001",
          data: () => ({
            title: "Fascicolo Usura Bancaria",
            createdAt: { toDate: () => date1 },
            updatedAt: { toDate: () => date1 },
          }),
        },
        {
          id: "chat_002",
          data: () => ({
            title: "Ricorso Cassazione Responsabilità Medica",
            createdAt: { toDate: () => date1 },
            updatedAt: { toDate: () => date2 },
          }),
        },
      ];

      mockGetDocs.mockResolvedValueOnce({ docs: mockDocs });

      const result = await listChatsByUser("usr_flv_2026");

      expect(mockGetDb).toHaveBeenCalledTimes(1);
      expect(mockCollection).toHaveBeenCalledWith(fakeDbInstance, "chats");
      expect(mockWhere).toHaveBeenCalledWith("ownerId", "==", "usr_flv_2026");
      expect(mockOrderBy).toHaveBeenCalledWith("updatedAt", "desc");
      expect(mockQuery).toHaveBeenCalled();
      expect(mockGetDocs).toHaveBeenCalled();

      expect(result).toHaveLength(2);
      // Verifica mapping e fallback
      expect(result.some((c) => c.id === "chat_001" && c.title === "Fascicolo Usura Bancaria")).toBe(true);
      expect(result.some((c) => c.id === "chat_002" && c.title === "Ricorso Cassazione Responsabilità Medica")).toBe(true);
    });

    test("applica il titolo di default 'Nuovo Fascicolo' e genera la data corrente se assente", async () => {
      const todayFormatted = new Date().toLocaleDateString("it-IT");

      const mockDocs = [
        {
          id: "chat_incomplete",
          data: () => ({
            title: undefined,
            createdAt: null,
            updatedAt: null,
          }),
        },
      ];

      mockGetDocs.mockResolvedValueOnce({ docs: mockDocs });

      const result = await listChatsByUser("usr_generic");

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: "chat_incomplete",
        title: "Nuovo Fascicolo",
        createdAt: todayFormatted,
        updatedAt: todayFormatted,
      });
    });

    test("restituisce un array vuoto quando l'utente non ha chat archiviate", async () => {
      mockGetDocs.mockResolvedValueOnce({ docs: [] });

      const result = await listChatsByUser("usr_senza_chat");

      expect(result).toEqual([]);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* FETCH CHAT MESSAGES                                                        */
  /* -------------------------------------------------------------------------- */
  describe("fetchChatMessages", () => {
    test("recupera i messaggi della sotto-collezione 'messages' ordinati per timestamp", async () => {
      const sampleMessages = [
        {
          id: "msg_1",
          data: () => ({
            role: "user",
            content: "Qual è il foro competente?",
            timestamp: new Date("2026-05-10T10:00:00Z"),
          }),
        },
        {
          id: "msg_2",
          data: () => ({
            role: "model",
            content: "Ai sensi dell'art. 18 c.p.c., la competenza appartiene al giudice del luogo di residenza.",
            timestamp: new Date("2026-05-10T10:01:00Z"),
          }),
        },
      ];

      mockGetDocs.mockResolvedValueOnce({ docs: sampleMessages });

      const messages = await fetchChatMessages("chat_123");

      expect(mockCollection).toHaveBeenCalledWith(fakeDbInstance, "chats", "chat_123", "messages");
      expect(mockOrderBy).toHaveBeenCalledWith("timestamp", "asc");
      expect(messages).toHaveLength(2);
      expect(messages[0].id).toBe("msg_1");
      expect(messages[0].role).toBe("user");
      expect(messages[1].id).toBe("msg_2");
      expect(messages[1].role).toBe("model");

      // Verifica logging di debug a terminale
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("=== 🗂️ LOG DB: CHAT chat_123 ===")
      );
      expect(console.table).toHaveBeenCalledWith([
        { id: "msg_1", mittente: "user", testo: "Qual è il foro competente?..." },
        { id: "msg_2", mittente: "model", testo: "Ai sensi dell'art. 18 c.p.c., ..." },
      ]);
    });

    test("intercetta errori di firestore loggando su console.error e ritornando array vuoto", async () => {
      mockGetDocs.mockRejectedValueOnce(new Error("Permission denied: insufficient privilege to read subcollection"));

      const result = await fetchChatMessages("chat_denied");

      expect(result).toEqual([]);
      expect(console.error).toHaveBeenCalledWith(
        "Errore nel recupero messaggi chat:",
        expect.any(Error)
      );
    });
  });
});