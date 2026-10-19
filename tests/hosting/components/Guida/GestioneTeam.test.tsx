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
import GestioneTeam from "@/features/guide/components/GestioneTeam"; // <-- adegua il path se necessario

describe("Guida - GestioneTeam Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza l'intestazione della guida, i badge di categoria e la descrizione introduttiva", () => {
    render(<GestioneTeam />);

    expect(screen.getByText("3. Account")).toBeInTheDocument();
    expect(screen.getByText("Soluzioni Workspace Studio")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Gestione del Team e Workspace Condiviso",
        level: 1,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /consente di coordinare l'attività di più professionisti all'interno di un unico ambiente di lavoro centralizzato/i
      )
    ).toBeInTheDocument();
  });

  test("renderizza la sezione attivazione workspace, generazione voucher e link di amministrazione", () => {
    render(<GestioneTeam />);

    expect(
      screen.getByRole("heading", {
        name: "Attivazione del Workspace e Assegnazione Voucher",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Generazione e Validità dei Voucher",
        level: 3,
      })
    ).toBeInTheDocument();

    expect(screen.getByText(/Pacchetto di Voucher Business:/i)).toBeInTheDocument();
    expect(screen.getByText(/Flessibilità Totale \(No Sprechi\):/i)).toBeInTheDocument();

    const teamAdminLink = screen.getByRole("link", {
      name: /Pannello di Amministrazione Team \(\/profilo\/team\) →/i,
    });
    expect(teamAdminLink).toBeInTheDocument();
    expect(teamAdminLink).toHaveAttribute("href", "/profilo/team");
  });

  test("renderizza i ruoli e i permessi nel team (Owner, Membri, Viewer, Editor)", () => {
    render(<GestioneTeam />);

    expect(
      screen.getByRole("heading", {
        name: "Ruoli e Permessi nel Team",
        level: 2,
      })
    ).toBeInTheDocument();

    // Owner
    expect(screen.getByText("Amministratore")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Owner (Proprietario)", level: 3 })
    ).toBeInTheDocument();
    expect(screen.getByText(/L'utente che effettua l'acquisto assume di default il ruolo di Owner/i)).toBeInTheDocument();

    // Membri
    expect(screen.getByText("Collaboratori")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Membri del Team", level: 3 })
    ).toBeInTheDocument();
    expect(screen.getByText("Viewer")).toBeInTheDocument();
    expect(screen.getByText("Editor")).toBeInTheDocument();
  });

  test("renderizza le modalità di invito e il requisito di accesso per i collaboratori", () => {
    render(<GestioneTeam />);

    expect(
      screen.getByRole("heading", {
        name: "Invito e Accesso dei Collaboratori",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "1. Invito Diretto via Email", level: 3 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "2. Condivisione Codice Voucher", level: 3 })
    ).toBeInTheDocument();

    expect(screen.getByText(/Requisito di Accesso:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/gli utenti invitati devono disporre di un account registrato e attivo su Jurio/i)
    ).toBeInTheDocument();
  });

  test("renderizza le regole di visibilità e inviolabilità delle sessioni conversazionali", () => {
    render(<GestioneTeam />);

    expect(
      screen.getByRole("heading", {
        name: "Regole di Condivisione, Visibilità e Riservatezza",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Consultazione Protetta", level: 3 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Inviolabilità delle Sessioni Conversazionali",
        level: 3,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Non è consentito modificare documenti altrui né intervenire o scrivere all'interno delle chat/i
      )
    ).toBeInTheDocument();
  });

  test("renderizza l'immagine illustrativa e la rispettiva didascalia", () => {
    render(<GestioneTeam />);

    const image = screen.getByRole("img");
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute(
      "src",
      "https://jurio.it/guida-image/team.webp"
    );

    expect(
      screen.getByText(
        /Figura 1: Pannello di controllo del workspace con riepilogo licenze e membri attivi/i
      )
    ).toBeInTheDocument();
  });
});