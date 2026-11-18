import React from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  logout: vi.fn(),
  authCallback: null as null | ((u: unknown) => void),
  fetchWithSecurity: vi.fn(),
}));

vi.mock("@word/firebase/auth", () => ({
  logout: mocks.logout,
  loginWithEmail: vi.fn(),
  onAuthStateChange: (cb: (u: unknown) => void) => {
    mocks.authCallback = cb;
    return () => {};
  },
}));
vi.mock("@word/firebase/functions", () => ({ fetchWithSecurity: mocks.fetchWithSecurity }));
vi.mock("@word/tools/FascicoloSelector", () => ({ FascicoloSelector: () => null }));

import { DocumentInputArea } from "@word/tools/DocumentInputArea";
import FonteCard from "@word/tools/FonteCard";
import ToolHome from "@word/tools/ToolHome";
import Workspace from "@word/app/Workspace";
import App from "@word/taskpane/components/App";
import { installWordMock, uninstallOfficeMocks } from "./mocks/office";

describe("DocumentInputArea", () => {
  const setup = () => {
    const props = {
      testo: "",
      setTesto: vi.fn(),
      istruzioni: "",
      setIstruzioni: vi.fn(),
      isLoading: false,
      onError: vi.fn(),
    };
    render(<DocumentInputArea {...props} />);
    return props;
  };

  it("'Selezione' legge il testo selezionato", async () => {
    installWordMock({ selectionText: "clausola selezionata" });
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: "Selezione" }));
    await waitFor(() => expect(p.setTesto).toHaveBeenCalledWith("clausola selezionata"));
  });

  it("ignora una selezione vuota", async () => {
    const word = installWordMock({ selectionText: "   " });
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: "Selezione" }));
    await waitFor(() => expect(word.sync).toHaveBeenCalled());
    expect(p.setTesto).not.toHaveBeenCalled();
  });

  it("'Tutto l'atto' legge l'intero corpo del documento", async () => {
    installWordMock({ bodyText: "Intero contratto" });
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: "Tutto l'atto" }));
    await waitFor(() => expect(p.setTesto).toHaveBeenCalledWith("Intero contratto"));
  });

  it("riporta l'errore se Word.run fallisce", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const word = installWordMock();
    word.run.mockRejectedValue(new Error("GeneralException"));
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: "Tutto l'atto" }));
    await waitFor(() => expect(p.onError).toHaveBeenCalledWith("Impossibile leggere il documento intero."));
  });

  it("fuori da Word non tenta di leggere il documento", () => {
    uninstallOfficeMocks();
    const p = setup();
    fireEvent.click(screen.getByRole("button", { name: "Selezione" }));
    expect(p.onError).toHaveBeenCalledWith(expect.stringContaining("Microsoft Word"));
  });
});

describe("FonteCard", () => {
  it("collega la fonte alla scheda Jurio e formatta i numeri di sentenza", () => {
    render(<FonteCard fonte={{ id: "abc", titolo: "12/2021", score: 88 }} />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "https://jurio.it/giurisprudenza/abc");
    expect(link).toHaveTextContent("Provvedimento giuridico 12/2021");
    expect(screen.getByText("88%")).toBeInTheDocument();
  });

  it("codifica l'id nell'URL", () => {
    render(<FonteCard fonte={{ id: "a/b?c", titolo: "x" }} />);
    expect(screen.getByRole("link")).toHaveAttribute("href", "https://jurio.it/giurisprudenza/a%2Fb%3Fc");
  });

  it("senza id mostra il titolo senza link e lo score 0–1 in percentuale", () => {
    render(<FonteCard fonte={{ titolo: "Fonte web", score: 0.42 }} />);
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByText("Fonte web")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
  });
});

const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as unknown as Response;

const usage = (piano: string, limiteMensile: number | null, usateMese: number) =>
  jsonResponse({ piano, ai: { limiteMensile, usateMese } });

describe("ToolHome", () => {
  it("separa gli strumenti senza AI da quelli con AI e ogni scheda apre il relativo strumento", () => {
    const onSelect = vi.fn();
    render(<ToolHome onSelectTool={onSelect} />);
    const ricerca = screen.getByRole("region", { name: "Ricerca" });
    const ai = screen.getByRole("region", { name: "Assistenza AI" });
    expect(within(ricerca).getByText("Senza AI")).toBeInTheDocument();
    expect(within(ricerca).getByText("Ricerca in banca dati")).toBeInTheDocument();
    expect(within(ai).queryByText("Ricerca in banca dati")).toBeNull();
    for (const titolo of [
      "Chiedi al documento",
      "Revisione con semaforo",
      "Giurisprudenza per il documento",
      "Redazione con fonti",
      "Riscrittura",
    ]) {
      expect(within(ai).getByText(titolo)).toBeInTheDocument();
    }
    fireEvent.click(screen.getByText("Ricerca in banca dati"));
    fireEvent.click(screen.getByText("Chiedi al documento"));
    fireEvent.click(screen.getByText("Revisione con semaforo"));
    fireEvent.click(screen.getByText("Giurisprudenza per il documento"));
    fireEvent.click(screen.getByText("Redazione con fonti"));
    fireEvent.click(screen.getByText("Riscrittura"));
    expect(onSelect.mock.calls.map((c) => c[0])).toEqual([
      "database",
      "ask",
      "compliance",
      "caseLaw",
      "search",
      "redrafting",
    ]);
  });

  it("ogni strumento ha una descrizione e l'informativa di riservatezza è presente", () => {
    render(<ToolHome onSelectTool={vi.fn()} />);
    expect(screen.getByText(/per estremi \(numero o ECLI\)/)).toBeInTheDocument();
    expect(screen.getByText("Riservatezza dei documenti")).toBeInTheDocument();
    expect(screen.getByText(/non viene salvato sui server Jurio/)).toBeInTheDocument();
  });
});

describe("Workspace", () => {
  const user = { email: "avv@studio.it" } as never;

  it("Essential: mostra piano e richieste AI residue", async () => {
    mocks.fetchWithSecurity.mockResolvedValue(usage("essential", 10, 3));
    render(<Workspace user={user} />);
    expect(await screen.findByText("Piano Essential")).toBeInTheDocument();
    expect(screen.getByText("7 di 10 richieste AI disponibili")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "3");
    expect(screen.getByText("Ogni utilizzo consuma 1 richiesta AI: 10 al mese nel tuo piano.")).toBeInTheDocument();
    expect(mocks.fetchWithSecurity).toHaveBeenCalledWith("https://wordagent.test", { action: "usage" });
  });

  it("Business: richieste AI incluse, nessun contatore", async () => {
    mocks.fetchWithSecurity.mockResolvedValue(usage("business", null, 40));
    render(<Workspace user={user} />);
    expect(await screen.findByText("Piano Business")).toBeInTheDocument();
    expect(screen.getByText("Richieste AI incluse")).toBeInTheDocument();
    expect(screen.queryByRole("progressbar")).toBeNull();
  });

  it("apre uno strumento con titolo, etichetta AI e descrizione, e torna alla home", async () => {
    mocks.fetchWithSecurity.mockResolvedValue(usage("essential", 10, 0));
    render(<Workspace user={user} />);
    expect(screen.getByText("avv@studio.it")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Revisione con semaforo"));
    expect(screen.getByRole("heading", { name: "Revisione con semaforo" })).toBeInTheDocument();
    expect(screen.getByText("AI")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Strumenti" }));
    expect(screen.getByText("Strumenti Jurio")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Ricerca in banca dati"));
    expect(screen.getByRole("heading", { name: "Ricerca in banca dati" })).toBeInTheDocument();
    expect(screen.getByText("Senza AI")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Jurio" }));
    expect(screen.getByText("Strumenti Jurio")).toBeInTheDocument();
  });

  it("richieste AI esaurite: i pulsanti AI sono disabilitati con invito al piano Business", async () => {
    mocks.fetchWithSecurity.mockResolvedValue(usage("essential", 10, 10));
    render(<Workspace user={user} />);
    await screen.findByText("0 di 10 richieste AI disponibili");
    fireEvent.click(screen.getByText("Giurisprudenza per il documento"));
    // gli strumenti si caricano all'apertura (code splitting)
    expect(await screen.findByRole("button", { name: "Trova la giurisprudenza" })).toBeDisabled();
    expect(screen.getByText("Richieste AI del mese esaurite.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "passa al piano Business" })).toHaveAttribute(
      "href",
      "https://jurio.it/profilo/piani"
    );
  });

  it("'Esci' esegue il logout", () => {
    mocks.fetchWithSecurity.mockResolvedValue(usage("business", null, 0));
    mocks.logout.mockResolvedValue(undefined);
    render(<Workspace user={user} />);
    fireEvent.click(screen.getByRole("button", { name: "Esci" }));
    expect(mocks.logout).toHaveBeenCalled();
  });
});

describe("App (gating autenticazione)", () => {
  it("mostra il caricamento, poi il login se non autenticato, poi il workspace", () => {
    mocks.fetchWithSecurity.mockResolvedValue(usage("business", null, 0));
    render(<App />);
    expect(screen.getByText("Caricamento in corso...")).toBeInTheDocument();
    act(() => mocks.authCallback?.(null));
    expect(screen.getByText("Accedi al tuo spazio di lavoro")).toBeInTheDocument();
    act(() => mocks.authCallback?.({ email: "avv@studio.it" }));
    expect(screen.getByText("avv@studio.it")).toBeInTheDocument();
  });
});
