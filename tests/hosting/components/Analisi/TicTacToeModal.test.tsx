import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

import { TicTacToeModal } from "@/features/analisi/components/TicTacToeModal";

describe("TicTacToeModal Component Suite", () => {
  const defaultProps = {
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("renderizza correttamente il titolo, la scacchiera e i messaggi iniziali", () => {
    render(<TicTacToeModal {...defaultProps} />);

    expect(screen.getByText("Pausa cognitiva")).toBeInTheDocument();
    expect(screen.getByText("SEZIONE CIVILE")).toBeInTheDocument();
    expect(screen.getByText("Tris")).toBeInTheDocument();
    expect(screen.getByText("La Corte sta elaborando una mossa.")).toBeInTheDocument();
    expect(screen.getByText("Tuo turno — seleziona una casella")).toBeInTheDocument();
    expect(screen.getByText("X = Difesa · O = Corte")).toBeInTheDocument();

    const buttons = screen.getAllByRole("button", { name: /casella/i });
    expect(buttons).toHaveLength(9);
  });

  test("chiama onClose al click sul pulsante di chiusura nell'header", () => {
    const onCloseMock = vi.fn();
    render(<TicTacToeModal onClose={onCloseMock} />);

    const closeButton = screen.getByRole("button", { name: /chiudi pausa cognitiva/i });
    fireEvent.click(closeButton);

    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  test("permessi di mossa al giocatore X e attivazione del computer dopo il click", async () => {
    vi.useFakeTimers();

    render(<TicTacToeModal {...defaultProps} />);

    const cella1 = screen.getByRole("button", { name: /casella 1/i });
    
    act(() => {
      fireEvent.click(cella1);
    });

    expect(cella1).toHaveTextContent("X");
    expect(screen.getByText("La Corte delibera...")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(550);
    });

    const buttons = screen.getAllByRole("button", { name: /casella/i });
    const computerMoves = buttons.filter((btn) => btn.textContent === "O");
    expect(computerMoves.length).toBeGreaterThan(0);
  });

  test("interagisce con la scacchiera e gestisce i turni di gioco", async () => {
    vi.useFakeTimers();

    render(<TicTacToeModal {...defaultProps} />);

    const cells = screen.getAllByRole("button", { name: /casella/i });

    act(() => {
      fireEvent.click(cells[0]);
    });
    expect(cells[0]).toHaveTextContent("X");

    act(() => {
      vi.advanceTimersByTime(550);
    });

    // Verifica che il computer abbia risposto
    const computerMoves = cells.filter((btn) => btn.textContent === "O");
    expect(computerMoves.length).toBe(1);
  });
});