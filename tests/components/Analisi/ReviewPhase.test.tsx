import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";

import { ReviewPhase } from "@/features/analisi/components/ReviewPhase";
import type { DeepAnalysisSession } from "@/features/analisi/hooks/types";

/* ---------- mock dei sotto-componenti ---------- */
vi.mock("@/features/analisi/components/ComparisonGrid", () => ({
  ComparisonGrid: () => <div data-testid="comparison-grid">ComparisonGrid Mock</div>,
}));

vi.mock("@/features/analisi/components/FontiOrientamentoSwitch", () => ({
  FontiOrientamentoSwitch: () => <div data-testid="fonti-orientamento-switch">FontiOrientamentoSwitch Mock</div>,
}));

describe("ReviewPhase Component Suite", () => {
  const mockSession: DeepAnalysisSession = {
    promptOriginale: "Verifica della prescrizione nei contratti bancari.",
    mappaDialettica: {
      orientamentoFavorevole: { titoloTesi: "Favorevole" },
      orientamentoContrario: { titoloTesi: "Contrario" },
      puntiAperti: ["Primo profilo di incertezza", "Secondo profilo di incertezza"],
    },
  } as unknown as DeepAnalysisSession;

  const defaultProps = {
    activeSession: mockSession,
    messaggioEsito: null,
    setMessaggioEsito: vi.fn(),
    onApriHitlPreset: vi.fn(),
    toggleEsclusionePrecedente: vi.fn(),
    mostraHitlBox: false,
    setMostraHitlBox: vi.fn(),
    direttivaPersonalizzata: "",
    setDirettivaPersonalizzata: vi.fn(),
    handleEseguiHitlAction: vi.fn(),
    isProcessing: false,
    avviaGenerazioneSintesi: vi.fn(),
    fontiApprovateCount: 3,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("renderizza correttamente il quesito, le griglie, le fonti e i punti aperti", () => {
    render(<ReviewPhase {...defaultProps} />);

    expect(screen.getByText("Quesito Analizzato")).toBeInTheDocument();
    expect(screen.getByText("Verifica della prescrizione nei contratti bancari.")).toBeInTheDocument();
    expect(screen.getByTestId("comparison-grid")).toBeInTheDocument();
    expect(screen.getByTestId("fonti-orientamento-switch")).toBeInTheDocument();
    expect(screen.getByText("Punti Aperti e Profili di Incertezza")).toBeInTheDocument();
    expect(screen.getByText("Primo profilo di incertezza")).toBeInTheDocument();
    expect(screen.getByText("Secondo profilo di incertezza")).toBeInTheDocument();
    expect(screen.getByText("3 Fonti Approvate")).toBeInTheDocument();
  });

  test("mostra e chiude correttamente l'alert esito quando presente", () => {
    const setMessaggioEsitoMock = vi.fn();
    render(
      <ReviewPhase
        {...defaultProps}
        messaggioEsito={{ tipo: "success", testo: "Operazione completata con successo." }}
        setMessaggioEsito={setMessaggioEsitoMock}
      />
    );

    expect(screen.getByText("Operazione completata con successo.")).toBeInTheDocument();

    const chiudiButton = screen.getByRole("button", { name: /chiudi/i });
    fireEvent.click(chiudiButton);

    expect(setMessaggioEsitoMock).toHaveBeenCalledWith(null);
  });

  test("disabilita il pulsante di generazione sintesi se non ci sono fonti approvate o se è in corso", () => {
    const { rerender } = render(<ReviewPhase {...defaultProps} fontiApprovateCount={0} />);

    const button = screen.getByRole("button", { name: /genera sintesi strategica/i });
    expect(button).toBeDisabled();

    rerender(<ReviewPhase {...defaultProps} fontiApprovateCount={3} isProcessing={true} />);
    expect(button).toBeDisabled();
  });

  test("avvia la generazione della sintesi al click sul pulsante dedicato", async () => {
    const avviaGenerazioneMock = vi.fn().mockResolvedValue(undefined);
    render(<ReviewPhase {...defaultProps} avviaGenerazioneSintesi={avviaGenerazioneMock} />);

    const button = screen.getByRole("button", { name: /genera sintesi strategica/i });
    
    await act(async () => {
      fireEvent.click(button);
    });

    expect(avviaGenerazioneMock).toHaveBeenCalledTimes(1);
  });

  test("renderizza e gestisce il box HITL e la textarea della direttiva personalizzata", () => {
    const setDirettivaMock = vi.fn();
    const handleEseguiHitlMock = vi.fn().mockResolvedValue(undefined);

    render(
      <ReviewPhase
        {...defaultProps}
        mostraHitlBox={true}
        direttivaPersonalizzata="Approfondisci la giurisprudenza di merito."
        setDirettivaPersonalizzata={setDirettivaMock}
        handleEseguiHitlAction={handleEseguiHitlMock}
      />
    );

    expect(screen.getByText(/Direttiva di Approfondimento & Note \(HITL\)/i)).toBeInTheDocument();
    
    const textarea = screen.getByPlaceholderText("Modifica il comando o detta note specifiche...");
    expect(textarea).toHaveValue("Approfondisci la giurisprudenza di merito.");

    const eseguiButton = screen.getByRole("button", { name: /esegui approfondimento/i });
    expect(eseguiButton).not.toBeDisabled();

    act(() => {
      fireEvent.click(eseguiButton);
    });
    expect(handleEseguiHitlMock).toHaveBeenCalledTimes(1);
  });

  test("gestisce la dettatura vocale se supportata dal browser", () => {
    const startMock = vi.fn();
    const stopMock = vi.fn();

    // Funzione costruttore con function keyword per supportare l'operatore `new`
    function MockSpeechRecognition() {
      return {
        start: startMock,
        stop: stopMock,
        continuous: false,
        interimResults: false,
        lang: "",
      };
    }

    vi.stubGlobal("window", {
      ...window,
      SpeechRecognition: MockSpeechRecognition,
    });

    render(<ReviewPhase {...defaultProps} mostraHitlBox={true} />);

    const micButton = screen.getByTitle("Detta direttiva");
    
    act(() => {
      fireEvent.click(micButton);
    });

    expect(startMock).toHaveBeenCalledTimes(1);
  });

  test("mostra un alert se la dettatura vocale non è supportata dal browser", () => {
    const alertMock = vi.spyOn(window, "alert").mockImplementation(() => {});
    
    vi.stubGlobal("window", {
      ...window,
      SpeechRecognition: undefined,
      webkitSpeechRecognition: undefined,
    });

    render(<ReviewPhase {...defaultProps} mostraHitlBox={true} />);

    const micButton = screen.getByTitle("Detta direttiva");
    
    act(() => {
      fireEvent.click(micButton);
    });

    expect(alertMock).toHaveBeenCalledWith("La dettatura vocale non è supportata da questo browser.");
  });
});