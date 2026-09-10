import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import ApprofondimentoGiurisprudenziale from "@/features/guide/components/ApprofondimentoGiurisprudenziale";

describe("ApprofondimentoGiurisprudenziale Guida Component Suite", () => {
  test("renderizza l'intestazione principale, i badge di piano e la descrizione introduttiva", () => {
    render(<ApprofondimentoGiurisprudenziale />);

    expect(screen.getByText("1. Casi d'uso")).toBeInTheDocument();
    expect(screen.getByText("Piano Business / Essential / Piano prova")).toBeInTheDocument();
    
    expect(
      screen.getByRole("heading", { level: 1, name: "Approfondimento Giurisprudenziale" })
    ).toBeInTheDocument();

    expect(
      screen.getByText(/Il modulo di Approfondimento Giurisprudenziale è progettato per supportare avvocati/i)
    ).toBeInTheDocument();
  });

  test("renderizza la Sezione 1 con parametri di configurazione, componenti del flusso e la prima immagine", () => {
    render(<ApprofondimentoGiurisprudenziale />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Configurazione e Avvio dell'Indagine" })
    ).toBeInTheDocument();

    expect(screen.getByText("Parametri di Configurazione:")).toBeInTheDocument();
    expect(screen.getByText("Inquadramento Giuridico Preliminare")).toBeInTheDocument();
    expect(screen.getByText("Integrazione Documentale del Fascicolo")).toBeInTheDocument();

    const img1 = screen.getByAltText(
      "Schermata di configurazione e avvio dell'approfondimento giurisprudenziale"
    );
    expect(img1).toBeInTheDocument();
    expect(img1).toHaveAttribute("src", "https://jurio.it/guida-image/analisi_1.webp");
    expect(img1).toHaveAttribute("loading", "lazy");
  });

  test("renderizza la Sezione 2 con Mappa Dialettica, orientamenti contrapposti e la seconda immagine", () => {
    render(<ApprofondimentoGiurisprudenziale />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Mappa Dialettica e Tesi Contrapposte" })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { level: 3, name: "Orientamento Favorevole" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 3, name: "Orientamento Contrario" })
    ).toBeInTheDocument();

    const img2 = screen.getByAltText(
      "Visualizzazione della Mappa Dialettica con tesi favorevoli e contrarie"
    );
    expect(img2).toBeInTheDocument();
    expect(img2).toHaveAttribute("src", "https://jurio.it/guida-image/analisi_2.webp");
  });

  test("renderizza la Sezione 3 con gli output della sintesi strategica e la terza immagine", () => {
    render(<ApprofondimentoGiurisprudenziale />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Sintesi Strategica e Esportazione Report" })
    ).toBeInTheDocument();

    expect(screen.getByText("Executive Summary")).toBeInTheDocument();
    expect(screen.getByText("Argomentazioni e Rischi")).toBeInTheDocument();
    expect(screen.getByText("Copia Rapida Appunti")).toBeInTheDocument();
    expect(screen.getByText("Esportazione in PDF")).toBeInTheDocument();

    const img3 = screen.getByAltText(
      "Visualizzazione del report di sintesi strategica e opzioni di esportazione"
    );
    expect(img3).toBeInTheDocument();
    expect(img3).toHaveAttribute("src", "https://jurio.it/guida-image/analisi_3.webp");
  });
});