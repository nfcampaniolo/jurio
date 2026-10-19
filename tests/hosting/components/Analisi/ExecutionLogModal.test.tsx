import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import { ExecutionLogModal, type LogStep } from "@/features/analisi/components/ExecutionLogModal";

/* ---------- mock dei sotto-componenti ---------- */
vi.mock("@/features/analisi/components//TicTacToeModal", () => ({
  TicTacToeModal: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="tic-tac-toe-modal">
      <span>TicTacToe Modal Mock</span>
      <button type="button" onClick={onClose}>Chiudi Gioco</button>
    </div>
  ),
}));

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return {
    ...actual,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: ({ children, className }: React.HTMLAttributes<HTMLDivElement>) => (
        <div className={className}>{children}</div>
      ),
    },
  };
});

describe("ExecutionLogModal Component Suite", () => {
  const mockSteps: LogStep[] = [
    { id: "1", message: "Inizializzazione vector search", status: "completed" },
    { id: "2", message: "Analisi massime di legittimità", status: "completed" },
  ] as unknown as LogStep[];

  const defaultProps = {
    isOpen: true,
    title: "Esecuzione Pipeline AI",
    steps: mockSteps,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("non renderizza nulla se isOpen è false", () => {
    render(<ExecutionLogModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByText("Esecuzione Pipeline AI")).not.toBeInTheDocument();
  });

  test("renderizza correttamente il modale, il titolo, i log e il conteggio eventi se isOpen è true", () => {
    render(<ExecutionLogModal {...defaultProps} />);

    expect(screen.getByText("Esecuzione Pipeline AI")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("Inizializzazione vector search")).toBeInTheDocument();
    expect(screen.getByText("Analisi massime di legittimità")).toBeInTheDocument();
    expect(screen.getByText(/2\s*eventi/i)).toBeInTheDocument();
    expect(screen.getByText("Elaborazione IA in corso... Non chiudere la finestra.")).toBeInTheDocument();
  });

  test("mostra il messaggio di attesa quando l'array dei passi (steps) è vuoto", () => {
    render(<ExecutionLogModal {...defaultProps} steps={[]} />);

    expect(screen.getByText("In attesa di eventi...")).toBeInTheDocument();
    expect(screen.getByText(/0\s*eventi/i)).toBeInTheDocument();
  });

  test("apre il modale TicTacToe manualmente cliccando su 'Pausa cognitiva'", () => {
    render(<ExecutionLogModal {...defaultProps} />);

    expect(screen.queryByTestId("tic-tac-toe-modal")).not.toBeInTheDocument();

    const pauseButton = screen.getByRole("button", { name: /pausa cognitiva/i });
    
    act(() => {
      fireEvent.click(pauseButton);
    });

    expect(screen.getByTestId("tic-tac-toe-modal")).toBeInTheDocument();
  });

  test("apre automaticamente il modale TicTacToe dopo 8 secondi tramite setTimeout", () => {
    vi.useFakeTimers();

    render(<ExecutionLogModal {...defaultProps} />);

    expect(screen.queryByTestId("tic-tac-toe-modal")).not.toBeInTheDocument();

    // Avanza il timer di 8000ms
    act(() => {
      vi.advanceTimersByTime(8000);
    });

    expect(screen.getByTestId("tic-tac-toe-modal")).toBeInTheDocument();
  });

  test("chiude il modale TicTacToe cliccando sul pulsante di chiusura interno", () => {
    render(<ExecutionLogModal {...defaultProps} />);

    const pauseButton = screen.getByRole("button", { name: /pausa cognitiva/i });
    
    act(() => {
      fireEvent.click(pauseButton);
    });

    expect(screen.getByTestId("tic-tac-toe-modal")).toBeInTheDocument();

    const closeGameButton = screen.getByRole("button", { name: /chiudi gioco/i });
    
    act(() => {
      fireEvent.click(closeGameButton);
    });

    expect(screen.queryByTestId("tic-tac-toe-modal")).not.toBeInTheDocument();
  });
});