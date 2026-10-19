import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildConceptMap, mergeConceptMaps, sanitizeConceptMapForSynthesis } from "@functions/genai/deepAnalysisAgent/_helper";

describe("deep-analysis concept maps", () => {
  beforeEach(() => vi.clearAllMocks());

  it("builds source and thesis relationships and tracks citation metadata", () => {
    const source = {
      nodeId: "source-1", sourceId: "s1", source: "internal" as const, kind: "provvedimento" as const,
      label: "Sentenza 1/24", url: null, metadata: { numero_sentenza: "1/24" }, normeCitate: ["art. 1"],
      precedentiCitati: [{ numero: "2", anno: 2020 }],
    };
    const map = buildConceptMap({
      prompt: "Q",
      sources: [source],
      mappaDialettica: { orientamentoFavorevole: { titoloTesi: "Tesi", fonti: [{ id: "s1" }] } },
    });
    expect(map.nodes.some((node) => node.kind === "tesi")).toBe(true);
    expect(map.nodes.some((node) => node.label === "Sentenza 2/2020" && !node.resolved)).toBe(true);
    expect(map.edges.some((edge) => edge.type === "supporta")).toBe(true);
  });

  it("merges duplicate nodes and edges and sanitizes absent maps", () => {
    const map = buildConceptMap({ prompt: "Q", sources: [], mappaDialettica: {} });
    expect(mergeConceptMaps(null, null).quesito).toBe("");
    expect(mergeConceptMaps(map, null)).toBe(map);
    const merged = mergeConceptMaps(map, { ...map, sourceIds: ["s1"] });
    expect(merged.sourceIds).toEqual(["s1"]);
    expect(sanitizeConceptMapForSynthesis(null)).toBeNull();
    expect(sanitizeConceptMapForSynthesis(merged)).toEqual(merged);
  });
});
