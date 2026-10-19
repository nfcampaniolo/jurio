import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  extractKnownSourceIds, extractResearchSources, extractToolOutputs, isUrl, normalizeArray,
  normalizePrecedenti, normalizeText, stableId, validaFonti,
} from "@functions/genai/deepAnalysisAgent/_utils";

describe("deep-analysis source utilities", () => {
  beforeEach(() => vi.clearAllMocks());

  it("normalizes strings and arrays and creates stable identifiers", () => {
    expect(normalizeText("  a\n b ")).toBe("a b");
    expect(normalizeArray([" a ", 2, "a", ""])).toEqual(["a"]);
    expect(normalizePrecedenti([{ numero: " 12 ", anno: 2024 }, null])).toEqual([{ numero: "12", anno: 2024 }]);
    expect(stableId("x", "value")).toBe(stableId("x", "value"));
  });

  it("extracts valid tool output into deduplicated research sources", () => {
    const messages = [{ content: [{ toolResponse: { output: [
      { _type: "giurisprudenza_semantica", id: "s1", numero_sentenza: "1/24", norme_citate: [" art. 1 "] },
      { _type: "web_search", link: "https://example.org", titolo: "Web", sourceType: "web" },
      { error: "failed" },
    ] } }] }];
    expect(extractToolOutputs(messages)).toHaveLength(1);
    const sources = extractResearchSources(messages);
    expect(sources).toHaveLength(2);
    expect(sources[0]).toMatchObject({ sourceId: "s1", kind: "provvedimento", label: "Sentenza 1/24" });
    expect(sources[1]).toMatchObject({ source: "web", url: "https://example.org" });
  });

  it("collects known IDs and rejects source identifiers inconsistent with their source type", () => {
    expect(extractKnownSourceIds({ sourceIds: ["s1"] }, {
      orientamentoFavorevole: { fonti: [{ id: "s2" }] }, orientamentoContrario: { fonti: [{ id: "s1" }] },
    })).toEqual(["s1", "s2"]);
    expect(isUrl("https://example.org")).toBe(true);
    expect(isUrl("javascript:alert(1)")).toBe(false);
    expect(validaFonti([{ id: "https://example.org", fonte: "web" }, { id: "url", fonte: "interna" }]))
      .toEqual([{ id: "https://example.org", fonte: "web" }, { id: "url", fonte: "interna" }]);
    expect(validaFonti([{ id: "https://bad", fonte: "interna" }, { id: "not-url", fonte: "web" }])).toEqual([]);
  });
});
