import { describe, test, expect, vi, beforeEach } from "vitest";
import type { QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import { FirebaseError } from "firebase/app";

/* ---------- hoisted mocks ---------- */
const {
  mockGetDb,
  mockCollection,
  mockDoc,
  mockGetDoc,
  mockGetDocs,
  mockSetDoc,
  mockQuery,
  mockWhere,
  mockOrderBy,
  mockLimit,
  mockStartAfter,
  mockOr,
  mockServerTimestamp,
  mockMapToMassima,
  mockMakeRiferimentiKeys,
} = vi.hoisted(() => ({
  mockGetDb: vi.fn().mockResolvedValue("mock_db"),
  mockCollection: vi.fn((_db: unknown, ...pathSegments: string[]) => pathSegments.join("/")),
  mockDoc: vi.fn((_db: unknown, ...pathSegments: string[]) => pathSegments.join("/")),
  mockGetDoc: vi.fn(),
  mockGetDocs: vi.fn(),
  mockSetDoc: vi.fn().mockResolvedValue(undefined),
  mockQuery: vi.fn((col: unknown) => col),
  mockWhere: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
  mockOrderBy: vi.fn((field: string, direction?: string) => ({ field, direction })),
  mockLimit: vi.fn((n: number) => ({ limit: n })),
  mockStartAfter: vi.fn((doc: unknown) => ({ startAfter: doc })),
  mockOr: vi.fn((...constraints: unknown[]) => ({ or: constraints })),
  mockServerTimestamp: vi.fn(() => "server_timestamp"),
  mockMapToMassima: vi.fn((id: string, data: Record<string, unknown>) => ({ id, ...data })),
  mockMakeRiferimentiKeys: vi.fn((input: unknown) =>
    typeof input === "string" && input.trim() ? ["cpc:a10"] : []
  ),
}));

/* ---------- mock modules ---------- */
vi.mock("@/infrastructure/db", () => ({
  getDb: () => mockGetDb(),
}));

vi.mock("@/shared/services/document", () => ({
  _mapFirestoreDocToMassima: (id: string, data: unknown) =>
    mockMapToMassima(id, data as Record<string, unknown>),
}));

vi.mock("@/shared/hooks/riferimentiTranslator", () => ({
  makeRiferimentiNormativiKeys: (input: unknown) => mockMakeRiferimentiKeys(input),
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

vi.mock("firebase/firestore", () => ({
  collection: (db: unknown, ...pathSegments: string[]) => mockCollection(db, ...pathSegments),
  doc: (db: unknown, ...pathSegments: string[]) => mockDoc(db, ...pathSegments),
  getDoc: (ref: unknown) => mockGetDoc(ref),
  getDocs: (queryRef: unknown) => mockGetDocs(queryRef),
  setDoc: (ref: unknown, data: unknown, options: unknown) => mockSetDoc(ref, data, options),
  query: (col: unknown) => mockQuery(col),
  where: (field: string, op: string, val: unknown) => mockWhere(field, op, val),
  orderBy: (field: string, dir?: string) => mockOrderBy(field, dir),
  limit: (n: number) => mockLimit(n),
  startAfter: (doc: unknown) => mockStartAfter(doc),
  or: (...constraints: unknown[]) => mockOr(...constraints),
  serverTimestamp: () => mockServerTimestamp(),
}));

/* ---------- subject under test ---------- */
import {
  loadUserSearchTerms,
  saveUserSearchTerm,
  findByNumeroSentenza,
  fetchSentencesByIdsOrdered,
  findNormativaFromUserQuery,
  findBySottocategoria,
  loadDistinctSottocategorie,
  fetchCortePaginata,
  isAuthzError,
  isUnavailableError,
  isNetworkError,
} from "@/features/search/hooks/search";

describe("sentenceQueries Service Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loadUserSearchTerms", () => {
    test("restituisce i termini di ricerca dell'utente validi", async () => {
      mockGetDocs.mockResolvedValueOnce({
        docs: [
          { data: () => ({ term: "diritto civile" }) },
          { data: () => ({ term: "" }) },
          { data: () => ({ term: 123 }) },
          { data: () => ({ term: "responsabilità" }) },
        ],
      });

      const terms = await loadUserSearchTerms("user_123", 10);

      expect(terms).toEqual(["diritto civile", "responsabilità"]);
      expect(mockGetDb).toHaveBeenCalledTimes(1);
    });
  });

  describe("saveUserSearchTerm", () => {
    test("salva il termine normalizzato con merge e serverTimestamp", async () => {
      await saveUserSearchTerm("user_123", "  Diritto Penale  ");

      expect(mockSetDoc).toHaveBeenCalledTimes(1);
      expect(mockSetDoc).toHaveBeenCalledWith(
        "users/user_123/search_terms/diritto%20penale",
        { term: "Diritto Penale", updatedAt: "server_timestamp" },
        { merge: true }
      );
    });

    test("non esegue alcuna operazione se il termine è vuoto", async () => {
      await saveUserSearchTerm("user_123", "   ");
      expect(mockSetDoc).not.toHaveBeenCalled();
    });
  });

  describe("findByNumeroSentenza", () => {
    test("cerca per numero/anno, ecli e urn unendo i risultati ed evitando duplicati", async () => {
      const mockDoc1 = { id: "doc_1", data: () => ({ numero_sentenza: "2/2026" }) };
      const mockDoc2 = { id: "doc_2", data: () => ({ ecli: "ECLI:123" }) };

      mockGetDocs
        .mockResolvedValueOnce({ docs: [mockDoc1] })
        .mockResolvedValueOnce({ docs: [mockDoc2] })
        .mockResolvedValueOnce({ docs: [mockDoc1] });

      mockMapToMassima.mockImplementation((id: string, data: Record<string, unknown>) => ({
        id,
        ...data,
      }));

      const results = await findByNumeroSentenza("2/2026");

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe("doc_1");
      expect(results[1].id).toBe("doc_2");
    });

    test("restituisce un array vuoto se non viene trovato alcun documento", async () => {
      mockGetDocs
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] })
        .mockResolvedValueOnce({ docs: [] });

      const results = await findByNumeroSentenza("999/2026");
      expect(results).toEqual([]);
    });
  });

  describe("fetchSentencesByIdsOrdered", () => {
    test("recupera e mappa le sentenze esistenti per ID", async () => {
      mockGetDoc
        .mockResolvedValueOnce({ exists: () => true, id: "s_1", data: () => ({ titolo: "Uno" }) })
        .mockResolvedValueOnce({ exists: () => false })
        .mockResolvedValueOnce({ exists: () => true, id: "s_3", data: () => ({ titolo: "Tre" }) });

      mockMapToMassima.mockImplementation((id: string, data: Record<string, unknown>) => ({
        id,
        ...data,
      }));

      const results = await fetchSentencesByIdsOrdered(["s_1", "s_missing", "s_3"]);

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe("s_1");
      expect(results[1].id).toBe("s_3");
    });
  });

  describe("findNormativaFromUserQuery", () => {
    test("ritorna chiavi vuote se la query è vuota o senza riferimenti normativi", async () => {
      const result = await findNormativaFromUserQuery("   ");
      expect(result).toEqual({ keys: [], docs: [] });
    });

    test("esegue la query Firestore e restituisce chiavi e documenti", async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [{ id: "s_1", data: () => ({ titolo: "Norma" }) }],
      });

      mockMapToMassima.mockImplementation((id: string, data: Record<string, unknown>) => ({
        id,
        ...data,
      }));

      const result = await findNormativaFromUserQuery("art. 10 cpc");

      expect(result.keys).toEqual(["cpc:a10"]);
      expect(result.docs).toHaveLength(1);
      expect(result.docs[0].id).toBe("s_1");
    });
  });

  describe("findBySottocategoria", () => {
    test("restituisce un array vuoto se la sottocategoria è vuota", async () => {
      const results = await findBySottocategoria("   ");
      expect(results).toEqual([]);
    });

    test("esegue la query con or e restituisce i documenti mappati", async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [{ id: "s_1", data: () => ({ sottocategoria: ["civile"] }) }],
      });

      mockMapToMassima.mockImplementation((id: string, data: Record<string, unknown>) => ({
        id,
        ...data,
      }));

      const results = await findBySottocategoria("Civile");
      expect(results).toHaveLength(1);
      expect(results[0].id).toBe("s_1");
    });
  });

  describe("loadDistinctSottocategorie", () => {
    test("carica e ordina le sottocategorie dalla tassonomia", async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [
          { data: () => ({ nome: "Amministrativo" }) },
          { data: () => ({ nome: "" }) },
          { data: () => ({ nome: "Civile" }) },
        ],
      });

      const subcats = await loadDistinctSottocategorie();
      expect(subcats).toEqual(["Amministrativo", "Civile"]);
    });

    test("gestisce gli errori restituendo un array vuoto", async () => {
      mockGetDocs.mockRejectedValueOnce(new Error("Firebase error"));
      const subcats = await loadDistinctSottocategorie();
      expect(subcats).toEqual([]);
    });
  });

  describe("fetchCortePaginata", () => {
    test("costruisce correttamente la query complessa con filtri multipli e paginazione", async () => {
      const mockDocSnap = { id: "s_1", data: () => ({ titolo: "Sentenza Paginata" }) };
      mockGetDocs.mockResolvedValueOnce({
        docs: [mockDocSnap],
      });

      mockMapToMassima.mockImplementation((id: string, data: Record<string, unknown>) => ({
        id,
        ...data,
      }));

      const startDate = new Date("2026-01-01");
      const endDate = new Date("2026-12-31");
      const lastDocMock = { id: "last" } as unknown as QueryDocumentSnapshot<DocumentData>;

      const result = await fetchCortePaginata(
        "Sezione I",
        "Civile",
        "Cassazione",
        "Materia Civile",
        "Ordinanza Cautelare",
        "desc",
        startDate,
        endDate,
        lastDocMock,
        5
      );

      expect(result.docs).toHaveLength(1);
      expect(result.lastVisible).toBe(mockDocSnap);
      expect(mockGetDocs).toHaveBeenCalledTimes(1);
    });
  });

  describe("Error Helper Functions", () => {
    test("isAuthzError rileva correttamente errori di permesso o autenticazione", () => {
      expect(isAuthzError(new FirebaseError("permission-denied", "Denied"))).toBe(true);
      expect(isAuthzError(new FirebaseError("unauthenticated", "Auth"))).toBe(true);
      expect(isAuthzError(new Error("Access forbidden 403"))).toBe(true);
      expect(isAuthzError(new Error("Network timeout"))).toBe(false);
    });

    test("isUnavailableError rileva correttamente l'errore unavailable di Firebase", () => {
      expect(isUnavailableError(new FirebaseError("unavailable", "Down"))).toBe(true);
      expect(isUnavailableError(new Error("unavailable"))).toBe(false);
    });

    test("isNetworkError rileva correttamente errori di rete", () => {
      expect(isNetworkError(new Error("Failed to fetch"))).toBe(true);
      expect(isNetworkError(new Error("Network connection lost"))).toBe(true);
      expect(isNetworkError(new FirebaseError("permission-denied", "Denied"))).toBe(false);
    });
  });
});