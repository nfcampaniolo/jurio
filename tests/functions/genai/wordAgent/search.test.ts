import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ tool: vi.fn() }));
vi.mock("@functions/genai/tools/index", () => ({ internalDatabaseSearch: mocks.tool }));

import { mapToolResults, searchJurioDatabase, titoloProvvedimento, toolMessage } from "@functions/genai/wordAgent/_search";

describe("wordAgent – ricerca senza AI", () => {
  beforeEach(() => {
    mocks.tool.mockReset();
  });

  it("compone il titolo con organo, sezione e numero", () => {
    expect(titoloProvvedimento({ organo: "Cassazione civile", sezione: "Sez. III", numero: "1234/2020" }))
      .toBe("Cassazione civile, Sez. III n. 1234/2020");
    expect(titoloProvvedimento({})).toBe("Provvedimento");
  });

  it("normalizza l'output dello strumento, scarta messaggi ed errori, arrotonda lo score", () => {
    const out = mapToolResults([
      { id: "s1", court: "Cassazione", sezione: "III", caseNumber: "1/2020", ecli: "ECLI:IT", summary: "Massima",
        tipoMassima: "conforme", _score: 0.8765, sourceUrl: "https://x.it" },
      { message: "Nessun risultato" },
      { error: "boom" },
      { id: 5 },
    ]);
    expect(out).toEqual([{
      id: "s1", titolo: "Cassazione, III n. 1/2020", organo: "Cassazione", sezione: "III", numero: "1/2020",
      ecli: "ECLI:IT", massima: "Massima", tipoMassima: "conforme", score: 0.88, url: "https://x.it",
    }]);
    expect(mapToolResults({ topMatches: [] })).toEqual([]);
  });

  it("riporta il messaggio informativo dello strumento", () => {
    expect(toolMessage([{ message: "Nessuna sentenza trovata" }])).toBe("Nessuna sentenza trovata");
    expect(toolMessage([{ id: "s1" }])).toBeNull();
  });

  it.each([
    ["exact", { searchType: "exact", caseNumber: "1234/2020" }],
    ["semantic", { searchType: "semantic", query: "1234/2020" }],
    ["legal_reference", { searchType: "legal_reference", query: "1234/2020" }],
  ] as const)("modalità %s → input corretto per lo strumento, con contesto utente", async (mode, expected) => {
    mocks.tool.mockResolvedValue([]);
    await searchJurioDatabase({ mode, query: "1234/2020", userId: "u1" });
    expect(mocks.tool).toHaveBeenCalledWith(expected, { context: { userId: "u1", uiFilters: [], dbLimit: 10 } });
  });
});
