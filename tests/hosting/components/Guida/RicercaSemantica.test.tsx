import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

/* ---------- mock react-router-dom ---------- */
vi.mock("react-router-dom", () => ({
  __esModule: true,
  Link: ({
    to,
    children,
    className,
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
}));

/* ---------- component ---------- */
import RicercaSemantica from "@/features/guide/components/RicercaSemantica"; // <-- adegua il path se necessario

describe("Guida - RicercaSemantica Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza l'intestazione della guida, i badge di categoria e la descrizione introduttiva", () => {
    render(<RicercaSemantica />);

    expect(screen.getByText("1. Casi d'uso")).toBeInTheDocument();
    expect(screen.getByText("Piano Essential / Business / Prova Gratuita")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Ricerca Semantica",
        level: 1,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /L'interfaccia della ricerca semantica è progettata per consentire l'interrogazione dell'archivio giurisprudenziale tramite linguaggio naturale/i
      )
    ).toBeInTheDocument();
  });

  test("renderizza la sezione di inserimento quesito, suggerimenti, comando vocale e livelli di raffinamento", () => {
    render(<RicercaSemantica />);

    expect(
      screen.getByRole("heading", {
        name: "Funzionamento e Inserimento del Quesito",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(screen.getByText("Suggerimento per la formulazione:")).toBeInTheDocument();
    expect(screen.getByText(/Comando vocale:/i)).toBeInTheDocument();

    // Livelli di raffinamento
    expect(
      screen.getByRole("heading", { name: "Livelli di Raffinamento", level: 3 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Filtra per argomento", level: 4 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Filtri avanzati di ricerca", level: 4 })
    ).toBeInTheDocument();

    expect(screen.getByText(/Corte:/i)).toBeInTheDocument();
    expect(screen.getByText(/Tipo massima:/i)).toBeInTheDocument();
    expect(screen.getByText(/Tipo documento:/i)).toBeInTheDocument();
    expect(screen.getByText(/Ordinamento:/i)).toBeInTheDocument();
    expect(screen.getByText(/Numero risultati:/i)).toBeInTheDocument();
    expect(screen.getByText(/Intervallo temporale \(Dal \/ Al\):/i)).toBeInTheDocument();
  });

  test("renderizza la sezione anatomia della scheda risultato e il disclaimer legale", () => {
    render(<RicercaSemantica />);

    expect(
      screen.getByRole("heading", {
        name: "Consultazione e Struttura dei Risultati",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Anatomia della Scheda Risultato", level: 3 })
    ).toBeInTheDocument();

    expect(screen.getByText("Intestazione e Atto")).toBeInTheDocument();
    expect(screen.getByText("Identificatori Ufficiali")).toBeInTheDocument();
    expect(screen.getByText("Corpo della Massima")).toBeInTheDocument();
    expect(screen.getByText("Strumenti di Sintesi")).toBeInTheDocument();

    // Disclaimer Legale
    expect(screen.getByText("Disclaimer Legale e Note di Utilizzo:")).toBeInTheDocument();
    expect(
      screen.getByText(/I contenuti non sostituiscono l'interpretazione autentica degli atti ufficiali/i)
    ).toBeInTheDocument();
  });

  test("renderizza la sezione disamina provvedimento, strumenti operativi e caricamento documenti esterni", () => {
    render(<RicercaSemantica />);

    expect(
      screen.getByRole("heading", {
        name: "Visualizzazione del Documento Giuridico",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Struttura e Analisi Contenuto", level: 3 })
    ).toBeInTheDocument();
    expect(screen.getByText(/Metadati Istituzionali:/i)).toBeInTheDocument();
    expect(screen.getByText(/Ratio decidendi:/i)).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Strumenti Operativi e Azioni", level: 3 })
    ).toBeInTheDocument();
    expect(screen.getByText(/Pannello Azioni:/i)).toBeInTheDocument();
    expect(screen.getByText(/Anteprima Documento:/i)).toBeInTheDocument();
    expect(screen.getByText(/Documenti Correlati:/i)).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Caricamento e Analisi Documenti Esterni",
        level: 3,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/consente l'upload di sentenze o atti esterni nel proprio cloud privato/i)
    ).toBeInTheDocument();
  });

  test("renderizza tutte le immagini illustrative con i rispettivi attributi alt e didascalie", () => {
    render(<RicercaSemantica />);

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(3);

    expect(images[0]).toHaveAttribute("src", "https://jurio.it/guida-image/ricerca.webp");
    expect(images[1]).toHaveAttribute("src", "https://jurio.it/guida-image/risultati.webp");
    expect(images[2]).toHaveAttribute("src", "https://jurio.it/guida-image/massima.webp");

    expect(
      screen.getByText(/Figura 1: Interfaccia di inserimento query con opzioni di raffinamento avanzato/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Figura 2: Visualizzazione delle schede ordinate per rilevanza e indicatori di provenienza/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Figura 3: Scheda di disamina del provvedimento e pannello strumenti operativi/i)
    ).toBeInTheDocument();
  });
});