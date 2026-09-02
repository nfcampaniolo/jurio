import { describe, test, expect, vi, beforeEach } from "vitest";

/* ---------- hoisted mocks ---------- */
const { mockGetDb, mockGetDocs } = vi.hoisted(() => ({
  mockGetDb: vi.fn().mockResolvedValue({}),
  mockGetDocs: vi.fn(),
}));

/* ---------- mock modules ---------- */
vi.mock("@/services/db", () => ({
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
    collection: vi.fn((_, name) => name),
    query: vi.fn((col) => col),
    where: vi.fn(() => ({})),
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
import { fetchUserPayments } from "@/services/paymentService";
import { Timestamp } from "firebase/firestore";

describe("fetchUserPayments Service Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("restituisce un array vuoto se non viene fornito un uid", async () => {
    const result = await fetchUserPayments("");
    expect(result).toEqual([]);
    expect(mockGetDb).not.toHaveBeenCalled();
  });

  test("recupera, parsa e ordina correttamente i pagamenti da PayPal e Stripe", async () => {
    const date1 = new Date("2026-06-01T10:00:00Z");
    const date2 = new Date("2026-07-01T10:00:00Z");

    const mockPayPalSnap: MockSnapshot = {
      forEach: (callback) => {
        callback({
          id: "paypal_1",
          data: () => ({
            status: "COMPLETED",
            completedAt: new (Timestamp as unknown as { new (d: Date): unknown })(date1),
            paidCurrency: "EUR",
            paidValue: 49.99,
            planId: "plan_a",
            paypalCaptureId: "cap_123",
          }),
        });
      },
    };

    const mockStripeSnap: MockSnapshot = {
      forEach: (callback) => {
        callback({
          id: "stripe_1",
          data: () => ({
            status: "COMPLETED",
            completedAt: new (Timestamp as unknown as { new (d: Date): unknown })(date2),
            paidCurrency: "EUR",
            paidAmountMinor: 9999,
            planId: "plan_b",
            customerId: "cus_123",
          }),
        });
      },
    };

    mockGetDocs
      .mockResolvedValueOnce(mockPayPalSnap)
      .mockResolvedValueOnce(mockStripeSnap);

    const records = await fetchUserPayments("user_123");

    expect(records).toHaveLength(2);
    expect(records[0].id).toBe("stripe_1");
    expect(records[0].completedAt).toEqual(date2);
    expect(records[1].id).toBe("paypal_1");
    expect(records[1].completedAt).toEqual(date1);
  });

  test("gestisce correttamente i Timestamp di Firestore per completedAt su entrambi i provider", async () => {
    const date1 = new Date("2026-05-15T12:00:00Z");
    const date2 = new Date("2026-05-16T12:00:00Z");

    const mockPayPalSnap: MockSnapshot = {
      forEach: (callback) => {
        callback({
          id: "paypal_ts",
          data: () => ({
            status: "COMPLETED",
            completedAt: new (Timestamp as unknown as { new (d: Date): unknown })(date1),
            paidCurrency: "EUR",
            paidValue: 10,
          }),
        });
      },
    };

    const mockStripeSnap: MockSnapshot = {
      forEach: (callback) => {
        callback({
          id: "stripe_ts",
          data: () => ({
            status: "COMPLETED",
            completedAt: new (Timestamp as unknown as { new (d: Date): unknown })(date2),
            paidCurrency: "EUR",
            paidAmountMinor: 2000,
          }),
        });
      },
    };

    mockGetDocs
      .mockResolvedValueOnce(mockPayPalSnap)
      .mockResolvedValueOnce(mockStripeSnap);

    const records = await fetchUserPayments("user_123");

    expect(records).toHaveLength(2);
    expect(records[0].completedAt).toEqual(date2);
    expect(records[1].completedAt).toEqual(date1);
  });
});