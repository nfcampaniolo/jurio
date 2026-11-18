import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchWithSecurity: vi.fn() }));
vi.mock("@word/firebase/functions", () => ({ fetchWithSecurity: mocks.fetchWithSecurity }));

import CaseLaw, { CASE_LAW_DOCUMENT_LIMIT } from "@word/tools/CaseLaw";
import { installWordMock } from "../mocks/office";
import { SSE_DONE, sseEvent, sseResponse } from "../mocks/sse";

const esito = {
  sintesi: "Contratto di locazione commerciale con clausola di rinuncia all'indennità.",
  query: ["rinuncia indennità avviamento locazione commerciale"],
  risultati: [
    {
      id: "s1", titolo: "Cassazione civile n. 1/2020", organo: "Cassazione civile", sezione: "", numero: "1/2020",
      ecli: "", massima: "Nulla la rinuncia preventiva.", tipoMassima: "difforme", score: 0.8,
    },
  ],
};

describe("Giurisprudenza per il documento", () => {
  beforeEach(() => {
    mocks.fetchWithSecurity.mockReset();
  });

  it("invia il documento intero e mostra sintesi, ricerche eseguite e precedenti", async () => {
    installWordMock({ bodyText: "Contratto..." });
    mocks.fetchWithSecurity.mockResolvedValue(sseResponse([sseEvent({ result: esito }), SSE_DONE]));
    render(<CaseLaw />);
    fireEvent.click(screen.getByRole("button", { name: "Trova la giurisprudenza" }));
    expect(await screen.findByText("Precedenti pertinenti (1)")).toBeInTheDocument();
    expect(mocks.fetchWithSecurity.mock.calls[0][1]).toEqual({ action: "case_law", documento: "Contratto..." });
    expect(screen.getByText(esito.sintesi)).toBeInTheDocument();
    expect(screen.getByText(esito.query[0])).toBeInTheDocument();
    expect(screen.getByText("Difforme")).toBeInTheDocument();
  });

  it("'Solo selezione' usa il testo selezionato", async () => {
    installWordMock({ selectionText: "Art. 5 – Recesso", bodyText: "Tutto" });
    mocks.fetchWithSecurity.mockResolvedValue(sseResponse([sseEvent({ result: esito }), SSE_DONE]));
    render(<CaseLaw />);
    fireEvent.click(screen.getByRole("radio", { name: "Solo selezione" }));
    fireEvent.click(screen.getByRole("button", { name: "Trova la giurisprudenza" }));
    await screen.findByText("Precedenti pertinenti (1)");
    expect(mocks.fetchWithSecurity.mock.calls[0][1].documento).toBe("Art. 5 – Recesso");
  });

  it.each([
    [{ bodyText: "" }, "Il documento è vuoto."],
    [{ bodyText: "x".repeat(CASE_LAW_DOCUMENT_LIMIT + 1) }, /seleziona la sezione da analizzare/],
  ])("non invia nulla se il documento è vuoto o troppo esteso", async (word, message) => {
    installWordMock(word);
    render(<CaseLaw />);
    fireEvent.click(screen.getByRole("button", { name: "Trova la giurisprudenza" }));
    expect(await screen.findByText(message)).toBeInTheDocument();
    expect(mocks.fetchWithSecurity).not.toHaveBeenCalled();
  });

  it("mostra il messaggio del tetto mensile restituito dal server", async () => {
    installWordMock({ bodyText: "Atto" });
    mocks.fetchWithSecurity.mockResolvedValue({
      ok: false,
      status: 429,
      json: async () => ({ details: "Hai utilizzato tutte le richieste AI del mese incluse nel tuo piano." }),
    });
    render(<CaseLaw />);
    fireEvent.click(screen.getByRole("button", { name: "Trova la giurisprudenza" }));
    expect(await screen.findByText(/tutte le richieste AI del mese/)).toBeInTheDocument();
  });
});
