import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generate: vi.fn(), randomUUID: vi.fn(), search: vi.fn() }));
vi.mock("@functions/genai/wordAgent/_search", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@functions/genai/wordAgent/_search")>()),
  searchJurioDatabase: mocks.search,
}));
vi.mock("@functions/genai/_config", () => ({ ai: { defineFlow: (_config: unknown, handler: unknown) => handler, generate: mocks.generate } }));
vi.mock("@functions/genai/tools/index", () => ({
  internalDatabaseSearch: { name: "internalDatabaseSearch" }, webSearch: { name: "webSearch" },
  userFileSearch: { name: "userFileSearch" },
}));
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return {
    ...actual,
    default: { ...actual, randomUUID: mocks.randomUUID },
    randomUUID: mocks.randomUUID,
  };
});

import {
  estraiFontiDalRisultato,
  rimuoviIdInterni,
  wordAskFlow,
  wordCaseLawFlow,
  wordQuoteFlow,
  wordRedraftFlow,
  wordReviewFlow,
} from "@functions/genai/wordAgent/flow";

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

  it("builds source titles from the tool fields and drops sources without any", () => {
    const response = { messages: [{ role: "tool", content: [{ toolResponse: { output: [
      { id: "a", court: "Cassazione Civile", sezione: "TERZA SEZIONE CIVILE", caseNumber: "599/2025", _score: 1 },
      { id: "b", caseNumber: "12/2024" },
      { id: "c", ecli: "ECLI:IT:CASS:2020:1" },
      { id: "d", summary: "solo massima" },
    ] } }] }] };
    expect(estraiFontiDalRisultato(response).map((f) => f.titolo)).toEqual([
      "Cassazione Civile, TERZA SEZIONE CIVILE n. 599/2025",
      "12/2024",
      "ECLI:IT:CASS:2020:1",
    ]);
  });

  it("removes internal UUIDs from generated text keeping the citation", () => {
    const id = "fdcdd16a-ab95-479b-995e-aa5f9dbf8edc";
    expect(rimuoviIdInterni(`Cass. civ. n. 599/2025 (id: ${id}).`)).toBe("Cass. civ. n. 599/2025.");
    expect(rimuoviIdInterni(`Cass. civ. n. 599/2025, id: ${id}, afferma che`)).toBe("Cass. civ. n. 599/2025, afferma che");
    expect(rimuoviIdInterni(`Cass. n. 1/2024 [${id}] e **ID:** \`${id}\``)).toBe("Cass. n. 1/2024 e");
    expect(rimuoviIdInterni(`- Cass. n. 1/2024\n- ${id}\n  - sotto`)).toBe("- Cass. n. 1/2024\n\n  - sotto");
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

  describe("wordRedraftFlow", () => {
    const redraft = wordRedraftFlow as unknown as (input: unknown, context: unknown) => Promise<unknown>;

    it("isola testo e direttiva nei delimitatori e usa solo la banca dati senza fascicolo", async () => {
      mocks.generate.mockResolvedValueOnce({ text: "  Clausola riscritta  ", messages: [] });
      const out = await redraft(
        { text: "Clausola", promptDirettiva: " più chiara ", fascicoloId: null, userId: "u1" },
        { sendChunk: vi.fn() }
      );
      expect(out).toEqual({ risultato: "Clausola riscritta", fonti: [] });
      const call = mocks.generate.mock.calls[0][0];
      expect(call.messages[1].content[0].text).toBe(
        "<TESTO_DA_RISCRIVERE>\nClausola\n</TESTO_DA_RISCRIVERE>\n<DIRETTIVA>\npiù chiara\n</DIRETTIVA>"
      );
      expect(call.tools.map((t: { name: string }) => t.name)).toEqual(["internalDatabaseSearch"]);
      expect(call.messages[0].content[0].text).not.toContain("userFileSearch");
    });

    it("con un fascicolo abilita userFileSearch e passa fascicoloId nel contesto", async () => {
      mocks.generate.mockImplementationOnce(async (options: { onChunk: (c: unknown) => void }) => {
        options.onChunk({ content: [{ toolRequest: { name: "userFileSearch" } }] });
        return { text: "ok", messages: [] };
      });
      const sendChunk = vi.fn();
      await redraft({ text: "x", fascicoloId: "f1", userId: "u1" }, { sendChunk });
      const call = mocks.generate.mock.calls[0][0];
      expect(call.tools.map((t: { name: string }) => t.name)).toEqual(["internalDatabaseSearch", "userFileSearch"]);
      expect(call.context).toEqual({ userId: "u1", fascicoloId: "f1" });
      expect(sendChunk).toHaveBeenCalledWith({ status: "Consultazione dei documenti del fascicolo..." });
    });

    it("risposta vuota o errore del modello → errore generico", async () => {
      mocks.generate.mockResolvedValueOnce({ text: "  ", messages: [] });
      await expect(redraft({ text: "x", userId: "u1" }, { sendChunk: vi.fn() }))
        .rejects.toThrow("Si è verificato un errore durante la riscrittura.");
      mocks.generate.mockRejectedValueOnce(new Error("provider"));
      await expect(redraft({ text: "x", userId: "u1" }, { sendChunk: vi.fn() }))
        .rejects.toThrow("Si è verificato un errore durante la riscrittura.");
    });
  });

  describe("wordReviewFlow con criteri (prompt Jurio o playbook)", () => {
    it("aggiunge i criteri delimitati dopo il documento", async () => {
      mocks.generate.mockResolvedValueOnce({ output: { tesi: [] } });
      const review = wordReviewFlow as unknown as (input: unknown, context: unknown) => Promise<unknown>;
      await review(
        { chunks: ["Art. 1"], criteri: { titolo: 'Playbook "A"', testo: "Soglia rischio: alta" }, userId: "u1" },
        { sendChunk: vi.fn() }
      );
      const text = mocks.generate.mock.calls[0][0].messages[1].content[0].text as string;
      expect(text).toContain("</TESTO_DOCUMENTO>");
      expect(text).toContain(`<CRITERI_DI_REVISIONE titolo="Playbook 'A'">\nSoglia rischio: alta\n</CRITERI_DI_REVISIONE>`);
      expect(text.indexOf("</TESTO_DOCUMENTO>")).toBeLessThan(text.indexOf("<CRITERI_DI_REVISIONE"));
    });
  });

  describe("wordAskFlow", () => {
    const ask = wordAskFlow as unknown as (input: unknown, context: unknown) => Promise<unknown>;

    it("documento e domanda delimitati, cronologia come turni, solo la banca dati come strumento", async () => {
      mocks.generate.mockResolvedValueOnce({ text: " Risposta ", messages: [] });
      const out = await ask(
        {
          domanda: "Chi può recedere?",
          documento: "Contratto...",
          cronologia: [{ role: "user", text: "prima" }, { role: "model", text: "risposta" }],
          userId: "u1",
        },
        { sendChunk: vi.fn() }
      );
      expect(out).toEqual({ risposta: "Risposta", fonti: [] });
      const call = mocks.generate.mock.calls[0][0];
      expect(call.messages.map((m: { role: string }) => m.role)).toEqual(["system", "user", "model", "user"]);
      expect(call.messages[3].content[0].text).toBe(
        "<DOCUMENTO>\nContratto...\n</DOCUMENTO>\n<DOMANDA>\nChi può recedere?\n</DOMANDA>"
      );
      expect(call.tools.map((t: { name: string }) => t.name)).toEqual(["internalDatabaseSearch"]);
    });

    it("senza documento lo dichiara nel prompt di sistema", async () => {
      mocks.generate.mockResolvedValueOnce({ text: "ok", messages: [] });
      await ask({ domanda: "x", userId: "u1" }, { sendChunk: vi.fn() });
      const call = mocks.generate.mock.calls[0][0];
      expect(call.messages[0].content[0].text).toContain("il documento non è stato allegato");
      expect(call.messages.at(-1).content[0].text).toBe("<DOMANDA>\nx\n</DOMANDA>");
    });

    it("risposta vuota o errore → messaggio generico", async () => {
      mocks.generate.mockResolvedValueOnce({ text: "", messages: [] });
      await expect(ask({ domanda: "x", userId: "u1" }, { sendChunk: vi.fn() }))
        .rejects.toThrow("Si è verificato un errore durante la risposta.");
    });
  });

  describe("wordCaseLawFlow", () => {
    const caseLaw = wordCaseLawFlow as unknown as (input: unknown, context: unknown) => Promise<unknown>;

    it("una sola chiamata al modello, poi ricerca semantica per ogni query con dedup per id e ordinamento", async () => {
      mocks.generate.mockResolvedValueOnce({ output: { sintesi: " Sintesi ", query: ["q1", " ", "q2"] } });
      mocks.search
        .mockResolvedValueOnce({ risultati: [{ id: "a", score: 0.7 }, { id: "b", score: 0.9 }], messaggio: null })
        .mockResolvedValueOnce({ risultati: [{ id: "a", score: 0.8 }], messaggio: null });
      const sendChunk = vi.fn();
      const out = await caseLaw({ documento: "Atto", userId: "u1" }, { sendChunk });
      expect(mocks.generate).toHaveBeenCalledOnce();
      expect(mocks.generate.mock.calls[0][0].model).toBe("vertexai/gemini-3.5-flash-lite");
      expect(mocks.generate.mock.calls[0][0].prompt).toBe("<DOCUMENTO>\nAtto\n</DOCUMENTO>");
      expect(mocks.search).toHaveBeenCalledWith({ mode: "semantic", query: "q1", userId: "u1", limit: 8 });
      expect(mocks.search).toHaveBeenCalledTimes(2);
      expect(out).toEqual({
        sintesi: "Sintesi",
        query: ["q1", "q2"],
        risultati: [{ id: "b", score: 0.9 }, { id: "a", score: 0.8 }],
      });
      expect(sendChunk).toHaveBeenCalledWith({ status: "Ricerca dei precedenti pertinenti..." });
    });

    it("una ricerca fallita non blocca le altre", async () => {
      mocks.generate.mockResolvedValueOnce({ output: { sintesi: "S", query: ["q1", "q2"] } });
      mocks.search
        .mockRejectedValueOnce(new Error("vector"))
        .mockResolvedValueOnce({ risultati: [{ id: "x", score: 0.5 }], messaggio: null });
      const out = (await caseLaw({ documento: "A", userId: "u1" }, { sendChunk: vi.fn() })) as { risultati: unknown[] };
      expect(out.risultati).toEqual([{ id: "x", score: 0.5 }]);
    });

    it("lite fallito → una sola ripetuta con il modello predefinito", async () => {
      mocks.generate
        .mockRejectedValueOnce(new Error("lite down"))
        .mockResolvedValueOnce({ output: { sintesi: "S", query: ["q1"] } });
      mocks.search.mockResolvedValueOnce({ risultati: [], messaggio: null });
      const out = (await caseLaw({ documento: "A", userId: "u1" }, { sendChunk: vi.fn() })) as { sintesi: string };
      expect(out.sintesi).toBe("S");
      expect(mocks.generate).toHaveBeenCalledTimes(2);
      expect(mocks.generate.mock.calls[1][0].model).toBeUndefined();
    });

    it("sintesi assente → errore generico, nessuna ricerca", async () => {
      mocks.generate.mockResolvedValue({ output: null });
      await expect(caseLaw({ documento: "A", userId: "u1" }, { sendChunk: vi.fn() }))
        .rejects.toThrow("Si è verificato un errore durante la sintesi del documento.");
      expect(mocks.search).not.toHaveBeenCalled();
    });
  });
});
