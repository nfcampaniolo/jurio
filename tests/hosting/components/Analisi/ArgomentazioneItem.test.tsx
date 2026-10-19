import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ArgomentazioneItem } from "@/features/analisi/components/ArgomentazioneItem";
import type { PrecedenteReperito } from "@/features/analisi/hooks/types";

/* ---------- mock PrecedenteChip ---------- */
vi.mock("@/features/analisi/components/PrecedenteChip", () => ({
  PrecedenteChip: ({ id }: { id: string }) => (
    <div data-testid={`precedente-chip-${id}`}>Chip {id}</div>
  ),
}));

describe("ArgomentazioneItem Component Suite", () => {
  const mockFonti: PrecedenteReperito[] = [
    { id: "cass-1234", fonte: "interna" },
    { id: "web-source-id", fonte: "web" },
  ] as unknown as PrecedenteReperito[];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza correttamente il testo pulito senza riferimenti", () => {
    render(
      <ArgomentazioneItem
        rawText="Questa è un'analisi giuridica di prova."
        fontiValide={[]}
        colorClass="bg-blue-500"
      />
    );

    expect(screen.getByText("Questa è un'analisi giuridica di prova.")).toBeInTheDocument();
    expect(screen.queryByText("Fonti correlate")).not.toBeInTheDocument();
  });

  test("rimuove i titoli e le intestazioni standard dal testo grezzo", () => {
    render(
      <ArgomentazioneItem
        rawText="Punti di Forza dell'Azione: L'atto presenta ottimi profili di fondatezza."
        fontiValide={[]}
        colorClass="bg-green-500"
      />
    );

    expect(screen.getByText("L'atto presenta ottimi profili di fondatezza.")).toBeInTheDocument();
    expect(screen.queryByText(/Punti di Forza dell'Azione/i)).not.toBeInTheDocument();
  });

  test("analizza e renderizza i PrecedenteChip per le fonti interne valide", () => {
    render(
      <ArgomentazioneItem
        rawText="Orientamento consolidato della Corte (cass-1234)."
        fontiValide={mockFonti}
        colorClass="bg-amber-500"
      />
    );

    expect(screen.getByText("Orientamento consolidato della Corte.")).toBeInTheDocument();
    expect(screen.getByTestId("precedente-chip-cass-1234")).toBeInTheDocument();
    expect(screen.getByText("Fonti correlate")).toBeInTheDocument();
  });

  test("analizza e renderizza i collegamenti esterni web per gli URL http", () => {
    render(
      <ArgomentazioneItem
        rawText="Approfondimento normativo [https://www.normattiva.it/articolo]."
        fontiValide={[]}
        colorClass="bg-purple-500"
      />
    );

    expect(screen.getByText("Approfondimento normativo")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /normattiva\.it/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "https://www.normattiva.it/articolo");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  test("gestisce i riferimenti finali con parentesi quadre e punto", () => {
    render(
      <ArgomentazioneItem
        rawText="Principio di diritto applicabile [cass-1234]."
        fontiValide={mockFonti}
        colorClass="bg-red-500"
      />
    );

    expect(screen.getByText("Principio di diritto applicabile")).toBeInTheDocument();
    expect(screen.getByTestId("precedente-chip-cass-1234")).toBeInTheDocument();
  });
});