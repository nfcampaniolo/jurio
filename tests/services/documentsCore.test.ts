import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import type { DocumentoGiurisprudenziale } from "@/interfaces/interfaces";
import type { WithRiferimenti } from "@/services/documentsHelpers";

/* ---------- hoisted mocks ---------- */
const {
  mockGetDb,
  mockToast,
  mockDoc,
  mockSetDoc,
  mockDeleteDoc,
  mockUpdateDoc,
  mockGetDoc,
  mockGetDocs,
  mockCollection,
  mockQuery,
  mockWhere,
  mockLimit,
  mockOr,
  mockWriteBatch,
  mockTimestampFromDate,
  mockGetAuth,
  mockGetEncoding,
  mockMakeRiferimentiNormativiKeys,
  mockBuildNumeroSentenza,
  mockBuildUrnFromMassima,
  mockLowerArrayOrString,
  mockMapFirestoreDocToMassima,
  MockFirebaseError,
} = vi.hoisted(() => {
  class FirebaseError extends Error {
    code: string;
    constructor(code: string, message: string = "") {
      super(message);
      this.name = "FirebaseError";
      this.code = code;
    }
  }

  const mockBatchInstance = {
    delete: vi.fn(),
    commit: vi.fn().mockResolvedValue(undefined),
  };

  return {
    mockGetDb: vi.fn(),
    mockToast: {
      error: vi.fn(),
      success: vi.fn(),
    },
    mockDoc: vi.fn((...args: unknown[]) => ({ _type: "docRef", path: args.slice(1).join("/") })),
    mockSetDoc: vi.fn(),
    mockDeleteDoc: vi.fn(),
    mockUpdateDoc: vi.fn(),
    mockGetDoc: vi.fn(),
    mockGetDocs: vi.fn(),
    mockCollection: vi.fn((...args: unknown[]) => ({ _type: "collectionRef", path: args.slice(1).join("/") })),
    mockQuery: vi.fn((col: unknown, ...constraints: unknown[]) => ({ col, constraints })),
    mockWhere: vi.fn((field: string, op: string, val: unknown) => ({ field, op, val })),
    mockLimit: vi.fn((num: number) => ({ limit: num })),
    mockOr: vi.fn((...conditions: unknown[]) => ({ or: conditions })),
    mockWriteBatch: vi.fn(() => mockBatchInstance),
    mockTimestampFromDate: vi.fn((date: Date) => ({
      _type: "timestamp",
      toDate: () => date,
      seconds: Math.floor(date.getTime() / 1000),
    })),
    mockGetAuth: vi.fn(),
    mockGetEncoding: vi.fn(),
    mockMakeRiferimentiNormativiKeys: vi.fn(),
    mockBuildNumeroSentenza: vi.fn(),
    mockBuildUrnFromMassima: vi.fn(),
    mockLowerArrayOrString: vi.fn(),
    mockMapFirestoreDocToMassima: vi.fn(),
    MockFirebaseError: FirebaseError,
  };
});

/* ---------- mock modules ---------- */
vi.mock("react-hot-toast", () => ({
  __esModule: true,
  toast: mockToast,
}));

vi.mock("firebase/app", () => ({
  __esModule: true,
  FirebaseError: MockFirebaseError,
}));

vi.mock("./db", () => ({
  __esModule: true,
  getDb: mockGetDb,
}));

vi.mock("@/services/db", () => ({
  __esModule: true,
  getDb: mockGetDb,
}));

vi.mock("firebase/auth", () => ({
  __esModule: true,
  getAuth: mockGetAuth,
}));

vi.mock("firebase/firestore", () => ({
  __esModule: true,
  doc: mockDoc,
  setDoc: mockSetDoc,
  deleteDoc: mockDeleteDoc,
  updateDoc: mockUpdateDoc,
  getDoc: mockGetDoc,
  getDocs: mockGetDocs,
  collection: mockCollection,
  query: mockQuery,
  where: mockWhere,
  limit: mockLimit,
  or: mockOr,
  writeBatch: mockWriteBatch,
  Timestamp: {
    fromDate: mockTimestampFromDate,
  },
}));

vi.mock("js-tiktoken", () => ({
  __esModule: true,
  getEncoding: mockGetEncoding,
}));

vi.mock("./riferimentiTranslator", () => ({
  __esModule: true,
  makeRiferimentiNormativiKeys: mockMakeRiferimentiNormativiKeys,
}));

vi.mock("@/services/riferimentiTranslator", () => ({
  __esModule: true,
  makeRiferimentiNormativiKeys: mockMakeRiferimentiNormativiKeys,
}));

vi.mock("./documentsHelpers", () => ({
  __esModule: true,
  buildNumeroSentenza: mockBuildNumeroSentenza,
  buildUrnFromMassima: mockBuildUrnFromMassima,
  lowerArrayOrString: mockLowerArrayOrString,
  _mapFirestoreDocToMassima: mockMapFirestoreDocToMassima,
}));

vi.mock("@/services/documentsHelpers", () => ({
  __esModule: true,
  buildNumeroSentenza: mockBuildNumeroSentenza,
  buildUrnFromMassima: mockBuildUrnFromMassima,
  lowerArrayOrString: mockLowerArrayOrString,
  _mapFirestoreDocToMassima: mockMapFirestoreDocToMassima,
}));

/* ---------- subject under test ---------- */
import {
  loadMaxima,
  deleteDocument,
  renameDocument,
  getDocumentMassima,
  listDocumentsByUser,
  checkDuplicateDocument,
} from "@/services/documentsCore";

describe("Documents Core Service Suite", () => {
  const fakeDb = { id: "firestore_instance" };

  const createMockQuerySnapshot = <T extends { id: string; ref?: unknown; data?: () => unknown }>(
    docs: T[]
  ) => ({
    empty: docs.length === 0,
    docs,
    forEach: (cb: (doc: T) => void) => docs.forEach(cb),
  });

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});

    mockGetDb.mockResolvedValue(fakeDb);
    mockGetAuth.mockReturnValue({
      currentUser: { uid: "usr_flv_2026" },
    });

    mockBuildNumeroSentenza.mockReturnValue("1234/2026");
    mockBuildUrnFromMassima.mockReturnValue("urn:nir:stato:corte.cassazione:2026-03-01;1234");
    mockLowerArrayOrString.mockImplementation((val: unknown) =>
      typeof val === "string" ? val.toLowerCase() : val
    );
    mockMakeRiferimentiNormativiKeys.mockReturnValue(["art_2043_cc"]);

    mockGetEncoding.mockReturnValue({
      encode: vi.fn((str: string) => Array.from({ length: Math.ceil(str.length / 4) }, (_, i) => i)),
      decode: vi.fn(() => "Chunk decodificato del testo integrale"),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /* -------------------------------------------------------------------------- */
  /* LOAD MAXIMA                                                                */
  /* -------------------------------------------------------------------------- */
  describe("loadMaxima", () => {
    const baseData: DocumentoGiurisprudenziale & WithRiferimenti = {
      id: "doc_sentenza_001",
      materia: "Civile",
      organo_giudicante: "Corte di Cassazione",
      anno: 2026,
      massima: "In tema di inadempimento contrattuale...",
      presidente: "dott. mario rossi",
      relatore: "dott.ssa laura bianchi",
      data_sentenza: "2026-05-12T00:00:00.000Z",
      sottocategoria: "Responsabilità Contrattuale",
      riferimenti_normativi: "art. 2043 c.c.",
    } as unknown as DocumentoGiurisprudenziale & WithRiferimenti;

    test("solleva errore se l'UID è stringa vuota", async () => {
      await expect(
        loadMaxima("", baseData, "usr_flv_2026", "sentences", "")
      ).rejects.toThrow("UID mancante");
    });

    test("solleva errore per URN duplicato nella collection 'sentences'", async () => {
      mockGetDocs.mockResolvedValueOnce(
        createMockQuerySnapshot([{ id: "doc_diverso_esistente", data: () => ({}) }])
      );

      await expect(
        loadMaxima("doc_sentenza_001", baseData, "usr_flv_2026", "sentences", "")
      ).rejects.toThrow(
        "Documento già presente con lo stesso URN: urn:nir:stato:corte.cassazione:2026-03-01;1234"
      );

      expect(mockCollection).toHaveBeenCalledWith(fakeDb, "sentences");
      expect(mockWhere).toHaveBeenCalledWith(
        "urn",
        "==",
        "urn:nir:stato:corte.cassazione:2026-03-01;1234"
      );
      expect(mockLimit).toHaveBeenCalledWith(1);
    });

    test("consente il salvataggio se l'URN trovato appartiene allo stesso UID (upsert)", async () => {
      mockGetDocs.mockResolvedValueOnce(
        createMockQuerySnapshot([{ id: "doc_sentenza_001", data: () => ({}) }])
      );

      await loadMaxima("doc_sentenza_001", baseData, "usr_flv_2026", "sentences", "");

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          presidente: "DOTT. MARIO ROSSI",
          relatore: "DOTT.SSA LAURA BIANCHI",
          sottocategoria: "responsabilità contrattuale",
          dataSentenza: expect.objectContaining({ _type: "timestamp" }),
          riferimenti_normativi_key: ["art_2043_cc"],
          user: "usr_flv_2026",
        }),
        { merge: true }
      );
    });

    test("elabora e chunkizza finalText con tokenizer js-tiktoken", async () => {
      const fakeTokens = Array.from({ length: 4000 }, (_, i) => i);
      mockGetEncoding.mockReturnValueOnce({
        encode: vi.fn((str: string) =>
          str.includes("Paragrafo") ? [1, 2, 3] : fakeTokens
        ),
        decode: vi.fn(
          () => "Paragrafo 1. Trattazione dei motivi del ricorso.\n\n"
        ),
      });

      await loadMaxima(
        "doc_sentenza_001",
        baseData,
        "usr_flv_2026",
        "documents",
        "Testo completo lungo della sentenza giurisprudenziale..."
      );

      expect(mockSetDoc).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          testo_integrale: expect.any(Array),
        }),
        { merge: true }
      );
    });
  });

  /* -------------------------------------------------------------------------- */
  /* DELETE DOCUMENT                                                            */
  /* -------------------------------------------------------------------------- */
  describe("deleteDocument", () => {
    test("elimina direttamente il documento singolo se collectionName !== 'documents'", async () => {
      await deleteDocument("sentences", "sent_123");

      expect(mockDoc).toHaveBeenCalledWith(fakeDb, "sentences", "sent_123");
      expect(mockDeleteDoc).toHaveBeenCalled();
      expect(mockWriteBatch).not.toHaveBeenCalled();
    });

    test("elimina documento e relativi chunks in batch se collectionName === 'documents'", async () => {
      const mockBatch = mockWriteBatch();
      const chunkDocs = [
        { id: "chunk_1", ref: { path: "document_chunks/chunk_1" } },
        { id: "chunk_2", ref: { path: "document_chunks/chunk_2" } },
      ];

      mockGetDocs.mockResolvedValueOnce(createMockQuerySnapshot(chunkDocs));

      await deleteDocument("documents", "doc_parent_99");

      expect(mockWriteBatch).toHaveBeenCalledWith(fakeDb);
      expect(mockCollection).toHaveBeenCalledWith(fakeDb, "document_chunks");
      expect(mockWhere).toHaveBeenCalledWith("parentId", "==", "doc_parent_99");
      expect(mockWhere).toHaveBeenCalledWith("user", "==", "usr_flv_2026");

      // 1 per mainDoc + 2 per i chunks
      expect(mockBatch.delete).toHaveBeenCalledTimes(3);
      expect(mockBatch.commit).toHaveBeenCalledTimes(1);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* RENAME DOCUMENT                                                            */
  /* -------------------------------------------------------------------------- */
  describe("renameDocument", () => {
    test("aggiorna il campo nome_file con updateDoc", async () => {
      await renameDocument("doc_101", "Ricorso_Appello_Modificato.pdf");

      expect(mockDoc).toHaveBeenCalledWith(fakeDb, "documents", "doc_101");
      expect(mockUpdateDoc).toHaveBeenCalledWith(expect.anything(), {
        nome_file: "Ricorso_Appello_Modificato.pdf",
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* GET DOCUMENT MASSIMA                                                       */
  /* -------------------------------------------------------------------------- */
  describe("getDocumentMassima", () => {
    test("ritorna i dati del documento se presente", async () => {
      const mockData = { id: "doc_1", massima: "Principio confermato" };
      mockGetDoc.mockResolvedValueOnce({
        exists: () => true,
        data: () => mockData,
      });

      const result = await getDocumentMassima("doc_1", "sentences");

      expect(result).toEqual(mockData);
    });

    test("ritorna null se il documento non esiste su Firestore", async () => {
      mockGetDoc.mockResolvedValueOnce({
        exists: () => false,
      });

      const result = await getDocumentMassima("doc_inexistent", "sentences");

      expect(result).toBeNull();
    });

    test("ritorna 'denied' in caso di errore permission-denied", async () => {
      mockGetDoc.mockRejectedValueOnce(
        new MockFirebaseError("permission-denied", "Accesso non autorizzato")
      );

      const result = await getDocumentMassima("doc_secret", "sentences");

      expect(result).toBe("denied");
      expect(mockToast.error).not.toHaveBeenCalled();
    });

    test("gestisce errore unavailable con apposito toast e ritorna null", async () => {
      mockGetDoc.mockRejectedValueOnce(
        new MockFirebaseError("unavailable", "Firestore disconnesso")
      );

      const result = await getDocumentMassima("doc_down", "sentences");

      expect(result).toBeNull();
      expect(mockToast.error).toHaveBeenCalledWith(
        "Servizio momentaneamente non disponibile. Riprova."
      );
    });

    test("gestisce errore not-found con toast dedicato", async () => {
      mockGetDoc.mockRejectedValueOnce(
        new MockFirebaseError("not-found", "Document missing")
      );

      const result = await getDocumentMassima("doc_missing", "sentences");

      expect(result).toBeNull();
      expect(mockToast.error).toHaveBeenCalledWith("Documento non trovato.");
    });

    test("gestisce codice di errore Firebase default con toast generico", async () => {
      mockGetDoc.mockRejectedValueOnce(
        new MockFirebaseError("resource-exhausted", "Quota superata")
      );

      const result = await getDocumentMassima("doc_quota", "sentences");

      expect(result).toBeNull();
      expect(mockToast.error).toHaveBeenCalledWith(
        "Errore Firebase nel caricamento del documento."
      );
    });

    test("gestisce un generico Error mostrando il messaggio nel toast", async () => {
      mockGetDoc.mockRejectedValueOnce(new Error("Timeout socket di rete"));

      const result = await getDocumentMassima("doc_err", "sentences");

      expect(result).toBeNull();
      expect(mockToast.error).toHaveBeenCalledWith("Timeout socket di rete");
    });
  });

  /* -------------------------------------------------------------------------- */
  /* LIST DOCUMENTS BY USER                                                     */
  /* -------------------------------------------------------------------------- */
  describe("listDocumentsByUser", () => {
    test("interroga i documenti visibili per utente e li ordina per createdAt decrescente", async () => {
      const docA = {
        id: "doc_A",
        createdAt: new Date("2026-04-01T10:00:00Z"),
      };
      const docB = {
        id: "doc_B",
        createdAt: new Date("2026-04-15T12:00:00Z"),
      };

      const rawDocs = [
        { id: "doc_A", data: () => ({ createdAt: "2026-04-01" }) },
        { id: "doc_B", data: () => ({ createdAt: "2026-04-15" }) },
      ];

      mockGetDocs.mockResolvedValueOnce(createMockQuerySnapshot(rawDocs));

      mockMapFirestoreDocToMassima
        .mockReturnValueOnce(docA)
        .mockReturnValueOnce(docB);

      const results = await listDocumentsByUser("usr_flv_2026");

      expect(mockCollection).toHaveBeenCalledWith(fakeDb, "documents");
      expect(mockOr).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything()
      );

      expect(results).toEqual([docB, docA]);
      expect(mockMapFirestoreDocToMassima).toHaveBeenCalledTimes(2);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* CHECK DUPLICATE DOCUMENT                                                   */
  /* -------------------------------------------------------------------------- */
  describe("checkDuplicateDocument", () => {
    test("restituisce null senza query se uid o fileName sono vuoti", async () => {
      expect(await checkDuplicateDocument("", "sentenza.pdf")).toBeNull();
      expect(await checkDuplicateDocument("usr_1", "")).toBeNull();
      expect(mockGetDocs).not.toHaveBeenCalled();
    });

    test("restituisce l'ID del primo documento se trova un duplicato con lo stesso nome file", async () => {
      mockGetDocs.mockResolvedValueOnce(
        createMockQuerySnapshot([{ id: "doc_dup_555" }])
      );

      const duplicateId = await checkDuplicateDocument("usr_flv_2026", "Sentenza_Cassazione_2026.pdf");

      expect(mockCollection).toHaveBeenCalledWith(fakeDb, "documents");
      expect(mockWhere).toHaveBeenCalledWith("user", "==", "usr_flv_2026");
      expect(mockWhere).toHaveBeenCalledWith("nome_file", "==", "Sentenza_Cassazione_2026.pdf");
      expect(duplicateId).toBe("doc_dup_555");
    });

    test("restituisce null se non trova duplicati", async () => {
      mockGetDocs.mockResolvedValueOnce(
        createMockQuerySnapshot([])
      );

      const duplicateId = await checkDuplicateDocument("usr_flv_2026", "Nuovo_Atto.pdf");

      expect(duplicateId).toBeNull();
    });

    test("intercetta l'eccezione di rete registrando su console.error e ritornando null", async () => {
      mockGetDocs.mockRejectedValueOnce(new Error("Timeout Firestore index"));

      const duplicateId = await checkDuplicateDocument("usr_flv_2026", "Atto_Test.pdf");

      expect(duplicateId).toBeNull();
      expect(console.error).toHaveBeenCalledWith(
        "Errore durante la verifica dei duplicati su Firestore:",
        expect.any(Error)
      );
    });
  });
});