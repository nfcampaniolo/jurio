import React from "react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { PromptBuilderForm } from "@/interfaces/interfaces";
import { PromptCreator } from "@/features/prompt/components/PromptCreator";

/* ---------- hoisted mocks ---------- */
const {
  mockGeneratePrompt,
  mockHookState,
} = vi.hoisted(() => ({
  mockGeneratePrompt: vi.fn(),
  mockHookState: {
    generatedPrompt: null as string | null,
    isGenerating: false,
    generatePrompt: vi.fn(),
    isAccessDenied: false,
  },
}));

/* ---------- mock modules ---------- */
vi.mock("@/features/prompt/hooks/usePromptGenerator", () => ({
  __esModule: true,
  usePromptGenerator: () => ({
    ...mockHookState,
    generatePrompt: mockGeneratePrompt,
  }),
}));

vi.mock("@/shared/components/AccessDenied", () => ({
  __esModule: true,
  AccessDenied: () => <div data-testid="access-denied-component">Accesso Negato</div>,
}));

vi.mock("framer-motion", () => ({
  __esModule: true,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: vi.fn(() => false),
}));

describe("PromptCreator Component Suite", () => {
  const mockOnBack = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockHookState.generatedPrompt = null;
    mockHookState.isGenerating = false;
    mockHookState.isAccessDenied = false;
    window.location.hash = "";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /* -------------------------------------------------------------------------- */
  /* RENDERING INIZIALE & POPSTATE                                              */
  /* -------------------------------------------------------------------------- */
  describe("Inizializzazione e Routing Hash", () => {
    test("imposta hash #crea nella cronologia e richiama onBack su evento popstate", () => {
      const pushStateSpy = vi.spyOn(window.history, "pushState");

      render(<PromptCreator onBack={mockOnBack} />);

      expect(pushStateSpy).toHaveBeenCalledWith({ view: "crea" }, "", "#crea");

      window.dispatchEvent(new PopStateEvent("popstate"));
      expect(mockOnBack).toHaveBeenCalledTimes(1);
    });

    test("esegue onBack al click sul pulsante 'Torna all\\'archivio'", () => {
      render(<PromptCreator onBack={mockOnBack} />);

      const backButton = screen.getByRole("button", { name: /torna all'archivio/i });
      fireEvent.click(backButton);

      expect(mockOnBack).toHaveBeenCalledTimes(1);
    });

    test("mostra il componente AccessDenied se l'hook segnala isAccessDenied", () => {
      mockHookState.isAccessDenied = true;

      render(<PromptCreator onBack={mockOnBack} />);

      expect(screen.getByTestId("access-denied-component")).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* TEMPLATE PRE-POPOLATO                                                      */
  /* -------------------------------------------------------------------------- */
  describe("Inizializzazione con Template", () => {
    test("popola il form con i dati passati come template", () => {
      const sampleTemplate: PromptBuilderForm = {
        title: "Estrattore Contratti Locazione",
        objective: "Individuare parti, canone e clausola risolutiva espressa",
        notes: "Usa formato valuta EUR",
        fields: [
          {
            name: "canone_mensile",
            type: "number",
            description: "Importo canone mensile pattuito",
            isRequired: true,
          },
        ],
      };

      render(<PromptCreator onBack={mockOnBack} template={sampleTemplate} />);

      expect(screen.getByDisplayValue("Estrattore Contratti Locazione")).toBeInTheDocument();
      expect(
        screen.getByDisplayValue("Individuare parti, canone e clausola risolutiva espressa")
      ).toBeInTheDocument();
      expect(screen.getByDisplayValue("Usa formato valuta EUR")).toBeInTheDocument();
      expect(screen.getByDisplayValue("canone_mensile")).toBeInTheDocument();
      expect(screen.getByDisplayValue("Importo canone mensile pattuito")).toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* GESTIONE DINAMICA DEI CAMPI (USEFIELDARRAY)                                */
  /* -------------------------------------------------------------------------- */
  describe("Gestione Campi Dinamici (Fields Array)", () => {
    test("non mostra il pulsante Rimuovi se è presente un solo campo", () => {
      render(<PromptCreator onBack={mockOnBack} />);

      expect(screen.queryByRole("button", { name: /rimuovi/i })).not.toBeInTheDocument();
    });

    test("aggiunge un nuovo blocco campo al click su 'Aggiungi campo' e permette la rimozione", async () => {
      render(<PromptCreator onBack={mockOnBack} />);

      const addFieldBtn = screen.getByRole("button", { name: /aggiungi campo/i });
      fireEvent.click(addFieldBtn);

      const removeButtons = screen.getAllByRole("button", { name: /rimuovi/i });
      expect(removeButtons).toHaveLength(2);

      fireEvent.click(removeButtons[1]);

      expect(screen.queryByRole("button", { name: /rimuovi/i })).not.toBeInTheDocument();
    });

    test("mostra il campo opzioni enum solo quando il tipo selezionato è 'enum'", async () => {
      render(<PromptCreator onBack={mockOnBack} />);

      expect(screen.queryByPlaceholderText(/es\. confermato, sospeso, risolto/i)).not.toBeInTheDocument();

      const typeSelect = screen.getByRole("combobox");
      fireEvent.change(typeSelect, { target: { value: "enum" } });

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText(/es\. confermato, sospeso, risolto/i)
        ).toBeInTheDocument();
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* SUGGERIMENTI E INTERAZIONE HINT                                            */
  /* -------------------------------------------------------------------------- */
  describe("Tooltip e Suggerimenti", () => {
    test("mostra il box di suggerimento su mouseEnter dell'icona e lo nasconde su mouseLeave", () => {
      render(<PromptCreator onBack={mockOnBack} />);

      const hintBtn = screen.getByTitle("Suggerimento");

      fireEvent.mouseEnter(hintBtn);
      expect(
        screen.getByText(/esempio: "analizza il contratto e individua durata/i)
      ).toBeInTheDocument();

      fireEvent.mouseLeave(hintBtn);
      expect(
        screen.queryByText(/esempio: "analizza il contratto e individua durata/i)
      ).not.toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* VALIDAZIONE E SUBMIT                                                       */
  /* -------------------------------------------------------------------------- */
  describe("Validazione Form e Invio Dati", () => {
    test("mostra messaggi di errore se i campi obbligatori sono vuoti al submit", async () => {
      render(<PromptCreator onBack={mockOnBack} />);

      const submitBtn = screen.getByRole("button", { name: /crea il modello/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(screen.getByText("Inserisci un nome per il modello")).toBeInTheDocument();
        expect(screen.getByText("Descrivi cosa deve analizzare l'AI")).toBeInTheDocument();
      });

      expect(mockGeneratePrompt).not.toHaveBeenCalled();
    });

    test("invia il payload normalizzato a generatePrompt quando il form è valido", async () => {
      render(<PromptCreator onBack={mockOnBack} />);

      fireEvent.change(screen.getByPlaceholderText(/es\. analisi contratti di locazione/i), {
        target: { value: "Verifica Clausole Arbitrali" },
      });

      fireEvent.change(
        screen.getByPlaceholderText(/es\. individua durata, canone, responsabilità/i),
        {
          target: { value: "Rileva clausole di devoluzione ad arbitrato rituale" },
        }
      );

      fireEvent.change(screen.getByPlaceholderText(/es\. canone_annuo/i), {
        target: { value: "presenza_arbitrato" },
      });

      fireEvent.change(screen.getByPlaceholderText(/es\. individua la clausola che indica/i), {
        target: { value: "Cerca riferimento ad arbitrato o collegio arbitrale" },
      });

      const submitBtn = screen.getByRole("button", { name: /crea il modello/i });
      fireEvent.click(submitBtn);

      await waitFor(() => {
        expect(mockGeneratePrompt).toHaveBeenCalledTimes(1);
        expect(mockGeneratePrompt).toHaveBeenCalledWith(
          expect.objectContaining({
            title: "Verifica Clausole Arbitrali",
            objective: "Rileva clausole di devoluzione ad arbitrato rituale",
            fields: [
              expect.objectContaining({
                name: "presenza_arbitrato",
                description: "Cerca riferimento ad arbitrato o collegio arbitrale",
              }),
            ],
          })
        );
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /* OVERLAY STATO GENERAZIONE & AUTO-REDIRECT                                  */
  /* -------------------------------------------------------------------------- */
  describe("Stato di Generazione e Redirect Automatico", () => {
    test("mostra overlay di caricamento e disabilita il submit quando isGenerating è true", () => {
      mockHookState.isGenerating = true;

      render(<PromptCreator onBack={mockOnBack} />);

      expect(screen.getByText("Stiamo creando il modello")).toBeInTheDocument();
      const submitBtn = screen.getByRole("button", { name: /crea il modello/i });
      expect(submitBtn).toBeDisabled();
    });

    test("mostra messaggio di completamento ed esegue onBack dopo timeout quando generatedPrompt è presente", () => {
      vi.useFakeTimers();
      mockHookState.generatedPrompt = "Prompt generato con successo";
      mockHookState.isGenerating = false;

      render(<PromptCreator onBack={mockOnBack} />);

      expect(screen.getByText("Modello creato")).toBeInTheDocument();
      expect(mockOnBack).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1800);

      expect(mockOnBack).toHaveBeenCalledTimes(1);
    });
  });
});