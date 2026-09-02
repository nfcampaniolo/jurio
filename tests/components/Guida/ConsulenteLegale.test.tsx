import { describe, test, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

/* ---------- component ---------- */
import ConsulenteLegale from "@/components/Guida/ConsulenteLegale"; // <-- adegua il path se necessario

describe("Guida - ConsulenteLegale Component Suite", () => {
  beforeEach(() => {
    // Reset prima di ciascun test
  });

  test("renderizza l'intestazione della guida, i badge di categoria e la descrizione introduttiva", () => {
    render(<ConsulenteLegale />);

    expect(screen.getByText("1. Casi d'uso")).toBeInTheDocument();
    expect(screen.getByText("Piano Business / Prova Gratuita")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Consulente Legale",
        level: 1,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /costituisce l'ambiente di lavoro interattivo della piattaforma, progettato per supportare l'analisi giuridica/i
      )
    ).toBeInTheDocument();
  });

  test("renderizza le 3 modalità operative (Chat Temporanea, Nuovo Fascicolo, Sfoglia Archivio)", () => {
    render(<ConsulenteLegale />);

    expect(
      screen.getByRole("heading", {
        name: "Modalità Operative",
        level: 2,
      })
    ).toBeInTheDocument();

    // Box numerati delle modalità
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Chat Temporanea", level: 3 })).toBeInTheDocument();
    expect(
      screen.getByText(/sessione rapida di ricerca ed elaborazione giurisprudenziale senza salvare dati/i)
    ).toBeInTheDocument();

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nuovo Fascicolo", level: 3 })).toBeInTheDocument();
    expect(
      screen.getByText(/strutturare una pratica continuativa, organizzare atti specifici/i)
    ).toBeInTheDocument();

    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Sfoglia Archivio", level: 3 })).toBeInTheDocument();
    expect(
      screen.getByText(/consultare, riprendere o gestire le pratiche e le sessioni di analisi/i)
    ).toBeInTheDocument();
  });

  test("renderizza la sezione del flusso conversazionale, filtri avanzati, gestione allegati e pannello fonti", () => {
    render(<ConsulenteLegale />);

    expect(
      screen.getByRole("heading", {
        name: "La Chat Temporanea e il Flusso Conversazionale",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Motore Giurisprudenziale e Filtri", level: 3 })
    ).toBeInTheDocument();
    expect(screen.getByText("Filtri di Ricerca Avanzati")).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Documenti di Sessione (fino a 10)", level: 3 })
    ).toBeInTheDocument();
    expect(screen.getByText(/caricare e gestire fino a 10 allegati/i)).toBeInTheDocument();

    // Box Fonti Citate e Zero Allucinazioni
    expect(screen.getByText("Pannello delle Fonti Citate e Zero Allucinazioni:")).toBeInTheDocument();
    expect(
      screen.getByText(/garantisce la totale verificabilità di ogni affermazione e azzera il rischio di allucinazioni/i)
    ).toBeInTheDocument();
  });

  test("renderizza la sezione sulla creazione e configurazione dei fascicoli", () => {
    render(<ConsulenteLegale />);

    expect(
      screen.getByRole("heading", {
        name: "Creazione e Gestione dei Fascicoli",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Configurazione e Creazione della Pratica", level: 3 })
    ).toBeInTheDocument();

    expect(screen.getByText(/Nome del Fascicolo:/i)).toBeInTheDocument();
    expect(screen.getByText(/Documenti Collegati:/i)).toBeInTheDocument();
    expect(
      screen.getByText(/l'assistente manterrà sempre come contesto l'intero patrimonio informativo della pratica/i)
    ).toBeInTheDocument();
  });

  test("renderizza la sezione sull'archivio pratiche e le regole di collaborazione del team", () => {
    render(<ConsulenteLegale />);

    expect(
      screen.getByRole("heading", {
        name: "Archivio e Collaborazione nel Gruppo di Lavoro",
        level: 2,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: "Permessi e Condivisione nel Team", level: 3 })
    ).toBeInTheDocument();

    expect(
      screen.getByText(/i colleghi del team possono consultare le analisi svolte, ma non intervenire o scrivere nei thread altrui/i)
    ).toBeInTheDocument();
  });

  test("renderizza tutte le immagini illustrative e le relative didascalie", () => {
    render(<ConsulenteLegale />);

    const images = screen.getAllByRole("img");
    expect(images).toHaveLength(2);

    expect(images[0]).toHaveAttribute("src", "https://jurio.it/guida-image/consulente.webp");
    expect(images[1]).toHaveAttribute("src", "https://jurio.it/guida-image/chat.webp");

    expect(
      screen.getByText(/Figura 1: Hub principale del modulo Consulente Legale con scelta della modalità di lavoro/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Figura 2: Sessione conversazionale con ancoraggio puntuale alle fonti e agli allegati/i)
    ).toBeInTheDocument();
  });
});