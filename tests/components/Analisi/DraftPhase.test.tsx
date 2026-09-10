import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { DraftPhase } from "@/features/analisi/components/DraftPhase";

/* ---------- mock AnalysisPromptSection ---------- */
vi.mock("@/features/analisi/components/AnalysisPromptSection", () => ({
  AnalysisPromptSection: ({
    prompt,
    setPrompt,
    isProcessing,
  }: {
    prompt: string;
    setPrompt: (val: string) => void;
    isProcessing: boolean;
  }) => (
    <div data-testid="analysis-prompt-section">
      <textarea
        aria-label="prompt-textarea"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        disabled={isProcessing}
      />
    </div>
  ),
}));

describe("DraftPhase Component Suite", () => {
  const defaultProps = {
    quesito: "",
    setQuesito: vi.fn(),
    isProcessing: false,
    onEseguiRicerca: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza correttamente AnalysisPromptSection e il pulsante disabilitato se il quesito è vuoto", () => {
    render(<DraftPhase {...defaultProps} quesito="" />);

    expect(screen.getByTestId("analysis-prompt-section")).toBeInTheDocument();
    
    const button = screen.getByRole("button", { name: /costruisci mappa dialettica/i });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  test("abilita il pulsante quando il quesito contiene testo valido", () => {
    render(<DraftPhase {...defaultProps} quesito="Analisi di legittimità sulla responsabilità medica." />);

    const button = screen.getByRole("button", { name: /costruisci mappa dialettica/i });
    expect(button).not.toBeDisabled();
  });

  test("disabilita il pulsante e mostra lo stato di elaborazione quando isProcessing è true", () => {
    render(
      <DraftPhase
        {...defaultProps}
        quesito="Quesito valido"
        isProcessing={true}
      />
    );

    const button = screen.getByRole("button", { name: /elaborazione.../i });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
  });

  test("invoca onEseguiRicerca e gestisce lo stato di caricamento locale al click sulla CTA", async () => {
    const onEseguiRicercaMock = vi.fn().mockResolvedValue(undefined);

    render(
      <DraftPhase
        {...defaultProps}
        quesito="Verifica orientamenti di legittimità."
        onEseguiRicerca={onEseguiRicercaMock}
      />
    );

    const button = screen.getByRole("button", { name: /costruisci mappa dialettica/i });
    fireEvent.click(button);

    expect(onEseguiRicercaMock).toHaveBeenCalledTimes(1);
    
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /costruisci mappa dialettica/i })).toBeInTheDocument();
    });
  });

  test("propaga correttamente l'aggiornamento del prompt tramite AnalysisPromptSection", () => {
    const setQuesitoMock = vi.fn();
    render(<DraftPhase {...defaultProps} setQuesito={setQuesitoMock} quesito="" />);

    const textarea = screen.getByRole("textbox", { name: /prompt-textarea/i });
    fireEvent.change(textarea, { target: { value: "Nuovo quesito di prova" } });

    expect(setQuesitoMock).toHaveBeenCalledWith("Nuovo quesito di prova");
  });
});