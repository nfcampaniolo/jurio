import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import {
  AnalysisPromptSection,
} from "@/features/analisi/components/AnalysisPromptSection";
import type {
  SpeechRecognitionEvent,
  SpeechRecognitionErrorEvent,
  ISpeechRecognition,
  SpeechWindow,
} from "@/shared/hooks/speech-recognition";

class MockSpeechRecognition extends EventTarget implements ISpeechRecognition {
  static lastInstance: MockSpeechRecognition | null = null;

  continuous = false;
  interimResults = false;
  lang = "";
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  onresult: ((this: ISpeechRecognition, ev: SpeechRecognitionEvent) => void) | null = null;
  onerror: ((this: ISpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null = null;
  onend: ((this: ISpeechRecognition, ev: Event) => void) | null = null;

  constructor() {
    super();
    MockSpeechRecognition.lastInstance = this;
  }
}

describe("AnalysisPromptSection Component Suite", () => {
  const defaultProps = {
    prompt: "",
    setPrompt: vi.fn(),
    isProcessing: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    MockSpeechRecognition.lastInstance = null;
    vi.spyOn(window, "alert").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});

    const win = window as unknown as SpeechWindow;
    win.SpeechRecognition = MockSpeechRecognition as unknown as {
      new (): ISpeechRecognition;
    };
    delete win.webkitSpeechRecognition;
  });

  afterEach(() => {
    const win = window as unknown as SpeechWindow;
    delete win.SpeechRecognition;
    delete win.webkitSpeechRecognition;
    vi.restoreAllMocks();
  });

  test("renderizza correttamente l'intestazione, il pulsante vocale e l'area di testo", () => {
    render(<AnalysisPromptSection {...defaultProps} prompt="Test quesito giuridico" />);

    expect(
      screen.getByRole("heading", { level: 3, name: "Istruzioni di Analisi" })
    ).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(
      /descrivi l'analisi legale, la ricerca giurisprudenziale profonda/i
    );
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue("Test quesito giuridico");

    const micButton = screen.getByRole("button", { name: /detta/i });
    expect(micButton).toBeInTheDocument();
    expect(micButton).toHaveAttribute("title", "Avvia dettatura vocale");
  });

  test("invoca setPrompt al cambio del testo nella textarea", () => {
    const setPromptMock = vi.fn();
    render(<AnalysisPromptSection {...defaultProps} setPrompt={setPromptMock} />);

    const textarea = screen.getByPlaceholderText(
      /descrivi l'analisi legale, la ricerca giurisprudenziale profonda/i
    );
    fireEvent.change(textarea, { target: { value: "Nuova analisi di Cassazione" } });

    expect(setPromptMock).toHaveBeenCalledWith("Nuova analisi di Cassazione");
  });

  test("disabilita textarea e pulsante vocale quando isProcessing è true", () => {
    render(<AnalysisPromptSection {...defaultProps} isProcessing={true} />);

    const textarea = screen.getByPlaceholderText(
      /descrivi l'analisi legale, la ricerca giurisprudenziale profonda/i
    );
    const micButton = screen.getByRole("button", { name: /detta/i });

    expect(textarea).toBeDisabled();
    expect(micButton).toBeDisabled();
  });

  test("mostra un alert se il browser non supporta la SpeechRecognition API", () => {
    const win = window as unknown as SpeechWindow;
    delete win.SpeechRecognition;
    delete win.webkitSpeechRecognition;

    render(<AnalysisPromptSection {...defaultProps} />);

    const micButton = screen.getByRole("button", { name: /detta/i });
    fireEvent.click(micButton);

    expect(window.alert).toHaveBeenCalledWith(
      "La dettatura vocale non è supportata da questo browser."
    );
  });

  test("avvia la registrazione e aggiorna l'UI allo stato di ascolto", () => {
    render(<AnalysisPromptSection {...defaultProps} />);

    const micButton = screen.getByRole("button", { name: /detta/i });
    fireEvent.click(micButton);

    const instance = MockSpeechRecognition.lastInstance;
    expect(instance).not.toBeNull();
    expect(instance?.start).toHaveBeenCalledTimes(1);
    expect(instance?.continuous).toBe(true);
    expect(instance?.interimResults).toBe(true);
    expect(instance?.lang).toBe("it-IT");

    expect(screen.getByText("Ascoltando...")).toBeInTheDocument();
    expect(micButton).toHaveAttribute("title", "Ferma registrazione");
  });

  test("arresta la registrazione al secondo click sul pulsante", () => {
    render(<AnalysisPromptSection {...defaultProps} />);

    const micButton = screen.getByRole("button", { name: /detta/i });

    // Primo click: avvia
    fireEvent.click(micButton);
    expect(MockSpeechRecognition.lastInstance?.start).toHaveBeenCalledTimes(1);

    // Secondo click: ferma
    fireEvent.click(micButton);
    expect(MockSpeechRecognition.lastInstance?.stop).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Detta")).toBeInTheDocument();
  });

  test("appende il testo trascritto dal riconoscimento vocale al prompt esistente", () => {
    const setPromptMock = vi.fn();
    render(
      <AnalysisPromptSection
        {...defaultProps}
        prompt="Contesto iniziale."
        setPrompt={setPromptMock}
      />
    );

    const micButton = screen.getByRole("button", { name: /detta/i });
    fireEvent.click(micButton);

    const mockEvent = {
      resultIndex: 0,
      results: [
        Object.assign([{ transcript: "Verifica ratio decidendi." }], {
          isFinal: true,
          length: 1,
          item: (index: number) => ({ transcript: "Verifica ratio decidendi.", confidence: 1 }[index]),
        }),
      ],
    } as unknown as SpeechRecognitionEvent;

    act(() => {
      MockSpeechRecognition.lastInstance?.onresult?.(mockEvent);
    });

    expect(setPromptMock).toHaveBeenCalledWith(
      "Contesto iniziale. Verifica ratio decidendi."
    );
  });

  test("reimposta lo stato quando il riconoscimento termina (onend) o va in errore (onerror)", () => {
    render(<AnalysisPromptSection {...defaultProps} />);

    const micButton = screen.getByRole("button", { name: /detta/i });
    fireEvent.click(micButton);
    expect(screen.getByText("Ascoltando...")).toBeInTheDocument();

    // Simula evento onend
    act(() => {
      MockSpeechRecognition.lastInstance?.onend?.(new Event("end"));
    });

    expect(screen.getByText("Detta")).toBeInTheDocument();

    // Riavvia e simula onerror
    fireEvent.click(micButton);
    expect(screen.getByText("Ascoltando...")).toBeInTheDocument();

    const mockErrorEvent = {
      error: "audio-capture",
      message: "Microphone error",
    } as unknown as SpeechRecognitionErrorEvent;

    act(() => {
      MockSpeechRecognition.lastInstance?.onerror?.(mockErrorEvent);
    });

    expect(screen.getByText("Detta")).toBeInTheDocument();
  });
});