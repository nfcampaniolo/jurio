import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

import { ReportSintesi } from "@/features/analisi/components/ReportSintesi";
import type { DeepAnalysisSession } from "@/features/analisi/hooks/types";

/* ---------- mock dei sotto-componenti ---------- */
vi.mock("@/features/analisi/components/ArgomentazioneItem", () => ({
  ArgomentazioneItem: ({ rawText }: { rawText: string }) => (
    <li data-testid="argomentazione-item">{rawText}</li>
  ),
}));

vi.mock("@/features/analisi/components/OrientamentoItem", () => ({
  OrientamentoItem: ({ orientamento }: { orientamento: { tipo: string; titoloTesi: string } }) => (
    <div data-testid={`orientamento-item-${orientamento.tipo.toLowerCase()}`}>
      {orientamento.tipo}: {orientamento.titoloTesi}
    </div>
  ),
}));

vi.mock("@/features/analisi/components/PrecedenteChip", () => ({
  PrecedenteChip: ({ id }: { id: string }) => (
    <div data-testid={`precedente-chip-${id}`}>Chip {id}</div>
  ),
}));

describe("ReportSintesi Component Suite", () => {
  const mockSession: DeepAnalysisSession = {
    title: "Caso di Responsabilità Civile",
    inquadramento: {
      qualificazioneGiuridica: "Responsabilità contrattuale ed extracontrattuale",
      fattispecieEstratta: "Inadempimento di obblighi contrattuali complessi",
      normeRiferimento: ["Art. 1218 c.c.", "Art. 2043 c.c."],
    },
    mappaDialettica: {
      orientamentoFavorevole: {
        titoloTesi: "Tesi della responsabilità oggettiva attenuata",
        argomentazioneLogica: "La giurisprudenza prevalente esclude la colpa grave.",
        fonti: [{ id: "cass-1234", fonte: "interna", escluso: false }],
      },
      orientamentoContrario: {
        titoloTesi: "Tesi rigorista di legittimità",
        argomentazioneLogica: "Gli orientamenti minoritari impongono oneri probatori stringenti.",
        fonti: [{ id: "https://www.normattiva.it/test", fonte: "web", escluso: false }],
      },
    },
    sintesiStrategica: {
      executiveSummary: "Analisi approfondita dei presupposti di accoglimento della domanda.",
      argomentazioniAzione: ["Punto di forza principale (cass-1234)."],
      rischiEEccezioni: ["Rischio di prescrizione eccepito dalla controparte."],
      conclusioniStrategiche: "Si consiglia l'introduzione del ricorso principale [cass-1234].",
    },
  } as unknown as DeepAnalysisSession;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock di clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });

    // Mock di window.print
    vi.spyOn(window, "print").mockImplementation(() => {});
  });

  test("non renderizza nulla se sintesiStrategica è assente", () => {
    const invalidSession = { ...mockSession, sintesiStrategica: null } as unknown as DeepAnalysisSession;
    const { container } = render(<ReportSintesi session={invalidSession} />);

    expect(container).toBeEmptyDOMElement();
  });

  test("renderizza correttamente tutte le sezioni della nota strategica", () => {
    render(<ReportSintesi session={mockSession} />);

    expect(screen.getByText("Nota Strategica Conclusiva")).toBeInTheDocument();
    expect(screen.getByText("Sintesi Strategica")).toBeInTheDocument();
    expect(screen.getByText(/Pratica: Caso di Responsabilità Civile/i)).toBeInTheDocument();
    
    // Executive Summary
    expect(screen.getByText("Analisi approfondita dei presupposti di accoglimento della domanda.")).toBeInTheDocument();

    // Inquadramento Normativo
    expect(screen.getByText("Responsabilità contrattuale ed extracontrattuale")).toBeInTheDocument();
    expect(screen.getByText("Art. 1218 c.c.")).toBeInTheDocument();
    expect(screen.getByText("Art. 2043 c.c.")).toBeInTheDocument();

    // Mappa Dialettica
    expect(screen.getByTestId("orientamento-item-favorevole")).toBeInTheDocument();
    expect(screen.getByTestId("orientamento-item-contrario")).toBeInTheDocument();

    // Argomentazioni e Rischi
    expect(screen.getAllByTestId("argomentazione-item")).toHaveLength(2);

    // Conclusioni Operative
    expect(screen.getByText(/Si consiglia l'introduzione del ricorso principale/i)).toBeInTheDocument();
    expect(screen.getByTestId("precedente-chip-cass-1234")).toBeInTheDocument();
  });

  test("copia il testo formattato negli appunti al click su 'Copia Testo'", async () => {
    render(<ReportSintesi session={mockSession} />);

    const copyButton = screen.getByRole("button", { name: /copia testo/i });
    fireEvent.click(copyButton);

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Copiato")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Copia Testo")).toBeInTheDocument();
    }, { timeout: 3000 });
  });

  test("chiama window.print() al click su 'Esporta PDF'", () => {
    render(<ReportSintesi session={mockSession} />);

    const exportButton = screen.getByRole("button", { name: /esporta pdf/i });
    fireEvent.click(exportButton);

    expect(window.print).toHaveBeenCalledTimes(1);
  });
});