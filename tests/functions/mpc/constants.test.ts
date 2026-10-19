import { beforeEach, describe, expect, it, vi } from "vitest";
import { AREE } from "@functions/_constants";
import {
  JURIO_DOCTRINE_SEARCH_URL,
  JURIO_EXTRACT_TEXT_URL,
  JURIO_VECTOR_SEARCH_URL,
  NOMI_AREE,
} from "@functions/mpc/constants";

describe("MPC constants", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exposes the backend service endpoints", () => {
    expect(JURIO_VECTOR_SEARCH_URL).toBe("https://vectorsearchjurio-vqoobrenua-ew.a.run.app");
    expect(JURIO_EXTRACT_TEXT_URL).toBe("https://extractdocumenttext-vqoobrenua-ew.a.run.app");
    expect(JURIO_DOCTRINE_SEARCH_URL).toBe("https://vectorsearchdoctrine-vqoobrenua-ew.a.run.app");
  });

  it("joins all area labels for the matter-search tool description", () => {
    expect(NOMI_AREE).toBe(Object.values(AREE).join("', '"));
    expect(NOMI_AREE).toContain("Diritto Costituzionale e Parlamentare");
    expect(NOMI_AREE).toContain("Ordinamento Minorile (Civile e Penale)");
  });
});
