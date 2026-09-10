import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PrecedenteCard } from "@/features/analisi/components/PrecedenteCard";
import type { PrecedenteReperito } from "@/features/analisi/hooks/types";
import { usePrecedente } from "@/features/analisi/hooks/usePrecedente";

/* ---------- mock dei hook e componenti esterni ---------- */
vi.mock("@/features/analisi/hooks/usePrecedente", () => ({
  usePrecedente: vi.fn(),
}));

vi.mock("@/features/document/components/CitationGraph", () => ({
  default: ({ precedenti }: { precedenti: string[] }) => (
    <div data-testid="citation-tree">Citazioni: {precedenti.length}</div>
  ),
}));

const mockedUsePrecedente = vi.mocked(usePrecedente);

describe("PrecedenteCard Component Suite", () => {
  const defaultPrecedente: PrecedenteReperito = {
    id: "cass-1234",
    fonte: "interna",
    gradoPertinenza: 95,
    escluso: false,
    nuova: true,
  } as unknown as PrecedenteReperito;

  const mockDocumentoInterno = {
    id: "cass-1234",
    organo_giudicante: "Corte di Cassazione, Sezione Civile",
    numero_sentenza: "2026/456",
    data_sentenza: "2026-06-15",
    grado_giudizio: "Legittimità",
    massima: "Il principio di diritto in materia di contratti bancari.",
    ratio_decidendi: "La tutela della buona fede contrattuale.",
    riferimenti_normativi: ["Art. 1375 c.c.", "Art. 1460 c.c."],
    precedenti_richiamati: ["Cass. 111/2025", "Cass. 222/2024"],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza correttamente una fonte di tipo web", () => {
    const webPrecedente: PrecedenteReperito = {
      id: "https://www.normattiva.it/articolo",
      fonte: "web",
      gradoPertinenza: 88,
      escluso: false,
    } as unknown as PrecedenteReperito;

    mockedUsePrecedente.mockReturnValue({
      precedente: null,
      loading: false,
      error: null,
    });

    render(<PrecedenteCard precedente={webPrecedente} onToggleEsclusione={vi.fn()} />);

    expect(screen.getByText("Fonte web")).toBeInTheDocument();
    
    const link = screen.getByRole("link", { name: /https:\/\/www\.normattiva\.it\/articolo/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://www.normattiva.it/articolo");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");

    expect(screen.getByText("88/100")).toBeInTheDocument();
  });

  test("non renderizza nulla se la fonte interna non è reperita (documento nullo o errore)", () => {
    mockedUsePrecedente.mockReturnValue({
      precedente: null,
      loading: false,
      error: "Not found",
    });

    const { container } = render(
      <PrecedenteCard precedente={defaultPrecedente} onToggleEsclusione={vi.fn()} />
    );

    expect(container).toBeEmptyDOMElement();
  });

  test("mostra lo stato di caricamento durante il recupero del documento interno", () => {
    mockedUsePrecedente.mockReturnValue({
      precedente: null,
      loading: true,
      error: null,
    });

    render(<PrecedenteCard precedente={defaultPrecedente} onToggleEsclusione={vi.fn()} />);

    expect(screen.getByText("Recupero del provvedimento...")).toBeInTheDocument();
  });

  test("renderizza correttamente tutti i dettagli del documento interno caricato", () => {
    mockedUsePrecedente.mockReturnValue({
      precedente: mockDocumentoInterno,
      loading: false,
      error: null,
    });

    render(<PrecedenteCard precedente={defaultPrecedente} onToggleEsclusione={vi.fn()} />);

    expect(screen.getByText("Corte di Cassazione, Sezione Civile")).toBeInTheDocument();
    expect(screen.getByText("Nuova")).toBeInTheDocument();
    expect(screen.getByText(/N\. 2026\/456/i)).toBeInTheDocument();
    expect(screen.getByText("15/06/2026")).toBeInTheDocument();
    expect(screen.getByText("Legittimità")).toBeInTheDocument();

    expect(screen.getByText("Massima")).toBeInTheDocument();
    expect(screen.getByText("Il principio di diritto in materia di contratti bancari.")).toBeInTheDocument();

    expect(screen.getByText("Ratio decidendi")).toBeInTheDocument();
    expect(screen.getByText("La tutela della buona fede contrattuale.")).toBeInTheDocument();

    expect(screen.getByText("Art. 1375 c.c.")).toBeInTheDocument();
    expect(screen.getByText("Art. 1460 c.c.")).toBeInTheDocument();

    expect(screen.getByTestId("citation-tree")).toBeInTheDocument();
    expect(screen.getByText("Citazioni: 2")).toBeInTheDocument();

    const jurioLink = screen.getByRole("link", { name: /vedi su jurio/i });
    expect(jurioLink).toHaveAttribute("href", "https://jurio.it/giurisprudenza/cass-1234");
    expect(jurioLink).toHaveAttribute("target", "_blank");

    expect(screen.getByText("95/100")).toBeInTheDocument();
  });

  test("gestisce correttamente lo stato escluso applicando la classe e il toggle", () => {
    const excludedPrecedente: PrecedenteReperito = {
      ...defaultPrecedente,
      escluso: true,
    };

    mockedUsePrecedente.mockReturnValue({
      precedente: mockDocumentoInterno,
      loading: false,
      error: null,
    });

    const onToggleMock = vi.fn();
    render(<PrecedenteCard precedente={excludedPrecedente} onToggleEsclusione={onToggleMock} />);

    const toggleButton = screen.getByRole("button", { name: /includi precedente/i });
    expect(toggleButton).toBeInTheDocument();

    fireEvent.click(toggleButton);
    expect(onToggleMock).toHaveBeenCalledWith("cass-1234", false);
  });
});