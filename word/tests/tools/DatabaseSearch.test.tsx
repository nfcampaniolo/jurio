import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchWithSecurity: vi.fn() }));
vi.mock("@word/firebase/functions", () => ({ fetchWithSecurity: mocks.fetchWithSecurity }));

import DatabaseSearch from "@word/tools/DatabaseSearch";
import { installWordMock } from "../mocks/office";
import { jsonResponse } from "../mocks/http";

const risultato = {
  id: "s1",
  titolo: "Cassazione civile, Sez. III n. 1234/2020",
  organo: "Cassazione civile",
  sezione: "Sez. III",
  numero: "1234/2020",
  ecli: "ECLI:IT:CASS:2020:1234CIV",
  massima: "La rinuncia preventiva all'indennità è nulla.",
  tipoMassima: "conforme",
  score: 0.91,
};

describe("Ricerca in banca dati (senza AI)", () => {
  beforeEach(() => {
    mocks.fetchWithSecurity.mockReset();
  });

  it("cerca per concetto con action=search e mostra i provvedimenti", async () => {
    mocks.fetchWithSecurity.mockResolvedValue(jsonResponse({ risultati: [risultato], messaggio: null }));
    render(<DatabaseSearch />);
    fireEvent.change(screen.getByLabelText("Cosa cerchi"), { target: { value: " indennità di avviamento " } });
    fireEvent.click(screen.getByRole("button", { name: "Cerca" }));
    expect(await screen.findByText("Risultati (1)")).toBeInTheDocument();
    expect(mocks.fetchWithSecurity).toHaveBeenCalledWith("https://wordagent.test", {
      action: "search",
      mode: "semantic",
      query: "indennità di avviamento",
    });
    expect(screen.getByRole("link", { name: /Cassazione civile, Sez. III n. 1234\/2020/ })).toHaveAttribute(
      "href",
      "https://jurio.it/giurisprudenza/s1"
    );
    expect(screen.getByText("Conforme")).toBeInTheDocument();
    expect(screen.getByText("91%")).toBeInTheDocument();
  });

  it("le modalità Estremi e Norma inviano il tipo di ricerca corrispondente", async () => {
    mocks.fetchWithSecurity.mockResolvedValue(jsonResponse({ risultati: [], messaggio: "Nessuna sentenza trovata." }));
    render(<DatabaseSearch />);
    fireEvent.click(screen.getByRole("tab", { name: "Estremi" }));
    fireEvent.change(screen.getByLabelText("Cosa cerchi"), { target: { value: "1234/2020" } });
    fireEvent.keyDown(screen.getByLabelText("Cosa cerchi"), { key: "Enter" });
    expect(await screen.findByText("Nessuna sentenza trovata.")).toBeInTheDocument();
    expect(mocks.fetchWithSecurity.mock.calls[0][1]).toMatchObject({ mode: "exact" });

    fireEvent.click(screen.getByRole("tab", { name: "Norma" }));
    fireEvent.click(screen.getByRole("button", { name: "Cerca" }));
    await waitFor(() => expect(mocks.fetchWithSecurity).toHaveBeenCalledTimes(2));
    expect(mocks.fetchWithSecurity.mock.calls[1][1]).toMatchObject({ mode: "legal_reference" });
  });

  it("'Cita nel testo' inserisce gli estremi dopo la selezione con il link alla scheda", async () => {
    const word = installWordMock();
    mocks.fetchWithSecurity.mockResolvedValue(jsonResponse({ risultati: [risultato], messaggio: null }));
    render(<DatabaseSearch />);
    fireEvent.change(screen.getByLabelText("Cosa cerchi"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Cerca" }));
    fireEvent.click(await screen.findByRole("button", { name: "Cita nel testo" }));
    await waitFor(() =>
      expect(word.selection.insertText).toHaveBeenCalledWith(
        "Cassazione civile, Sez. III n. 1234/2020 (ECLI:IT:CASS:2020:1234CIV)",
        "End"
      )
    );
    expect(word.selection.inserted[0].hyperlink).toBe("https://jurio.it/giurisprudenza/s1");
    expect(await screen.findByText("Citazione inserita")).toBeInTheDocument();
  });

  it("'Usa la selezione' copia il testo selezionato", async () => {
    installWordMock({ selectionText: "clausola risolutiva espressa" });
    render(<DatabaseSearch />);
    fireEvent.click(screen.getByRole("button", { name: "Usa la selezione" }));
    expect(await screen.findByDisplayValue("clausola risolutiva espressa")).toBeInTheDocument();
  });

  it("mostra l'errore del server", async () => {
    mocks.fetchWithSecurity.mockResolvedValue(jsonResponse({ details: "Limite giornaliero raggiunto" }, 429));
    render(<DatabaseSearch />);
    fireEvent.change(screen.getByLabelText("Cosa cerchi"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Cerca" }));
    expect(await screen.findByText("Limite giornaliero raggiunto")).toBeInTheDocument();
  });
});
