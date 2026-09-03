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
import ProvaGratuita from "@/features/guide/components/ProvaGratuita"; // <-- adegua il path se necessario

describe("Guida - ProvaGratuita Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza l'intestazione della guida, i badge di categoria e la descrizione del trial senza carta di credito", () => {
    render(<ProvaGratuita />);

    expect(screen.getByText("3. Account")).toBeInTheDocument();
    expect(screen.getByText("7 Giorni di Prova Completa")).toBeInTheDocument();
    expect(screen.getByText("Nessuna Carta di Credito")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Periodo di Prova Gratuita",
        level: 1,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Al termine della registrazione si attiva automaticamente una finestra di/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Per accedere alla prova non è richiesta alcuna carta di credito/i
      )
    ).toBeInTheDocument();
  });

  test("renderizza le quattro funzionalità Business incluse nel trial e il link al Prompt Builder", () => {
    render(<ProvaGratuita />);

    expect(
      screen.getByRole("heading", {
        name: "Funzionalità Incluse nel Trial",
        level: 2,
      })
    ).toBeInTheDocument();

    // 1. Ricerca Semantica
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Ricerca Semantica e Nomofilattica",
        level: 3,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Interrogazione illimitata e completa della banca dati delle Corti Supreme/i)
    ).toBeInTheDocument();

    // 2. Consulente Legale
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Consulente Legale & Fascicoli",
        level: 3,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Ambiente interattivo completo con creazione di fascicoli di studio persistenti/i)
    ).toBeInTheDocument();

    // 3. Analisi Documentale & Prompt Builder
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Analisi Documentale, OCR & Trascrizioni",
        level: 3,
      })
    ).toBeInTheDocument();
    const linkPromptBuilder = screen.getByRole("link", { name: "Prompt Builder" });
    expect(linkPromptBuilder).toBeInTheDocument();
    expect(linkPromptBuilder).toHaveAttribute("href", "/profilo/prompt-builder#crea");

    // 4. Verifica Coerenza
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Verifica Coerenza & Redazione Assistita",
        level: 3,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Confronto sistematico tra atti difensivi e giurisprudenza prevalente/i)
    ).toBeInTheDocument();
  });

  test("renderizza la sezione sulla scadenza dei 7 giorni, conservazione dati e assenza di addebiti automatici", () => {
    render(<ProvaGratuita />);

    expect(
      screen.getByRole("heading", {
        name: "Cosa Succede alla Scadenza dei 7 Giorni",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Nessun Rinnovo o Addebito Automatico",
        level: 3,
      })
    ).toBeInTheDocument();

    expect(screen.getByText(/Conservazione dei Dati:/i)).toBeInTheDocument();
    expect(screen.getByText(/Scelta in Autonomia:/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /Allo scadere dei 7 giorni, il periodo di prova si conclude senza alcuna transazione economica/i
      )
    ).toBeInTheDocument();
  });

  test("renderizza l'immagine illustrativa e la didascalia esplicativa", () => {
    render(<ProvaGratuita />);

    const image = screen.getByRole("img");
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute(
      "src",
      "https://jurio.it/guida-image/prova.webp"
    );

    expect(
      screen.getByText(
        /Figura 1: Stato dell'account durante i 7 giorni di prova con accesso completo a tutti i moduli/i
      )
    ).toBeInTheDocument();
  });
});