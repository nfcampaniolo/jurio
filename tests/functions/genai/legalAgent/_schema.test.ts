import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FlowChunkPayload, ToolContext } from "@functions/genai/legalAgent/_schema";

describe("legal-agent tool context contracts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("accepts a complete retrieval context and stream status payload", () => {
    const context: ToolContext = {
      userId: "u1", fascicoloId: null, uiFilters: [], docs: ["doc-1"], dbLimit: 5, webLimit: 3,
    };
    const payload: FlowChunkPayload = { status: "loading", text: "searching" };
    expect(context.docs).toEqual(["doc-1"]);
    expect(payload.status).toBe("loading");
  });
});
