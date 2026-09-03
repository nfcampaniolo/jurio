import { describe, test, expect, vi, beforeEach } from "vitest";

/* ---------- hoisted mocks ---------- */
const {
  mockGetDocs,
  mockCollection,
  mockQuery,
  mockWhere,
  mockLimit,
  mockOrderBy,
  mockGetDb,
  mockMakeRiferimentiNormativiKeys,
} = vi.hoisted(() => ({
  mockGetDocs: vi.fn(),
  mockCollection: vi.fn((_db: unknown, collectionName: string) => ({ collectionName })),
  mockQuery: vi.fn((...args: unknown[]) => ({ isQuery: true, args })),
  mockWhere: vi.fn((field: string, op: string, val: unknown) => ({ field, op, val })),
  mockLimit: vi.fn((count: number) => ({ limit: count })),
  mockOrderBy: vi.fn((field: string, dir: string) => ({ orderBy: field, dir })),
  mockGetDb: vi.fn().mockResolvedValue({ firestore: "mockDb" }),
  mockMakeRiferimentiNormativiKeys: vi.fn(),
}));

/* ---------- mock firestore & services ---------- */
vi.mock("firebase/firestore", () => ({
  __esModule: true,
  collection: (db: unknown, path: string) => mockCollection(db, path),
  query: (...args: unknown[]) => mockQuery(...args),
  where: (field: string, op: string, val: unknown) => mockWhere(field, op, val),
  limit: (count: number) => mockLimit(count),
  orderBy: (field: string, dir: string) => mockOrderBy(field, dir),
  getDocs: (q: unknown) => mockGetDocs(q),
}));

vi.mock("@/infrastructure/db", () => ({
  __esModule: true,
  getDb: () => mockGetDb(),
}));

vi.mock("@/shared/hooks/riferimentiTranslator", () => ({
  __esModule: true,
  makeRiferimentiNormativiKeys: (norme: string[]) => mockMakeRiferimentiNormativiKeys(norme),
}));

/* ---------- subject under test ---------- */
import { cercaPrecedente, cercaPrecedentiPerNorme } from "@/features/document/hooks/cercaPrecedenti"; // <-- adegua il path del file

describe("Precedenti Service Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  describe("cercaPrecedente", () => {
    test("restituisce null senza interrogare Firestore se mancano anno o numero", async () => {
      expect(await cercaPrecedente("Cassazione Civile")).toBeNull();
      expect(await cercaPrecedente("Sentenza del 2023 senza numero")).toBeNull();
      expect(await cercaPrecedente("Sentenza n. 1234 senza anno")).toBeNull();

      expect(mockGetDb).not.toHaveBeenCalled();
      expect(mockGetDocs).not.toHaveBeenCalled();
    });

    test("restituisce null se l'organo giudicante non è supportato", async () => {
      const result = await cercaPrecedente("Tribunale di Roma n. 1234/2022");

      expect(result).toBeNull();
      expect(mockGetDb).not.toHaveBeenCalled();
    });

    test("estrae correttamente varianti numero con zero-padding (es. 123/2023 -> 0123, 00123)", async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [{ id: "doc-1", data: () => ({ titolo: "Cassazione 123/2023" }) }],
      });

      await cercaPrecedente("Cass. Civ. n. 123 del 2023");

      expect(mockWhere).toHaveBeenCalledWith(
        "numero_sentenza",
        "in",
        ["123/2023", "0123/2023", "00123/2023"]
      );
    });

    test("normalizza correttamente Sezioni Unite Civili e Penali della Cassazione", async () => {
      mockGetDocs.mockResolvedValue({ empty: true, docs: [] });

      // Sezioni Unite Civili
      await cercaPrecedente("Cass. Sez. Un. n. 500/2021");
      expect(mockWhere).toHaveBeenCalledWith("organo_giudicante", "==", "CORTE DI CASSAZIONE");
      expect(mockWhere).toHaveBeenCalledWith("sezione", "==", "SEZIONI UNITE CIVILI");

      // Sezioni Unite Penali
      await cercaPrecedente("Cass. Pen. Sezioni Unite n. 100/2022");
      expect(mockWhere).toHaveBeenCalledWith("sezione", "==", "SEZIONI UNITE PENALI");
    });

    test("normalizza la Sezione Feriale Penale della Cassazione", async () => {
      mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] });

      await cercaPrecedente("Cass. Pen. Sez. Feriale n. 45/2022");
      expect(mockWhere).toHaveBeenCalledWith("sezione", "==", "SEZIONE FERIALE PENALE");
    });

    test("normalizza sezioni numeriche (arabe e romane) per la Cassazione", async () => {
      mockGetDocs.mockResolvedValue({ empty: true, docs: [] });

      // Civile 3 -> TERZA SEZIONE CIVILE
      await cercaPrecedente("Cass. Civ. Sez. 3 n. 1500/2020");
      expect(mockWhere).toHaveBeenCalledWith("sezione", "==", "TERZA SEZIONE CIVILE");

      // Penale IV -> QUARTA SEZIONE PENALE
      await cercaPrecedente("Cass. Pen. Sez. IV n. 980/2021");
      expect(mockWhere).toHaveBeenCalledWith("sezione", "==", "QUARTA SEZIONE PENALE");
    });

    test("normalizza Consiglio di Stato e Adunanza Plenaria", async () => {
      mockGetDocs.mockResolvedValue({ empty: true, docs: [] });

      // Adunanza Plenaria
      await cercaPrecedente("Cons. Stato Ad. Plen. n. 12/2021");
      expect(mockWhere).toHaveBeenCalledWith("organo_giudicante", "==", "CONSIGLIO DI STATO");
      expect(mockWhere).toHaveBeenCalledWith("sezione", "==", "PLENARIA");

      // Sezione ordinaria (es. Sez. 4 -> IV)
      await cercaPrecedente("Cons. St. Sez. 4 n. 300/2022");
      expect(mockWhere).toHaveBeenCalledWith("sezione", "==", "SEZIONE IV");
    });

    test("normalizza Corte Costituzionale senza applicare filtri di sezione", async () => {
      mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] });

      await cercaPrecedente("Corte Cost. n. 10/2024");

      expect(mockWhere).toHaveBeenCalledWith("organo_giudicante", "==", "CORTE COSTITUZIONALE");
      const filtriSezione = mockWhere.mock.calls.filter((call) => call[0] === "sezione");
      expect(filtriSezione.length).toBe(0);
    });

    test("restituisce id e dati del documento quando il precedente viene trovato", async () => {
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: "sent-999",
            data: () => ({ massimario: "Principio di diritto espresso...", anno: "2023" }),
          },
        ],
      });

      const res = await cercaPrecedente("Cass. Civ. Sez. I n. 555/2023");

      expect(res).toEqual({
        id: "sent-999",
        massimario: "Principio di diritto espresso...",
        anno: "2023",
      });
      expect(mockLimit).toHaveBeenCalledWith(1);
    });

    test("restituisce null e intercetta l'eccezione se Firestore solleva un errore", async () => {
      mockGetDocs.mockRejectedValueOnce(new Error("Firestore connection timeout"));

      const res = await cercaPrecedente("Cass. Civ. n. 1234/2020");

      expect(res).toBeNull();
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe("cercaPrecedentiPerNorme", () => {
    test("restituisce array vuoto immediatamente se non vengono generate chiavi normative valide", async () => {
      mockMakeRiferimentiNormativiKeys.mockReturnValueOnce([]);

      const res = await cercaPrecedentiPerNorme(["norma sconosciuta"]);

      expect(res).toEqual([]);
      expect(mockGetDb).not.toHaveBeenCalled();
      expect(mockGetDocs).not.toHaveBeenCalled();
    });

    test("limita le chiavi a un massimo di 10 per rispettare i vincoli array-contains-any di Firestore", async () => {
      const elevenKeys = Array.from({ length: 11 }, (_, i) => `cpc:a${i + 1}`);
      mockMakeRiferimentiNormativiKeys.mockReturnValueOnce(elevenKeys);

      mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] });

      await cercaPrecedentiPerNorme(["articoli vari"]);

      expect(mockWhere).toHaveBeenCalledWith(
        "riferimenti_normativi_key",
        "array-contains-any",
        elevenKeys.slice(0, 10)
      );
    });

    test("esegue la query ordinata per dataSentenza decrescente e applica il limite di default (41)", async () => {
      mockMakeRiferimentiNormativiKeys.mockReturnValueOnce(["cc:a2043"]);
      mockGetDocs.mockResolvedValueOnce({
        empty: false,
        docs: [
          {
            id: "doc-101",
            data: () => ({ titolo: "Risarcimento del danno", dataSentenza: "2024-01-10" }),
          },
        ],
      });

      const res = await cercaPrecedentiPerNorme(["art 2043 cc"]);

      expect(mockOrderBy).toHaveBeenCalledWith("dataSentenza", "desc");
      expect(mockLimit).toHaveBeenCalledWith(41);
      expect(res).toEqual([
        {
          id: "doc-101",
          titolo: "Risarcimento del danno",
          dataSentenza: "2024-01-10",
          score: 1,
        },
      ]);
    });

    test("rispetta un parametro maxResults personalizzato", async () => {
      mockMakeRiferimentiNormativiKeys.mockReturnValueOnce(["cc:a1218"]);
      mockGetDocs.mockResolvedValueOnce({ empty: true, docs: [] });

      await cercaPrecedentiPerNorme(["art 1218 cc"], 10);

      expect(mockLimit).toHaveBeenCalledWith(10);
    });

    test("restituisce array vuoto se Firestore solleva un'eccezione", async () => {
      mockMakeRiferimentiNormativiKeys.mockReturnValueOnce(["cp:a575"]);
      mockGetDocs.mockRejectedValueOnce(new Error("Index missing in Firestore"));

      const res = await cercaPrecedentiPerNorme(["art 575 cp"]);

      expect(res).toEqual([]);
      expect(console.error).toHaveBeenCalled();
    });
  });
});