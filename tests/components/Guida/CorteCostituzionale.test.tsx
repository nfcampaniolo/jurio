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
import CorteCostituzionale from "@/features/guide/components/CorteCostituzionale"; // <-- adegua il path se necessario

describe("Guida - CorteCostituzionale Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza l'intestazione della guida, i badge di categoria e la descrizione introduttiva", () => {
    render(<CorteCostituzionale />);

    expect(screen.getByText("2. Giurisprudenza")).toBeInTheDocument();
    expect(screen.getByText("Copertura dal 2021 a oggi")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Corte Costituzionale",
        level: 1,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /è l'organo supremo di garanzia che assicura il rispetto della Costituzione della Repubblica Italiana/i
      )
    ).toBeInTheDocument();
  });

  test("renderizza gli ambiti di competenza (Controllo di Costituzionalità, Conflitti di Attribuzione, Referendum) e i rispettivi badge", () => {
    render(<CorteCostituzionale />);

    expect(
      screen.getByRole("heading", {
        name: "Ambiti di Competenza e Tipologie di Giudizio",
        level: 2,
      })
    ).toBeInTheDocument();

    // 1. Controllo di Costituzionalità
    expect(screen.getByText("Giudizio di Legittimità")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Controllo di Costituzionalità",
        level: 3,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Verifica che le leggi e gli atti aventi forza di legge dello Stato/i)
    ).toBeInTheDocument();

    // 2. Conflitti di Attribuzione
    expect(screen.getByText("Conflitti Istituzionali")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Conflitti di Attribuzione",
        level: 3,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Risolve le controversie relative alla delimitazione dei poteri tra organi dello Stato/i)
    ).toBeInTheDocument();

    // 3. Giudizio sui Referendum
    expect(screen.getByText("Partecipazione Popolare")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Giudizio sui Referendum",
        level: 3,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Valuta l'ammissibilità dei quesiti di referendum abrogativo/i)
    ).toBeInTheDocument();
  });

  test("renderizza la sezione sulle tipologie di atti catalogati e il link a /fonti", () => {
    render(<CorteCostituzionale />);

    expect(
      screen.getByRole("heading", {
        name: "Tipologia di Provvedimenti Catalogati",
        level: 3,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(/sentenze di accoglimento, sentenze di rigetto, sentenze interpretative/i)
    ).toBeInTheDocument();

    const linkFonti = screen.getByRole("link", { name: "/fonti" });
    expect(linkFonti).toBeInTheDocument();
    expect(linkFonti).toHaveAttribute("href", "/fonti");
  });

  test("renderizza l'immagine illustrativa e la didascalia esplicativa", () => {
    render(<CorteCostituzionale />);

    const image = screen.getByRole("img");
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute(
      "src",
      "https://jurio.it/guida-image/costituzionale.webp"
    );

    expect(
      screen.getByText(
        /Figura 1: Dettaglio di una sentenza della Consulta con parametri costituzionali e dispositivo/i
      )
    ).toBeInTheDocument();
  });
});