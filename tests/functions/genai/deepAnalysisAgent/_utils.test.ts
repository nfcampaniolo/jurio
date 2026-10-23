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
      { _type: "web_search", link: "https://example.org", title: "Web", content: "contenuto web", source: "example.org", sourceType: "web" },
      { error: "failed" },
    ] } }] }];
    expect(extractToolOutputs(messages)).toHaveLength(1);
    const sources = extractResearchSources(messages);
    expect(sources).toHaveLength(2);
    expect(sources[0]).toMatchObject({ sourceId: "s1", kind: "provvedimento", label: "Sentenza 1/24" });
    expect(sources[1]).toMatchObject({
      source: "web", url: "https://example.org", label: "Web",
      metadata: { fonte: "example.org", contenuto: "contenuto web" },
    });
  });

  it("collects known IDs and rejects source identifiers inconsistent with their source type", () => {
    expect(extractKnownSourceIds({ sourceIds: ["s1"] }, {
      orientamentoFavorevole: { fonti: [{ id: "s2" }] }, orientamentoContrario: { fonti: [{ id: "s1" }] },
    })).toEqual(["s1", "s2"]);
    expect(isUrl("https://example.org")).toBe(true);
    expect(isUrl("javascript:alert(1)")).toBe(false);
    expect(validaFonti([{ id: "https://example.org", fonte: "web" }, { id: "url", fonte: "interna" }]))
      .toEqual([{ id: "https://example.org", fonte: "web", tipoFonte: "web" }, { id: "url", fonte: "interna" }]);
    expect(validaFonti([{ id: "https://bad", fonte: "interna" }, { id: "not-url", fonte: "web" }])).toEqual([]);
  });

  it("keeps the real content returned by the search tools", () => {
    const sources = extractResearchSources([{ content: [{ toolResponse: { output: [
      { _type: "giurisprudenza_semantica", id: "s1", caseNumber: "12/2024", court: "Cassazione", summary: "massima reale" },
      { _type: "web_search", sourceType: "doctrine", id: "d1_theme_1", title: "Tema", content: "contenuto dottrina" },
      { _type: "document_chunk", id: "c1", documentId: "doc1", fileName: "atto.pdf", paragraphText: "testo allegato", originalPosition: 2 },
    ] } }] }]);
    const byId = Object.fromEntries(sources.map((source) => [source.sourceId, source]));
    expect(byId.s1.label).toBe("Sentenza 12/2024");
    expect(byId.s1.metadata.massima).toBe("massima reale");
    expect(byId.d1_theme_1.metadata.contenuto).toBe("contenuto dottrina");
    expect(byId.doc1.label).toBe("atto.pdf");
    expect(byId.doc1.metadata.estratti[0].testo).toBe("testo allegato");
    expect(validaFonti([{ id: "d1_theme_1", fonte: "interna" }], sources)[0])
      .toMatchObject({ tipoFonte: "dottrina", titolo: "Tema" });
  });

  it("adds the stored summary of attached documents to the same source as its chunks", () => {
    const sources = extractResearchSources([{ content: [{ toolResponse: { output: [
      { _type: "document_chunk", id: "doc1_chunk_0", documentId: "doc1", fileName: "atto.pdf", paragraphText: "testo" },
      { _type: "document_summary", documentId: "doc1", fileName: "atto.pdf", summary: "riassunto", legalIssues: "questioni" },
    ] } }] }]);
    expect(sources).toHaveLength(1);
    expect(sources[0].metadata).toMatchObject({ riassunto: "riassunto", questioniGiuridiche: "questioni" });
    expect(sources[0].metadata.estratti).toHaveLength(1);
  });
});
