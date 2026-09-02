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
import Accesso from "@/components/Guida/Accesso"; // <-- adegua il path se necessario

describe("Guida - Accesso Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza l'intestazione della guida, i badge di categoria e la descrizione introduttiva", () => {
    render(<Accesso />);

    expect(screen.getByText("3. Account")).toBeInTheDocument();
    expect(screen.getByText("Autenticazione & Registrazione")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Login e Registrazione", level: 1 })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Per utilizzare gli strumenti di ricerca e le funzionalità avanzate di Jurio è necessario autenticarsi/i
      )
    ).toBeInTheDocument();
  });

  test("renderizza la sezione Login con modalità email/password, SSO Google e passaggi di recupero password", () => {
    render(<Accesso />);

    expect(
      screen.getByRole("heading", { name: "Login (Accesso)", level: 2 })
    ).toBeInTheDocument();

    // Box modalità di accesso
    expect(
      screen.getByRole("heading", { name: "Accesso con Email e Password", level: 3 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Single Sign-On con Google", level: 3 })
    ).toBeInTheDocument();

    // Procedura di recupero credenziali
    expect(
      screen.getByRole("heading", { name: "Procedura di Recupero della Password", level: 3 })
    ).toBeInTheDocument();
    expect(screen.getByText(/Password dimenticata\?/i)).toBeInTheDocument();
    expect(screen.getByText(/riceverai un'email con il link sicuro/i)).toBeInTheDocument();
  });

  test("renderizza la sezione Registrazione e i campi anagrafici con i rispettivi badge di obbligatorietà", () => {
    render(<Accesso />);

    expect(
      screen.getByRole("heading", {
        name: "Creazione di un Nuovo Account (Registrazione)",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Dati di Profilo Richiesti", level: 3 })
    ).toBeInTheDocument();

    // Campi e badge
    expect(screen.getByRole("heading", { name: "Nome e Cognome", level: 4 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Numero di Telefono", level: 4 })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Categoria Professionale", level: 4 })).toBeInTheDocument();

    const requiredBadges = screen.getAllByText("Obbligatorio");
    expect(requiredBadges).toHaveLength(2);

    expect(screen.getByText("Opzionale")).toBeInTheDocument();
  });

  test("renderizza i link normativi e legali ai Termini di Servizio, Privacy Policy e GDPR", () => {
    render(<Accesso />);

    const linkTermini = screen.getByRole("link", { name: "/termini" });
    const linkPrivacy = screen.getByRole("link", { name: "/privacy" });
    const linkGdpr = screen.getByRole("link", { name: "/gdpr" });

    expect(linkTermini).toHaveAttribute("href", "/termini");
    expect(linkPrivacy).toHaveAttribute("href", "/privacy");
    expect(linkGdpr).toHaveAttribute("href", "/gdpr");
  });

  test("renderizza le immagini illustrative e le didascalie esplicative", () => {
    render(<Accesso />);

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(2);

    expect(images[0]).toHaveAttribute("src", "https://jurio.it/guida-image/login.webp");
    expect(images[1]).toHaveAttribute("src", "https://jurio.it/guida-image/registrati.webp");

    expect(
      screen.getByText(/Figura 1: Schermata di autenticazione con opzione Single Sign-On/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Figura 2: Modulo di iscrizione con campi anagrafici/i)
    ).toBeInTheDocument();
  });
});