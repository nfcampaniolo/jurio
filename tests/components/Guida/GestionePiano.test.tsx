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
import GestionePiano from "@/components/Guida/GestionePiano"; // <-- adegua il path se necessario

describe("Guida - GestionePiano Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza l'intestazione della guida, i badge di categoria e la descrizione introduttiva", () => {
    render(<GestionePiano />);

    expect(screen.getByText("3. Account")).toBeInTheDocument();
    expect(screen.getByText("Abbonamenti & Workspace")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Gestione del Piano e Workspace di Studio",
        level: 1,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /è l'ambiente dedicato al monitoraggio del proprio stato contrattuale, all'acquisto o rinnovo delle licenze/i
      )
    ).toBeInTheDocument();
  });

  test("renderizza la sezione monitoraggio status account e codici sconto", () => {
    render(<GestionePiano />);

    expect(
      screen.getByRole("heading", {
        name: "Monitoraggio dello Status e Promozioni",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Stato dell'Account", level: 3 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Codici Promozionali e Sconti", level: 3 })
    ).toBeInTheDocument();
  });

  test("renderizza i piani individuali (Piano Essential e Piano Business) con i rispettivi badge", () => {
    render(<GestionePiano />);

    expect(
      screen.getByRole("heading", {
        name: "Selezione e Upgrade del Piano Individuale",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(screen.getByText("Piano Individuale")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Piano Essential", level: 3 })
    ).toBeInTheDocument();

    expect(screen.getByText("Set Completo AI")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Piano Business", level: 3 })
    ).toBeInTheDocument();
  });

  test("renderizza i dettagli delle soluzioni Workspace, la gestione voucher e il link alla quotazione Enterprise", () => {
    render(<GestionePiano />);

    expect(
      screen.getByRole("heading", {
        name: "Soluzioni Team & Workspace per Studi Legali",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Tagli Disponibili", level: 3 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Lavoro Simultaneo e Condivisione", level: 3 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Sistema di Voucher Flessibili a 365 Giorni",
        level: 3,
      })
    ).toBeInTheDocument();

    const enterpriseLink = screen.getByRole("link", {
      name: "Richiedi Quotazione Enterprise →",
    });
    expect(enterpriseLink).toBeInTheDocument();
    expect(enterpriseLink).toHaveAttribute("href", "/contatti");
  });

  test("renderizza la sezione sullo storico pagamenti e le relative voci contabili", () => {
    render(<GestionePiano />);

    expect(
      screen.getByRole("heading", {
        name: "Storico Pagamenti e Tracciamento Transazioni",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(screen.getByText("Data di Esecuzione")).toBeInTheDocument();
    expect(screen.getByText("Piano / Modulo")).toBeInTheDocument();
    expect(screen.getByText("Importo Complessivo")).toBeInTheDocument();
    expect(screen.getByText("Metodo & ID Transazione")).toBeInTheDocument();
  });

  test("renderizza le immagini illustrative con le relative didascalie", () => {
    render(<GestionePiano />);

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(2);

    expect(images[0]).toHaveAttribute("src", "https://jurio.it/guida-image/piano.webp");
    expect(images[1]).toHaveAttribute("src", "https://jurio.it/guida-image/voucher.webp");

    expect(
      screen.getByText(
        /Figura 1: Schermata di gestione del piano con indicatore di status e sconti applicati/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Figura 2: Dashboard Workspace con gestione dei voucher e assegnazione delle utenze di studio/i
      )
    ).toBeInTheDocument();
  });
});