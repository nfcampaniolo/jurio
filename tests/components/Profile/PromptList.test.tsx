import React from "react";
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { SavedPrompt } from "@/interfaces/interfaces";
import { PromptList } from "@/components/Profile/PromptList";

/* ---------- hoisted mocks ---------- */
const { mockToast } = vi.hoisted(() => ({
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

/* ---------- mock modules ---------- */
vi.mock("react-hot-toast", () => ({
  __esModule: true,
  toast: mockToast,
  default: mockToast,
}));

// Mock framer-motion per eseguire i test in ambiente DOM senza overhead di animazione
vi.mock("framer-motion", () => ({
  __esModule: true,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  useReducedMotion: vi.fn(() => false),
}));

describe("PromptList Component Suite", () => {
  const mockOnCreateNew = vi.fn();
  const mockOnDelete = vi.fn();
  const originalClipboard = navigator.clipboard;

  const samplePrompts: SavedPrompt[] = [
    {
      id: "prompt_01",
      title: "Estrattore Clausole Vessatorie",
      objective: "Identifica e analizza clausole abusive nei contratti d'appalto.",
      content: "Agisci come esperto civilista. Analizza il contratto...",
      createdAt: new Date("2026-03-10T10:00:00Z"),
    } as unknown as SavedPrompt,
    {
      id: "prompt_02",
      title: "Sintesi Sentenze Cassazione",
      objective: "Estrae massima e principio di diritto conformemente al massimario.",
      content: "Estrai massima ufficiale...",
      createdAt: {
        toDate: () => new Date("2026-04-15T15:30:00Z"),
      } as unknown as SavedPrompt["createdAt"],
    } as unknown as SavedPrompt,
  ];

  beforeEach(() => {
    vi.clearAllMocks();

    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: originalClipboard,
      writable: true,
      configurable: true,
    });
  });

  /* -------------------------------------------------------------------------- */
  /* STATO DI CARICAMENTO (LOADING)                                             */
  /* -------------------------------------------------------------------------- */
  describe("Stato di Caricamento", () => {
    test("mostra lo spinner e il messaggio di caricamento quando isLoading è true", () => {
      render(
        <PromptList
          prompts={[]}
          isLoading={true}
          onCreateNew={mockOnCreateNew}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText(/caricamento prompt\.\.\./i)).toBeInTheDocument();
      expect(screen.queryByText(/nessun prompt/i)).not.toBeInTheDocument();
      expect(screen.queryByText("Estrattore Clausole Vessatorie")).not.toBeInTheDocument();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* STATO VUOTO (EMPTY STATE)                                                  */
  /* -------------------------------------------------------------------------- */
  describe("Stato Vuoto", () => {
    test("visualizza il banner introduttivo se l'elenco prompt è vuoto", () => {
      render(
        <PromptList
          prompts={[]}
          isLoading={false}
          onCreateNew={mockOnCreateNew}
          onDelete={mockOnDelete}
        />
      );

      expect(
        screen.getByText("Personalizza l’intelligenza di Jurio sui tuoi documenti")
      ).toBeInTheDocument();
      expect(screen.getByText("Workflow & Automazione")).toBeInTheDocument();
    });

    test("attiva onCreateNew al click su 'Crea il tuo primo prompt'", () => {
      render(
        <PromptList
          prompts={[]}
          isLoading={false}
          onCreateNew={mockOnCreateNew}
          onDelete={mockOnDelete}
        />
      );

      const createFirstBtn = screen.getByRole("button", {
        name: /crea il tuo primo prompt/i,
      });
      fireEvent.click(createFirstBtn);

      expect(mockOnCreateNew).toHaveBeenCalledTimes(1);
    });
  });

  /* -------------------------------------------------------------------------- */
  /* HEADER & NAVIGAZIONE                                                       */
  /* -------------------------------------------------------------------------- */
  describe("Header", () => {
    test("attiva onCreateNew al click sul pulsante dell'header 'Nuovo Prompt'", () => {
      render(
        <PromptList
          prompts={samplePrompts}
          isLoading={false}
          onCreateNew={mockOnCreateNew}
          onDelete={mockOnDelete}
        />
      );

      const headerBtn = screen.getByRole("button", { name: /nuovo prompt/i });
      fireEvent.click(headerBtn);

      expect(mockOnCreateNew).toHaveBeenCalledTimes(1);
      expect(mockOnCreateNew).toHaveBeenCalledWith();
    });
  });

  /* -------------------------------------------------------------------------- */
  /* LISTA PROMPT & AZIONI CARD                                                 */
  /* -------------------------------------------------------------------------- */
  describe("Rendering Cards & Azioni", () => {
    test("renderizza i titoli e gli obiettivi di tutti i prompt forniti", () => {
      render(
        <PromptList
          prompts={samplePrompts}
          isLoading={false}
          onCreateNew={mockOnCreateNew}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText("Estrattore Clausole Vessatorie")).toBeInTheDocument();
      expect(screen.getByText("Sintesi Sentenze Cassazione")).toBeInTheDocument();
      expect(
        screen.getByText("Identifica e analizza clausole abusive nei contratti d'appalto.")
      ).toBeInTheDocument();
    });

    test("copia il contenuto del prompt negli appunti e mostra toast di conferma", () => {
      render(
        <PromptList
          prompts={samplePrompts}
          isLoading={false}
          onCreateNew={mockOnCreateNew}
          onDelete={mockOnDelete}
        />
      );

      const copyButtons = screen.getAllByTitle("Copia il prompt");
      fireEvent.click(copyButtons[0]);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        "Agisci come esperto civilista. Analizza il contratto..."
      );
      expect(mockToast.success).toHaveBeenCalledWith("Prompt copiato negli appunti!");
    });

    test("passa l'intero oggetto prompt a onCreateNew al click su 'Modello'", () => {
      render(
        <PromptList
          prompts={samplePrompts}
          isLoading={false}
          onCreateNew={mockOnCreateNew}
          onDelete={mockOnDelete}
        />
      );

      const templateButtons = screen.getAllByTitle("Usa come base per uno nuovo");
      fireEvent.click(templateButtons[1]);

      expect(mockOnCreateNew).toHaveBeenCalledTimes(1);
      expect(mockOnCreateNew).toHaveBeenCalledWith(samplePrompts[1]);
    });

    test("invoca onDelete passando l'id del prompt selezionato", () => {
      render(
        <PromptList
          prompts={samplePrompts}
          isLoading={false}
          onCreateNew={mockOnCreateNew}
          onDelete={mockOnDelete}
        />
      );

      const deleteButtons = screen.getAllByTitle("Elimina");
      fireEvent.click(deleteButtons[0]);

      expect(mockOnDelete).toHaveBeenCalledTimes(1);
      expect(mockOnDelete).toHaveBeenCalledWith("prompt_01");
    });
  });

  /* -------------------------------------------------------------------------- */
  /* FORMATTAZIONE DATE (HELPER FORMATDATE)                                      */
  /* -------------------------------------------------------------------------- */
  describe("Rami di Formattazione Data", () => {
    test("gestisce correttamente stringhe ISO, numeri epoch, date nulle e non valide", () => {
      const variedPrompts: SavedPrompt[] = [
        {
          id: "p_iso",
          title: "Prompt ISO",
          objective: "Test ISO",
          createdAt: "2026-05-20T00:00:00Z",
        } as unknown as SavedPrompt,
        {
          id: "p_epoch",
          title: "Prompt Epoch",
          objective: "Test Epoch",
          createdAt: 1773571200000,
        } as unknown as SavedPrompt,
        {
          id: "p_invalid",
          title: "Prompt Invalido",
          objective: "Test Invalido",
          createdAt: "data-non-riconosciuta",
        } as unknown as SavedPrompt,
        {
          id: "p_null",
          title: "Prompt Nullo",
          objective: "Test Nullo",
          createdAt: null,
        } as unknown as SavedPrompt,
      ];

      render(
        <PromptList
          prompts={variedPrompts}
          isLoading={false}
          onCreateNew={mockOnCreateNew}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText(/Data sconosciuta/i)).toBeInTheDocument();
      expect(screen.getByText(/Data non valida/i)).toBeInTheDocument();
    });
  });
});