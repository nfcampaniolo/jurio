import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CONFIG } from "@functions/genai/_interfaces";

describe("GenAI interfaces runtime defaults", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exports the default deep-analysis configuration", () => {
    expect(DEFAULT_CONFIG).toEqual({
      confidenceLevel: 80,
      sourceWeb: true,
      sourceInternalDB: true,
      webLimit: 5,
      sourceDoctrine: true,
    });
  });
});
