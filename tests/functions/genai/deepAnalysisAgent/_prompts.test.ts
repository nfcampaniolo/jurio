import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildResearchAnalysisSystemPrompt, buildResearchMappingSystemPrompt, buildRefineResearchSystemPrompt,
  buildRefineMappingSystemPrompt, buildSynthesisReportSystemPrompt,
} from "@functions/genai/deepAnalysisAgent/_prompts";

describe("deep-analysis prompt builders", () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes the active tools and attachments in research instructions", () => {
    const prompt = buildResearchAnalysisSystemPrompt({
      prompt: "Quesito", requiredTools: ["webSearch"], hasUserDocs: true, docsLength: 1, docs: [{ id: "file-1" }],
    });
    expect(prompt).toContain("Quesito");
    expect(prompt).toContain("webSearch");
    expect(prompt).toContain("userFileSearch");
    expect(prompt).toContain("ALLEGATI / FASCICOLO UTENTE CARICATI (1)");
    expect(prompt).toContain("Gli ID vengono passati dal backend");
  });

  it("includes source evidence and refinement constraints in the follow-up prompts", () => {
    expect(buildResearchMappingSystemPrompt({ prompt: "Q", allSources: [{ id: "s1" }] })).toContain('"id":"s1"');
    expect(buildRefineResearchSystemPrompt({
      originalPrompt: "Q", direttivaHitl: "approfondisci", requiredTools: [], hasUserDocs: false,
      docsLength: 0, docs: [], knownIds: ["s1"],
    })).toContain("approfondisci");
    expect(buildRefineResearchSystemPrompt({
      originalPrompt: "Q", direttivaHitl: "approfondisci", requiredTools: [], hasUserDocs: false,
      docsLength: 0, docs: [], knownIds: ["precedente-1"],
    })).toContain("precedente-1");
    expect(buildRefineMappingSystemPrompt({ originalPrompt: "Q", direttivaHitl: "nuovi dati" })).toContain("nuovi dati");
    expect(buildSynthesisReportSystemPrompt("Q")).toContain("esclusivamente i dati JSON");
  });
});
