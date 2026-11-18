import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchWithSecurity: vi.fn() }));
vi.mock("@word/firebase/functions", () => ({ fetchWithSecurity: mocks.fetchWithSecurity }));

import Search from "@word/tools/Search";
import { installWordMock } from "../mocks/office";
import { writeMemoryState } from "@word/tools/memoryState";
import { SSE_DONE, sseEvent, sseResponse } from "../mocks/sse";

const result = {
  result: {
    testoQuote: "Secondo Cass. 1234/2020, la clausola è nulla.",
    fonti: [{ id: "abc", titolo: "1234/2020", score: 0.91 }],
  },
};

const search = (text = "nullità clausola di rinuncia all'indennità") => {
  fireEvent.change(screen.getByPlaceholderText(/intelligenza artificiale/), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Cerca Fonti e Redigi" }));
};

describe("Search (Ricerca e inserimento)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("invia action=research con contesto e istruzioni", async () => {
    mocks.fetchWithSecurity.mockResolvedValue(sseResponse([SSE_DONE]));
    render(<Search />);
    search("concetto");
    await waitFor(() => expect(mocks.fetchWithSecurity).toHaveBeenCalled());
    expect(mocks.fetchWithSecurity.mock.calls[0][1]).toEqual({
      action: "research",
      contesto: "concetto",
      promptIndirizzamento: "",
      filters: [],
    });
  });

  it("mostra la sintesi e le fonti restituite", async () => {
    mocks.fetchWithSecurity.mockResolvedValue(sseResponse([sseEvent(result), SSE_DONE]));
    render(<Search />);
    search();
    expect(await screen.findByDisplayValue(/la clausola è nulla/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Provvedimento giuridico 1234/2020" })).toHaveAttribute(
      "href",
      "https://jurio.it/giurisprudenza/abc"
    );
    expect(screen.getByText("91%")).toBeInTheDocument();
  });

  it("ricompone un evento SSE spezzato su due letture di rete", async () => {
    const ev = sseEvent(result);
    mocks.fetchWithSecurity.mockResolvedValue(sseResponse([ev.slice(0, 30), ev.slice(30), SSE_DONE]));
    render(<Search />);
    search();
    expect(await screen.findByDisplayValue(/la clausola è nulla/)).toBeInTheDocument();
  });

  it("mostra l'errore se la richiesta fallisce", async () => {
    mocks.fetchWithSecurity.mockResolvedValue(sseResponse([], { ok: false, status: 500 }));
    render(<Search />);
    search();
    expect(await screen.findByText("Errore server: 500")).toBeInTheDocument();
  });

  it("mostra l'errore inviato nello stream", async () => {
    mocks.fetchWithSecurity.mockResolvedValue(sseResponse([sseEvent({ error: { message: "Servizio non disponibile" } }), SSE_DONE]));
    render(<Search />);
    search();
    expect(await screen.findByText("Servizio non disponibile")).toBeInTheDocument();
  });

  it("chiama l'endpoint wordAgent configurato per l'ambiente", async () => {
    mocks.fetchWithSecurity.mockResolvedValue(sseResponse([sseEvent(result), SSE_DONE]));
    render(<Search />);
    search();
    await waitFor(() => expect(mocks.fetchWithSecurity).toHaveBeenCalledWith("https://wordagent.test", expect.any(Object)));
  });

  it("'Cattura da Word' copia la selezione nel campo contesto", async () => {
    installWordMock({ selectionText: "Testo selezionato" });
    render(<Search />);
    fireEvent.click(screen.getByRole("button", { name: "Cattura da Word" }));
    expect(await screen.findByDisplayValue("Testo selezionato")).toBeInTheDocument();
  });

  it("'Inserisci' sostituisce la selezione con la sintesi (solo su azione esplicita)", async () => {
    const word = installWordMock();
    writeMemoryState("search_testoQuote", "Sintesi approvata");
    render(<Search />);
    expect(word.selection.insertText).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Inserisci" }));
    await waitFor(() => expect(word.selection.insertText).toHaveBeenCalledWith("Sintesi approvata", "Replace"));
  });

  it("'Commento' inserisce la sintesi come commento sulla selezione", async () => {
    const word = installWordMock();
    writeMemoryState("search_testoQuote", "Sintesi approvata");
    render(<Search />);
    fireEvent.click(screen.getByRole("button", { name: "Commento" }));
    await waitFor(() => expect(word.selection.insertComment).toHaveBeenCalledWith("Sintesi approvata"));
  });

  it("non scrive il contesto nel localStorage", () => {
    render(<Search />);
    fireEvent.change(screen.getByPlaceholderText(/intelligenza artificiale/), { target: { value: "fatti riservati" } });
    expect(localStorage.length).toBe(0);
  });
});
