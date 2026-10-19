import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generate: vi.fn(), randomUUID: vi.fn() }));
vi.mock("@functions/genai/_config", () => ({ ai: { defineFlow: (_config: unknown, handler: unknown) => handler, generate: mocks.generate } }));
vi.mock("@functions/genai/tools/index", () => ({
  internalDatabaseSearch: { name: "internalDatabaseSearch" }, webSearch: { name: "webSearch" },
}));
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return {
    ...actual,
    default: { ...actual, randomUUID: mocks.randomUUID },
    randomUUID: mocks.randomUUID,
  };
});

import { estraiFontiDalRisultato, wordQuoteFlow, wordReviewFlow } from "@functions/genai/wordAgent/flow";

describe("Word-agent flows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.generate.mockReset();
    mocks.randomUUID.mockReset();
  });

  it("extracts and deduplicates citation results and calculates missing scores", () => {
    const response = { messages: [{ role: "tool", content: [{ toolResponse: { output: [
      { id: "s1", titolo: "Sentenza", _distance: 0.2 }, { id: "s1", titolo: "Duplicate" },
    ] } }] }] };
    expect(estraiFontiDalRisultato(response)).toEqual([{ id: "s1", titolo: "Sentenza", url: undefined, score: 0.8 }]);
  });

  it("uses unique secure fallback keys for sources without identifiers", () => {
    mocks.randomUUID
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000001")
      .mockReturnValueOnce("00000000-0000-4000-8000-000000000002");
    const response = { messages: [{ role: "tool", content: [{ toolResponse: { output: [
      { titolo: "Prima fonte" }, { titolo: "Seconda fonte" },
    ] } }] }] };

    expect(estraiFontiDalRisultato(response)).toEqual([
      { id: "id-non-disponibile", titolo: "Prima fonte", url: undefined, score: undefined },
      { id: "id-non-disponibile", titolo: "Seconda fonte", url: undefined, score: undefined },
    ]);
    expect(mocks.randomUUID).toHaveBeenCalledTimes(2);
  });

  it("returns a safe message when quote research yields no citations and handles an empty review", async () => {
    mocks.generate.mockResolvedValueOnce({ text: "NESSUN_RISULTATO", messages: [] });
    const quote = wordQuoteFlow as unknown as (input: unknown, context: unknown) => Promise<unknown>;
    await expect(quote({ contesto: "case", userId: "u1" }, { sendChunk: vi.fn() }))
      .resolves.toEqual({ testoQuote: "Nessuna giurisprudenza pertinente trovata per questo concetto.", fonti: [] });
    mocks.generate.mockResolvedValueOnce({ output: { tesi: [] } });
    const review = wordReviewFlow as unknown as (input: unknown, context: unknown) => Promise<unknown>;
    await expect(review({ chunks: [], userId: "u1" }, { sendChunk: vi.fn() })).resolves.toEqual({ tesi: [] });
  });

  it("streams a quote answer with sources extracted from a tool response", async () => {
    mocks.generate.mockImplementationOnce(async (options: { onChunk: (chunk: unknown) => void }) => {
      options.onChunk({ content: [{ toolRequest: { name: "internalDatabaseSearch" } }] });
      return {
        text: "  Quote text  ",
        request: { messages: [{ role: "tool", content: [{ toolResponse: { output: [
          { documento_id: "doc-1", numero_sentenza: "5/24", score: 0.876 },
          { id: "broken", error: "ignore" },
        ] } }] }] },
      };
    });
    const sendChunk = vi.fn();
    const quote = wordQuoteFlow as unknown as (input: unknown, context: unknown) => Promise<unknown>;
    await expect(quote({
      contesto: "scenario", promptIndirizzamento: " focus ", filters: "invalid", userId: "u1",
    }, { sendChunk })).resolves.toEqual({
      testoQuote: "Quote text",
      fonti: [{ id: "doc-1", titolo: "5/24", url: undefined, score: 0.88 }],
    });
    expect(mocks.generate.mock.calls[0][0].messages[1].content[0].text)
      .toContain("<ISTRUZIONE_UTENTE>\nfocus");
    expect(mocks.generate.mock.calls[0][0].context.uiFilters).toEqual([]);
    expect(sendChunk).toHaveBeenCalledWith({ status: "Analisi sentenze trovate..." });
  });

  it("normalizes review sources and streams research progress for both tools", async () => {
    mocks.generate.mockImplementationOnce(async (options: { onChunk: (chunk: unknown) => void }) => {
      options.onChunk({ content: [{ toolRequest: { name: "internalDatabaseSearch", input: { query: "12/24" } } }] });
      options.onChunk({ content: [{ toolRequest: { name: "webSearch", input: {} } }] });
      return { output: { tesi: [{
        id: "", testoOriginale: "quoted text", tesiGiuridica: "claim", semaforo: "GIALLO",
        livelloVerifica: "BASSO", motivazione: "uncertain", orientamento: "unknown",
        fonti: [{ id: "invalid" }, { id: null }],
      }] } };
    });
    const sendChunk = vi.fn();
    const review = wordReviewFlow as unknown as (input: unknown, context: unknown) => Promise<unknown>;
    const output = await review({
      chunks: ["first", " ", "third"], promptIndirizzamento: "specific", userId: "u1",
    }, { sendChunk }) as { tesi: Array<{ id: string; fonti: unknown[] }> };
    expect(mocks.generate.mock.calls[0][0].messages[1].content[0].text)
      .toContain("[BLOCCO 3]\nthird");
    expect(mocks.generate.mock.calls[0][0].messages[1].content[0].text)
      .toContain("<ISTRUZIONI_SPECIFICHE>");
    expect(sendChunk).toHaveBeenCalledWith({ message: { status: 'Ricerca in archivio: "12/24"...' } });
    expect(sendChunk).toHaveBeenCalledWith({ message: { status: "Ricerca web di conferma: argomento..." } });
    expect(output.tesi[0].id).toMatch(/^tesi_\d+_0$/);
    expect(output.tesi[0].fonti).toEqual([]);
  });

  it("wraps Genkit errors from quote and review generation", async () => {
    mocks.generate.mockRejectedValueOnce(new Error("provider error"));
    const quote = wordQuoteFlow as unknown as (input: unknown, context: unknown) => Promise<unknown>;
    await expect(quote({ contesto: "scenario", userId: "u1" }, { sendChunk: vi.fn() }))
      .rejects.toThrow("Si è verificato un errore durante la ricerca o la generazione della citazione.");
    mocks.generate.mockRejectedValueOnce(new Error("provider error"));
    const review = wordReviewFlow as unknown as (input: unknown, context: unknown) => Promise<unknown>;
    await expect(review({ chunks: ["text"], userId: "u1" }, { sendChunk: vi.fn() }))
      .rejects.toThrow("Si è verificato un errore durante l'analisi di conformità.");
  });
});
