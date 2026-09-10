import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FontiOrientamentoSwitch } from "@/features/analisi/components/FontiOrientamentoSwitch";
import type { OrientamentoDialettico, PrecedenteReperito } from "@/features/analisi/hooks/types";

/* ---------- mock PrecedenteCard ---------- */
vi.mock("@/features/analisi/components/PrecedenteCard", () => ({
  PrecedenteCard: ({ precedente, onToggleEsclusione }: { precedente: PrecedenteReperito; onToggleEsclusione: (id: string, escluso: boolean) => void }) => (
    <div data-testid={`precedente-card-${precedente.id}`}>
      <span>{precedente.id}</span>
      <button 
        type="button" 
        onClick={() => onToggleEsclusione(precedente.id, !precedente.escluso)}
      >
        Toggle {precedente.id}
      </button>
    </div>
  ),
}));

describe("FontiOrientamentoSwitch Component Suite", () => {
  const mockFavorevoliValide: PrecedenteReperito[] = [
    { id: "cass-1111", fonte: "interna", escluso: false },
    { id: "cass-2222", fonte: "interna", escluso: true },
  ] as unknown as PrecedenteReperito[];

  const mockContrarieValide: PrecedenteReperito[] = [
    { id: "https://www.normattiva.it/doc", fonte: "web", escluso: false },
  ] as unknown as PrecedenteReperito[];

  const mockFontiCorrotte: PrecedenteReperito[] = [
    { id: "err/id", fonte: "interna" },
    { id: "not-found-id", fonte: "interna", descrizione: "not found" },
  ] as unknown as PrecedenteReperito[];

  const defaultProps = {
    orientamentoFavorevole: null,
    orientamentoContrario: null,
    onToggleEsclusione: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  test("renderizza i messaggi di vuoto quando non ci sono orientamenti o fonti valide", () => {
    render(<FontiOrientamentoSwitch {...defaultProps} />);

    expect(screen.getByText("Esplora Fonti e Precedenti")).toBeInTheDocument();
    expect(screen.getByText("Favorevoli (0/0)")).toBeInTheDocument();
    expect(screen.getByText("Contrarie (0/0)")).toBeInTheDocument();
    expect(screen.getByText("Nessuna fonte favorevole disponibile o valida.")).toBeInTheDocument();
  });

  test("filtra correttamente le fonti non valide e mostra i contatori delle fonti attive", () => {
    const orientamentoFav: OrientamentoDialettico = {
      fonti: [...mockFavorevoliValide, ...mockFontiCorrotte],
    } as unknown as OrientamentoDialettico;

    const orientamentoCont: OrientamentoDialettico = {
      fonti: mockContrarieValide,
    } as unknown as OrientamentoDialettico;

    render(
      <FontiOrientamentoSwitch
        {...defaultProps}
        orientamentoFavorevole={orientamentoFav}
        orientamentoContrario={orientamentoCont}
      />
    );

    expect(screen.getByText("Favorevoli (1/2)")).toBeInTheDocument();
    expect(screen.getByText("Contrarie (1/1)")).toBeInTheDocument();

    expect(screen.getByTestId("precedente-card-cass-1111")).toBeInTheDocument();
    expect(screen.getByTestId("precedente-card-cass-2222")).toBeInTheDocument();
    expect(screen.queryByTestId("precedente-card-err/id")).not.toBeInTheDocument();
  });

  test("commuta correttamente tra i tab 'Favorevoli' e 'Contrarie'", () => {
    const orientamentoFav: OrientamentoDialettico = {
      fonti: mockFavorevoliValide,
    } as unknown as OrientamentoDialettico;

    const orientamentoCont: OrientamentoDialettico = {
      fonti: mockContrarieValide,
    } as unknown as OrientamentoDialettico;

    render(
      <FontiOrientamentoSwitch
        {...defaultProps}
        orientamentoFavorevole={orientamentoFav}
        orientamentoContrario={orientamentoCont}
      />
    );

    expect(screen.getByTestId("precedente-card-cass-1111")).toBeVisible();
    
    const contrarioCard = screen.getByTestId("precedente-card-https://www.normattiva.it/doc");
    expect(contrarioCard.closest(".hidden")).toBeInTheDocument();

    const contrarieTabButton = screen.getByRole("button", { name: /contrarie/i });
    fireEvent.click(contrarieTabButton);

    expect(contrarioCard.closest(".hidden")).not.toBeInTheDocument();
    expect(contrarioCard).toBeVisible();
  });

  test("propaga correttamente la chiamata di toggle esclusione al click sulla card", () => {
    const onToggleEsclusioneMock = vi.fn();
    const orientamentoFav: OrientamentoDialettico = {
      fonti: [mockFavorevoliValide[0]],
    } as unknown as OrientamentoDialettico;

    render(
      <FontiOrientamentoSwitch
        {...defaultProps}
        orientamentoFavorevole={orientamentoFav}
        onToggleEsclusione={onToggleEsclusioneMock}
      />
    );

    const toggleButton = screen.getByRole("button", { name: /toggle cass-1111/i });
    fireEvent.click(toggleButton);

    expect(onToggleEsclusioneMock).toHaveBeenCalledWith("cass-1111", true);
  });
});