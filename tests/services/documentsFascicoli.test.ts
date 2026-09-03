import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import type { DBThreadData } from "@/interfaces/interfaces";

/* ---------- hoisted mocks ---------- */
const {
  mockGetDb,
  mockCollection,
  mockGetDocs,
  mockQuery,
  mockWhere,
  mockOrderBy,
  mockOr,
  mockToDateSafe,
} = vi.hoisted(() => {
  const toDateSafeImpl = vi.fn((val: unknown): Date => {
    if (val instanceof Date) return val;
    if (val && typeof val === "object" && "toDate" in val && typeof (val as { toDate: () => unknown }).toDate === "function") {
      return (val as { toDate: () => Date }).toDate();
    }
    if (typeof val === "string" || typeof val === "number") {
      const d = new Date(val);
      if (!Number.isNaN(d.getTime())) return d;
    }
    return new Date(0);
  });

  return {
    mockGetDb: vi.fn(),
    mockCollection: vi.fn((...args: unknown[]) => ({ _type: "collection", path: args.slice(1).join("/") })),
    mockGetDocs: vi.fn(),
    mockQuery: vi.fn((col: unknown, ...constraints: unknown[]) => ({ col, constraints })),
    mockWhere: vi.fn((field: string, op: string, val: unknown) => ({ field, op, val })),
    mockOrderBy: vi.fn((field: string, dir: string) => ({ field, dir })),
    mockOr: vi.fn((...conditions: unknown[]) => ({ or: conditions })),
    mockToDateSafe: toDateSafeImpl,
  };
});

/* ---------- mock modules ---------- */
vi.mock("./db", () => ({
  __esModule: true,
  getDb: mockGetDb,
}));

vi.mock("@/infrastructure/db", () => ({
  __esModule: true,
  getDb: mockGetDb,
}));

vi.mock("./documentsHelpers", () => ({
  __esModule: true,
  toDateSafe: mockToDateSafe,
}));

vi.mock("@/shared/services/documentsHelpers", () => ({
  __esModule: true,
  toDateSafe: mockToDateSafe,
}));

vi.mock("firebase/firestore", () => ({
  __esModule: true,
  collection: mockCollection,
  getDocs: mockGetDocs,
  query: mockQuery,
  where: mockWhere,
  orderBy: mockOrderBy,
  or: mockOr,
}));

/* ---------- subject under test ---------- */
import { listFascicoliByUser, fetchFascicoloData } from "@/shared/services/documentsFascicoli";

describe("Documents & Fascicoli Service Suite", () => {
  const fakeDbInstance = { _db: "firestore_mock_fascicoli" };

  const createMockSnapshot = <T extends { id: string; data: () => unknown }>(docs: T[]) => ({
    empty: docs.length === 0,
    docs,
    forEach: (cb: (doc: T) => void) => docs.forEach(cb),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDb.mockResolvedValue(fakeDbInstance);
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /* -------------------------------------------------------------------------- */
  /* LIST FASCICOLI BY USER                                                     */
  /* -------------------------------------------------------------------------- */
  describe("listFascicoliByUser", () => {
    test("esegue query con clausola 'or' per ownerId e visibleTo e ordina per updatedAt desc", async () => {
      const dateOlder = new Date("2026-03-01T10:00:00Z");
      const dateNewer = new Date("2026-03-10T14:30:00Z");

      const mockDocs = [
        {
          id: "fascicolo_1",
          data: () => ({
            title: "Contenzioso Contrattuale Alfa S.r.l.",
            createdAt: { toDate: () => dateOlder },
            updatedAt: { toDate: () => dateOlder },
            ownerId: "usr_flv_2026",
          }),
        },
        {
          id: "fascicolo_2",
          data: () => ({
            title: "Arbitrato Societario Beta S.p.A.",
            createdAt: { toDate: () => dateOlder },
            updatedAt: { toDate: () => dateNewer },
            ownerId: "usr_partner_99",
          }),
        },
      ];

      mockGetDocs.mockResolvedValueOnce(createMockSnapshot(mockDocs));

      const result = await listFascicoliByUser("usr_flv_2026");

      expect(mockGetDb).toHaveBeenCalledTimes(1);
      expect(mockCollection).toHaveBeenCalledWith(fakeDbInstance, "fascicoli");
      expect(mockWhere).toHaveBeenCalledWith("ownerId", "==", "usr_flv_2026");
      expect(mockWhere).toHaveBeenCalledWith("visibleTo", "array-contains", "usr_flv_2026");
      expect(mockOr).toHaveBeenCalled();
      expect(mockOrderBy).toHaveBeenCalledWith("updatedAt", "desc");
      expect(mockGetDocs).toHaveBeenCalled();

      expect(result).toHaveLength(2);
      expect(result.some((f) => f.id === "fascicolo_1" && f.title === "Contenzioso Contrattuale Alfa S.r.l.")).toBe(true);
      expect(result.some((f) => f.id === "fascicolo_2" && f.ownerId === "usr_partner_99")).toBe(true);
    });

    test("applica valori di fallback per campi opzionali o mancanti", async () => {
      const todayFormatted = new Date().toLocaleDateString("it-IT");

      const mockDocs = [
        {
          id: "fascicolo_senza_dati",
          data: () => ({
            title: undefined,
            createdAt: null,
            updatedAt: null,
            ownerId: undefined,
          }),
        },
      ];

      mockGetDocs.mockResolvedValueOnce(createMockSnapshot(mockDocs));

      const result = await listFascicoliByUser("usr_guest");

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: "fascicolo_senza_dati",
        title: "Nuovo Fascicolo",
        createdAt: todayFormatted,
        updatedAt: todayFormatted,
        ownerId: "",
      });
    });

    test("ritorna array vuoto se non ci sono fascicoli associati all'utente", async () => {
      mockGetDocs.mockResolvedValueOnce(createMockSnapshot([]));

      const result = await listFascicoliByUser("usr_empty");

      expect(result).toEqual([]);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* FETCH FASCICOLO DATA                                                       */
  /* -------------------------------------------------------------------------- */
  describe("fetchFascicoloData", () => {
    test("recupera gerarchia threads e messaggi, mappando isHistorical a true", async () => {
      const threadDate = new Date("2026-04-10T09:00:00Z");

      const threadDoc = {
        id: "thread_01",
        data: (): DBThreadData => ({
          title: "Quesito Preliminare",
          updatedAt: { toDate: () => threadDate } as unknown as import("firebase/firestore").Timestamp,
          createdAt: { toDate: () => threadDate } as unknown as import("firebase/firestore").Timestamp,
        }),
      };

      const messageDoc1 = {
        id: "msg_user_1",
        data: () => ({
          role: "user",
          content: "Richiesta verifica prescrizione",
          timestamp: new Date("2026-04-10T09:01:00Z"),
        }),
      };

      const messageDoc2 = {
        id: "msg_model_1",
        data: () => ({
          role: "model",
          content: "Il termine ordinario decennale decorre dal...",
          timestamp: new Date("2026-04-10T09:02:00Z"),
          sources: [{ id: "src_1", identificativo: "Art. 2946 c.c." }],
        }),
      };

      // 1ª chiamata getDocs: snapshot dei threads
      mockGetDocs.mockResolvedValueOnce(createMockSnapshot([threadDoc]));
      // 2ª chiamata getDocs: snapshot dei messaggi del thread_01
      mockGetDocs.mockResolvedValueOnce(createMockSnapshot([messageDoc1, messageDoc2]));

      const payload = await fetchFascicoloData("fascicolo_100");

      expect(mockCollection).toHaveBeenCalledWith(fakeDbInstance, "fascicoli", "fascicolo_100", "threads");
      expect(mockCollection).toHaveBeenCalledWith(
        fakeDbInstance,
        "fascicoli",
        "fascicolo_100",
        "threads",
        "thread_01",
        "messages"
      );

      expect(payload).toHaveLength(1);
      expect(payload[0].threadId).toBe("thread_01");
      expect(payload[0].threadData.title).toBe("Quesito Preliminare");
      expect(payload[0].messages).toHaveLength(2);

      expect(payload[0].messages[0]).toMatchObject({
        id: "msg_user_1",
        role: "user",
        isHistorical: true,
      });

      expect(payload[0].messages[1]).toMatchObject({
        id: "msg_model_1",
        role: "model",
        isHistorical: true,
        sources: [{ id: "src_1", identificativo: "Art. 2946 c.c." }],
      });

      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining("=== 📁 LOG DB: FASCICOLO fascicolo_100")
      );
    });

    test("ordina i messaggi per timestamp crescente e a parità di timestamp posiziona user prima di model", async () => {
      const sameTimestamp = new Date("2026-04-15T12:00:00Z");

      const threadDoc = {
        id: "thread_tie",
        data: (): DBThreadData => ({
          title: "Tie break thread",
          updatedAt: { toDate: () => sameTimestamp } as unknown as import("firebase/firestore").Timestamp,
          createdAt: { toDate: () => sameTimestamp } as unknown as import("firebase/firestore").Timestamp,
        }),
      };

      // Inseriti in ordine inverso (prima model poi user)
      const rawMessages = [
        {
          id: "msg_model",
          data: () => ({
            role: "model",
            content: "Risposta generata",
            timestamp: sameTimestamp,
          }),
        },
        {
          id: "msg_user",
          data: () => ({
            role: "user",
            content: "Domanda utente",
            timestamp: sameTimestamp,
          }),
        },
      ];

      mockGetDocs.mockResolvedValueOnce(createMockSnapshot([threadDoc]));
      mockGetDocs.mockResolvedValueOnce(createMockSnapshot(rawMessages));

      const payload = await fetchFascicoloData("fascicolo_tie");

      const messages = payload[0].messages;
      expect(messages[0].id).toBe("msg_user");
      expect(messages[0].role).toBe("user");
      expect(messages[1].id).toBe("msg_model");
      expect(messages[1].role).toBe("model");
    });

    test("ordina i thread multipli per updatedAt decrescente", async () => {
      const olderDate = new Date("2026-01-01T10:00:00Z");
      const newerDate = new Date("2026-02-01T10:00:00Z");

      const threadOlder = {
        id: "thread_old",
        data: (): DBThreadData => ({
          title: "Vecchio Thread",
          updatedAt: { toDate: () => olderDate } as unknown as import("firebase/firestore").Timestamp,
          createdAt: { toDate: () => olderDate } as unknown as import("firebase/firestore").Timestamp,
        }),
      };

      const threadNewer = {
        id: "thread_new",
        data: (): DBThreadData => ({
          title: "Nuovo Thread",
          updatedAt: { toDate: () => newerDate } as unknown as import("firebase/firestore").Timestamp,
          createdAt: { toDate: () => newerDate } as unknown as import("firebase/firestore").Timestamp,
        }),
      };

      // I thread arrivano in ordine cronologico diretto
      mockGetDocs.mockResolvedValueOnce(createMockSnapshot([threadOlder, threadNewer]));
      // Messaggi threadOlder
      mockGetDocs.mockResolvedValueOnce(createMockSnapshot([]));
      // Messaggi threadNewer
      mockGetDocs.mockResolvedValueOnce(createMockSnapshot([]));

      const payload = await fetchFascicoloData("fascicolo_sort");

      expect(payload).toHaveLength(2);
      expect(payload[0].threadId).toBe("thread_new");
      expect(payload[1].threadId).toBe("thread_old");
    });

    test("intercetta eccezioni di rete registrando su console.error e ritornando un array vuoto", async () => {
      mockGetDocs.mockRejectedValueOnce(new Error("Timeout socket lettura subcollection fascicoli"));

      const payload = await fetchFascicoloData("fascicolo_network_err");

      expect(payload).toEqual([]);
      expect(console.error).toHaveBeenCalledWith(
        "Errore nel recupero dati fascicolo:",
        expect.any(Error)
      );
    });
  });
});