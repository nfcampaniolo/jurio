import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

/* ---------- mock react-router-dom ---------- */
vi.mock("react-router-dom", () => ({
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
import AnalisiDocumenti from "@/features/guide/components/AnalisiDocumenti"; // <-- adegua il path se necessario

describe("Guida - AnalisiDocumenti Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza l'intestazione della guida, i badge di categoria e la descrizione introduttiva", () => {
    render(<AnalisiDocumenti />);

    expect(screen.getByText("1. Casi d'uso")).toBeInTheDocument();
    expect(screen.getByText("Piano Business / Prova Gratuita")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Analisi Documentale", level: 1 })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /è lo strumento dedicato all'elaborazione avanzata, all'estrazione dati e alla strutturazione di file esterni/i
      )
    ).toBeInTheDocument();
  });

  test("renderizza le modalità di caricamento e i tag dei formati file supportati", () => {
    render(<AnalisiDocumenti />);

    expect(
      screen.getByRole("heading", {
        name: "Formati Supportati e Caricamento",
        level: 2,
      })
    ).toBeInTheDocument();

    // Modalità di caricamento
    expect(screen.getByRole("heading", { name: "Drag & Drop", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Dispositivo Locale", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cloud Personale", level: 3 })).toBeInTheDocument();

    // Formati file
    expect(screen.getByText("Estensioni e tipologie di file supportate:")).toBeInTheDocument();
    const formats = [
      "PDF",
      "Word (.docx)",
      "EML (Email)",
      "PowerPoint",
      "Excel",
      "Immagini (PNG, JPG)",
      "Audio MP3",
    ];
    formats.forEach((format) => {
      expect(screen.getByText(format)).toBeInTheDocument();
    });
  });

  test("renderizza i moduli di estrazione OCR e trascrizione audio", () => {
    render(<AnalisiDocumenti />);

    expect(
      screen.getByRole("heading", {
        name: "Motore di Estrazione e Riconoscimento",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Elaboratore OCR (Immagini e PDF Scansionati)",
        level: 3,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Modulo di Trascrizione Audio",
        level: 3,
      })
    ).toBeInTheDocument();

    expect(screen.getByText("Generazione Documento Strutturato:")).toBeInTheDocument();
  });

  test("renderizza gli schemi di elaborazione e il link al Prompt Builder personalizzato", () => {
    render(<AnalisiDocumenti />);

    expect(
      screen.getByRole("heading", {
        name: "Schemi di Elaborazione e Prompt Builder",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Prompt Standard", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Prompt Verticali Predefiniti", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Prompt Builder Personalizzato", level: 3 })).toBeInTheDocument();

    const linkPromptBuilder = screen.getByRole("link", {
      name: /Vai al Prompt Builder \(\/profilo\/prompt-builder#crea\) →/i,
    });
    expect(linkPromptBuilder).toBeInTheDocument();
    expect(linkPromptBuilder).toHaveAttribute("href", "/profilo/prompt-builder#crea");
  });

  test("renderizza la sezione di gestione dell'archivio documenti e le azioni operative", () => {
    render(<AnalisiDocumenti />);

    expect(
      screen.getByRole("heading", {
        name: "Gestione dell'Archivio Documenti",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Azioni disponibili sulle schede archivio:",
        level: 3,
      })
    ).toBeInTheDocument();

    expect(screen.getByText(/Consultazione Dettagliata:/i)).toBeInTheDocument();
    expect(screen.getByText(/Manutenzione Archivio:/i)).toBeInTheDocument();
    expect(screen.getByText(/Integrazione con il Consulente Legale:/i)).toBeInTheDocument();
  });

  test("renderizza le immagini illustrative e le didascalie esplicative", () => {
    render(<AnalisiDocumenti />);

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(2);

    expect(images[0]).toHaveAttribute("src", "https://jurio.it/guida-image/analisi.webp");
    expect(images[1]).toHaveAttribute("src", "https://jurio.it/guida-image/prompting.webp");

    expect(
      screen.getByText(/Figura 1: Interfaccia di upload file con selezione automatica del motore di acquisizione/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Figura 2: Creazione di regole di estrazione customizzate tramite il Prompt Builder/i)
    ).toBeInTheDocument();
  });
});