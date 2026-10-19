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
import AggiornamentoForzato from "@/features/guide/components/AggiornamentoForzato"; // <-- adegua il path se necessario

describe("Guida - AggiornamentoForzato Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza l'intestazione della guida, i badge di categoria e la descrizione introduttiva", () => {
    render(<AggiornamentoForzato />);

    expect(screen.getByText("4. Supporto")).toBeInTheDocument();
    expect(screen.getByText("Risoluzione Problemi & Cache")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Come Eseguire un Aggiornamento Forzato",
        level: 1,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Durante la navigazione, il browser memorizza temporaneamente file/i)
    ).toBeInTheDocument();
  });

  test("renderizza la sezione esplicativa sul funzionamento dell'Hard Refresh", () => {
    render(<AggiornamentoForzato />);

    expect(
      screen.getByRole("heading", {
        name: "Perché eseguire un Hard Refresh",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(/consente di bypassare i file salvati localmente/i)
    ).toBeInTheDocument();
  });

  test("renderizza tutte le card dei browser supportati (Chrome, Firefox, Edge, Safari)", () => {
    render(<AggiornamentoForzato />);

    expect(
      screen.getByRole("heading", {
        name: "Scorciatoie da Tastiera per i Principali Browser",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "Google Chrome", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mozilla Firefox", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Microsoft Edge", level: 3 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Apple Safari", level: 3 })).toBeInTheDocument();

    expect(screen.getByText("Chrome")).toBeInTheDocument();
    expect(screen.getByText("Firefox")).toBeInTheDocument();
    expect(screen.getByText("Edge")).toBeInTheDocument();
    expect(screen.getByText("Safari")).toBeInTheDocument();
  });

  test("renderizza le combinazioni di tasti e scorciatoie per ciascun sistema operativo", () => {
    const { container } = render(<AggiornamentoForzato />);

    const kbdElements = container.querySelectorAll("kbd");
    expect(kbdElements.length).toBeGreaterThan(10);

    // Controlla la presenza di scorciatoie chiave
    expect(screen.getAllByText("Ctrl").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("F5").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("⌘ Cmd").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Shift").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("⌥ Option")).toBeInTheDocument();
  });

  test("renderizza la sezione di troubleshooting con il link al ticket di assistenza", () => {
    render(<AggiornamentoForzato />);

    expect(screen.getByText("Il problema persiste?")).toBeInTheDocument();
    expect(
      screen.getByText(/modalità di navigazione in incognito \/ anonima/i)
    ).toBeInTheDocument();

    const supportLink = screen.getByRole("link", { name: "aprire un ticket di assistenza" });
    expect(supportLink).toBeInTheDocument();
    expect(supportLink).toHaveAttribute("href", "/guida/supporto/assistenza");
  });
});