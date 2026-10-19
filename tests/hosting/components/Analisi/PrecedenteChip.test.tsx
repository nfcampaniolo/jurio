import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

import { PrecedenteChip } from "@/features/analisi/components/PrecedenteChip";
import { usePrecedente } from "@/features/analisi/hooks/usePrecedente";

/* ---------- mock dell'hook usePrecedente ---------- */
vi.mock("@/features/analisi/hooks/usePrecedente", () => ({
  usePrecedente: vi.fn(),
}));

const mockedUsePrecedente = vi.mocked(usePrecedente);

describe("PrecedenteChip Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("mostra lo stato di caricamento quando loading è true", () => {
    mockedUsePrecedente.mockReturnValue({
      precedente: null,
      loading: true,
      error: null,
    });

    render(<PrecedenteChip id="cass-1111" />);

    expect(screen.getByText("Caricamento...")).toBeInTheDocument();
  });

  test("non renderizza nulla se il precedente non viene trovato (null)", () => {
    mockedUsePrecedente.mockReturnValue({
      precedente: null,
      loading: false,
      error: null,
    });

    const { container } = render(<PrecedenteChip id="cass-1111" />);

    expect(container).toBeEmptyDOMElement();
  });

  test("renderizza correttamente il link con organo e numero sentenza quando caricato", () => {
    mockedUsePrecedente.mockReturnValue({
      precedente: {
        id: "cass-1111",
        organo_giudicante: "Cassazione Civile",
        numero_sentenza: "1234/2026",
      },
      loading: false,
      error: null,
    } as unknown as ReturnType<typeof usePrecedente>);

    render(<PrecedenteChip id="cass-1111" />);

    const link = screen.getByRole("link", { name: /cassazione civile · n\. 1234\/2026/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://jurio.it/giurisprudenza/cass-1111");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("usa la label di fallback 'Sentenza Jurio' se mancano organo e numero", () => {
    mockedUsePrecedente.mockReturnValue({
      precedente: {
        id: "cass-1111",
      },
      loading: false,
      error: null,
    } as unknown as ReturnType<typeof usePrecedente>);

    render(<PrecedenteChip id="cass-1111" />);

    const link = screen.getByRole("link", { name: /sentenza jurio/i });
    expect(link).toBeInTheDocument();
  });
});