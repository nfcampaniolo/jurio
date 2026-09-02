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
import InterfacceNavigazione from "@/components/Guida/InterfacceNavigazione"; // <-- adegua il path se necessario

describe("Guida - InterfacceNavigazione Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza l'intestazione della guida, i badge di categoria e la descrizione introduttiva", () => {
    render(<InterfacceNavigazione />);

    expect(screen.getByText("1. Casi d'uso")).toBeInTheDocument();
    expect(screen.getByText("Navigazione Globale")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Interfacce di Navigazione",
        level: 1,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /La navigazione all'interno dell'applicazione web è strutturata principalmente attorno a due elementi/i
      )
    ).toBeInTheDocument();
  });

  test("renderizza la sezione Header con panoramica, strumenti operativi e pulsanti di servizio", () => {
    render(<InterfacceNavigazione />);

    expect(
      screen.getByRole("heading", {
        name: "Barra di intestazione (Header)",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Panoramica del Servizio", level: 3 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Strumenti Operativi Centrali", level: 3 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Area Personale e Servizi", level: 3 })
    ).toBeInTheDocument();

    // Link di servizio dell'Header
    const linkAssistenza = screen.getByRole("link", { name: "Assistenza (/contatti)" });
    const linkNotifiche = screen.getByRole("link", { name: "Centro Notifiche (/notifiche)" });
    const linkGuida = screen.getByRole("link", { name: "Guida Utente (/guida)" });

    expect(linkAssistenza).toHaveAttribute("href", "/contatti");
    expect(linkNotifiche).toHaveAttribute("href", "/notifiche");
    expect(linkGuida).toHaveAttribute("href", "/guida");
  });

  test("renderizza la sezione Footer con le tre colonne (Canali & Prodotto, Supporto & Risorse, Area Legale) e i relativi link", () => {
    render(<InterfacceNavigazione />);

    expect(
      screen.getByRole("heading", {
        name: "Piè di pagina (Footer)",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Canali & Prodotto", level: 3 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Supporto & Risorse", level: 3 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Area Legale", level: 3 })
    ).toBeInTheDocument();

    // Link nel Footer
    expect(screen.getByRole("link", { name: "/fonti" })).toHaveAttribute("href", "/fonti");
    expect(screen.getByRole("link", { name: "/casi-studio" })).toHaveAttribute("href", "/casi-studio");
    expect(screen.getByRole("link", { name: "Privacy Policy (/privacy)" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Termini di Servizio (/termini)" })).toHaveAttribute("href", "/termini");
    expect(screen.getByRole("link", { name: "/gdpr" })).toHaveAttribute("href", "/gdpr");
  });

  test("renderizza le immagini illustrative e le didascalie esplicative", () => {
    render(<InterfacceNavigazione />);

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(2);

    expect(images[0]).toHaveAttribute("src", "https://jurio.it/guida-image/header.webp");
    expect(images[1]).toHaveAttribute("src", "https://jurio.it/guida-image/footer.webp");

    expect(
      screen.getByText(/Figura 1: Dettaglio della barra superiore e delle voci di accesso rapido/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Figura 2: Organizzazione delle sezioni informative e legali nel footer/i)
    ).toBeInTheDocument();
  });
});