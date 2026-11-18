import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetchWithSecurity: vi.fn() }));
vi.mock("@word/firebase/functions", () => ({ fetchWithSecurity: mocks.fetchWithSecurity }));
// Il selettore dei criteri ha i suoi test: qui un semplice select evita la chiamata "prompts".
vi.mock("@word/components/PromptSelector", () => ({
  PromptSelector: ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <select aria-label="Criteri di revisione" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Standard</option>
      <option value="pb1">Playbook</option>
    </select>
  ),
}));

import Review from "@word/tools/Review";
import type { TesiReview } from "@word/tools/types";
import { installWordMock, uninstallOfficeMocks } from "../mocks/office";
import { readMemoryState, writeMemoryState } from "@word/tools/memoryState";
import { SSE_DONE, sseEvent, sseResponse } from "../mocks/sse";

const WORD_AGENT_URL = "https://wordagent.test";
const UUID = "123e4567-e89b-12d3-a456-426614174000";

const tesi = (over: Partial<TesiReview> = {}): TesiReview => ({
  id: "T1",
  testoOriginale: "Il conduttore rinuncia a qualsiasi indennità",
  tesiGiuridica: "Rinuncia preventiva all'indennità di avviamento",
  semaforo: "ROSSO",
  livelloVerifica: "ALTO",
  motivazione: "Nulla ex art. 79 L. 392/1978",
  orientamento: "Orientamento consolidato",
  fonti: [{ id: UUID, titolo: "1234/2020", rilevanza: "conforme" }],
  ...over,
});

const startReview = (text = "Il conduttore rinuncia a qualsiasi indennità di avviamento.") => {
  fireEvent.change(screen.getByPlaceholderText(/Clicca 'Selezione'/), { target: { value: text } });
  fireEvent.click(screen.getByRole("button", { name: "Analizza Conformità" }));
};

describe("Review (Analisi conformità)", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
    Element.prototype.scrollIntoView = vi.fn();
  });

  it("il bottone è disabilitato senza testo", () => {
    render(<Review />);
    expect(screen.getByRole("button", { name: "Analizza Conformità" })).toBeDisabled();
  });

  it("invia action=review con il testo spezzato in chunk e le istruzioni", async () => {
    mocks.fetchWithSecurity.mockResolvedValue(sseResponse([SSE_DONE]));
    render(<Review />);
    fireEvent.change(screen.getByPlaceholderText(/clausola risolutiva/), { target: { value: "focus" } });
    startReview("x".repeat(2000));
    await waitFor(() => expect(mocks.fetchWithSecurity).toHaveBeenCalled());
    const [url, payload] = mocks.fetchWithSecurity.mock.calls[0];
    expect(url).toBe(WORD_AGENT_URL);
    expect(payload).toMatchObject({ action: "review", promptIndirizzamento: "focus" });
    expect(payload.chunks).toHaveLength(2);
  });

  it("ricompone eventi SSE spezzati su più letture e mostra le tesi", async () => {
    const event = sseEvent({ result: { tesi: [tesi()] } });
    mocks.fetchWithSecurity.mockResolvedValue(
      sseResponse([sseEvent({ message: { status: "Ricerca in archivio" } }), event.slice(0, 20), event.slice(20), SSE_DONE])
    );
    render(<Review />);
    startReview();
    expect(await screen.findByText("Elementi Rilevati (1)")).toBeInTheDocument();
    expect(screen.getByText("ROSSO")).toBeInTheDocument();
    expect(screen.getByText("Nulla ex art. 79 L. 392/1978")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Provvedimento giuridico 1234\/2020/ });
    expect(link).toHaveAttribute("href", `https://jurio.it/giurisprudenza/${UUID}`);
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("mostra l'errore inviato nello stream", async () => {
    mocks.fetchWithSecurity.mockResolvedValue(sseResponse([sseEvent({ error: { message: "Quota esaurita" } }), SSE_DONE]));
    render(<Review />);
    startReview();
    expect(await screen.findByText("Quota esaurita")).toBeInTheDocument();
  });

  it("mostra lo status HTTP in caso di errore server", async () => {
    mocks.fetchWithSecurity.mockResolvedValue(sseResponse([], { ok: false, status: 429 }));
    render(<Review />);
    startReview();
    expect(await screen.findByText(/Limite di utilizzo raggiunto/)).toBeInTheDocument();
  });

  it("se lo stream si chiude senza risultato l'utente vede un messaggio", async () => {
    mocks.fetchWithSecurity.mockResolvedValue(sseResponse([sseEvent({ message: { status: "Lettura..." } })]));
    render(<Review />);
    startReview();
    expect(await screen.findByText(/risposta del server si è interrotta/)).toBeInTheDocument();
  });

  it("non rende link a URL non http(s) restituite dal modello", () => {
    writeMemoryState("review_risultati", [tesi({ fonti: [{ url: "javascript:alert(1)", riferimento: "Fonte sospetta" }] })]);
    render(<Review />);
    expect(screen.getByText("Fonte sospetta").closest("a")).toBeNull();
  });

  it("colora l'intera card in base al semaforo", () => {
    writeMemoryState("review_risultati", [tesi({ semaforo: "VERDE" })]);
    render(<Review />);
    expect(screen.getByText("VERDE").closest(".tesi-card")).toHaveClass("tesi-verde");
  });

  it("codifica l'id della fonte nel link", () => {
    writeMemoryState("review_risultati", [tesi({ fonti: [{ id: "a/b", titolo: "X" }] })]);
    render(<Review />);
    expect(screen.getByRole("link", { name: /X/ })).toHaveAttribute("href", "https://jurio.it/giurisprudenza/a%2Fb");
  });

  it("ripristina testo e risultati al rientro nello strumento, senza scriverli nel browser", () => {
    writeMemoryState("review_risultati", [tesi()]);
    writeMemoryState("review_testoAtto", "testo salvato");
    render(<Review />);
    expect(screen.getByDisplayValue("testo salvato")).toBeInTheDocument();
    expect(screen.getByText("Elementi Rilevati (1)")).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/Clicca 'Selezione'/), { target: { value: "Contratto riservato" } });
    expect(localStorage.length).toBe(0);
  });

  it("ignora le vecchie cache nel localStorage", () => {
    localStorage.setItem("review_risultati", JSON.stringify([tesi()]));
    render(<Review />);
    expect(screen.queryByText(/Elementi Rilevati/)).toBeNull();
  });

  it("'Ripulisci' svuota risultati e testo", () => {
    writeMemoryState("review_risultati", [tesi()]);
    writeMemoryState("review_testoAtto", "riservato");
    render(<Review />);
    fireEvent.click(screen.getByRole("button", { name: "Ripulisci" }));
    expect(screen.queryByText(/Elementi Rilevati/)).toBeNull();
    expect(readMemoryState("review_risultati")).toEqual([]);
    expect(readMemoryState("review_testoAtto")).toBe("");
  });

  it("invia il prompt o playbook scelto come promptId", async () => {
    mocks.fetchWithSecurity.mockResolvedValue(sseResponse([SSE_DONE]));
    render(<Review />);
    fireEvent.change(screen.getByLabelText("Criteri di revisione"), { target: { value: "pb1" } });
    startReview();
    await waitFor(() => expect(mocks.fetchWithSecurity).toHaveBeenCalled());
    expect(mocks.fetchWithSecurity.mock.calls[0][1]).toMatchObject({ action: "review", promptId: "pb1" });
  });

  it("mostra gli orientamenti difformi della tesi", () => {
    writeMemoryState("review_risultati", [
      tesi({ contrasti: [{ riferimento: "Cass. 99/2019", descrizione: "ammette la rinuncia successiva" }] }),
    ]);
    render(<Review />);
    expect(screen.getByText("Orientamenti difformi")).toBeInTheDocument();
    expect(screen.getByText("Cass. 99/2019")).toBeInTheDocument();
  });

  describe("commenti in Word", () => {
    it("ancora il commento al testo originale trovato nel documento", async () => {
      const word = installWordMock({ bodyText: "Art. 5 – Il conduttore rinuncia a qualsiasi indennità di avviamento." });
      writeMemoryState("review_risultati", [tesi()]);
      render(<Review />);
      fireEvent.click(screen.getByRole("button", { name: "Appunta a margine" }));
      await waitFor(() => expect(word.foundRanges[0]?.insertComment).toHaveBeenCalled());
      const comment = word.foundRanges[0].insertComment.mock.calls[0][0] as string;
      expect(comment).toContain("[SEMAFORO ROSSO]");
      expect(comment).toContain("ORIENTAMENTO:\nOrientamento consolidato");
      expect(comment).toContain(`Link: https://jurio.it/giurisprudenza/${UUID}`);
    });

    it("ripiega su snippet più corti quando il testo è stato modificato dopo l'analisi", async () => {
      const word = installWordMock({ bodyText: "Il conduttore rinuncia a qualsiasi pretesa." });
      writeMemoryState("review_risultati", [tesi()]);
      render(<Review />);
      fireEvent.click(screen.getByRole("button", { name: "Appunta a margine" }));
      await waitFor(() => expect(word.foundRanges).toHaveLength(1));
      // 100 car. → 50 car. → prime 4 parole
      expect(word.body.search.mock.calls.map((c) => c[0])).toEqual([
        "Il conduttore rinuncia a qualsiasi indennità",
        "Il conduttore rinuncia a qualsiasi indennità",
        "Il conduttore rinuncia a",
      ]);
    });

    it("segnala quando il testo non è più presente nel documento", async () => {
      installWordMock({ bodyText: "Documento completamente diverso" });
      writeMemoryState("review_risultati", [tesi()]);
      render(<Review />);
      fireEvent.click(screen.getByRole("button", { name: "Appunta a margine" }));
      expect(await screen.findByText(/Impossibile trovare una corrispondenza/)).toBeInTheDocument();
    });

    it("'Appunta Tutti' commenta solo le tesi trovate", async () => {
      const word = installWordMock({ bodyText: "Il conduttore rinuncia a qualsiasi indennità. Clausola penale." });
      writeMemoryState("review_risultati", [tesi(), tesi({ id: "T2", testoOriginale: "Testo assente dal documento corrente" })]);
      render(<Review />);
      fireEvent.click(screen.getByRole("button", { name: "Appunta Tutti" }));
      await waitFor(() => expect(word.sync).toHaveBeenCalled());
      await waitFor(() => expect(word.foundRanges.filter((r) => r.insertComment.mock.calls.length)).toHaveLength(1));
    });

    it("fuori da Word mostra un errore invece di fallire", async () => {
      uninstallOfficeMocks();
      writeMemoryState("review_risultati", [tesi()]);
      render(<Review />);
      fireEvent.click(screen.getByRole("button", { name: "Appunta a margine" }));
      expect(await screen.findByText(/solo all'interno del pannello/)).toBeInTheDocument();
    });
  });
});
