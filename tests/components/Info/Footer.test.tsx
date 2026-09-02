import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

/* ---------- mock react-router-dom ---------- */
vi.mock("react-router-dom", () => ({
  Link: ({
    to,
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

/* ---------- mock react-icons/fa ---------- */
vi.mock("react-icons/fa", () => ({
  FaLinkedin: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="fa-linkedin" {...props} />
  ),
  FaInstagram: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="fa-instagram" {...props} />
  ),
}));

/* ---------- component ---------- */
import { Footer } from "@/components/Info/Footer"; // <-- adegua il path se necessario

describe("Footer Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza branding, descrizione aziendale e pulsante top", () => {
    render(<Footer />);

    const footerElement = screen.getByRole("contentinfo");
    expect(footerElement).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Footer", level: 2 })).toHaveClass("sr-only");

    const logoButton = screen.getByRole("button", { name: "Torna all'inizio della pagina" });
    expect(logoButton).toHaveTextContent("Jurio");

    expect(
      screen.getByText(
        /Strumenti avanzati per la ricerca giuridica, l’analisi e la sintesi dei documenti/i
      )
    ).toBeInTheDocument();
  });

  test("renderizza i canali social con link sicuri a schede esterne", () => {
    render(<Footer />);

    expect(screen.getByText("Seguici")).toBeInTheDocument();

    const linkedInLink = screen.getByRole("link", { name: "Visita la nostra pagina LinkedIn" });
    expect(linkedInLink).toHaveAttribute("href", "https://linkedin.com");
    expect(linkedInLink).toHaveAttribute("target", "_blank");
    expect(linkedInLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByTestId("fa-linkedin")).toBeInTheDocument();

    const instagramLink = screen.getByRole("link", { name: "Visita la nostra pagina Instagram" });
    expect(instagramLink).toHaveAttribute("href", "https://instagram.com");
    expect(instagramLink).toHaveAttribute("target", "_blank");
    expect(instagramLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(screen.getByTestId("fa-instagram")).toBeInTheDocument();
  });

  test("renderizza le sezioni di navigazione, i link interni e i collegamenti legali statici", () => {
    render(<Footer />);

    const nav = screen.getByRole("navigation", { name: "Link del footer" });
    expect(nav).toBeInTheDocument();

    // Sezione Supporto
    expect(screen.getByText("Supporto")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Prezzi" })).toHaveAttribute("href", "/prezzi");
    expect(screen.getByRole("link", { name: "Contattaci" })).toHaveAttribute("href", "/contatti");
    expect(screen.getByRole("link", { name: "Fonti" })).toHaveAttribute("href", "/fonti");
    expect(screen.getByRole("link", { name: "Casi di studio" })).toHaveAttribute("href", "/casi-studio");
    expect(screen.getByRole("link", { name: "Guida utente" })).toHaveAttribute("href", "/guida");

    // Sezione Legale
    expect(screen.getByText("Legale")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
    expect(screen.getByRole("link", { name: "Termini di servizio" })).toHaveAttribute("href", "/termini");
    expect(screen.getByRole("link", { name: "Trattamento dei dati" })).toHaveAttribute("href", "/gdpr");
  });

  test("renderizza il disclaimer istituzionale e l'anno di copyright corrente", () => {
    const currentYear = new Date().getFullYear();

    render(<Footer />);

    expect(
      screen.getByText(
        /Le fonti documentali indicizzate provengono esclusivamente da archivi istituzionali ufficiali/i
      )
    ).toBeInTheDocument();

    expect(
      screen.getByText(new RegExp(`© ${currentYear} Jurio\\. Tutti i diritti riservati\\.`, "i"))
    ).toBeInTheDocument();
  });
});