import React from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { SentenceNode } from "@/features/document/components/CitationGraph";

/* ---------- hoisted mocks ---------- */
const { mockCercaPrecedente } = vi.hoisted(() => ({
  mockCercaPrecedente: vi.fn(),
}));

/* ---------- mock modules ---------- */
vi.mock("@/features/document/hooks/cercaPrecedenti", () => ({
  __esModule: true,
  cercaPrecedente: mockCercaPrecedente,
}));

vi.mock("framer-motion", () => ({
  __esModule: true,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

/* ---------- subject under test ---------- */
import CitationTree from "@/features/document/components/CitationGraph";

describe("CitationTree & CitationBranch Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* -------------------------------------------------------------------------- */
  /* STATO VUOTO                                                                */
  /* -------------------------------------------------------------------------- */
  describe("CitationTree - Gestione Lista Vuota", () => {
    test("mostra messaggio di fallback quando l'array di precedenti è vuoto o non definito", () => {
      const { rerender } = render(<CitationTree precedenti={[]} />);
      expect(screen.getByText("Nessun precedente registrato.")).toBeInTheDocument();

      rerender(<CitationTree precedenti={undefined as unknown as string[]} />);
      expect(screen.getByText("Nessun precedente registrato.")).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* STATO DI CARICAMENTO & NON INDICIZZATO                                     */
  /* -------------------------------------------------------------------------- */
  describe("CitationBranch - Caricamento e Risultato Assente", () => {
    test("mostra indicatore di caricamento durante la chiamata a cercaPrecedente", () => {
      // Lasciamo la Promise pendente per verificare lo stato di loading
      mockCercaPrecedente.mockReturnValue(new Promise(() => {}));

      render(<CitationTree precedenti={["Cass. Civ. 1234/2026"]} />);

      expect(screen.getByText(/ricerca precedente:/i)).toBeInTheDocument();
      expect(screen.getByText("Cass. Civ. 1234/2026")).toBeInTheDocument();
    });

    test("mostra il badge 'Non indicizzato' se cercaPrecedente restituisce null", async () => {
      mockCercaPrecedente.mockResolvedValueOnce(null);

      render(<CitationTree precedenti={["Cass. Civ. 9999/2026"]} />);

      await waitFor(() => {
        expect(screen.getByText("Non indicizzato")).toBeInTheDocument();
        expect(screen.getByText("Cass. Civ. 9999/2026")).toBeInTheDocument();
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* RENDERING DATI & FALLBACK                                                  */
  /* -------------------------------------------------------------------------- */
  describe("CitationBranch - Rendering Dati della Sentenza", () => {
    const mockSentence: SentenceNode = {
      id: "doc_sentenza_001",
      organo_giudicante: "Corte di Cassazione",
      sezione: "Sez. III Civile",
      numero_sentenza: "15420/2026",
      massima: "La clausola di determinazione degli interessi ultralegali deve essere pattuita per iscritto...",
      fattispecie_rilevante: "Controversia su contratti di conto corrente e applicazione tassi usurari.",
      precedenti_richiamati: ["Cass. Pen. 4321/2024"],
    };

    test("renderizza organo, sezione, numero sentenza e anteprima massima", async () => {
      mockCercaPrecedente.mockResolvedValueOnce(mockSentence);

      render(<CitationTree precedenti={["Cass. Civ. 15420/2026"]} />);

      await waitFor(() => {
        expect(screen.getByText(/corte di cassazione • sez\. iii civile/i)).toBeInTheDocument();
        expect(screen.getByText("N. 15420/2026")).toBeInTheDocument();
        expect(
          screen.getByText(/“la clausola di determinazione degli interessi/i)
        ).toBeInTheDocument();
      });
    });

    test("applica valori di fallback se i campi opzionali non sono valorizzati", async () => {
      const minimalSentence: SentenceNode = {
        id: "doc_minima",
        organo_giudicante: undefined,
        sezione: undefined,
        numero_sentenza: undefined,
        massima: undefined,
      };

      mockCercaPrecedente.mockResolvedValueOnce(minimalSentence);

      render(<CitationTree precedenti={["Cass. 000/2026"]} />);

      await waitFor(() => {
        expect(screen.getByText("Cassazione")).toBeInTheDocument();
        expect(screen.getByText("N. S.N.")).toBeInTheDocument();
        expect(screen.getByText("Clicca per visualizzare i dettagli")).toBeInTheDocument();
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* RAMIFICAZIONE RICORSIVA DEI PRECEDENTI                                      */
  /* -------------------------------------------------------------------------- */
  describe("CitationBranch - Albero Ricorsivo e Sottoprecedenti", () => {
    test("gestisce il toggle espansione/compressione e richiama il componente ricorsivo", async () => {
      const parentSentence: SentenceNode = {
        id: "parent_01",
        organo_giudicante: "Cassazione",
        numero_sentenza: "100/2026",
        precedenti_richiamati: ["Cass. Civ. 50/2023"],
      };

      const childSentence: SentenceNode = {
        id: "child_01",
        organo_giudicante: "Cassazione",
        numero_sentenza: "50/2023",
        massima: "Principio richiamato in tema di solidarietà passiva.",
      };

      mockCercaPrecedente
        .mockResolvedValueOnce(parentSentence)
        .mockResolvedValueOnce(childSentence);

      render(<CitationTree precedenti={["Cass. 100/2026"]} />);

      await waitFor(() => {
        expect(screen.getByText("N. 100/2026")).toBeInTheDocument();
      });

      const toggleButton = screen.getByTitle("Espandi sottoprecedenti");
      expect(toggleButton).toBeInTheDocument();

      fireEvent.click(toggleButton);

      expect(screen.getByTitle("Comprimi rami")).toBeInTheDocument();

      await waitFor(() => {
        expect(screen.getByText("N. 50/2023")).toBeInTheDocument();
      });
    });

    test("non mostra il pulsante di toggle se non vi sono precedenti richiamati", async () => {
      const solitarySentence: SentenceNode = {
        id: "solo_01",
        organo_giudicante: "Consiglio di Stato",
        numero_sentenza: "300/2026",
        precedenti_richiamati: [],
      };

      mockCercaPrecedente.mockResolvedValueOnce(solitarySentence);

      render(<CitationTree precedenti={["CdS 300/2026"]} />);

      await waitFor(() => {
        expect(screen.getByText("N. 300/2026")).toBeInTheDocument();
      });

      expect(screen.queryByTitle("Espandi sottoprecedenti")).not.toBeInTheDocument();
      expect(screen.queryByTitle("Comprimi rami")).not.toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* MODALE DETTAGLIO E ACCESSIBILITÀ                                           */
  /* -------------------------------------------------------------------------- */
  describe("CitationBranch - Modale Laterale", () => {
    const fullSentence: SentenceNode = {
      id: "sent_full_999",
      organo_giudicante: "Corte Costituzionale",
      sezione: "Unica",
      numero_sentenza: "88/2026",
      massima: "È costituzionalmente illegittimo l'articolo nella parte in cui...",
      fattispecie_rilevante: "Giudizio di legittimità costituzionale in via incidentale.",
    };

    test("apre il pannello laterale al click sulla riga e mostra le sezioni di dettaglio", async () => {
      mockCercaPrecedente.mockResolvedValueOnce(fullSentence);

      render(<CitationTree precedenti={["Corte Cost. 88/2026"]} />);

      await waitFor(() => {
        expect(screen.getByText("N. 88/2026")).toBeInTheDocument();
      });

      const card = screen.getByText("N. 88/2026").closest('[role="button"]');
      fireEvent.click(card!);

      expect(screen.getByText("Sentenza N. 88/2026")).toBeInTheDocument();
      expect(screen.getByText(/giudizio di legittimità costituzionale/i)).toBeInTheDocument();
      expect(screen.getByText("Massima / Principio di Diritto")).toBeInTheDocument();
      expect(screen.getAllByText(/è costituzionalmente illegittimo/i)).toHaveLength(2);

      const externalLink = screen.getByRole("link", { name: /visualizza intera sentenza/i });
      expect(externalLink).toHaveAttribute("href", "/giurisprudenza/sent_full_999");
    });

    test("chiude il pannello laterale al click sul pulsante di chiusura (FaTimes)", async () => {
      mockCercaPrecedente.mockResolvedValueOnce(fullSentence);

      render(<CitationTree precedenti={["Corte Cost. 88/2026"]} />);

      await waitFor(() => {
        expect(screen.getByText("N. 88/2026")).toBeInTheDocument();
      });

      const card = screen.getByText("N. 88/2026").closest('[role="button"]');
      fireEvent.click(card!);

      const closeButton = screen.getByLabelText("Chiudi");
      fireEvent.click(closeButton);

      expect(screen.queryByText("Sentenza N. 88/2026")).not.toBeInTheDocument();
    });

    test("chiude il pannello al click sul link della sentenza intera", async () => {
      mockCercaPrecedente.mockResolvedValueOnce(fullSentence);

      render(<CitationTree precedenti={["Corte Cost. 88/2026"]} />);

      await waitFor(() => {
        expect(screen.getByText("N. 88/2026")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("N. 88/2026").closest('[role="button"]')!);

      const externalLink = screen.getByRole("link", { name: /visualizza intera sentenza/i });
      fireEvent.click(externalLink);

      expect(screen.queryByText("Sentenza N. 88/2026")).not.toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* ACCESSIBILITÀ (SonarQube A11y)                                             */
  /* -------------------------------------------------------------------------- */
  describe("CitationBranch - Accessibilità (SonarQube A11y)", () => {
    const a11ySentence: SentenceNode = {
      id: "sent_a11y_123",
      organo_giudicante: "Tribunale",
      numero_sentenza: "10/2026",
      massima: "Test accessibilità",
    };

    test("apre il pannello laterale tramite tastiera premendo Enter", async () => {
      mockCercaPrecedente.mockResolvedValueOnce(a11ySentence);
      render(<CitationTree precedenti={["Tribunale 10/2026"]} />);
      
      await waitFor(() => expect(screen.getByText("N. 10/2026")).toBeInTheDocument());

      const trigger = screen.getByText("N. 10/2026").closest('[role="button"]')!;
      fireEvent.keyDown(trigger, { key: "Enter" });

      expect(screen.getByText("Sentenza N. 10/2026")).toBeInTheDocument();
    });

    test("apre il pannello laterale tramite tastiera premendo Spazio", async () => {
      mockCercaPrecedente.mockResolvedValueOnce(a11ySentence);
      render(<CitationTree precedenti={["Tribunale 10/2026"]} />);
      
      await waitFor(() => expect(screen.getByText("N. 10/2026")).toBeInTheDocument());

      const trigger = screen.getByText("N. 10/2026").closest('[role="button"]')!;
      fireEvent.keyDown(trigger, { key: " " });

      expect(screen.getByText("Sentenza N. 10/2026")).toBeInTheDocument();
    });

    test("ignora i tasti non adibiti all'apertura (es. Tab, Escape)", async () => {
      mockCercaPrecedente.mockResolvedValueOnce(a11ySentence);
      render(<CitationTree precedenti={["Tribunale 10/2026"]} />);
      
      await waitFor(() => expect(screen.getByText("N. 10/2026")).toBeInTheDocument());

      const trigger = screen.getByText("N. 10/2026").closest('[role="button"]')!;
      fireEvent.keyDown(trigger, { key: "Tab" });
      fireEvent.keyDown(trigger, { key: "Escape" });
      fireEvent.keyDown(trigger, { key: "ArrowDown" });

      // Il pannello non deve aprirsi
      expect(screen.queryByText("Sentenza N. 10/2026")).not.toBeInTheDocument();
    });
  });
});