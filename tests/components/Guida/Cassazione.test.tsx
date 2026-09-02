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
import Cassazione from "@/components/Guida/Cassazione"; // <-- adegua il path se necessario

describe("Guida - Cassazione Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza l'intestazione della guida, i badge di categoria e la descrizione introduttiva", () => {
    render(<Cassazione />);

    expect(screen.getByText("2. Giurisprudenza")).toBeInTheDocument();
    expect(screen.getByText("Copertura dal 2021 a oggi")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Corte Suprema di Cassazione",
        level: 1,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /La Corte di Cassazione costituisce il vertice della giurisdizione ordinaria e il nucleo principale dell'archivio integrato/i
      )
    ).toBeInTheDocument();
  });

  test("renderizza la sezione Sezioni Civili con tutte le sezioni ordinarie e le Sezioni Unite Civili", () => {
    render(<Cassazione />);

    expect(
      screen.getByRole("heading", {
        name: "Corte di Cassazione - Sezioni Civili",
        level: 2,
      })
    ).toBeInTheDocument();

    // Singole sezioni civili
    expect(screen.getByText("Prima Sezione Civile")).toBeInTheDocument();
    expect(screen.getByText("Seconda Sezione Civile")).toBeInTheDocument();
    expect(screen.getByText("Terza Sezione Civile")).toBeInTheDocument();
    expect(screen.getByText("Quarta Sezione Civile (Lavoro)")).toBeInTheDocument();
    expect(screen.getByText("Quinta Sezione Civile (Tributaria)")).toBeInTheDocument();
    expect(screen.getByText("Sesta Sezione Civile")).toBeInTheDocument();

    // Sezioni Unite
    expect(screen.getByText("Sezioni Unite Civili:")).toBeInTheDocument();
    expect(
      screen.getByText(/Risolvono contrasti interpretativi tra le sezioni ordinarie/i)
    ).toBeInTheDocument();
  });

  test("renderizza la sezione Sezioni Penali con tutte le sezioni ordinarie, la feriale e le Sezioni Unite Penali", () => {
    render(<Cassazione />);

    expect(
      screen.getByRole("heading", {
        name: "Corte di Cassazione - Sezioni Penali",
        level: 2,
      })
    ).toBeInTheDocument();

    // Singole sezioni penali
    expect(screen.getByText("Prima Sezione Penale")).toBeInTheDocument();
    expect(screen.getByText("Seconda Sezione Penale")).toBeInTheDocument();
    expect(screen.getByText("Terza Sezione Penale")).toBeInTheDocument();
    expect(screen.getByText("Quarta Sezione Penale")).toBeInTheDocument();
    expect(screen.getByText("Quinta Sezione Penale")).toBeInTheDocument();
    expect(screen.getByText("Sesta Sezione Penale")).toBeInTheDocument();
    expect(screen.getByText("Settima Sezione Penale")).toBeInTheDocument();
    expect(screen.getByText("Sezione Feriale")).toBeInTheDocument();

    // Sezioni Unite
    expect(screen.getByText("Sezioni Unite Penali:")).toBeInTheDocument();
    expect(
      screen.getByText(/Garantiscono l'uniformità interpretativa e dirimono i contrasti giurisprudenziali/i)
    ).toBeInTheDocument();
  });

  test("renderizza i criteri di indicizzazione e il link normativo a /fonti", () => {
    render(<Cassazione />);

    expect(
      screen.getByRole("heading", {
        name: "Criteri di Indicizzazione dei Provvedimenti",
        level: 3,
      })
    ).toBeInTheDocument();

    const linkFonti = screen.getByRole("link", { name: "/fonti" });
    expect(linkFonti).toBeInTheDocument();
    expect(linkFonti).toHaveAttribute("href", "/fonti");
  });

  test("renderizza l'immagine illustrativa e la didascalia esplicativa", () => {
    render(<Cassazione />);

    const image = screen.getByRole("img");
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute(
      "src",
      "https://jurio.it/guida-image/cassazione.webp"
    );

    expect(
      screen.getByText(
        /Figura 1: Interrogazione del repertorio delle Sezioni Civili e Penali della Suprema Corte/i
      )
    ).toBeInTheDocument();
  });
});