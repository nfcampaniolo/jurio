import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ComparisonGrid } from "@/features/analisi/components/ComparisonGrid";
import type { OrientamentoDialettico } from "@/features/analisi/hooks/types";

describe("ComparisonGrid Component Suite", () => {
  const mockFavorevole: OrientamentoDialettico = {
    titoloTesi: "Tesi di legittimità consolidata",
    argomentazioneLogica: "La giurisprudenza di cassazione riconosce la fondatezza dell'eccezione.",
  } as unknown as OrientamentoDialettico;

  const mockContrario: OrientamentoDialettico = {
    titoloTesi: "Orientamento restrittivo di merito",
    argomentazioneLogica: "Alcuni giudici di seconde cure applicano un criterio difforme.",
  } as unknown as OrientamentoDialettico;

  const defaultProps = {
    orientamentoFavorevole: null,
    orientamentoContrario: null,
    onApriHitlPreset: vi.fn(),
    isProcessing: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza i messaggi di fallback quando gli orientamenti sono assenti", () => {
    render(<ComparisonGrid {...defaultProps} />);

    expect(screen.getByText("Orientamento Favorevole")).toBeInTheDocument();
    expect(screen.getByText("Nessun orientamento favorevole rilevato.")).toBeInTheDocument();

    expect(screen.getByText("Orientamento Contrario / Rischio")).toBeInTheDocument();
    expect(screen.getByText("Nessun orientamento contrario rilevato.")).toBeInTheDocument();
  });

  test("renderizza correttamente i dati quando gli orientamenti favorevole e contrario sono forniti", () => {
    render(
      <ComparisonGrid
        {...defaultProps}
        orientamentoFavorevole={mockFavorevole}
        orientamentoContrario={mockContrario}
      />
    );

    expect(screen.getByText("Tesi di legittimità consolidata")).toBeInTheDocument();
    expect(
      screen.getByText("La giurisprudenza di cassazione riconosce la fondatezza dell'eccezione.")
    ).toBeInTheDocument();

    expect(screen.getByText("Orientamento restrittivo di merito")).toBeInTheDocument();
    expect(
      screen.getByText("Alcuni giudici di seconde cure applicano un criterio difforme.")
    ).toBeInTheDocument();
  });

  test("invoca onApriHitlPreset con stringa vuota al click su 'Rafforza Tesi Favorevole'", () => {
    const onApriHitlPresetMock = vi.fn().mockResolvedValue(undefined);
    render(
      <ComparisonGrid
        {...defaultProps}
        orientamentoFavorevole={mockFavorevole}
        onApriHitlPreset={onApriHitlPresetMock}
      />
    );

    const button = screen.getByRole("button", { name: /rafforza tesi favorevole/i });
    fireEvent.click(button);

    expect(onApriHitlPresetMock).toHaveBeenCalledWith("");
  });

  test("invoca onApriHitlPreset con il preset di confutazione al click su 'Confuta Tesi Avversa'", () => {
    const onApriHitlPresetMock = vi.fn().mockResolvedValue(undefined);
    render(
      <ComparisonGrid
        {...defaultProps}
        orientamentoContrario={mockContrario}
        onApriHitlPreset={onApriHitlPresetMock}
      />
    );

    const button = screen.getByRole("button", { name: /confuta tesi avversa/i });
    fireEvent.click(button);

    expect(onApriHitlPresetMock).toHaveBeenCalledWith(
      "Cerca precedenti o argomentazioni di distinguish per confutare e smontare la tesi contraria."
    );
  });

  test("disabilita i pulsanti e mostra lo stato di elaborazione durante l'azione asincrona", async () => {
    let resolvePromise: (value?: unknown) => void = () => {};
    const asyncPromise = new Promise((resolve) => {
      resolvePromise = resolve;
    });
    const onApriHitlPresetMock = vi.fn().mockReturnValue(asyncPromise);

    render(
      <ComparisonGrid
        {...defaultProps}
        orientamentoFavorevole={mockFavorevole}
        onApriHitlPreset={onApriHitlPresetMock}
      />
    );

    const button = screen.getByRole("button", { name: /rafforza tesi favorevole/i });
    fireEvent.click(button);

    // Verifica stato di caricamento
    expect(screen.getByRole("button", { name: /elaborazione.../i })).toBeInTheDocument();
    expect(button).toBeDisabled();

    // Risolvi la promise
    await waitFor(async () => {
      resolvePromise();
      await asyncPromise;
    });

    expect(screen.getByRole("button", { name: /rafforza tesi favorevole/i })).toBeInTheDocument();
  });

  test("disabilita i pulsanti quando isProcessing è true", () => {
    render(
      <ComparisonGrid
        {...defaultProps}
        orientamentoFavorevole={mockFavorevole}
        orientamentoContrario={mockContrario}
        isProcessing={true}
      />
    );

    const buttons = screen.getAllByRole("button");
    buttons.forEach((btn) => {
      expect(btn).toBeDisabled();
    });
  });
});