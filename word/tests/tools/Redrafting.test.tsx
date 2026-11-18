import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchWithSecurity: vi.fn() }));
vi.mock("@word/firebase/functions", () => ({ fetchWithSecurity: mocks.fetchWithSecurity }));
// Il selettore ha i suoi test (utils.test.tsx): qui lo sostituiamo con uno stub
vi.mock("@word/tools/FascicoloSelector", () => ({
  FascicoloSelector: ({ onSelect }: { onSelect: (f: unknown) => void }) => (
    <button onClick={() => onSelect({ id: "fasc-1", title: "Rossi c. Bianchi" })}>stub-seleziona-fascicolo</button>
  ),
}));

import Redrafting from "@word/tools/Redrafting";
import { installWordMock } from "../mocks/office";
import { SSE_DONE, sseEvent, sseResponse } from "../mocks/sse";

const setText = (t: string) =>
  fireEvent.change(screen.getByPlaceholderText(/Clicca 'Selezione'/), { target: { value: t } });

describe("Redrafting (Riscrivi)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("invia action=redraft con testo, direttiva e fascicolo selezionato", async () => {
    mocks.fetchWithSecurity.mockResolvedValue(sseResponse([SSE_DONE]));
    render(<Redrafting />);
    setText("Clausola originale");
    fireEvent.change(screen.getByPlaceholderText(/più stringente/), { target: { value: "più stringente" } });
    fireEvent.click(screen.getByText("stub-seleziona-fascicolo"));
    fireEvent.click(screen.getByRole("button", { name: 'Riscrivi usando "Rossi c. Bianchi"' }));
    await waitFor(() => expect(mocks.fetchWithSecurity).toHaveBeenCalled());
    expect(mocks.fetchWithSecurity.mock.calls[0][1]).toEqual({
      action: "redraft",
      text: "Clausola originale",
      fascicoloId: "fasc-1",
      promptDirettiva: "più stringente",
    });
  });

  it("mostra la bozza modificabile e NON la applica in automatico", async () => {
    const word = installWordMock();
    mocks.fetchWithSecurity.mockResolvedValue(
      sseResponse([sseEvent({ result: { risultato: "Clausola riscritta" } }), SSE_DONE])
    );
    render(<Redrafting />);
    setText("Clausola originale");
    fireEvent.click(screen.getByRole("button", { name: "Riscrivi Testo" }));
    expect(await screen.findByDisplayValue("Clausola riscritta")).toBeInTheDocument();
    expect(word.selection.insertText).not.toHaveBeenCalled();
  });

  it("applica in Word la versione modificata dall'utente", async () => {
    const word = installWordMock();
    mocks.fetchWithSecurity.mockResolvedValue(
      sseResponse([sseEvent({ result: { risultato: "Bozza AI" } }), SSE_DONE])
    );
    render(<Redrafting />);
    setText("x");
    fireEvent.click(screen.getByRole("button", { name: "Riscrivi Testo" }));
    const area = await screen.findByDisplayValue("Bozza AI");
    fireEvent.change(area, { target: { value: "Bozza rivista dall'avvocato" } });
    fireEvent.click(screen.getByRole("button", { name: /Sostituisci nel Documento/ }));
    await waitFor(() =>
      expect(word.selection.insertText).toHaveBeenCalledWith("Bozza rivista dall'avvocato", "Replace")
    );
  });

  it("può appuntare la proposta come commento", async () => {
    const word = installWordMock();
    mocks.fetchWithSecurity.mockResolvedValue(sseResponse([sseEvent({ result: { risultato: "Bozza" } }), SSE_DONE]));
    render(<Redrafting />);
    setText("x");
    fireEvent.click(screen.getByRole("button", { name: "Riscrivi Testo" }));
    await screen.findByDisplayValue("Bozza");
    fireEvent.click(screen.getByRole("button", { name: /Appunta come Commento/ }));
    await waitFor(() =>
      expect(word.selection.insertComment).toHaveBeenCalledWith("[PROPOSTA RE-DRAFTING]\n\nBozza")
    );
  });

  it("mostra il messaggio del server (es. piano non abilitato)", async () => {
    mocks.fetchWithSecurity.mockResolvedValue(sseResponse([], { ok: false, status: 403 }));
    render(<Redrafting />);
    setText("x");
    fireEvent.click(screen.getByRole("button", { name: "Riscrivi Testo" }));
    expect(await screen.findByText("Il tuo piano non include questa funzione.")).toBeInTheDocument();
  });

  it("mostra un errore se lo stream termina senza bozza", async () => {
    mocks.fetchWithSecurity.mockResolvedValue(sseResponse([sseEvent({ error: { message: "Errore modello" } }), SSE_DONE]));
    render(<Redrafting />);
    setText("x");
    fireEvent.click(screen.getByRole("button", { name: "Riscrivi Testo" }));
    expect(await screen.findByText("Errore modello")).toBeInTheDocument();
  });
});
