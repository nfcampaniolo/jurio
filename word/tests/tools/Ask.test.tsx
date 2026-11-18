import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchWithSecurity: vi.fn() }));
vi.mock("@word/firebase/functions", () => ({ fetchWithSecurity: mocks.fetchWithSecurity }));

import Ask, { ASK_DOCUMENT_LIMIT } from "@word/tools/Ask";
import { readMemoryState } from "@word/tools/memoryState";
import { installWordMock } from "../mocks/office";
import { SSE_DONE, sseEvent, sseResponse } from "../mocks/sse";

const risposta = (testo: string) =>
  sseResponse([
    sseEvent({ message: { status: "Ricerca nella banca dati Jurio..." } }),
    sseEvent({ result: { risposta: testo, fonti: [{ id: "s1", titolo: "1234/2020" }] } }),
    SSE_DONE,
  ]);

const chiedi = (domanda: string) => {
  fireEvent.change(screen.getByLabelText("Domanda"), { target: { value: domanda } });
  fireEvent.click(screen.getByRole("button", { name: "Invia domanda" }));
};

describe("Chiedi al documento", () => {
  beforeEach(() => {
    mocks.fetchWithSecurity.mockReset();
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("invia domanda e documento intero, mostra risposta e fonti", async () => {
    installWordMock({ bodyText: "Contratto di locazione..." });
    mocks.fetchWithSecurity.mockResolvedValue(risposta("Il conduttore deve **pagare** il canone."));
    render(<Ask />);
    chiedi("Quali obblighi ha il conduttore?");
    expect(await screen.findByText("pagare")).toBeInTheDocument();
    expect(screen.getByText("pagare").tagName).toBe("STRONG");
    expect(mocks.fetchWithSecurity.mock.calls[0][1]).toEqual({
      action: "ask",
      domanda: "Quali obblighi ha il conduttore?",
      documento: "Contratto di locazione...",
      cronologia: [],
    });
    expect(screen.getByRole("link", { name: /1234\/2020/ })).toBeInTheDocument();
  });

  it("la seconda domanda invia la cronologia della conversazione", async () => {
    installWordMock({ bodyText: "Atto" });
    mocks.fetchWithSecurity.mockResolvedValueOnce(risposta("Prima risposta")).mockResolvedValueOnce(risposta("Seconda"));
    render(<Ask />);
    chiedi("Prima?");
    await screen.findByText("Prima risposta");
    chiedi("E poi?");
    await screen.findByText("Seconda");
    expect(mocks.fetchWithSecurity.mock.calls[1][1].cronologia).toEqual([
      { role: "user", text: "Prima?" },
      { role: "model", text: "Prima risposta" },
    ]);
  });

  it("contesto 'Nessuno' non legge il documento", async () => {
    const word = installWordMock({ bodyText: "Riservato" });
    mocks.fetchWithSecurity.mockResolvedValue(risposta("ok"));
    render(<Ask />);
    fireEvent.click(screen.getByRole("radio", { name: "Nessuno" }));
    chiedi("Domanda generale");
    await screen.findByText("ok");
    expect(word.run).not.toHaveBeenCalled();
    expect(mocks.fetchWithSecurity.mock.calls[0][1].documento).toBe("");
  });

  it("documento troppo lungo: chiede di selezionare una parte e non consuma richieste", async () => {
    installWordMock({ bodyText: "x".repeat(ASK_DOCUMENT_LIMIT + 1) });
    render(<Ask />);
    chiedi("Domanda");
    expect(await screen.findByText(/seleziona la parte pertinente/)).toBeInTheDocument();
    expect(mocks.fetchWithSecurity).not.toHaveBeenCalled();
  });

  it("in caso di errore la domanda torna nel campo per reinviarla", async () => {
    installWordMock({ bodyText: "Atto" });
    mocks.fetchWithSecurity.mockResolvedValue(sseResponse([sseEvent({ error: { message: "Errore modello" } }), SSE_DONE]));
    render(<Ask />);
    chiedi("Domanda persa?");
    expect(await screen.findByText("Errore modello")).toBeInTheDocument();
    expect(screen.getByLabelText("Domanda")).toHaveValue("Domanda persa?");
    expect(readMemoryState("ask_turni")).toEqual([]);
  });

  it("'Inserisci come commento' commenta la selezione solo su richiesta", async () => {
    const word = installWordMock({ bodyText: "Atto" });
    mocks.fetchWithSecurity.mockResolvedValue(risposta("Risposta da annotare"));
    render(<Ask />);
    chiedi("Domanda");
    await screen.findByText("Risposta da annotare");
    expect(word.selection.insertComment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Inserisci come commento" }));
    await waitFor(() => expect(word.selection.insertComment).toHaveBeenCalledWith("Risposta da annotare"));
  });

  it("il riquadro di invio ha la dettatura e il pulsante di invio si attiva solo con testo", () => {
    render(<Ask />);
    expect(screen.getByRole("button", { name: "Detta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Invia domanda" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Domanda"), { target: { value: "x" } });
    expect(screen.getByRole("button", { name: "Invia domanda" })).toBeEnabled();
  });

  it("Maiusc+Invio non invia, Invio sì", async () => {
    installWordMock({ bodyText: "Atto" });
    mocks.fetchWithSecurity.mockResolvedValue(risposta("ok"));
    render(<Ask />);
    const campo = screen.getByLabelText("Domanda");
    fireEvent.change(campo, { target: { value: "Domanda" } });
    fireEvent.keyDown(campo, { key: "Enter", shiftKey: true });
    expect(mocks.fetchWithSecurity).not.toHaveBeenCalled();
    fireEvent.keyDown(campo, { key: "Enter" });
    expect(await screen.findByText("ok")).toBeInTheDocument();
  });

  it("'Nuova conversazione' svuota la cronologia", async () => {
    installWordMock({ bodyText: "Atto" });
    mocks.fetchWithSecurity.mockResolvedValue(risposta("Risposta"));
    render(<Ask />);
    chiedi("Domanda");
    await screen.findByText("Risposta");
    fireEvent.click(screen.getByRole("button", { name: "Nuova conversazione" }));
    expect(screen.queryByText("Risposta")).toBeNull();
    expect(screen.getByText("Esempi di domande:")).toBeInTheDocument();
  });
});
