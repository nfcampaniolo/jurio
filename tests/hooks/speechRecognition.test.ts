import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import type {
  ISpeechRecognition,
  SpeechWindow,
  SpeechRecognitionEvent,
  SpeechRecognitionErrorEvent,
} from "@/hooks/speech-recognition"; // <-- adegua il path del file di tipi

/**
 * Mock class per simulare l'implementazione del browser (JSDOM non include la Web Speech API)
 */
export class MockSpeechRecognition extends EventTarget implements ISpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = "it-IT";

  onresult: ((this: ISpeechRecognition, ev: SpeechRecognitionEvent) => void) | null = null;
  onerror: ((this: ISpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null = null;
  onend: ((this: ISpeechRecognition, ev: Event) => void) | null = null;

  start = vi.fn();
  stop = vi.fn(() => {
    if (this.onend) this.onend.call(this, new Event("end"));
  });
  abort = vi.fn(() => {
    if (this.onend) this.onend.call(this, new Event("end"));
  });

  // Metodi helper per simulare eventi nei test dei componenti/hook
  simulateResult(transcript: string, isFinal = true, confidence = 0.95) {
    const event = new Event("result") as SpeechRecognitionEvent;
    Object.assign(event, {
      resultIndex: 0,
      results: [
        Object.assign([{ transcript, confidence }], {
          isFinal,
          length: 1,
        }),
      ],
      length: 1,
    });

    this.onresult?.call(this, event);
    this.dispatchEvent(event);
  }

  simulateError(error: string, message = "Errore di riconoscimento vocale") {
    const event = new Event("error") as SpeechRecognitionErrorEvent;
    Object.assign(event, { error, message });

    this.onerror?.call(this, event);
    this.dispatchEvent(event);
  }
}

describe("Web Speech API Contract & Mock Suite", () => {
  const speechWin = window as unknown as SpeechWindow;

  beforeEach(() => {
    vi.clearAllMocks();
    delete speechWin.SpeechRecognition;
    delete speechWin.webkitSpeechRecognition;
  });

  afterEach(() => {
    delete speechWin.SpeechRecognition;
    delete speechWin.webkitSpeechRecognition;
  });

  describe("Rilevamento del supporto browser su Window", () => {
    test("rileva assenza del supporto se né SpeechRecognition né webkitSpeechRecognition sono presenti", () => {
      const isSupported = Boolean(
        speechWin.SpeechRecognition || speechWin.webkitSpeechRecognition
      );
      expect(isSupported).toBe(false);
    });

    test("rileva supporto standard se window.SpeechRecognition è definita", () => {
      speechWin.SpeechRecognition = MockSpeechRecognition;

      const RecognitionConstructor =
        speechWin.SpeechRecognition || speechWin.webkitSpeechRecognition;

      expect(RecognitionConstructor).toBeDefined();
      const instance = new RecognitionConstructor!();
      expect(instance).toBeInstanceOf(MockSpeechRecognition);
    });

    test("rileva supporto fallback Chromium (webkitSpeechRecognition)", () => {
      speechWin.webkitSpeechRecognition = MockSpeechRecognition;

      const RecognitionConstructor =
        speechWin.SpeechRecognition || speechWin.webkitSpeechRecognition;

      expect(RecognitionConstructor).toBeDefined();
      const instance = new RecognitionConstructor!();
      expect(instance).toBeInstanceOf(MockSpeechRecognition);
    });
  });

  describe("Ciclo di vita e dispatching eventi di ISpeechRecognition", () => {
    test("istanzia il client con impostazioni di default conformi alle interfacce", () => {
      const recognition = new MockSpeechRecognition();

      expect(recognition.continuous).toBe(false);
      expect(recognition.interimResults).toBe(false);
      expect(recognition.lang).toBe("it-IT");
      expect(recognition.onresult).toBeNull();
      expect(recognition.onerror).toBeNull();
      expect(recognition.onend).toBeNull();
    });

    test("gestisce il callback onresult con struttura di trascrizione valida", () => {
      const recognition = new MockSpeechRecognition();
      const onResultSpy = vi.fn();
      recognition.onresult = onResultSpy;

      recognition.simulateResult("Avvocato procediamo con il ricorso", true);

      expect(onResultSpy).toHaveBeenCalledTimes(1);
      const dispatchedEvent: SpeechRecognitionEvent = onResultSpy.mock.calls[0][0];

      expect(dispatchedEvent.results[0][0].transcript).toBe("Avvocato procediamo con il ricorso");
      expect(dispatchedEvent.results[0][0].confidence).toBeGreaterThan(0.9);
      expect(dispatchedEvent.results[0].isFinal).toBe(true);
      expect(dispatchedEvent.resultIndex).toBe(0);
    });

    test("intercetta l'evento onerror con codice errore e messaggio", () => {
      const recognition = new MockSpeechRecognition();
      const onErrorSpy = vi.fn();
      recognition.onerror = onErrorSpy;

      recognition.simulateError("not-allowed", "Permesso microfono negato");

      expect(onErrorSpy).toHaveBeenCalledTimes(1);
      const errorEvent: SpeechRecognitionErrorEvent = onErrorSpy.mock.calls[0][0];

      expect(errorEvent.error).toBe("not-allowed");
      expect(errorEvent.message).toBe("Permesso microfono negato");
    });

    test("invoca onend quando viene richiamato stop() o abort()", () => {
      const recognition = new MockSpeechRecognition();
      const onEndSpy = vi.fn();
      recognition.onend = onEndSpy;

      recognition.stop();
      expect(recognition.stop).toHaveBeenCalledTimes(1);
      expect(onEndSpy).toHaveBeenCalledTimes(1);

      recognition.abort();
      expect(recognition.abort).toHaveBeenCalledTimes(1);
      expect(onEndSpy).toHaveBeenCalledTimes(2);
    });
  });
});