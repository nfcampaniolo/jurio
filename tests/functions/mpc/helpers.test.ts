import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumePerMinuteFeature: vi.fn(),
  consumeDailyFeature: vi.fn(),
}));

vi.mock("@functions/_utils", () => ({
  consumePerMinuteFeature: mocks.consumePerMinuteFeature,
  consumeDailyFeature: mocks.consumeDailyFeature,
}));

type HelperExports = typeof import("@functions/mpc/helpers");
let findByNumeroSentenzaAdmin: HelperExports["findByNumeroSentenzaAdmin"];
let findBySottocategoriaAdmin: HelperExports["findBySottocategoriaAdmin"];
let formatDocument: HelperExports["formatDocument"];
let formatDoctrineDocument: HelperExports["formatDoctrineDocument"];
let verifyPlanAndLimits: HelperExports["verifyPlanAndLimits"];

function snapshot(data?: Record<string, unknown>, exists = true) {
  return { exists, data: () => data };
}

type MockDocument = { id: string; data: () => Record<string, unknown> };
type MockQueryResult = { empty?: boolean; docs: MockDocument[] };

function makeDb(tokenSnapshot = snapshot(undefined, false), userSnapshot = snapshot({ planId: "prova" })) {
  const tokenGet = vi.fn().mockResolvedValue(tokenSnapshot);
  const userGet = vi.fn().mockResolvedValue(userSnapshot);
  const clauses: unknown[][] = [];
  const docsByClause: Record<string, Array<{ id: string; data: () => Record<string, unknown> }>> = {};
  const get = vi.fn<() => Promise<MockQueryResult>>();
  const query = {
    where: vi.fn((...args: unknown[]) => {
      clauses.push(args);
      return query;
    }),
    limit: vi.fn(() => query),
    get: get.mockImplementation(async () => {
      const key = clauses.map((clause) => clause.join(":")).join("|");
      const docs = docsByClause[key] ?? [];
      return { empty: docs.length === 0, docs };
    }),
  };
  const collection = vi.fn((name: string) => {
    if (name === "oauth_tokens") {
      return { doc: vi.fn(() => ({ get: tokenGet })) };
    }
    if (name === "register") {
      return { doc: vi.fn(() => ({ get: userGet })) };
    }
    return query;
  });
  return {
    db: { collection } as unknown as Parameters<typeof verifyPlanAndLimits>[1],
    collection,
    tokenGet,
    userGet,
    clauses,
    docsByClause,
    query,
  };
}

describe("MPC helpers", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    ({
      findByNumeroSentenzaAdmin,
      findBySottocategoriaAdmin,
      formatDocument,
      formatDoctrineDocument,
      verifyPlanAndLimits,
    } = await import("@functions/mpc/helpers"));
    mocks.consumePerMinuteFeature.mockResolvedValue(undefined);
    mocks.consumeDailyFeature.mockResolvedValue(undefined);
  });

  describe("verifyPlanAndLimits", () => {
    it("rejects absent and empty bearer credentials before accessing Firestore", async () => {
      const { db, collection } = makeDb();

      const absent = await verifyPlanAndLimits("", db);
      const empty = await verifyPlanAndLimits("Bearer   ", db);

      expect(absent).toMatchObject({ ok: false, isError: true });
      expect(absent.text).toContain("token assente");
      expect(empty).toMatchObject({ ok: false, isError: true });
      expect(empty.text).toBe("Token di autenticazione non valido.");
      expect(collection).not.toHaveBeenCalled();
    });

    it("accepts a live OAuth token with an allowed user plan and consumes both limits", async () => {
      const expiresAt = { toDate: () => new Date(Date.now() + 60_000) };
      const { db } = makeDb(snapshot({ user: "oauth-user", expiresAt }));

      const result = await verifyPlanAndLimits("Bearer oauth-token", db);

      expect(result).toEqual({ ok: true, isError: false, text: "Autorizzato" });
      expect(mocks.consumePerMinuteFeature).toHaveBeenCalledWith("oauth-user", "research", 20);
      expect(mocks.consumeDailyFeature).toHaveBeenCalledWith("oauth-user", "research", 200);
    });

    it("rejects OAuth token records with missing uid or expired/malformed expiration", async () => {
      const cases = [
        { user: "", expiresAt: { toDate: () => new Date(Date.now() + 1000) } },
        { user: "user", expiresAt: { toDate: () => new Date(Date.now() - 1000) } },
        { user: "user", expiresAt: {} },
      ];

      for (const tokenData of cases) {
        const { db } = makeDb(snapshot(tokenData));
        const result = await verifyPlanAndLimits("Bearer token", db);
        expect(result).toMatchObject({ ok: false, isError: true });
        expect(result.text).toContain("Token OAuth non valido o scaduto");
      }
    });

    it("rejects authenticated users missing from the user registry", async () => {
      const missingUserDb = makeDb(
        snapshot({ user: "user", expiresAt: { toDate: () => new Date(Date.now() + 60_000) } }),
        snapshot(undefined, false)
      ).db;
      const missingUser = await verifyPlanAndLimits("Bearer token", missingUserDb);
      expect(missingUser).toMatchObject({ ok: false, isError: true });
      expect(missingUser.text).toContain("Account utente non trovato");
    });

    it("denies inactive plans and converts rate-limit errors to a user-facing guard", async () => {
      const inactiveDb = makeDb(
        snapshot({ user: "user", expiresAt: { toDate: () => new Date(Date.now() + 60_000) } }),
        snapshot({ planId: "expired" })
      ).db;
      const inactive = await verifyPlanAndLimits("Bearer token", inactiveDb);
      expect(inactive).toMatchObject({ ok: false, isError: false });
      expect(inactive.text).toContain("nessun piano attivo");

      mocks.consumePerMinuteFeature.mockRejectedValueOnce(new Error("rate limit exceeded"));
      const limitedDb = makeDb(
        snapshot({ user: "user", expiresAt: { toDate: () => new Date(Date.now() + 60_000) } })
      ).db;
      const limited = await verifyPlanAndLimits("Bearer token", limitedDb);
      expect(limited).toMatchObject({ ok: false, isError: false });
      expect(limited.text).toContain("limite massimo di ricerche");
    });

    it("propagates unexpected database errors", async () => {
      const { db } = makeDb();
      const error = new Error("Firestore unavailable");
      vi.mocked(db.collection).mockImplementationOnce(() => {
        throw error;
      });

      await expect(verifyPlanAndLimits("Bearer token", db)).rejects.toBe(error);
    });
  });

  describe("document formatters", () => {
    it("formats available case fields and trims optional text", () => {
      const result = formatDocument({
        id: " case-id ",
        tipo_documento: "Sentenza",
        organo_giudicante: "Cassazione",
        numero_sentenza: "12/2025",
        data_decisione: "2025-02-01",
        massima: "  Principio.  ",
        fattispecie_rilevante: "  Fatti. ",
      });

      expect(result).toContain("DOCUMENTO: Sentenza Cassazione, N. 12/2025");
      expect(result).toContain("MASSIMA: Principio.");
      expect(result).toContain("FATTISPECIE: Fatti.");
      expect(result).toContain("https://jurio.it/giurisprudenza/case-id");
    });

    it("omits blank optional text and formats doctrine defaults and cited statutes", () => {
      expect(formatDocument({ massima: "  ", fattispecie_rilevante: "\t" })).not.toContain("MASSIMA:");
      const result = formatDoctrineDocument({
        norme_citate: ["art. 1 c.c.", "art. 2 Cost."],
        url_pdf: "  https://jurio.it/doc.pdf  ",
        orientamento: "  prevalente ",
      });

      expect(result).toContain("FONTE: Documento di Dottrina - Sconosciuta");
      expect(result).toContain("ORIENTAMENTO (N/A): prevalente");
      expect(result).toContain("NORME CITATE: art. 1 c.c., art. 2 Cost.");
      expect(result).toContain("URL DOCUMENTO ORIGINALE: https://jurio.it/doc.pdf");
    });
  });

  describe("Firestore search helpers", () => {
    it("searches padded judgment numbers, ECLI and URN, deduplicating by document id", async () => {
      const numberDoc = { id: "same", data: () => ({ numero_sentenza: "12/2024" }) };
      const ecliDoc = { id: "same", data: () => ({ ecli: "ECLI:IT:ABC" }) };
      const urnDoc = { id: "other", data: () => ({ urn: "urn:abc" }) };
      const { db, query } = makeDb();
      query.get
        .mockResolvedValueOnce({ docs: [numberDoc] })
        .mockResolvedValueOnce({ docs: [ecliDoc] })
        .mockResolvedValueOnce({ docs: [urnDoc] });

      const result = await findByNumeroSentenzaAdmin("12/2024", db);

      expect(result).toEqual([
        { id: "same", ecli: "ECLI:IT:ABC" },
        { id: "other", urn: "urn:abc" },
      ]);
      expect(query.where).toHaveBeenNthCalledWith(1, "numero_sentenza", "in", [
        "12/2024", "012/2024", "0012/2024", "00012/2024",
      ]);
      expect(query.where).toHaveBeenNthCalledWith(2, "ecli", "==", "12/2024");
      expect(query.where).toHaveBeenNthCalledWith(3, "urn", "==", "12/2024");
    });

    it("searches ECLI and URN without a judgment number", async () => {
      const { db, query } = makeDb();
      query.get.mockResolvedValueOnce({ docs: [] }).mockResolvedValueOnce({
        docs: [{ id: "ecli", data: () => ({ ecli: "ECLI:IT:X" }) }],
      }).mockResolvedValueOnce({ docs: [] });

      const result = await findByNumeroSentenzaAdmin(" ECLI:IT:X ", db);

      expect(result).toEqual([{ id: "ecli", ecli: "ECLI:IT:X" }]);
      expect(query.where).toHaveBeenNthCalledWith(1, "ecli", "==", "ECLI:IT:X");
      expect(query.where).toHaveBeenNthCalledWith(2, "urn", "==", "ECLI:IT:X");
    });

    it("returns no results for an empty category and merges area/subcategory matches up to max", async () => {
      const { db, query } = makeDb();
      await expect(findBySottocategoriaAdmin("   ", 4, db)).resolves.toEqual([]);
      expect(query.where).not.toHaveBeenCalled();

      query.get.mockResolvedValueOnce({
        docs: [{ id: "one", data: () => ({ area: "Penale" }) }],
      }).mockResolvedValueOnce({
        docs: [
          { id: "one", data: () => ({ sottocategoria: ["furto"] }) },
          { id: "two", data: () => ({ sottocategoria: ["furto"] }) },
        ],
      });

      const result = await findBySottocategoriaAdmin(" Penale ", 2, db);

      expect(result).toEqual([
        { id: "one", sottocategoria: ["furto"] },
        { id: "two", sottocategoria: ["furto"] },
      ]);
      expect(query.where).toHaveBeenCalledWith("area", "==", "Penale");
      expect(query.where).toHaveBeenCalledWith("sottocategoria", "array-contains", "penale");
      expect(query.limit).toHaveBeenCalledTimes(2);
    });
  });
});
