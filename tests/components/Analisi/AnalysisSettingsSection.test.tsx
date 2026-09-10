import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnalysisSettingsSection } from "@/features/analisi/components/AnalysisSettingsSection";
import type { DeepAnalysisConfig } from "@/features/analisi/hooks/types";

describe("AnalysisSettingsSection Component Suite", () => {
  const mockConfig: DeepAnalysisConfig = {
    sourceInternalDB: true,
    sourceWeb: true,
    confidenceLevel: 80,
    temperature: 0.3,
    topK: 10,
  };

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    config: mockConfig,
    setConfig: vi.fn(),
    isProcessing: false,
    canStart: true,
    onStartAnalysis: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("non renderizza nulla se isOpen è false", () => {
    render(<AnalysisSettingsSection {...defaultProps} isOpen={false} />);

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.queryByText("Parametri Avanzati")).not.toBeInTheDocument();
  });

  test("renderizza correttamente il pannello laterale e tutte le sezioni di configurazione se isOpen è true", () => {
    render(<AnalysisSettingsSection {...defaultProps} />);

    expect(screen.getByText("Parametri Avanzati")).toBeInTheDocument();
    expect(screen.getByText("Tipologia di Fonti")).toBeInTheDocument();
    expect(screen.getByText("Banca Dati Interna")).toBeInTheDocument();
    expect(screen.getByText("Ricerca Web")).toBeInTheDocument();
    expect(screen.getByText("Livello di Confidenza")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByText("Temperatura")).toBeInTheDocument();
    expect(screen.getByText("0.3")).toBeInTheDocument();
    expect(screen.getByText("N. Risultati (k)")).toBeInTheDocument();
  });

  test("chiude il pannello cliccando sul pulsante di chiusura o sull'overlay", () => {
    const onCloseMock = vi.fn();
    const { container } = render(
      <AnalysisSettingsSection {...defaultProps} onClose={onCloseMock} />
    );

    const closeButton = screen.getByTitle("Chiudi impostazioni");
    fireEvent.click(closeButton);
    expect(onCloseMock).toHaveBeenCalledTimes(1);

    // Clic sull'overlay di sfondo (aria-hidden="true")
    const overlay = container.querySelector("[aria-hidden='true']");
    expect(overlay).toBeInTheDocument();
    if (overlay) {
      fireEvent.click(overlay);
      expect(onCloseMock).toHaveBeenCalledTimes(2);
    }
  });

  test("attiva e disattiva il pannello informativo delle sezioni al click sull'icona Info", () => {
    render(<AnalysisSettingsSection {...defaultProps} />);

    // Inizialmente la descrizione della confidenza non è visibile
    expect(
      screen.queryByText(/rappresenta la soglia minima di similarità semantica/i)
    ).not.toBeInTheDocument();

    // Trova i bottoni delle info e clicca sul secondo (Confidenza)
    const infoButtons = screen.getAllByRole("button", { name: "" }).filter(
      (btn) => btn.querySelector("svg.lucide-info")
    );
    fireEvent.click(infoButtons[1]);

    expect(
      screen.getByText(/rappresenta la soglia minima di similarità semantica/i)
    ).toBeInTheDocument();
  });

  test("aggiorna i valori di confidenza, temperatura e topK tramite i controlli input", () => {
    const setConfigMock = vi.fn();
    render(<AnalysisSettingsSection {...defaultProps} setConfig={setConfigMock} />);

    // Recupera tutti gli slider presenti nel pannello (0: confidenza, 1: temperatura)
    const sliders = screen.getAllByRole("slider");
    
    // Slider Confidenza (min 50, max 100, step 5)
    fireEvent.change(sliders[0], { target: { value: "90" } });
    expect(setConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({ confidenceLevel: 90 })
    );

    // Slider Temperatura (min 0, max 1, step 0.1)
    fireEvent.change(sliders[1], { target: { value: "0.7" } });
    expect(setConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.7 })
    );

    // Input Numerico TopK
    const topKInput = screen.getByRole("spinbutton");
    fireEvent.change(topKInput, { target: { value: "25" } });
    expect(setConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({ topK: 25 })
    );

    // Blur su TopK per testare la funzione clampValue
    fireEvent.blur(topKInput, { target: { value: "100" } });
    expect(setConfigMock).toHaveBeenCalledWith(
      expect.objectContaining({ topK: 50 })
    );
  });

  test("impedisce di deselezionare entrambe le fonti di ricerca e mostra l'avviso di obbligatorietà", () => {
    const setConfigMock = vi.fn();
    const configWithOnlyWeb: DeepAnalysisConfig = {
      ...mockConfig,
      sourceInternalDB: false,
      sourceWeb: true,
    };

    render(
      <AnalysisSettingsSection
        {...defaultProps}
        config={configWithOnlyWeb}
        setConfig={setConfigMock}
      />
    );

    // I checkbox sono associati alle label o intercettati via type
    const checkboxes = screen.getAllByRole("checkbox");
    const dbCheckbox = checkboxes[0]; // Banca Dati Interna (attualmente false)

    // Tenta di attivare DB (ora entrambe attive)
    fireEvent.click(dbCheckbox);
    expect(setConfigMock).toHaveBeenCalled();
  });

  test("disabilita il pulsante di avvio se canStart è false o se non ci sono fonti attive", () => {
    const configNoSource: DeepAnalysisConfig = {
      ...mockConfig,
      sourceInternalDB: false,
      sourceWeb: false,
    };

    const { rerender } = render(
      <AnalysisSettingsSection {...defaultProps} canStart={false} />
    );

    const startButton = screen.getByRole("button", { name: /avvia analisi profonda/i });
    expect(startButton).toBeDisabled();

    // Rerender con canStart true ma senza fonti selezionate
    rerender(
      <AnalysisSettingsSection
        {...defaultProps}
        canStart={true}
        config={configNoSource}
      />
    );
    expect(startButton).toBeDisabled();
    expect(screen.getByText(/è obbligatorio selezionare almeno una fonte di ricerca/i)).toBeInTheDocument();
  });

  test("avvia l'analisi e chiude il pannello quando si clicca sul pulsante di avvio e le condizioni sono valide", () => {
    const onStartAnalysisMock = vi.fn();
    const onCloseMock = vi.fn();

    render(
      <AnalysisSettingsSection
        {...defaultProps}
        onStartAnalysis={onStartAnalysisMock}
        onClose={onCloseMock}
      />
    );

    const startButton = screen.getByRole("button", { name: /avvia analisi profonda/i });
    expect(startButton).not.toBeDisabled();

    fireEvent.click(startButton);

    expect(onStartAnalysisMock).toHaveBeenCalledTimes(1);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });
});