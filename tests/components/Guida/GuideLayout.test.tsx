import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

/* ---------- mock react-router-dom ---------- */
vi.mock("react-router-dom", () => ({
  __esModule: true,
  Link: ({
    to,
    children,
    onClick,
    className,
  }: {
    to: string;
    children: React.ReactNode;
    onClick?: () => void;
    className?: string;
  }) => (
    <a href={to} onClick={onClick} className={className}>
      {children}
    </a>
  ),
}));

/* ---------- mock guideConfig ---------- */
vi.mock("@/hooks/guideConfig", () => ({
  __esModule: true,
  guideNavigation: [
    {
      title: "Introduzione",
      href: "/guida",
    },
    {
      title: "Casi d'uso",
      items: [
        { title: "Analisi Documentale", href: "/guida/analisi-documenti" },
        { title: "Consulente Legale", href: "/guida/consulente-legale" },
      ],
    },
  ],
}));

/* ---------- component ---------- */
import GuideLayout from "@/components/Guida/GuideLayout";

describe("GuideLayout Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza l'header mobile, la sidebar di navigazione e il contenuto principale", () => {
    render(
      <GuideLayout currentSlug="introduzione">
        <div data-testid="child-content">Contenuto Guida Principale</div>
      </GuideLayout>
    );

    expect(screen.getByText("Guida Jurio")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();

    // Voci di navigazione dalla configurazione mockata
    expect(screen.getByRole("link", { name: "Introduzione" })).toBeInTheDocument();
    expect(screen.getByText("Casi d'uso")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Analisi Documentale" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Consulente Legale" })).toBeInTheDocument();

    // Contenuto children
    expect(screen.getByTestId("child-content")).toBeInTheDocument();
    expect(screen.getByText("Contenuto Guida Principale")).toBeInTheDocument();
  });

  test("applica correttamente lo stato attivo (active) in base al currentSlug", () => {
    render(
      <GuideLayout currentSlug="analisi-documenti">
        <p>Testo</p>
      </GuideLayout>
    );

    const activeLink = screen.getByRole("link", { name: "Analisi Documentale" });
    expect(activeLink).toHaveClass("font-bold", "text-(--color-text)");

    const inactiveLink = screen.getByRole("link", { name: "Consulente Legale" });
    expect(inactiveLink).toHaveClass("font-light", "text-(--color-muted)");
  });

  test("gestisce correttamente l'apertura e la chiusura del menu mobile tramite pulsante", () => {
    render(
      <GuideLayout currentSlug="introduzione">
        <p>Testo</p>
      </GuideLayout>
    );

    const menuBtn = screen.getByRole("button", { name: "Menu" });
    expect(menuBtn).toBeInTheDocument();

    // Apri menu mobile
    fireEvent.click(menuBtn);
    expect(screen.getByRole("button", { name: "Chiudi" })).toBeInTheDocument();

    // Chiudi menu mobile
    fireEvent.click(screen.getByRole("button", { name: "Chiudi" }));
    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
  });

  test("chiude il menu mobile cliccando sull'overlay di sfondo", () => {
    render(
      <GuideLayout currentSlug="introduzione">
        <p>Testo</p>
      </GuideLayout>
    );

    const menuBtn = screen.getByRole("button", { name: "Menu" });
    fireEvent.click(menuBtn);
    expect(screen.getByRole("button", { name: "Chiudi" })).toBeInTheDocument();

    // Simula click sull'overlay (div fixed con bg-black/40)
    const overlay = document.querySelector(".fixed.inset-0.bg-black\\/40");
    expect(overlay).toBeInTheDocument();

    fireEvent.click(overlay!);
    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
  });

  test("chiude il menu mobile automaticamente al click su un link di navigazione", () => {
    render(
      <GuideLayout currentSlug="introduzione">
        <p>Testo</p>
      </GuideLayout>
    );

    const menuBtn = screen.getByRole("button", { name: "Menu" });
    fireEvent.click(menuBtn);
    expect(screen.getByRole("button", { name: "Chiudi" })).toBeInTheDocument();

    const navLink = screen.getByRole("link", { name: "Analisi Documentale" });
    fireEvent.click(navLink);

    // Il menu torna allo stato chiuso
    expect(screen.getByRole("button", { name: "Menu" })).toBeInTheDocument();
  });
});