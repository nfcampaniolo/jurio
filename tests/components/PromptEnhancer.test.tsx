import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { HTMLAttributes, ReactNode, SVGProps } from "react";
import { PromptEnhancer } from "@/shared/components/PromptEnhancer";
import { type HistoryMessage } from "@/shared/hooks/usePromptEnhancer";

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => ({
  Sparkles: (props: SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-sparkles" {...props} />
  ),
  Loader2: (props: SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-loader-2" {...props} />
  ),
  RotateCcw: (props: SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-rotate-ccw" {...props} />
  ),
}));

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

/* ---------- mock usePromptEnhancer hook ---------- */
const mockEnhancePrompt = vi.fn();
let mockIsEnhancing = false;

vi.mock("@/shared/hooks/usePromptEnhancer", () => ({
  usePromptEnhancer: () => ({
    enhancePrompt: mockEnhancePrompt,
    isEnhancing: mockIsEnhancing,
  }),
}));

describe("PromptEnhancer Component Suite", () => {
  const mockSetInputValue = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsEnhancing = false;
    mockEnhancePrompt.mockResolvedValue("Prompt ottimizzato per la ricerca legale.");
  });

  test("disabilita il pulsante e applica le classi di opacità se l'input ha 15 caratteri o meno", () => {
    const { container } = render(
      <PromptEnhancer
        inputValue="Testo breve"
        setInputValue={mockSetInputValue}
        type="chat"
      />
    );

    const button = screen.getByRole("button", { name: /Migliora il prompt con l'IA/i });
    expect(button).toBeDisabled();

    const motionDiv = container.querySelector(".hidden.md\\:block.opacity-30.pointer-events-none");
    expect(motionDiv).toBeInTheDocument();
    expect(screen.getByTestId("icon-sparkles")).toBeInTheDocument();
  });

  test("abilita il pulsante e rimuove le classi restrittive se l'input supera i 15 caratteri", () => {
    const { container } = render(
      <PromptEnhancer
        inputValue="Quesito giuridico articolato oltre i quindici caratteri"
        setInputValue={mockSetInputValue}
        type="chat"
      />
    );

    const button = screen.getByRole("button", { name: /Migliora il prompt con l'IA/i });
    expect(button).toBeEnabled();

    const motionDiv = container.querySelector(".opacity-30");
    expect(motionDiv).toBeNull();
  });

  test("disabilita il pulsante se la prop disabled è impostata a true", () => {
    render(
      <PromptEnhancer
        inputValue="Quesito giuridico articolato oltre i quindici caratteri"
        setInputValue={mockSetInputValue}
        type="chat"
        disabled={true}
      />
    );

    const button = screen.getByRole("button", { name: /Migliora il prompt con l'IA/i });
    expect(button).toBeDisabled();
  });

  test("mostra il loader e disabilita il pulsante quando isEnhancing è true", () => {
    mockIsEnhancing = true;

    render(
      <PromptEnhancer
        inputValue="Quesito giuridico articolato oltre i quindici caratteri"
        setInputValue={mockSetInputValue}
        type="chat"
      />
    );

    const button = screen.getByRole("button", { name: /Migliora il prompt con l'IA/i });
    expect(button).toBeDisabled();
    expect(screen.getByTestId("icon-loader-2")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-sparkles")).not.toBeInTheDocument();
  });

  test("esegue enhancePrompt con i parametri corretti (inputValue, type, history)", async () => {
    const mockHistory: HistoryMessage[] = [
      { role: "user", content: "Precedente messaggio" },
      { role: "assistant", content: "Precedente risposta" },
    ];

    render(
      <PromptEnhancer
        inputValue="Quesito valido per la verifica dei parametri"
        setInputValue={mockSetInputValue}
        type="approfondimento"
        history={mockHistory}
      />
    );

    const button = screen.getByRole("button", { name: /Migliora il prompt con l'IA/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockEnhancePrompt).toHaveBeenCalledWith(
        "Quesito valido per la verifica dei parametri",
        "approfondimento",
        mockHistory
      );
    });

    expect(mockSetInputValue).toHaveBeenCalledWith(
      "Prompt ottimizzato per la ricerca legale."
    );
  });

  test("completa il ciclo di miglioramento mostrando il tasto Undo ed eseguendo il ripristino dell'input originale", async () => {
    const originalText = "Testo originale che richiede ottimizzazione semantica";
    const enhancedText = "Versione ottimizzata dal modello IA per massimizzare il recupero";

    mockEnhancePrompt.mockResolvedValueOnce(enhancedText);

    const { rerender } = render(
      <PromptEnhancer
        inputValue={originalText}
        setInputValue={mockSetInputValue}
        type="chat"
      />
    );

    // 1. Clicca su Migliora
    const enhanceBtn = screen.getByRole("button", { name: /Migliora il prompt con l'IA/i });
    fireEvent.click(enhanceBtn);

    await waitFor(() => {
      expect(mockSetInputValue).toHaveBeenCalledWith(enhancedText);
    });

    // 2. Simula il componente padre che aggiorna inputValue con il risultato
    rerender(
      <PromptEnhancer
        inputValue={enhancedText}
        setInputValue={mockSetInputValue}
        type="chat"
      />
    );

    // 3. Verifica la comparsa del tasto Undo (RotateCcw)
    const undoBtn = screen.getByRole("button", { name: /Annulla miglioramento/i });
    expect(undoBtn).toBeInTheDocument();
    expect(screen.getByTestId("icon-rotate-ccw")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-sparkles")).not.toBeInTheDocument();

    // 4. Clicca su Undo per ripristinare il valore originario
    fireEvent.click(undoBtn);
    expect(mockSetInputValue).toHaveBeenCalledWith(originalText);

    // 5. Simula il componente padre che ripristina inputValue al valore originale
    rerender(
      <PromptEnhancer
        inputValue={originalText}
        setInputValue={mockSetInputValue}
        type="chat"
      />
    );

    // 6. canUndo diventa falso e ritorna la bacchetta magica
    expect(screen.queryByRole("button", { name: /Annulla miglioramento/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Migliora il prompt con l'IA/i })).toBeInTheDocument();
  });

  test("nasconde il tasto Undo se l'utente modifica anche solo un carattere dopo il miglioramento", async () => {
    const originalText = "Testo iniziale lungo oltre la soglia minima";
    const enhancedText = "Testo migliorato dall'intelligenza artificiale";

    mockEnhancePrompt.mockResolvedValueOnce(enhancedText);

    const { rerender } = render(
      <PromptEnhancer
        inputValue={originalText}
        setInputValue={mockSetInputValue}
        type="chat"
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Migliora il prompt con l'IA/i }));

    await waitFor(() => {
      expect(mockSetInputValue).toHaveBeenCalledWith(enhancedText);
    });

    // Simula aggiornamento con testo migliorato
    rerender(
      <PromptEnhancer
        inputValue={enhancedText}
        setInputValue={mockSetInputValue}
        type="chat"
      />
    );
    expect(screen.getByRole("button", { name: /Annulla miglioramento/i })).toBeInTheDocument();

    // L'utente modifica l'input (ad es. aggiunge uno spazio o una parola)
    rerender(
      <PromptEnhancer
        inputValue={`${enhancedText} modificato`}
        setInputValue={mockSetInputValue}
        type="chat"
      />
    );

    // canUndo diventa false perché inputValue !== enhancedPrompt
    expect(screen.queryByRole("button", { name: /Annulla miglioramento/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Migliora il prompt con l'IA/i })).toBeInTheDocument();
  });

  test("non imposta il tasto Undo né altera l'input se enhancePrompt restituisce null (errore API)", async () => {
    mockEnhancePrompt.mockResolvedValueOnce(null);

    render(
      <PromptEnhancer
        inputValue="Testo sufficientemente lungo per consentire la richiesta"
        setInputValue={mockSetInputValue}
        type="chat"
      />
    );

    const button = screen.getByRole("button", { name: /Migliora il prompt con l'IA/i });
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockEnhancePrompt).toHaveBeenCalledTimes(1);
    });

    expect(mockSetInputValue).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Annulla miglioramento/i })).not.toBeInTheDocument();
  });
});