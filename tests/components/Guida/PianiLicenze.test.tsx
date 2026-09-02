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
import PianiLicenze from "@/components/Guida/PianiLicenze"; // <-- adegua il path se necessario

describe("Guida - PianiLicenze Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza l'intestazione della guida, i badge di categoria e la spiegazione sull'assenza di rinnovo automatico", () => {
    render(<PianiLicenze />);

    expect(screen.getByText("3. Account")).toBeInTheDocument();
    expect(screen.getByText("Abbonamenti & Tariffe")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Piani e Licenze d'Uso",
        level: 1,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /L'accesso alle funzionalità della piattaforma è strutturato mediante l'acquisto di/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/non prevede alcun rinnovo automatico/i)
    ).toBeInTheDocument();
  });

  test("renderizza la sezione dei piani disponibili (Piano Essential e Piano Business) con i rispettivi elenchi funzionali", () => {
    render(<PianiLicenze />);

    expect(
      screen.getByRole("heading", {
        name: "I Piani Disponibili",
        level: 2,
      })
    ).toBeInTheDocument();

    // Piano Essential
    expect(screen.getByText("Ricerca & Consultazione")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Piano Essential", level: 3 })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Accesso illimitato alla banca dati delle Corti Supreme \(Cassazione, Consiglio di Stato, Corte Costituzionale\)/i
      )
    ).toBeInTheDocument();

    // Piano Business
    expect(screen.getByText("Suite Completa AI")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Piano Business", level: 3 })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Archivio cloud riservato con acquisizione intelligente documenti/i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Consulente Legale, gestione fascicoli di studio e thread persistenti/i)
    ).toBeInTheDocument();
  });

  test("renderizza la tabella comparativa delle tariffe con prezzi mensili, annuali e note promozionali", () => {
    render(<PianiLicenze />);

    expect(
      screen.getByRole("heading", {
        name: "Durata e Tariffe",
        level: 2,
      })
    ).toBeInTheDocument();

    // Intestazioni di tabella
    expect(screen.getByRole("columnheader", { name: "Piano" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Formula Mensile" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Formula Annuale" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Note Promozionali" })).toBeInTheDocument();

    // Riga Essential
    expect(screen.getByRole("cell", { name: "Essential" })).toBeInTheDocument();
    expect(screen.getByText("12,20 €")).toBeInTheDocument();
    expect(screen.getByText("Promo 1° mese: 6,10 € (-50%)")).toBeInTheDocument();
    expect(screen.getByText("61,00 €")).toBeInTheDocument();
    expect(screen.getByText("Listino 146,40 €")).toBeInTheDocument();
    expect(screen.getByText("Sconto del 58% su base annua")).toBeInTheDocument();

    // Riga Business
    expect(screen.getByRole("cell", { name: "Business" })).toBeInTheDocument();
    expect(screen.getByText("48,80 €")).toBeInTheDocument();
    expect(screen.getByText("Promo 1° mese: 24,40 € (-50%)")).toBeInTheDocument();
    expect(screen.getByText("244,00 €")).toBeInTheDocument();
    expect(screen.getByText("Listino 585,60 €")).toBeInTheDocument();
    expect(screen.getByText("Risparmio dedicato sul canone complessivo")).toBeInTheDocument();
  });

  test("renderizza la sezione sulla scadenza della licenza e la salvaguardia dei dati personali", () => {
    render(<PianiLicenze />);

    expect(
      screen.getByRole("heading", {
        name: "Gestione dell'Account e Scadenza della Licenza",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Cosa succede alla scadenza del periodo acquistato:",
        level: 3,
      })
    ).toBeInTheDocument();

    expect(screen.getByText(/Nessun Addebito Imprevisto:/i)).toBeInTheDocument();
    expect(screen.getByText(/Protezione e Custodia dei Dati:/i)).toBeInTheDocument();
    expect(screen.getByText(/Ripristino Immediato:/i)).toBeInTheDocument();
  });

  test("renderizza la sezione pagamenti Stripe/PCI DSS, fatturazione e il link all'assistenza amministrativa", () => {
    render(<PianiLicenze />);

    expect(
      screen.getByRole("heading", {
        name: "Modalità di Pagamento e Fatturazione Elettronica",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Metodi di Pagamento Ammessi", level: 3 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Fatturazione Elettronica", level: 3 })
    ).toBeInTheDocument();

    const supportLink = screen.getByRole("link", {
      name: /Contatta l'Assistenza Amministrativa \(\/contatti\) →/i,
    });
    expect(supportLink).toBeInTheDocument();
    expect(supportLink).toHaveAttribute("href", "/contatti");
  });

  test("renderizza l'immagine illustrativa e la rispettiva didascalia comparativa", () => {
    render(<PianiLicenze />);

    const image = screen.getByRole("img");
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute(
      "src",
      "https://jurio.it/guida-image/piani.webp"
    );

    expect(
      screen.getByText(
        /Figura 1: Schermata comparativa dei piani e selezione della frequenza di acquisto/i
      )
    ).toBeInTheDocument();
  });
});