import { describe, test, expect, vi, beforeEach } from "vitest";

/* ---------- hoisted mocks ---------- */
const {
  mockGetDb,
  mockDoc,
  mockGetDoc,
  mockSetDoc,
  mockDeleteDoc,
  mockCollection,
  mockQuery,
  mockOrderBy,
  mockGetDocs,
  mockServerTimestamp,
  mockMapToMassima,
  mockToDateSafe,
} = vi.hoisted(() => ({
  mockGetDb: vi.fn().mockResolvedValue("mock_db"),
  mockDoc: vi.fn((_db: unknown, ...pathSegments: string[]) => pathSegments.join("/")),
  mockGetDoc: vi.fn(),
  mockSetDoc: vi.fn().mockResolvedValue(undefined),
  mockDeleteDoc: vi.fn().mockResolvedValue(undefined),
  mockCollection: vi.fn((_db: unknown, ...pathSegments: string[]) => pathSegments.join("/")),
  mockQuery: vi.fn((col: unknown) => col),
  mockOrderBy: vi.fn((field: string, direction?: string) => ({ field, direction })),
  mockGetDocs: vi.fn(),
  mockServerTimestamp: vi.fn(() => "server_timestamp"),
  mockMapToMassima: vi.fn((id: string, data: Record<string, unknown>) => ({ id, ...data })),
  mockToDateSafe: vi.fn((val: unknown) => val || new Date()),
}));

/* ---------- mock modules ---------- */
vi.mock("@/services/db", () => ({
  getDb: () => mockGetDb(),
}));

vi.mock("@/services/document", () => ({
  _mapFirestoreDocToMassima: (id: string, data: unknown) =>
    mockMapToMassima(id, data as Record<string, unknown>),
  toDateSafe: (val: unknown) => mockToDateSafe(val),
}));

vi.mock("firebase/firestore", () => ({
  doc: (db: unknown, ...pathSegments: string[]) => mockDoc(db, ...pathSegments),
  getDoc: (ref: unknown) => mockGetDoc(ref),
  setDoc: (ref: unknown, data: unknown, options: unknown) => mockSetDoc(ref, data, options),
  deleteDoc: (ref: unknown) => mockDeleteDoc(ref),
  collection: (db: unknown, ...pathSegments: string[]) => mockCollection(db, ...pathSegments),
  query: (col: unknown) => mockQuery(col),
  orderBy: (field: string, direction?: string) => mockOrderBy(field, direction),
  getDocs: (queryRef: unknown) => mockGetDocs(queryRef),
  serverTimestamp: () => mockServerTimestamp(),
}));

/* ---------- subject under test ---------- */
import {
  savedSentenzaRef,
  isSentenzaSaved,
  saveSentenza,
  removeSentenza,
  deleteSaveSentence,
  listSavedSentenzeByUser,
} from "@/services/saveSentences";

describe("savedSentenze Service Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("savedSentenzaRef costruisce correttamente il riferimento al documento", async () => {
    const ref = await savedSentenzaRef("user_123", "sentenza_456");
    expect(mockGetDb).toHaveBeenCalledTimes(1);
    expect(ref).toBe("users/user_123/savedSentenze/sentenza_456");
  });

  test("isSentenzaSaved restituisce true se il documento esiste", async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => true,
    });

    const exists = await isSentenzaSaved("user_123", "sentenza_456");
    expect(exists).toBe(true);
    expect(mockGetDoc).toHaveBeenCalledTimes(1);
  });

  test("isSentenzaSaved restituisce false se il documento non esiste", async () => {
    mockGetDoc.mockResolvedValueOnce({
      exists: () => false,
    });

    const exists = await isSentenzaSaved("user_123", "sentenza_456");
    expect(exists).toBe(false);
  });

  test("saveSentenza salva la sentenza con merge e serverTimestamp", async () => {
    await saveSentenza("user_123", "sentenza_456");

    expect(mockSetDoc).toHaveBeenCalledTimes(1);
    expect(mockSetDoc).toHaveBeenCalledWith(
      "users/user_123/savedSentenze/sentenza_456",
      {
        sentenzaId: "sentenza_456",
        createdAt: "server_timestamp",
      },
      { merge: true }
    );
  });

  test("removeSentenza elimina il documento salvato", async () => {
    await removeSentenza("user_123", "sentenza_456");

    expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
    expect(mockDeleteDoc).toHaveBeenCalledWith("users/user_123/savedSentenze/sentenza_456");
  });

  describe("deleteSaveSentence", () => {
    test("lancia un errore se l'uid non è fornito", async () => {
      await expect(deleteSaveSentence("", "sentenza_456")).rejects.toThrow(
        "Utente non autenticato"
      );
    });

    test("elimina correttamente la sentenza salvata", async () => {
      await deleteSaveSentence("user_123", "sentenza_456");

      expect(mockGetDb).toHaveBeenCalledTimes(1);
      expect(mockDeleteDoc).toHaveBeenCalledWith("users/user_123/savedSentenze/sentenza_456");
    });
  });

  describe("listSavedSentenzeByUser", () => {
    test("restituisce un array vuoto se l'utente non ha sentenze salvate", async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [],
      });

      const result = await listSavedSentenzeByUser("user_123");
      expect(result).toEqual([]);
      expect(mockGetDocs).toHaveBeenCalledTimes(1);
    });

    test("recupera e mappa correttamente le sentenze salvate dell'utente", async () => {
      const mockSavedSnap = {
        docs: [
          {
            data: () => ({ sentenzaId: "s_1", createdAt: "2026-06-01" }),
          },
          {
            data: () => ({ sentenzaId: "s_2", createdAt: "2026-06-02" }),
          },
        ],
      };

      const mockSentenceDoc1 = {
        exists: () => true,
        id: "s_1",
        data: () => ({ titolo: "Sentenza Uno" }),
      };

      const mockSentenceDoc2 = {
        exists: () => true,
        id: "s_2",
        data: () => ({ titolo: "Sentenza Due" }),
      };

      mockGetDocs.mockResolvedValueOnce(mockSavedSnap);
      mockGetDoc
        .mockResolvedValueOnce(mockSentenceDoc1)
        .mockResolvedValueOnce(mockSentenceDoc2);
      
      mockMapToMassima.mockImplementation((id: string, data: Record<string, unknown>) => ({
        id,
        ...data,
      }));

      const result = await listSavedSentenzeByUser("user_123");

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: "s_1",
        titolo: "Sentenza Uno",
      });
      expect(result[1]).toEqual({
        id: "s_2",
        titolo: "Sentenza Due",
      });
      expect(mockMapToMassima).toHaveBeenCalledTimes(2);
    });

    test("filtra via i documenti non esistenti nella collezione sentences", async () => {
      const mockSavedSnap = {
        docs: [
          {
            data: () => ({ sentenzaId: "s_1", createdAt: "2026-06-01" }),
          },
          {
            data: () => ({ sentenzaId: "s_missing", createdAt: "2026-06-02" }),
          },
        ],
      };

      const mockSentenceDoc1 = {
        exists: () => true,
        id: "s_1",
        data: () => ({ titolo: "Sentenza Uno" }),
      };

      const mockMissingDoc = {
        exists: () => false,
      };

      mockGetDocs.mockResolvedValueOnce(mockSavedSnap);
      mockGetDoc
        .mockResolvedValueOnce(mockSentenceDoc1)
        .mockResolvedValueOnce(mockMissingDoc);

      mockMapToMassima.mockImplementation((id: string, data: Record<string, unknown>) => ({
        id,
        ...data,
      }));

      const result = await listSavedSentenzeByUser("user_123");

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: "s_1",
        titolo: "Sentenza Uno",
      });
    });
  });
});