// src/features/analisi/components/ExecutionLogModal/TicTacToeModal.tsx

import React from "react";
import { Loader2, Brain, X, RotateCcw } from "lucide-react";
import type { Cell, GameResult, Player } from "../hooks/types";

const INITIAL_BOARD: Cell[] = Array(9).fill(null);

const WINNING_COMBINATIONS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const getWinner = (board: Cell[]): GameResult => {
  for (const [a, b, c] of WINNING_COMBINATIONS) {
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return board.every(Boolean) ? "draw" : null;
};

const getWinningLine = (board: Cell[]): number[] => {
  for (const combination of WINNING_COMBINATIONS) {
    const [a, b, c] = combination;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return combination;
    }
  }
  return [];
};

const getComputerMove = (board: Cell[]): number => {
  const tryMove = (player: Player) => {
    for (let i = 0; i < board.length; i++) {
      if (board[i]) continue;
      const nextBoard = [...board];
      nextBoard[i] = player;
      if (getWinner(nextBoard) === player) return i;
    }
    return null;
  };

  const winningMove = tryMove("O");
  if (winningMove !== null) return winningMove;

  const blockingMove = tryMove("X");
  if (blockingMove !== null) return blockingMove;

  if (!board[4]) return 4;

  const corners = [0, 2, 6, 8].filter((index) => !board[index]);
  if (corners.length > 0) {
    return corners[Math.floor(Math.random() * corners.length)];
  }

  const freeCells = board
    .map((value, index) => (!value ? index : null))
    .filter((value): value is number => value !== null);

  return freeCells[Math.floor(Math.random() * freeCells.length)] ?? -1;
};

interface TicTacToeModalProps {
  onClose: () => void;
}

export const TicTacToeModal: React.FC<TicTacToeModalProps> = ({ onClose }) => {
  const [board, setBoard] = React.useState<Cell[]>(INITIAL_BOARD);
  const [currentPlayer, setCurrentPlayer] = React.useState<Player>("X");
  const [result, setResult] = React.useState<GameResult>(null);
  const [winningLine, setWinningLine] = React.useState<number[]>([]);
  const [computerThinking, setComputerThinking] = React.useState(false);

  const resetGame = React.useCallback(() => {
    setBoard(INITIAL_BOARD);
    setCurrentPlayer("X");
    setResult(null);
    setWinningLine([]);
    setComputerThinking(false);
  }, []);

  const handlePlayerMove = (index: number) => {
    if (board[index] || result || currentPlayer !== "X" || computerThinking) {
      return;
    }

    const nextBoard = [...board];
    nextBoard[index] = "X";
    const nextResult = getWinner(nextBoard);
    setBoard(nextBoard);

    if (nextResult) {
      setResult(nextResult);
      setWinningLine(getWinningLine(nextBoard));
      return;
    }

    setCurrentPlayer("O");
    setComputerThinking(true);
  };

  React.useEffect(() => {
    if (currentPlayer !== "O" || result || !computerThinking) return;

    const timer = window.setTimeout(() => {
      setBoard((currentBoard) => {
        const move = getComputerMove(currentBoard);
        if (move === -1) {
          setComputerThinking(false);
          return currentBoard;
        }

        const nextBoard = [...currentBoard];
        nextBoard[move] = "O";
        const nextResult = getWinner(nextBoard);

        if (nextResult) {
          setResult(nextResult);
          setWinningLine(getWinningLine(nextBoard));
        }

        setCurrentPlayer("X");
        setComputerThinking(false);
        return nextBoard;
      });
    }, 550);

    return () => window.clearTimeout(timer);
  }, [currentPlayer, result, computerThinking]);

  const resultLabel = React.useMemo(() => {
    switch (result) {
      case "X":
        return "Ricorso accolto";
      case "O":
        return "Ricorso respinto";
      case "draw":
        return "Decisione non definitiva";
      default:
        return null;
    }
  }, [result]);

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-xs" />

      <div className="relative z-10 w-full max-w-xs overflow-hidden rounded-lg border border-(--color-border) bg-(--color-surface) text-(--color-text) shadow-(--shadow-soft)">
        <div className="absolute left-0 right-0 top-0 z-20 h-0.75 bg-(--color-primary)" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-(--color-border) bg-(--color-bg) px-4 py-3">
          <div className="flex items-center gap-2.5">
            <Brain size={14} className="text-(--color-text) opacity-80" />
            <div>
              <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-(--color-muted)">
                Pausa cognitiva
              </div>
              <div className="font-mono text-[11px]">SEZIONE CIVILE</div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi pausa cognitiva"
            className="rounded-md p-1 text-(--color-muted) transition-colors hover:bg-(--color-surface) hover:text-(--color-text)"
          >
            <X size={14} />
          </button>
        </div>

        {/* Context */}
        <div className="px-4 pt-3 text-center">
          <div className="text-[9px] font-mono uppercase tracking-[0.14em] text-(--color-muted)">
            Difesa
            <span className="mx-1.5 opacity-40">vs</span>
            Corte
          </div>
          <h4 className="mt-1 text-xs font-semibold tracking-wide">Tris</h4>
          <p className="mt-0.5 text-[10px] text-(--color-muted)">
            La Corte sta elaborando una mossa.
          </p>
        </div>

        {/* Board */}
        <div className="mx-auto mt-3 grid w-45 grid-cols-3 overflow-hidden rounded-md border border-(--color-border)">
          {board.map((cell, index) => {
            const isWinningCell = winningLine.includes(index);
            return (
              <button
                key={index}
                type="button"
                onClick={() => handlePlayerMove(index)}
                disabled={
                  Boolean(cell) ||
                  Boolean(result) ||
                  currentPlayer !== "X" ||
                  computerThinking
                }
                aria-label={`Casella ${index + 1}`}
                className={[
                  "flex aspect-square items-center justify-center",
                  "border-r border-b border-(--color-border)",
                  "font-mono text-xl transition-all",
                  "last:border-r-0",
                  index >= 6 ? "border-b-0" : "",
                  index % 3 === 2 ? "border-r-0" : "",
                  "hover:bg-(--color-bg)",
                  "disabled:cursor-default",
                  isWinningCell ? "bg-(--color-bg) font-bold" : "",
                ].join(" ")}
              >
                {cell === "X" && <span className="text-(--color-text)">X</span>}
                {cell === "O" && <span className="text-(--color-muted)">O</span>}
              </button>
            );
          })}
        </div>

        {/* Area Stato fissa (h-24) per evitare scatti */}
        <div className="flex h-24 flex-col items-center justify-center px-4 text-center">
          {!result ? (
            <div className="flex items-center justify-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-(--color-muted)">
              {computerThinking ? (
                <>
                  <Loader2 size={10} className="animate-spin" />
                  La Corte delibera...
                </>
              ) : (
                <>Tuo turno — seleziona una casella</>
              )}
            </div>
          ) : (
            <div className="animate-in fade-in duration-200">
              <div className="text-[9px] font-bold uppercase tracking-[0.16em] text-(--color-muted)">
                Esito
              </div>
              <div className="mt-0.5 text-xs font-semibold">{resultLabel}</div>
              <div className="mt-2.5 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={resetGame}
                  className="inline-flex items-center gap-1.5 rounded-md border border-(--color-border) bg-(--color-bg) px-2.5 py-1 text-[9px] font-semibold uppercase tracking-widest transition-colors hover:border-(--color-text)"
                >
                  <RotateCcw size={10} />
                  Nuova causa
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md px-2.5 py-1 text-[9px] font-semibold uppercase tracking-widest text-(--color-muted) transition-colors hover:text-(--color-text)"
                >
                  Chiudi
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Fisso */}
        <div className="border-t border-(--color-border) bg-(--color-bg) px-4 py-2 text-center font-mono text-[8px] uppercase tracking-widest text-(--color-muted)">
          X = Difesa · O = Corte
        </div>
      </div>
    </div>
  );
};