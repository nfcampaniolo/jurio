import { describe, test, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/* ---------- component ---------- */
import ConsiglioStato from "@/features/guide/components/ConsiglioStato"; // <-- adegua il path se necessario

describe("Guida - ConsiglioStato Component Suite", () => {
  beforeEach(() => {
    // Reset di eventuali configurazioni prima di ogni test
  });

  test("renderizza l'intestazione della guida, i badge di categoria e la descrizione introduttiva", () => {
    render(<ConsiglioStato />);

    expect(screen.getByText("2. Giurisprudenza")).toBeInTheDocument();
    expect(screen.getByText("Copertura dal 2021 a oggi")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Consiglio di Stato",
        level: 1,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /è il massimo organo della giustizia amministrativa italiana/i
      )
    ).toBeInTheDocument();
  });

  test("renderizza l'articolazione di tutte le sezioni giurisdizionali (II, III, IV, V, VI, VII)", () => {
    render(<ConsiglioStato />);

    expect(
      screen.getByRole("heading", {
        name: "Articolazione delle Sezioni Giurisdizionali",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(screen.getByText("Sezione II")).toBeInTheDocument();
    expect(screen.getByText(/Ricorsi straordinari al Presidente della Repubblica/i)).toBeInTheDocument();

    expect(screen.getByText("Sezione III")).toBeInTheDocument();
    expect(screen.getByText(/Sanità, assistenza sociale, diritto dell'immigrazione/i)).toBeInTheDocument();

    expect(screen.getByText("Sezione IV")).toBeInTheDocument();
    expect(screen.getByText(/Urbanistica, governo del territorio, edilizia/i)).toBeInTheDocument();

    expect(screen.getByText("Sezione V")).toBeInTheDocument();
    expect(screen.getByText(/Appalti pubblici, contratti pubblici, procedure di gara/i)).toBeInTheDocument();

    expect(screen.getByText("Sezione VI")).toBeInTheDocument();
    expect(screen.getByText(/Università, istruzione, energia, provvedimenti delle Autorità Indipendenti/i)).toBeInTheDocument();

    expect(screen.getByText("Sezione VII")).toBeInTheDocument();
    expect(screen.getByText(/Smaltimento dell'arretrato e trattazione di materie trasversali/i)).toBeInTheDocument();
  });

  test("renderizza il blocco dedicato all'Adunanza Plenaria con badge e definizione nomofilattica", () => {
    render(<ConsiglioStato />);

    expect(screen.getByText("Nomofilachia Amministrativa")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Adunanza Plenaria",
        level: 3,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /È l'organo nomofilattico supremo della magistratura amministrativa/i
      )
    ).toBeInTheDocument();
  });

  test("renderizza l'immagine illustrativa e la didascalia di consultazione", () => {
    render(<ConsiglioStato />);

    const image = screen.getByRole("img");
    expect(image).toBeInTheDocument();
    expect(image).toHaveAttribute(
      "src",
      "https://jurio.it/guida-image/consiglio.webp"
    );

    expect(
      screen.getByText(
        /Figura 1: Consultazione delle decisioni e dei principi di diritto del Consiglio di Stato/i
      )
    ).toBeInTheDocument();
  });

  test("renderizza la sezione finale su analisi e ricerca semantica", () => {
    render(<ConsiglioStato />);

    expect(
      screen.getByRole("heading", {
        name: "Analisi e Ricerca Semantica",
        level: 3,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /il motore semantico di Jurio consente di rintracciare orientamenti consolidati/i
      )
    ).toBeInTheDocument();
  });
});