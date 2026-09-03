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
import ModificaProfilo from "@/features/guide/components/ModificaProfilo"; // <-- adegua il path se necessario

describe("Guida - ModificaProfilo Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza l'intestazione della guida, i badge di categoria e la descrizione introduttiva", () => {
    render(<ModificaProfilo />);

    expect(screen.getByText("3. Account")).toBeInTheDocument();
    expect(screen.getByText("Profilo & Preferenze")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Modifica del Profilo e Preferenze",
        level: 1,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /consente di aggiornare in qualsiasi momento le informazioni anagrafiche, personalizzare la propria identità visiva/i
      )
    ).toBeInTheDocument();
  });

  test("renderizza la sezione personalizzazione avatar con le istruzioni di caricamento", () => {
    render(<ModificaProfilo />);

    expect(
      screen.getByRole("heading", {
        name: "Personalizzazione Avatar e Dati di Riconoscimento",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Caricamento e Visibilità Avatar",
        level: 3,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(/È sufficiente cliccare direttamente sull'icona dell'avatar per selezionare/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/L'immagine impostata sarà visualizzata all'interno dell'header/i)
    ).toBeInTheDocument();
  });

  test("renderizza l'elenco delle qualifiche professionali selezionabili e la nota per il campo libero", () => {
    render(<ModificaProfilo />);

    expect(
      screen.getByRole("heading", {
        name: "Aggiornamento della Categoria Professionale",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Qualifiche Selezionabili dal Menu Rapido:",
        level: 3,
      })
    ).toBeInTheDocument();

    const qualifiche = [
      "Studente di giurisprudenza",
      "Praticante avvocato",
      "Avvocato",
      "Magistrato",
      "Notaio",
      "Consulente legale",
      "Assistente legale",
      "Personale di cancelleria",
      "Accademico",
    ];

    qualifiche.forEach((qualifica) => {
      expect(screen.getByText(qualifica)).toBeInTheDocument();
    });

    expect(screen.getByText(/Opzione "Altro \(specifica\)":/i)).toBeInTheDocument();
  });

  test("renderizza la sezione gestione consensi, i pulsanti operativi e i link normativi a /privacy, /termini e /gdpr", () => {
    render(<ModificaProfilo />);

    expect(
      screen.getByRole("heading", {
        name: "Gestione Consensi e Salvataggio",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Trasparenza e Note Legali",
        level: 3,
      })
    ).toBeInTheDocument();

    // Link legali
    const linkPrivacy = screen.getByRole("link", { name: "Privacy Policy" });
    const linkTermini = screen.getByRole("link", { name: "Termini di servizio" });
    const linkGdpr = screen.getByRole("link", { name: "Trattamento dati (GDPR)" });

    expect(linkPrivacy).toHaveAttribute("href", "/privacy");
    expect(linkTermini).toHaveAttribute("href", "/termini");
    expect(linkGdpr).toHaveAttribute("href", "/gdpr");

    // Azioni salva / annulla
    expect(screen.getByText("Pulsante Salva:")).toBeInTheDocument();
    expect(screen.getByText("Pulsante Annulla:")).toBeInTheDocument();
  });

  test("renderizza l'immagine illustrativa e la didascalia esplicativa", () => {
    render(<ModificaProfilo />);

    const image = screen.getByRole("img");
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute(
      "src",
      "https://jurio.it/guida-image/profilo.webp"
    );

    expect(
      screen.getByText(
        /Figura 1: Pannello di aggiornamento delle informazioni personali e caricamento avatar/i
      )
    ).toBeInTheDocument();
  });
});