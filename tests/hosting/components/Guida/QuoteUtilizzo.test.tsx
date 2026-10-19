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
import QuoteUtilizzo from "@/features/guide/components/QuoteUtilizzo"; // <-- adegua il path se necessario

describe("Guida - QuoteUtilizzo Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza l'intestazione della guida, i badge di categoria e la descrizione introduttiva", () => {
    render(<QuoteUtilizzo />);

    expect(screen.getByText("4. Supporto")).toBeInTheDocument();
    expect(screen.getByText("Report & Metriche di Produttività")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Quote di Utilizzo, Servizi e Limiti Tecnici",
        level: 1,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /La piattaforma applica logiche di monitoraggio e soglie di sicurezza per garantire prestazioni elevate/i
      )
    ).toBeInTheDocument();
  });

  test("renderizza la differenziazione tra i piani Essential e Business per tipologia di servizi", () => {
    render(<QuoteUtilizzo />);

    expect(
      screen.getByRole("heading", {
        name: "Differenziazione dei Piani per Servizi",
        level: 2,
      })
    ).toBeInTheDocument();

    // Piano Essential
    expect(screen.getByText("Piano Essential")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Ricerca & Giurisprudenza Illimitata",
        level: 3,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Accesso illimitato alla banca dati delle Corti Supreme/i)
    ).toBeInTheDocument();

    // Piano Business / Trial
    expect(screen.getByText("Piano Business / Trial")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Suite Completa di Agenti AI",
        level: 3,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Legal Agent/i)
    ).toBeInTheDocument();
  });

  test("renderizza le metriche di tempo risparmiato, i codici agente e i limiti di rate limiting", () => {
    render(<QuoteUtilizzo />);

    expect(
      screen.getByRole("heading", {
        name: "Tracciamento dell'Efficienza Operativa",
        level: 2,
      })
    ).toBeInTheDocument();

    // Stime tempo risparmiato
    expect(
      screen.getByRole("heading", { name: "~10 minuti risparmiati", level: 3 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "~30 minuti risparmiati", level: 3 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "~15 minuti risparmiati", level: 3 })
    ).toBeInTheDocument();

    // Micro-agenti
    expect(screen.getByText("research_agent")).toBeInTheDocument();
    expect(screen.getByText("review_agent")).toBeInTheDocument();
    expect(screen.getByText("drafting_agent")).toBeInTheDocument();

    // Rate Limiting
    expect(
      screen.getByText("Soglie di Protezione e Rate Limiting per Servizio:")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Soglia al Minuto: max 20 richieste \/ min/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Soglia Giornaliera: max 200 richieste \/ giorno per servizio/i)
    ).toBeInTheDocument();
  });

  test("renderizza i parametri di caricamento file, capacità di contesto e i tag dei formati supportati", () => {
    render(<QuoteUtilizzo />);

    expect(
      screen.getByRole("heading", {
        name: "Limiti di Caricamento e Gestione del Contesto Documentale",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Specifiche Tecniche per Documento", level: 3 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Formati Supportati Nativamente", level: 3 })
    ).toBeInTheDocument();

    // Limiti tecnici
    expect(screen.getByText(/fino a circa/i)).toBeInTheDocument();
    expect(screen.getByText("30 MB")).toBeInTheDocument();
    expect(screen.getByText("800.000 caratteri")).toBeInTheDocument();
    expect(screen.getByText("150 pagine")).toBeInTheDocument();

    // Formati file
    const formats = [
      ".pdf (anche firmati .p7m)",
      ".docx / .doc",
      ".txt",
      ".eml",
      ".png / .jpg / .jpeg",
      ".xlsx",
      ".pptx / .ppt",
      ".mp3 (audio)",
    ];
    formats.forEach((format) => {
      expect(screen.getByText(format)).toBeInTheDocument();
    });
  });

  test("renderizza la nota di best practice e il link per richiedere supporto dedicato a /contatti", () => {
    render(<QuoteUtilizzo />);

    expect(screen.getByText(/Best Practice:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/è consigliabile aprire un nuovo thread all'interno dello stesso fascicolo/i)
    ).toBeInTheDocument();

    const supportLink = screen.getByRole("link", {
      name: /Contatta il Reparto Tecnico \(\/contatti\) →/i,
    });
    expect(supportLink).toBeInTheDocument();
    expect(supportLink).toHaveAttribute("href", "/contatti");
  });
});