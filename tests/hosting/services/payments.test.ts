import { describe, test, expect, vi, beforeEach } from "vitest";

/* ---------- hoisted mocks ---------- */
/* ---------- hoisted mocks ---------- */
const { mockGetDb, mockGetDocs, mockCollection, mockQuery, mockWhere } = vi.hoisted(() => ({
  mockGetDb: vi.fn().mockResolvedValue("mock_db"),
  mockGetDocs: vi.fn(),
  mockCollection: vi.fn((_db: unknown, name: string) => name),
  // Accetta esplicitamente rest parameters restituendo il primo argomento (la collection/query)
  mockQuery: vi.fn((...args: unknown[]) => args[0]),
  mockWhere: vi.fn((field: string, op: string, value: unknown) => ({ field, op, value })),
}));

/* ---------- mock modules ---------- */
vi.mock("@/infrastructure/db", () => ({
  getDb: () => mockGetDb(),
}));

vi.mock("firebase/firestore", () => {
  class MockTimestamp {
    date: Date;
    constructor(date: Date) {
      this.date = date;
    }
    toDate() {
      return this.date;
    }
  }

  return {
    Timestamp: MockTimestamp,
    collection: (_db: unknown, name: string) => mockCollection(_db, name),
    query: mockQuery, // <-- passa direttamente il mock oppure (...args: unknown[]) => mockQuery(...args)
    where: (field: string, op: string, val: unknown) => mockWhere(field, op, val),
    getDocs: (...args: unknown[]) => mockGetDocs(...args),
  };
});

interface MockDoc {
  id: string;
  data: () => Record<string, unknown>;
}

interface MockSnapshot {
  forEach: (callback: (doc: MockDoc) => void) => void;
}

/* ---------- subject under test ---------- */
import { fetchUserPayments } from "@/features/plans/hooks/paymentService";
import { Timestamp } from "firebase/firestore";

describe("fetchUserPayments Service Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("restituisce un array vuoto se non viene fornito un uid", async () => {
    const result = await fetchUserPayments("");
    expect(result).toEqual([]);
    expect(mockGetDb).not.toHaveBeenCalled();
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  test("recupera, parsa e ordina in modo discendente le sessioni Stripe completate", async () => {
    const olderDate = new Date("2026-06-01T10:00:00Z");
    const newerDate = new Date("2026-07-01T10:00:00Z");

    const mockStripeSnap: MockSnapshot = {
      forEach: (callback) => {
        // Inseriamo prima il documento più vecchio per verificare l'ordinamento
        callback({
          id: "stripe_older",
          data: () => ({
            status: "COMPLETED",
            completedAt: new (Timestamp as unknown as { new (d: Date): unknown })(olderDate),
            paidCurrency: "EUR",
            paidAmountMinor: 4999,
            planId: "plan_basic",
            customerId: "cus_001",
          }),
        });
        callback({
          id: "stripe_newer",
          data: () => ({
            status: "COMPLETED",
            completedAt: new (Timestamp as unknown as { new (d: Date): unknown })(newerDate),
            paidCurrency: "USD",
            paidAmountMinor: 9900,
            planId: "plan_pro",
            customerId: "cus_002",
          }),
        });
      },
    };

    mockGetDocs.mockResolvedValueOnce(mockStripeSnap);

    const records = await fetchUserPayments("user_123");

    // Verifica filtri query Firestore
    expect(mockCollection).toHaveBeenCalledWith("mock_db", "stripeSessions");
    expect(mockWhere).toHaveBeenCalledWith("uid", "==", "user_123");
    expect(mockWhere).toHaveBeenCalledWith("status", "==", "COMPLETED");
    expect(mockGetDocs).toHaveBeenCalledTimes(1);

    // Verifica parsing e ordinamento (più recente in testa)
    expect(records).toHaveLength(2);
    expect(records[0]).toEqual({
      id: "stripe_newer",
      provider: "stripe",
      status: "COMPLETED",
      completedAt: newerDate,
      paidCurrency: "USD",
      paidValue: 99,
      planId: "plan_pro",
      customerId: "cus_002",
    });
    expect(records[1]).toEqual({
      id: "stripe_older",
      provider: "stripe",
      status: "COMPLETED",
      completedAt: olderDate,
      paidCurrency: "EUR",
      paidValue: 49.99,
      planId: "plan_basic",
      customerId: "cus_001",
    });
  });

  test("gestisce correttamente completedAt sia come Timestamp Firestore che come stringa di data", async () => {
    const timestampDate = new Date("2026-05-15T12:00:00Z");
    const rawDateString = "2026-05-16T15:30:00.000Z";

    const mockStripeSnap: MockSnapshot = {
      forEach: (callback) => {
        callback({
          id: "stripe_ts",
          data: () => ({
            status: "COMPLETED",
            completedAt: new (Timestamp as unknown as { new (d: Date): unknown })(timestampDate),
            paidAmountMinor: 1000,
          }),
        });
        callback({
          id: "stripe_string_date",
          data: () => ({
            status: "COMPLETED",
            completedAt: rawDateString,
            paidAmountMinor: 2000,
          }),
        });
      },
    };

    mockGetDocs.mockResolvedValueOnce(mockStripeSnap);

    const records = await fetchUserPayments("user_123");

    expect(records).toHaveLength(2);
    expect(records[0].id).toBe("stripe_string_date");
    expect(records[0].completedAt).toEqual(new Date(rawDateString));
    expect(records[1].id).toBe("stripe_ts");
    expect(records[1].completedAt).toEqual(timestampDate);
  });

  test("applica il fallback di default a 'EUR' per paidCurrency e 0 per paidAmountMinor mancante", async () => {
    const mockStripeSnap: MockSnapshot = {
      forEach: (callback) => {
        callback({
          id: "stripe_defaults",
          data: () => ({
            status: "COMPLETED",
            completedAt: new Date("2026-01-01T00:00:00Z"),
          }),
        });
      },
    };

    mockGetDocs.mockResolvedValueOnce(mockStripeSnap);

    const records = await fetchUserPayments("user_123");

    expect(records).toHaveLength(1);
    expect(records[0].paidCurrency).toBe("EUR");
    expect(records[0].paidValue).toBe(0);
  });
});