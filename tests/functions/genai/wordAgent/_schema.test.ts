import { beforeEach, describe, expect, it, vi } from "vitest";
import { FonteSchema, ReviewListSchema } from "@functions/genai/wordAgent/_schema";

describe("Word-agent schemas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("parses citations with optional scores and permits an empty review", () => {
    expect(FonteSchema.parse({ id: "d1", titolo: "Sentenza" })).toEqual({ id: "d1", titolo: "Sentenza" });
    expect(ReviewListSchema.parse({ tesi: [] })).toEqual({ tesi: [] });
    expect(ReviewListSchema.safeParse({ tesi: [{ id: "T1" }] }).success).toBe(false);
  });
});
