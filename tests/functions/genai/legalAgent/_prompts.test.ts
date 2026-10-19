import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildChatTitlePrompt, buildLegalAgentSystemPrompt, formatRetrievalContextBlock } from "@functions/genai/legalAgent/_prompts";

describe("legal-agent prompts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders active filters, attached documents and fascicolo metadata", () => {
    const prompt = buildLegalAgentSystemPrompt({
      uiFiltersString: "court=Cassazione", docs: ["atto.pdf"], alreadySeenIds: ["case-1"],
      fascicoloId: "f1", metadatiFascicolo: { Cliente: "Ada" },
    });
    expect(prompt).toContain("court=Cassazione");
    expect(prompt).toContain("atto.pdf");
    expect(prompt).toContain("case-1");
    expect(prompt).toContain("Cliente: Ada");
    expect(buildLegalAgentSystemPrompt({ uiFiltersString: "none", docs: [], alreadySeenIds: [] }))
      .toContain("Nessuno");
  });

  it("formats title and retrieval context prompts", () => {
    expect(buildChatTitlePrompt("Quesito")).toContain("Quesito");
    expect(formatRetrievalContextBlock("manuale", "testo")).toContain("Origine: manuale");
    expect(formatRetrievalContextBlock("manuale", "testo")).toContain("FINE CONTESTO RECUPERATO");
  });
});
