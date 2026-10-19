import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { WorkspaceHeader } from "@/features/analisi/components/WorkspaceHeader";
import type { DeepAnalysisSession } from "@/features/analisi/hooks/types";

describe("WorkspaceHeader Component Suite", () => {
  const mockSession: DeepAnalysisSession = {
    id: "session-1",
    title: "Analisi di legittimità contrattuale",
    status: "review",
  } as unknown as DeepAnalysisSession;

  const defaultProps = {
    activeSession: mockSession,
    titoloEditabile: "Analisi di legittimità contrattuale",
    isEditingTitle: false,
    setIsEditingTitle: vi.fn(),
    setTitoloLocale: vi.fn(),
    handleSalvaTitolo: vi.fn(),
    isProcessing: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza correttamente il titolo in modalità visualizzazione e lo stato della sessione", () => {
    render(<WorkspaceHeader {...defaultProps} />);

    expect(screen.getByText("Analisi di legittimità contrattuale")).toBeInTheDocument();
    expect(screen.getByText("Revisione Mappa")).toBeInTheDocument();
  });

  test("attiva la modifica del titolo al click sul titolo o sull'icona di modifica", () => {
    const setIsEditingTitleMock = vi.fn();
    render(<WorkspaceHeader {...defaultProps} setIsEditingTitle={setIsEditingTitleMock} />);

    const titleElement = screen.getByText("Analisi di legittimità contrattuale");
    fireEvent.click(titleElement);

    expect(setIsEditingTitleMock).toHaveBeenCalledWith(true);
  });

  test("renderizza l'input di modifica quando isEditingTitle è true e gestisce il cambio valore", () => {
    const setTitoloLocaleMock = vi.fn();
    const handleSalvaTitoloMock = vi.fn();

    render(
      <WorkspaceHeader
        {...defaultProps}
        isEditingTitle={true}
        setTitoloLocale={setTitoloLocaleMock}
        handleSalvaTitolo={handleSalvaTitoloMock}
      />
    );

    const input = screen.getByDisplayValue("Analisi di legittimità contrattuale");
    expect(input).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "Nuovo titolo indagine" } });
    expect(setTitoloLocaleMock).toHaveBeenCalledWith("Nuovo titolo indagine");

    fireEvent.keyDown(input, { key: "Enter" });
    expect(handleSalvaTitoloMock).toHaveBeenCalledTimes(1);

    fireEvent.blur(input);
    expect(handleSalvaTitoloMock).toHaveBeenCalledTimes(2);
  });

  test("mostra lo stato di elaborazione (processing) quando isProcessing è true", () => {
    render(<WorkspaceHeader {...defaultProps} isProcessing={true} />);

    expect(screen.getByText("Elaborazione Mappa...")).toBeInTheDocument();
  });

  test("mostra correttamente i diversi stati della sessione (draft, completed, nuova)", () => {
    const { rerender } = render(
      <WorkspaceHeader
        {...defaultProps}
        activeSession={{ ...mockSession, status: "draft" } as unknown as DeepAnalysisSession}
      />
    );
    expect(screen.getByText("Impostazione")).toBeInTheDocument();

    rerender(
      <WorkspaceHeader
        {...defaultProps}
        activeSession={{ ...mockSession, status: "completed" } as unknown as DeepAnalysisSession}
      />
    );
    expect(screen.getByText("Completata")).toBeInTheDocument();

    rerender(<WorkspaceHeader {...defaultProps} activeSession={null} />);
    expect(screen.getByText("Nuova")).toBeInTheDocument();
  });
});