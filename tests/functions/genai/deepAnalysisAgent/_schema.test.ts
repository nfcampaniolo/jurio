import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ConceptMapSchema, DeepAnalysisConfigSchema, ResearchMappingSchema, ResearchOutputSchema,
} from "@functions/genai/deepAnalysisAgent/_schema";

describe("deep-analysis schemas", () => {
  beforeEach(() => vi.clearAllMocks());

  it("applies configuration defaults and validates bounds", () => {
    expect(DeepAnalysisConfigSchema.parse({})).toEqual({
      confidenceLevel: 80, sourceWeb: true, sourceInternalDB: true, sourceDoctrine: true, webLimit: 5,
    });
    expect(DeepAnalysisConfigSchema.safeParse({ webLimit: 11 }).success).toBe(false);
  });

  it("validates concept map limits and permits mapped outputs without a concept map", () => {
    const validMap = {
      version: 1, quesito: "Q", rootId: "root",
      nodes: [{ id: "root", kind: "quesito", source: "system", sourceId: null, label: "Q" }],
      edges: [], sourceIds: [],
      stats: { provvedimenti: 0, dottrina: 0, web: 0, documenti: 0, norme: 0, tesi: 0, relazioni: 0 },
    };
    expect(ConceptMapSchema.parse(validMap).nodes).toHaveLength(1);
    expect(ConceptMapSchema.safeParse({ ...validMap, edges: Array(501).fill({}) }).success).toBe(false);
    expect(ResearchMappingSchema.safeParse({
      inquadramento: { qualificazioneGiuridica: "", fattispecieEstratta: "", normeRiferimento: [] },
      mappaDialettica: { orientamentoFavorevole: null, orientamentoContrario: null, puntiAperti: [] },
    }).success).toBe(true);
    expect(ResearchOutputSchema.safeParse({}).success).toBe(false);
  });
});
