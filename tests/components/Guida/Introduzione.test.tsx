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
import Introduzione from "@/features/guide/components/Introduzione"; // <-- adegua il path se necessario

describe("Guida - Introduzione Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza l'intestazione della guida, il badge di categoria e la descrizione introduttiva", () => {
    render(<Introduzione />);

    expect(screen.getByText("Documentazione Ufficiale")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Introduzione a Jurio",
        level: 1,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Jurio è un assistente legale virtuale innovativo che combina l'intelligenza artificiale con una vasta banca dati/i
      )
    ).toBeInTheDocument();
  });

  test("renderizza la sezione 'Cosa Offre Jurio' con le card dedicate a IA, Banca Dati e il link a /fonti", () => {
    render(<Introduzione />);

    expect(
      screen.getByRole("heading", {
        name: "Cosa Offre Jurio",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Intelligenza Artificiale Specializzata",
        level: 3,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Banca Dati Completa",
        level: 3,
      })
    ).toBeInTheDocument();

    const linkFonti = screen.getByRole("link", { name: "/fonti" });
    expect(linkFonti).toBeInTheDocument();
    expect(linkFonti).toHaveAttribute("href", "/fonti");
  });

  test("renderizza le quattro funzionalità operative nella sezione 'Cosa puoi fare con Jurio'", () => {
    render(<Introduzione />);

    expect(
      screen.getByRole("heading", {
        name: "3. Cosa puoi fare con Jurio",
        level: 3,
      })
    ).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Ricerca Legale", level: 4 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Analisi Documentale", level: 4 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Redazione Assistita", level: 4 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ricerca Avanzata", level: 4 })).toBeInTheDocument();
  });

  test("renderizza i vantaggi principali e il link alla sezione 'Analisi documentale'", () => {
    render(<Introduzione />);

    expect(
      screen.getByRole("heading", {
        name: "Vantaggi Principali",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Efficienza Operativa", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Accuratezza", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Versatilità", level: 3 })).toBeInTheDocument();

    const linkAnalisi = screen.getByRole("link", { name: "Analisi documentale" });
    expect(linkAnalisi).toBeInTheDocument();
    expect(linkAnalisi).toHaveAttribute("href", "/guida/analisi-documenti");
  });

  test("renderizza la sezione 'Come Utilizzare questa Guida' con le tre aree tematiche", () => {
    render(<Introduzione />);

    expect(
      screen.getByRole("heading", {
        name: "Come Utilizzare questa Guida",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(screen.getByText(/Casi d'uso:/i)).toBeInTheDocument();
    expect(screen.getByText(/Giurisprudenza:/i)).toBeInTheDocument();
    expect(screen.getByText(/Account & Supporto:/i)).toBeInTheDocument();
  });

  test("renderizza le immagini illustrative e le didascalie", () => {
    render(<Introduzione />);

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(2);

    expect(images[0]).toHaveAttribute("src", "https://jurio.it/guida-image/introduzione.webp");
    expect(images[1]).toHaveAttribute("src", "https://jurio.it/guida-image/add-in.webp");

    expect(
      screen.getByText(/Figura 1: Panoramica dell'interfaccia principale di Jurio/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Figura 2: Interazione diretta via chat ed elaborazione assistita/i)
    ).toBeInTheDocument();
  });
});