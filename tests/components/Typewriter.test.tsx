import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { Typewriter } from "@/components/Typewriter";

/* =========================
   MOCKS
========================= */

vi.mock("react-markdown", () => ({
  // Mock semplicissimo: renderizza il testo nudo per facilitare il testing
  default: ({ children }: { children: string }) => (
    <div data-testid="markdown-content">{children}</div>
  ),
}));

/* =========================
   TEST SUITE
========================= */

describe("Componente Typewriter", () => {
  const testText = "Ciao";
  const speed = 10;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  test("Inizialmente il testo è vuoto", () => {
    render(<Typewriter text={testText} speed={speed} />);
    const content = screen.getByTestId("markdown-content");
    expect(content.textContent).toBe("");
  });

  test("Mostra tutto il testo avanzando un carattere alla volta", () => {
    render(<Typewriter text={testText} speed={speed} />);
    const content = screen.getByTestId("markdown-content");

    // Per testare l'effetto "macchina da scrivere", avanziamo carattere per carattere.
    // Ogni ciclo: avanza il timer -> scatta il timeout -> aggiorna stato -> React renderizza -> nuovo useEffect
    for (let i = 0; i < testText.length; i++) {
      act(() => {
        vi.advanceTimersByTime(speed);
      });
      expect(content.textContent).toBe(testText.slice(0, i + 1));
    }

    expect(content.textContent).toBe(testText);
  });

  test("Mostra tutto il testo completo con un loop massivo", () => {
    const longText = "Questo è un testo lungo per il test.";
    render(<Typewriter text={longText} speed={speed} />);

    // FIX: Spostiamo l'act dentro il loop per forzare il re-render
    // e l'esecuzione dell'useEffect a ogni singolo carattere.
    for (let i = 0; i < longText.length; i++) {
      act(() => {
        vi.advanceTimersByTime(speed);
      });
    }

    const content = screen.getByTestId("markdown-content");
    expect(content.textContent).toBe(longText);
  });

  test("Rispetta la prop 'speed' personalizzata", () => {
    const slowSpeed = 1000;
    render(<Typewriter text="Hi" speed={slowSpeed} />);
    const content = screen.getByTestId("markdown-content");

    // Avanziamo di metà tempo: non deve esserci ancora nulla
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(content.textContent).toBe("");

    // Completiamo il primo carattere
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(content.textContent).toBe("H");
  });

  test("Pulisce correttamente il timeout all'unmount", () => {
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const { unmount } = render(<Typewriter text="Test" />);
    
    unmount();
    
    expect(clearTimeoutSpy).toHaveBeenCalled();
    clearTimeoutSpy.mockRestore();
  });
});