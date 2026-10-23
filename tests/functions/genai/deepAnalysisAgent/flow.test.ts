import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generate: vi.fn(),
  internalSearch: vi.fn(),
  doctrineSearch: vi.fn(),
  webSearch: vi.fn(),
  userFileSearch: vi.fn(),
}));
vi.mock("@functions/_deps", () => ({
  getDb: () => ({
    collection: () => ({ doc: (id: string) => ({ id }) }),
    getAll: async (...refs: Array<{ id: string }>) => refs.map((ref) => ({
      id: ref.id,
      data: () => ({ user: "u1", nome_file: "atto.pdf", summary: "riassunto allegato", extract_legal_issues: "questioni" }),
    })),
  }),
}));
vi.mock("@functions/genai/_config", () => ({ ai: { defineFlow: (_config: unknown, handler: unknown) => handler, generate: mocks.generate } }));
vi.mock("@functions/genai/tools/index", () => ({
  internalDatabaseSearch: mocks.internalSearch, doctrineSearch: mocks.doctrineSearch,
  webSearch: mocks.webSearch, userFileSearch: mocks.userFileSearch,
}));

import {
  generateSynthesisReportFlow, refineResearchFlow, researchAnalysisFlow,
} from "@functions/genai/deepAnalysisAgent/flow";

describe("deep-analysis flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generate.mockReset();
    mocks.internalSearch.mockReset();
    mocks.doctrineSearch.mockReset();
    mocks.webSearch.mockReset();
    mocks.userFileSearch.mockReset();
  });

  it("builds a concept map from search results and validated mapping output", async () => {
    mocks.generate.mockResolvedValueOnce({ output: {
        inquadramento: { qualificazioneGiuridica: "Q", fattispecieEstratta: "F", normeRiferimento: [] },
        mappaDialettica: { orientamentoFavorevole: null, orientamentoContrario: null, puntiAperti: [] },
      } });
    const handler = researchAnalysisFlow as unknown as (input: unknown) => Promise<unknown>;
    const result = await handler({
      prompt: "Q", docs: [], userId: "u1",
      config: { confidenceLevel: 80, sourceWeb: false, sourceInternalDB: false, sourceDoctrine: false, webLimit: 5 },
    }) as { mappaConcettuale: { quesito: string } };
    expect(result.mappaConcettuale.quesito).toBe("Q");
    expect(mocks.generate).toHaveBeenCalledTimes(1);
  });

  it("searches attached files by their IDs and in parallel with selected sources", async () => {
    mocks.generate
      .mockResolvedValueOnce({
        output: {
          internalDatabaseSearch: { searchType: "semantic", query: "quesito giuridico" },
          doctrineSearch: null,
          webSearch: null,
        },
      })
      .mockResolvedValueOnce({ output: {
        inquadramento: { qualificazioneGiuridica: "Q", fattispecieEstratta: "F", normeRiferimento: [] },
        mappaDialettica: { orientamentoFavorevole: null, orientamentoContrario: null, puntiAperti: [] },
      } });
    mocks.internalSearch.mockResolvedValue([]);
    mocks.userFileSearch.mockResolvedValue([]);
    const handler = researchAnalysisFlow as unknown as (input: unknown) => Promise<unknown>;

    await handler({
      prompt: "Quesito giuridico",
      docs: ["doc-1", "doc-2"],
      userId: "u1",
      config: { confidenceLevel: 80, sourceWeb: false, sourceInternalDB: true, sourceDoctrine: false, webLimit: 5 },
    });

    expect(mocks.internalSearch).toHaveBeenCalledWith(
      { searchType: "semantic", query: "quesito giuridico" },
      expect.objectContaining({ context: expect.objectContaining({ docs: ["doc-1", "doc-2"] }) })
    );
    expect(mocks.userFileSearch).toHaveBeenCalledWith(
      { query: expect.stringContaining("Quesito giuridico") },
      expect.objectContaining({ context: expect.objectContaining({ docs: ["doc-1", "doc-2"] }) })
    );
  });

  it("retries the mapping with the full model when no found source is linked to the theses", async () => {
    const inq = { qualificazioneGiuridica: "Q", fattispecieEstratta: "F", normeRiferimento: [] };
    mocks.generate
      .mockResolvedValueOnce({ output: {
        internalDatabaseSearch: { searchType: "semantic", query: "penale art 1384" },
        doctrineSearch: null, webSearch: null,
      } })
      .mockResolvedValueOnce({ output: {
        inquadramento: inq,
        mappaDialettica: {
          orientamentoFavorevole: { titoloTesi: "T", argomentazioneLogica: "A", fonti: [{ id: "inventato", fonte: "interna", gradoPertinenza: 80 }] },
          orientamentoContrario: null, puntiAperti: [],
        },
      } })
      .mockResolvedValueOnce({ output: {
        inquadramento: inq,
        mappaDialettica: {
          orientamentoFavorevole: { titoloTesi: "T", argomentazioneLogica: "A", fonti: [{ id: "sent-1", fonte: "interna", gradoPertinenza: 85 }] },
          orientamentoContrario: null, puntiAperti: [],
        },
      } });
    mocks.internalSearch.mockResolvedValue([{ _type: "giurisprudenza_semantica", id: "sent-1", caseNumber: "1/2024", summary: "massima" }]);
    const handler = researchAnalysisFlow as unknown as (input: unknown) => Promise<unknown>;
    const result = await handler({
      prompt: "Q", docs: [], userId: "u1",
      config: { confidenceLevel: 80, sourceWeb: false, sourceInternalDB: true, sourceDoctrine: false, webLimit: 5 },
    }) as { mappaDialettica: { orientamentoFavorevole: { fonti: Array<{ id: string }> } | null } };
    expect(mocks.generate).toHaveBeenCalledTimes(3);
    expect(mocks.generate.mock.calls[2][0].model).toBe("vertexai/gemini-3.5-flash");
    expect(result.mappaDialettica.orientamentoFavorevole?.fonti.map((f) => f.id)).toEqual(["sent-1"]);
  });

  it("limits external searches to two without starving enabled web search", async () => {
    mocks.generate
      .mockResolvedValueOnce({ output: {
        internalDatabaseSearch: { searchType: "semantic", query: "precedenti giuridici" },
        doctrineSearch: { query: "dottrina giuridica" },
        webSearch: { query: "normativa aggiornata", focus: "institutional" },
      } })
      .mockResolvedValueOnce({ output: {
        inquadramento: { qualificazioneGiuridica: "Q", fattispecieEstratta: "F", normeRiferimento: [] },
        mappaDialettica: { orientamentoFavorevole: null, orientamentoContrario: null, puntiAperti: [] },
      } });
    mocks.internalSearch.mockResolvedValue([]);
    mocks.doctrineSearch.mockResolvedValue([]);
    mocks.webSearch.mockResolvedValue([]);
    const handler = researchAnalysisFlow as unknown as (input: unknown) => Promise<unknown>;

    await handler({
      prompt: "Quesito giuridico",
      docs: [],
      userId: "u1",
      config: { confidenceLevel: 80, sourceWeb: true, sourceInternalDB: true, sourceDoctrine: true, webLimit: 5 },
    });

    expect(mocks.internalSearch).toHaveBeenCalledTimes(1);
    expect(mocks.doctrineSearch).not.toHaveBeenCalled();
    expect(mocks.webSearch).toHaveBeenCalledTimes(1);
  });

  it("runs web search when enabled even if the planner omits it", async () => {
    mocks.generate
      .mockResolvedValueOnce({ output: {
        internalDatabaseSearch: { searchType: "semantic", query: "articolo 1384 codice civile" },
        doctrineSearch: null,
        webSearch: null,
      } })
      .mockResolvedValueOnce({ output: {
        inquadramento: { qualificazioneGiuridica: "Q", fattispecieEstratta: "F", normeRiferimento: [] },
        mappaDialettica: { orientamentoFavorevole: null, orientamentoContrario: null, puntiAperti: [] },
      } });
    mocks.internalSearch.mockResolvedValue([]);
    mocks.webSearch.mockResolvedValue([]);
    const handler = researchAnalysisFlow as unknown as (input: unknown) => Promise<unknown>;

    await handler({
      prompt: "Riduzione della penale ex art. 1384 c.c.", docs: [], userId: "u1",
      config: { confidenceLevel: 80, sourceWeb: true, sourceInternalDB: true, sourceDoctrine: true, webLimit: 5 },
    });

    expect(mocks.webSearch).toHaveBeenCalledWith(
      { query: "Riduzione della penale ex art. 1384 c.c.", focus: "all" },
      expect.anything()
    );
    expect(mocks.internalSearch).toHaveBeenCalledTimes(1);
    expect(mocks.doctrineSearch).not.toHaveBeenCalled();
  });

  it("rejects report generation when the model provides no structured output", async () => {
    mocks.generate.mockResolvedValueOnce({ output: null });
    const handler = generateSynthesisReportFlow as unknown as (input: unknown) => Promise<unknown>;
    await expect(handler({
      quesitoOriginale: "Q",
      inquadramento: { qualificazioneGiuridica: "", fattispecieEstratta: "", normeRiferimento: [] },
      mappaDialettica: { orientamentoFavorevole: null, orientamentoContrario: null, puntiAperti: [] },
      mappaConcettuale: null, userId: "u1",
    })).rejects.toThrow("Errore nella stesura del report: Generazione del report fallita: output vuoto.");
  });

  it("refines evidence while preserving existing sources and filtering unsupported citations", async () => {
    mocks.generate
      .mockResolvedValueOnce({ output: {
        internalDatabaseSearch: { searchType: "semantic", query: "nuovi precedenti" },
        doctrineSearch: null,
        webSearch: null,
      } })
      .mockResolvedValueOnce({ output: {
        inquadramento: { qualificazioneGiuridica: "", fattispecieEstratta: "", normeRiferimento: [] },
        mappaDialettica: {
          orientamentoFavorevole: {
            titoloTesi: "Favorevole", argomentazioneLogica: "arg", fonti: [
              { id: "new-source", fonte: "interna", gradoPertinenza: 90 },
              { id: "untrusted", fonte: "interna", gradoPertinenza: 50 },
            ],
          },
          orientamentoContrario: null, puntiAperti: ["nuovo"],
        },
      } });
    mocks.internalSearch.mockResolvedValue([{
      _type: "giurisprudenza_semantica", id: "new-source", numero_sentenza: "12/2024",
    }]);
    const handler = refineResearchFlow as unknown as (input: unknown) => Promise<unknown>;
    const result = await handler({
      originalPrompt: "Q", direttivaHitl: "approfondisci",
      currentInquadramento: { qualificazioneGiuridica: "già", fattispecieEstratta: "", normeRiferimento: [] },
      currentMappaDialettica: { orientamentoFavorevole: null, orientamentoContrario: null, puntiAperti: ["aperto"] },
      currentMappaConcettuale: null, docs: [], userId: "u1",
      config: { confidenceLevel: 80, sourceWeb: false, sourceInternalDB: true, sourceDoctrine: false, webLimit: 5 },
    }) as { inquadramento: { qualificazioneGiuridica: string }; mappaDialettica: { orientamentoFavorevole: { fonti: Array<{ id: string; nuova?: boolean }> }; puntiAperti: string[] } };
    expect(result.inquadramento.qualificazioneGiuridica).toBe("già");
    expect(result.mappaDialettica.orientamentoFavorevole.fonti).toEqual([
      { id: "new-source", fonte: "interna", gradoPertinenza: 90, nuova: true, tipoFonte: "provvedimento", titolo: "Sentenza 12/2024" },
    ]);
    expect(result.mappaDialettica.puntiAperti).toEqual(["aperto", "nuovo"]);
  });

  it("converts mapping failures into a descriptive research error", async () => {
    mocks.generate.mockRejectedValue(new Error("provider down"));
    const handler = researchAnalysisFlow as unknown as (input: unknown) => Promise<unknown>;
    await expect(handler({
      prompt: "Q", docs: [], userId: "u1",
      config: { confidenceLevel: 80, sourceWeb: false, sourceInternalDB: false, sourceDoctrine: false, webLimit: 5 },
    })).rejects.toThrow("Errore durante la generazione della mappa dialettica: provider down");
  });
});
