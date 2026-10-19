import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";

import { LogStepItem } from "@/features/analisi/components/LogStepItem";
import type { LogStep } from "@/features/analisi/hooks/types";

describe("LogStepItem Component Suite", () => {
  test("renderizza correttamente un passo con stato 'success'", () => {
    const step: LogStep = {
      message: "Vector search completata con successo",
      status: "success",
      timestamp: "12:00:01",
    } as unknown as LogStep;

    render(<LogStepItem step={step} index={0} />);

    expect(screen.getByText("STEP #1")).toBeInTheDocument();
    expect(screen.getByText("12:00:01")).toBeInTheDocument();
    expect(screen.getByText("Vector search completata con successo")).toBeInTheDocument();
  });

  test("renderizza correttamente un passo con stato 'error'", () => {
    const step: LogStep = {
      message: "Errore di connessione al database",
      status: "error",
      timestamp: "12:00:05",
    } as unknown as LogStep;

    render(<LogStepItem step={step} index={1} />);

    expect(screen.getByText("STEP #2")).toBeInTheDocument();
    expect(screen.getByText("12:00:05")).toBeInTheDocument();
    expect(screen.getByText("Errore di connessione al database")).toBeInTheDocument();
  });

  test("renderizza correttamente un passo con stato 'pending'", () => {
    const step: LogStep = {
      message: "Elaborazione in corso...",
      status: "pending",
    } as unknown as LogStep;

    render(<LogStepItem step={step} index={2} />);

    expect(screen.getByText("STEP #3")).toBeInTheDocument();
    expect(screen.getByText("Elaborazione in corso...")).toBeInTheDocument();
  });
});