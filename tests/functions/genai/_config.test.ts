import { beforeEach, describe, expect, it, vi } from "vitest";
import { CFG, MAX_VECTOR_FETCH, RAG_DISTANCE, ai, getWebDomains } from "@functions/genai/_config";

vi.mock("genkit", () => ({ genkit: vi.fn(() => ({ configured: true })) }));
vi.mock("@genkit-ai/google-genai", () => ({ vertexAI: vi.fn(() => ({ provider: true })) }));

describe("GenAI configuration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("initializes Genkit and exposes the configured limits", () => {
    expect(ai).toBeDefined();
    expect(typeof ai.generate).toBe("function");
    expect(MAX_VECTOR_FETCH).toBe(30);
    expect(RAG_DISTANCE).toBe(CFG.ragDistance);
    expect(CFG.embedding.dimensions).toBe(1536);
  });

  it("returns independent domain lists for every focus", () => {
    const institutional = getWebDomains("institutional");
    const editorial = getWebDomains("editorial");
    const all = getWebDomains("all");
    expect(institutional).toEqual(CFG.domains.institutional);
    expect(editorial).toEqual(CFG.domains.editorial);
    expect(all).toEqual([...CFG.domains.institutional, ...CFG.domains.practices, ...CFG.domains.editorial]);
    institutional.push("example.test");
    expect(CFG.domains.institutional).not.toContain("example.test");
    expect(getWebDomains("unknown" as never)).toEqual(all);
  });
});
