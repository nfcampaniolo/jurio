import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { OrientamentoItem, type MappedOrientamento } from "@/features/analisi/components/OrientamentoItem";
import type { PrecedenteReperito } from "@/features/analisi/hooks/types";

/* ---------- mock PrecedenteChip ---------- */
vi.mock("@/features/analisi/components/PrecedenteChip", () => ({
  PrecedenteChip: ({ id }: { id: string }) => (
    <div data-testid={`precedente-chip-${id}`}>Chip {id}</div>
  ),
}));

describe("OrientamentoItem Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza correttamente un orientamento favorevole con tesi, logica e fonti miste", () => {
    const orientamentoFav: MappedOrientamento = {
      tipo: "Favorevole",
      titoloTesi: "Tesi a favore della legittimità dell'atto",
      argomentazioneLogica: "La normativa di riferimento supporta pienamente l'interpretazione estensiva.",
      fonti: [
        { id: "cass-5555", fonte: "interna" },
        { id: "https://www.normattiva.it/legge", fonte: "web" },
      ] as unknown as PrecedenteReperito[],
    };

    render(<OrientamentoItem orientamento={orientamentoFav} />);

    expect(screen.getByText("Orientamento Favorevole")).toBeInTheDocument();
    expect(screen.getByText("Tesi a favore della legittimità dell'atto")).toBeInTheDocument();
    expect(screen.getByText("La normativa di riferimento supporta pienamente l'interpretazione estensiva.")).toBeInTheDocument();
    expect(screen.getByText("Fonti giurisprudenziali correlate (2)")).toBeInTheDocument();

    expect(screen.getByTestId("precedente-chip-cass-5555")).toBeInTheDocument();

    const link = screen.getByRole("link", { name: /normattiva\.it/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://www.normattiva.it/legge");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("renderizza correttamente un orientamento contrario senza fonti", () => {
    const orientamentoCont: MappedOrientamento = {
      tipo: "Contrario",
      titoloTesi: "Orientamento restrittivo di merito",
      argomentazioneLogica: "Esistono pronunce difformi nei tribunali di primo grado.",
      fonti: [],
    };

    render(<OrientamentoItem orientamento={orientamentoCont} />);

    expect(screen.getByText("Orientamento Contrario")).toBeInTheDocument();
    expect(screen.getByText("Orientamento restrittivo di merito")).toBeInTheDocument();
    expect(screen.getByText("Esistono pronunce difformi nei tribunali di primo grado.")).toBeInTheDocument();
    expect(screen.queryByText(/Fonti giurisprudenziali correlate/i)).not.toBeInTheDocument();
  });
});