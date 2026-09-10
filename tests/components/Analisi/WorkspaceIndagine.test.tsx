import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WorkspaceIndagine } from "@/features/analisi/components/WorkspaceIndagine";
import { useDeepAnalysisSession } from "@/features/analisi/hooks/useDeepAnalysis";
import type { DeepAnalysisConfig } from "@/features/analisi/hooks/types";
import type { AttachedDocument } from "@/interfaces/interfaces";

/* ---------- mock dell'hook useDeepAnalysis ---------- */
vi.mock("@/features/analisi/hooks/useDeepAnalysis", () => ({
  useDeepAnalysisSession: vi.fn(),
}));

/* ---------- mock dei sotto-componenti ---------- */
vi.mock("@/features/analisi/components/ReportSintesi", () => ({
  ReportSintesi: () => <div data-testid="report-sintesi">ReportSintesi Mock</div>,
}));

vi.mock("@/features/analisi/components/ExecutionLogModal", () => ({
  ExecutionLogModal: ({ isOpen, title }: { isOpen: boolean; title: string }) =>
    isOpen ? <div data-testid="execution-log-modal">Log Modal: {title}</div> : null,
}));

vi.mock("@/features/analisi/components/WorkspaceHeader", () => ({
  WorkspaceHeader: () => <div data-testid="workspace-header">WorkspaceHeader Mock</div>,
}));

vi.mock("@/features/analisi/components/DraftPhase", () => ({
  DraftPhase: ({ onEseguiRicerca }: { onEseguiRicerca: () => void }) => (
    <div data-testid="draft-phase">
      <button type="button" onClick={onEseguiRicerca}>Esegui Ricerca Draft</button>
    </div>
  ),
}));

vi.mock("@/features/analisi/components/ReviewPhase", () => ({
  ReviewPhase: ({ avviaGenerazioneSintesi }: { avviaGenerazioneSintesi: () => void }) => (
    <div data-testid="review-phase">
      <button type="button" onClick={avviaGenerazioneSintesi}>Avvia Sintesi Review</button>
    </div>
  ),
}));

const mockedUseDeepAnalysisSession = vi.mocked(useDeepAnalysisSession);

describe("WorkspaceIndagine Component Suite", () => {
  const defaultHookReturn = {
    activeSession: null,
    isProcessing: false,
    updateTitle: vi.fn(),
    toggleEsclusionePrecedente: vi.fn(),
    avviaRicercaPrecedenti: vi.fn().mockResolvedValue(undefined),
    avviaIntegrazioneRicerca: vi.fn().mockResolvedValue({}),
    avviaGenerazioneSintesi: vi.fn().mockResolvedValue(undefined),
    isLogModalOpen: false,
    setIsLogModalOpen: vi.fn(),
    isCompleted: false,
  };

  const defaultProps = {
    sessioneId: null,
    onSessionCreated: vi.fn(),
    configurazione: { model: "gemini-2.5" } as unknown as DeepAnalysisConfig,
    attachedDocs: [] as AttachedDocument[],
    onOpenDocsModal: vi.fn(),
    onRemoveAttachment: vi.fn(),
    onSyncDocs: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza DraftPhase quando non c'è sessione attiva o lo stato è draft", () => {
    mockedUseDeepAnalysisSession.mockReturnValue({
      ...defaultHookReturn,
      activeSession: { id: "s-1", status: "draft", promptOriginale: "Quesito bozza" },
    } as unknown as ReturnType<typeof useDeepAnalysisSession>);

    render(<WorkspaceIndagine {...defaultProps} />);

    expect(screen.getByTestId("workspace-header")).toBeInTheDocument();
    expect(screen.getByTestId("draft-phase")).toBeInTheDocument();
  });

  test("renderizza ReviewPhase quando lo stato della sessione è review", () => {
    mockedUseDeepAnalysisSession.mockReturnValue({
      ...defaultHookReturn,
      activeSession: {
        id: "s-1",
        status: "review",
        promptOriginale: "Quesito review",
        mappaDialettica: { orientamentoFavorevole: { fonti: [] } },
      },
    } as unknown as ReturnType<typeof useDeepAnalysisSession>);

    render(<WorkspaceIndagine {...defaultProps} />);

    expect(screen.getByTestId("review-phase")).toBeInTheDocument();
  });

  test("renderizza ReportSintesi quando lo stato è completed o isCompleted è true", () => {
    mockedUseDeepAnalysisSession.mockReturnValue({
      ...defaultHookReturn,
      activeSession: {
        id: "s-1",
        status: "completed",
        sintesiStrategica: { executiveSummary: "Sommario" },
      },
      isCompleted: true,
    } as unknown as ReturnType<typeof useDeepAnalysisSession>);

    render(<WorkspaceIndagine {...defaultProps} />);

    expect(screen.getByTestId("report-sintesi")).toBeInTheDocument();
  });

  test("gestisce correttamente l'esecuzione della ricerca da DraftPhase con apertura log", async () => {
    const avviaRicercaMock = vi.fn().mockResolvedValue(undefined);
    mockedUseDeepAnalysisSession.mockReturnValue({
      ...defaultHookReturn,
      activeSession: { id: "s-1", status: "draft", promptOriginale: "Quesito di prova" },
      avviaRicercaPrecedenti: avviaRicercaMock,
      isLogModalOpen: true,
    } as unknown as ReturnType<typeof useDeepAnalysisSession>);

    render(<WorkspaceIndagine {...defaultProps} />);

    const button = screen.getByRole("button", { name: /esegui ricerca draft/i });
    fireEvent.click(button);

    expect(avviaRicercaMock).toHaveBeenCalled();
  });

  test("sincronizza i documenti allegati al cambio di activeSession.id", () => {
    const onSyncDocsMock = vi.fn();
    mockedUseDeepAnalysisSession.mockReturnValue({
      ...defaultHookReturn,
      activeSession: {
        id: "s-1",
        status: "draft",
        documentiAllegati: [{ id: "doc-1", name: "Atto.pdf" }],
      },
    } as unknown as ReturnType<typeof useDeepAnalysisSession>);

    render(<WorkspaceIndagine {...defaultProps} onSyncDocs={onSyncDocsMock} />);

    expect(onSyncDocsMock).toHaveBeenCalledWith([{ id: "doc-1", name: "Atto.pdf" }]);
  });
});