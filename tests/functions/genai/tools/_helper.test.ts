import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  validate: vi.fn().mockResolvedValue(undefined),
  increment: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@functions/_utils", () => ({ validateUserPlanAndLimits: mocks.validate }));
vi.mock("@functions/genai/_utils", () => ({ incrementRagCounter: mocks.increment }));

import { createResearchEmbedding, mapToObject, safeIncrementRagCounter } from "@functions/genai/tools/_helper";

describe("GenAI tool helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validate.mockResolvedValue(undefined);
    mocks.increment.mockResolvedValue(undefined);
  });

  it("skips empty counter batches and safely forwards nonempty batches", async () => {
    await safeIncrementRagCounter("sentences", []);
    expect(mocks.increment).not.toHaveBeenCalled();
    await safeIncrementRagCounter("sentences", ["doc"]);
    expect(mocks.increment).toHaveBeenCalledWith("sentences", ["doc"]);
    mocks.increment.mockRejectedValueOnce(new Error("counter unavailable"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(safeIncrementRagCounter("sentences", ["doc-2"])).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledOnce();
  });

  it("rejects unauthorized embedding requests before plan checks", async () => {
    await expect(createResearchEmbedding("", "question")).rejects.toThrow("UNAUTHORIZED");
    expect(mocks.validate).not.toHaveBeenCalled();
  });

  it("validates an authenticated user's plan before invoking embedding generation", async () => {
    mocks.validate.mockRejectedValueOnce(new Error("plan limit"));
    await expect(createResearchEmbedding("u1", "question")).rejects.toThrow("plan limit");
    expect(mocks.validate).toHaveBeenCalledWith("u1", "research");
  });

  it("maps Firestore data into the public retrieval record", () => {
    const result = mapToObject({
      id: "doc-1",
      data: () => ({ numero_sentenza: "12/2024", summary: "Prova di diritto", organo_giudicante: "Cassazione" }),
    } as never, ["diritto"]);
    expect(result).toMatchObject({
      id: "doc-1",
      numero_sentenza: "12/2024",
      organo_giudicante: "Cassazione",
      summary: "Prova di diritto",
      _source: "database_query",
    });
    expect(result.highlighted_massima).toContain("diritto");
  });

  it("uses massima when summary is absent and preserves missing metadata as null", () => {
    const result = mapToObject({
      id: "doc-2",
      data: () => ({ massima: "Principio generale", fattispecie: "Fatti" }),
    } as never, []);
    expect(result).toMatchObject({
      id: "doc-2", numero_sentenza: null, organo_giudicante: null, sezione: null,
      massima: "Principio generale", summary: null,
    });
  });
});
