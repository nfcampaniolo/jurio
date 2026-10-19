import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyUiFilters, chunkArray, getDistance, getHostname, getSafeDistance, getSafeLimit,
  isSafeHttpUrl, normalizePrecedenti, normalizeQuery, passesUiFilters, serializeFirestoreDate,
} from "@functions/genai/tools/_utils";

describe("GenAI retrieval utilities", () => {
  beforeEach(() => vi.clearAllMocks());

  it("normalizes query text, clamps limits and rejects invalid values", () => {
    expect(normalizeQuery("  una \n query  ")).toBe("una query");
    expect(normalizeQuery(null)).toBe("");
    expect(getSafeLimit("3.8", 5, 10)).toBe(3);
    expect(getSafeLimit(0, 5, 10)).toBe(1);
    expect(getSafeLimit(99, 5, 10)).toBe(10);
    expect(getSafeLimit("invalid", 5, 10)).toBe(5);
  });

  it("accepts only HTTPS URLs and derives a safe hostname", () => {
    expect(isSafeHttpUrl("https://example.org/a")).toBe(true);
    expect(isSafeHttpUrl("http://example.org")).toBe(false);
    expect(isSafeHttpUrl("javascript:alert(1)")).toBe(false);
    expect(getHostname("https://example.org/a")).toBe("example.org");
    expect(getHostname("not a URL")).toBe("Fonte web");
  });

  it("uses supplied distances or computes cosine-style distance with a fallback", () => {
    expect(getDistance({ distance: 0.2 }, [1, 0])).toBe(0.2);
    expect(getDistance({ data: () => ({ embedding: [0.5, 0.5] }) }, [1, 0])).toBe(0.5);
    expect(getSafeDistance([1, 0], [0, 1])).toBe(1);
    expect(getSafeDistance([1], [1, 2], 0.7)).toBe(0.7);
  });

  it("evaluates UI filters and builds Firestore filters while normalizing dates", () => {
    const data = { year: 2024, tags: ["civil"], dataSentenza: "2024-01-01" };
    expect(passesUiFilters(data, [{ field: "year", operator: ">=", value: 2020 }])).toBe(true);
    expect(passesUiFilters(data, [{ field: "tags", operator: "array-contains", value: "civil" }])).toBe(true);
    expect(passesUiFilters(data, [{ field: "year", operator: "==", value: 2023 }])).toBe(false);
    expect(passesUiFilters(data, "bad filters")).toBe(true);

    const query = { where: vi.fn().mockReturnThis() };
    applyUiFilters(query as never, [
      { field: "dataSentenza", operator: ">=", value: "2024-01-01" },
      { field: "unsupported", operator: "invalid", value: 1 },
    ]);
    expect(query.where).toHaveBeenCalledOnce();
    expect(query.where.mock.calls[0][1]).toBe(">=");
    expect(query.where.mock.calls[0][2]).toBeInstanceOf(Date);
  });

  it("serializes supported date forms, bounds precedent arrays and chunks values", () => {
    expect(serializeFirestoreDate("2024")).toBe("2024");
    expect(serializeFirestoreDate({ toDate: () => new Date("2024-01-01T00:00:00.000Z") })).toBe("2024-01-01T00:00:00.000Z");
    expect(serializeFirestoreDate({ toDate: () => { throw new Error("bad date"); } })).toBe("");
    expect(normalizePrecedenti([null, { numero: 5, questione_di_diritto: "x".repeat(1005) }])).toEqual([
      { valore: "" },
      { anno: null, numero: 5, sezione: "", questione_di_diritto: "x".repeat(1000) },
    ]);
    expect(chunkArray([1, 2, 3], 2)).toEqual([[1, 2], [3]]);
  });
});
