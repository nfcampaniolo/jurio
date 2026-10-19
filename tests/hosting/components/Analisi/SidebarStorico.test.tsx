import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { SidebarStorico } from "@/features/analisi/components/SidebarStorico";
import { useDeepAnalysisSession } from "@/features/analisi/hooks/useDeepAnalysis";

/* ---------- mock dell'hook useDeepAnalysis ---------- */
vi.mock("@/features/analisi/hooks/useDeepAnalysis", () => ({
  useDeepAnalysisSession: vi.fn(),
}));

const mockedUseDeepAnalysisSession = vi.mocked(useDeepAnalysisSession);

describe("SidebarStorico Component Suite", () => {
  const defaultProps = {
    sessioneAttivaId: "session-1",
    onSelectSession: vi.fn(),
    onOpenDeleteConfirm: vi.fn(),
    eliminandoId: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("mostra lo stato di caricamento quando loading è true", () => {
    mockedUseDeepAnalysisSession.mockReturnValue({
      sessionsList: [],
      loading: true,
    } as unknown as ReturnType<typeof useDeepAnalysisSession>);

    const { container } = render(<SidebarStorico {...defaultProps} />);

    expect(container.querySelectorAll(".animate-pulse")).toHaveLength(4);
  });

  test("mostra il messaggio di archivio vuoto quando sessionsList è vuota", () => {
    mockedUseDeepAnalysisSession.mockReturnValue({
      sessionsList: [],
      loading: false,
    } as unknown as ReturnType<typeof useDeepAnalysisSession>);

    render(<SidebarStorico {...defaultProps} />);

    expect(screen.getByText(/Nessuna indagine in archivio/i)).toBeInTheDocument();
  });

  test("renderizza correttamente la lista delle indagini con vari stati e date (incluso timestamp toDate)", () => {
    const mockSessions = [
      {
        id: "session-1",
        title: "Ricorso in materia bancaria",
        status: "completed",
        updatedAt: { toDate: () => new Date("2026-06-15T10:30:00Z") },
      },
      {
        id: "session-2",
        title: "",
        status: "review",
        updatedAt: "2026-06-14T14:20:00Z",
      },
      {
        id: "session-3",
        title: "Bozza preliminare",
        status: "draft",
        updatedAt: null,
      },
    ];

    mockedUseDeepAnalysisSession.mockReturnValue({
      sessionsList: mockSessions,
      loading: false,
    } as unknown as ReturnType<typeof useDeepAnalysisSession>);

    render(<SidebarStorico {...defaultProps} />);

    expect(screen.getByText("Ricorso in materia bancaria")).toBeInTheDocument();
    expect(screen.getByText("Indagine Senza Titolo")).toBeInTheDocument();
    expect(screen.getByText("Bozza preliminare")).toBeInTheDocument();

    expect(screen.getByText("Completata")).toBeInTheDocument();
    expect(screen.getByText("In Revisione")).toBeInTheDocument();
    expect(screen.getByText("Bozza")).toBeInTheDocument();
  });

  test("invoca onSelectSession al click su un elemento della lista", () => {
    const mockSessions = [
      {
        id: "session-2",
        title: "Altra indagine",
        status: "review",
        updatedAt: new Date(),
      },
    ];

    mockedUseDeepAnalysisSession.mockReturnValue({
      sessionsList: mockSessions,
      loading: false,
    } as unknown as ReturnType<typeof useDeepAnalysisSession>);

    const onSelectMock = vi.fn();
    render(<SidebarStorico {...defaultProps} onSelectSession={onSelectMock} />);

    const item = screen.getByText("Altra indagine");
    fireEvent.click(item);

    expect(onSelectMock).toHaveBeenCalledWith("session-2");
  });

  test("invoca onOpenDeleteConfirm al click sul pulsante di eliminazione", () => {
    const mockSessions = [
      {
        id: "session-1",
        title: "Indagine da eliminare",
        status: "completed",
        updatedAt: new Date(),
      },
    ];

    mockedUseDeepAnalysisSession.mockReturnValue({
      sessionsList: mockSessions,
      loading: false,
    } as unknown as ReturnType<typeof useDeepAnalysisSession>);

    const onDeleteMock = vi.fn();
    render(<SidebarStorico {...defaultProps} onOpenDeleteConfirm={onDeleteMock} />);

    const deleteButton = screen.getByTitle("Elimina indagine");
    fireEvent.click(deleteButton);

    expect(onDeleteMock).toHaveBeenCalledWith("session-1", "Indagine da eliminare");
  });
});