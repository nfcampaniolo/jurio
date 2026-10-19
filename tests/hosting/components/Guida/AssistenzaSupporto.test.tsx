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
import AssistenzaSupporto from "@/features/guide/components/AssistenzaSupporto"; // <-- adegua il path se necessario

describe("Guida - AssistenzaSupporto Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza l'intestazione della guida, i badge di categoria e il link alla pagina contatti", () => {
    render(<AssistenzaSupporto />);

    expect(screen.getByText("4. Supporto")).toBeInTheDocument();
    expect(screen.getByText("Assistenza & Ticket")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Assistenza e Canali di Supporto",
        level: 1,
      })
    ).toBeInTheDocument();

    const contactLink = screen.getByRole("link", { name: "/contatti" });
    expect(contactLink).toBeInTheDocument();
    expect(contactLink).toHaveAttribute("href", "/contatti");
  });

  test("renderizza i canali diretti di contatto (Assistente Virtuale e Apertura Ticket)", () => {
    render(<AssistenzaSupporto />);

    expect(
      screen.getByRole("heading", {
        name: "Canali Diretti di Contatto",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(screen.getByText("Supporto Istantaneo")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Assistente Virtuale (Jurio AI)",
        level: 3,
      })
    ).toBeInTheDocument();

    expect(screen.getByText("Helpdesk Tecnico")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Apertura Ticket di Supporto",
        level: 3,
      })
    ).toBeInTheDocument();
  });

  test("renderizza i campi richiesti per l'apertura del ticket e le linee guida descrittive", () => {
    render(<AssistenzaSupporto />);

    expect(
      screen.getByRole("heading", {
        name: "Come Inviare una Richiesta (Apertura Ticket)",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(screen.getByText("Nome Completo")).toBeInTheDocument();
    expect(screen.getByText("Email Account")).toBeInTheDocument();
    expect(screen.getByText("Oggetto Richiesta")).toBeInTheDocument();

    expect(
      screen.getByText("Dettagli Utili per la Descrizione del Problema:")
    ).toBeInTheDocument();
    expect(screen.getByText(/Sezione o strumento:/i)).toBeInTheDocument();
    expect(screen.getByText(/Messaggio di errore:/i)).toBeInTheDocument();
    expect(screen.getByText(/Ambiente operativo:/i)).toBeInTheDocument();
    expect(screen.getByText(/Caratteristiche del file:/i)).toBeInTheDocument();

    expect(screen.getByText(/Consenso Privacy/i)).toBeInTheDocument();
  });

  test("renderizza le casistiche di contatto nella sezione 'Quando Contattare il Supporto'", () => {
    render(<AssistenzaSupporto />);

    expect(
      screen.getByRole("heading", {
        name: "Quando Contattare il Supporto",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Assistenza Tecnica", level: 3 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Gestione Amministrativa", level: 3 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Feedback & Feature Request",
        level: 3,
      })
    ).toBeInTheDocument();
  });

  test("renderizza l'immagine illustrativa e la rispettiva didascalia", () => {
    render(<AssistenzaSupporto />);

    const image = screen.getByRole("img");
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute(
      "src",
      "https://jurio.it/guida-image/contatti.webp"
    );

    expect(
      screen.getByText(
        /Figura 1: Modulo di apertura ticket per richieste tecniche e amministrative/i
      )
    ).toBeInTheDocument();
  });
});