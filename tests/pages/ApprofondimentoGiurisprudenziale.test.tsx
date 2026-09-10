import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";
import { ApprofondimentoGiurisprudenziale } from "@/features/analisi/DeepAnalysisTool";
import { useAuth } from "@/context/useAuth";
import { useLegalChat } from "@/features/chat/hooks/useLegalChat";
import { eliminaSessione } from "@/features/analisi/hooks/useDeepAnalysis";
import { useParams, useNavigate } from "react-router-dom";

/* ---------- mock router ---------- */
vi.mock("react-router-dom", () => ({
  useParams: vi.fn(),
  useNavigate: vi.fn(),
}));

/* ---------- mock helmet ---------- */
vi.mock("@dr.pogodin/react-helmet", () => ({
  Helmet: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    section: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
      <section {...props}>{children}</section>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

/* ---------- mock moduli di contesto e hook ---------- */
vi.mock("@/context/useAuth", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/features/chat/hooks/useLegalChat", () => ({
  useLegalChat: vi.fn(),
}));

vi.mock("@/features/analisi/hooks/useDeepAnalysis", () => ({
  eliminaSessione: vi.fn(),
}));

/* ---------- mock componenti visuali ---------- */
vi.mock("@/shared/components/Header", () => ({
  Header: () => <header data-testid="header-mock">Header Mock</header>,
}));

vi.mock("@/shared/components/ConfirmModal", () => ({
  ConfirmModal: ({
    isOpen,
    title,
    onConfirm,
    onCancel,
  }: {
    isOpen: boolean;
    title: string;
    onConfirm: () => void;
    onCancel: () => void;
  }) =>
    isOpen ? (
      <div data-testid="confirm-modal">
        <span>{title}</span>
        <button type="button" onClick={onConfirm}>Conferma Eliminazione</button>
        <button type="button" onClick={onCancel}>Annulla Eliminazione</button>
      </div>
    ) : null,
}));

vi.mock("@/features/chat/components/DocumentSelectorPanel", () => ({
  DocumentSelectorPanel: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="doc-selector-panel">
        <button type="button" onClick={onClose}>Chiudi Allegati</button>
      </div>
    ) : null,
}));

vi.mock("@/features/analisi/components/DeepAnalysisLanding", () => ({
  DeepAnalysisLanding: () => <div data-testid="landing-mock">Landing Mock</div>,
}));

vi.mock("@/features/analisi/components/SidebarStorico", () => ({
  SidebarStorico: ({
    onSelectSession,
    onOpenDeleteConfirm,
  }: {
    onSelectSession: (id: string | null) => void;
    onOpenDeleteConfirm: (id: string, titolo: string) => void;
  }) => (
    <div data-testid="sidebar-storico-mock">
      <button type="button" onClick={() => onSelectSession("sess-456")}>
        Seleziona Sess 456
      </button>
      <button type="button" onClick={() => onOpenDeleteConfirm("sess-123", "Indagine Bancaria")}>
        Richiedi Eliminazione
      </button>
    </div>
  ),
}));

vi.mock("@/features/analisi/components/WorkspaceIndagine", () => ({
  WorkspaceIndagine: ({ sessioneId }: { sessioneId: string | null }) => (
    <div data-testid="workspace-indagine-mock">Workspace Sessione: {sessioneId || "nessuna"}</div>
  ),
}));

vi.mock("@/features/analisi/components/AnalysisSettingsSection", () => ({
  AnalysisSettingsSection: ({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) =>
    isOpen ? (
      <div data-testid="settings-modal-mock">
        <button type="button" onClick={onClose}>Chiudi Impostazioni</button>
      </div>
    ) : null,
}));

vi.mock("@/features/analisi/components/RiquadroFonte", () => ({
  RiquadroFonte: ({ etichetta }: { etichetta: string }) => (
    <div data-testid="riquadro-fonte-mock">{etichetta}</div>
  ),
}));

const mockedUseAuth = vi.mocked(useAuth);
const mockedUseLegalChat = vi.mocked(useLegalChat);
const mockedUseParams = vi.mocked(useParams);
const mockedUseNavigate = vi.mocked(useNavigate);
const mockedEliminaSessione = vi.mocked(eliminaSessione);

describe("ApprofondimentoGiurisprudenziale Component Suite", () => {
  const navigateMock = vi.fn();

  const defaultChatProps = {
    showDocsModal: false,
    setShowDocsModal: vi.fn(),
    attachedDocs: [],
    setAttachedDocs: vi.fn(),
    archiveDocs: [],
    isLoadingData: false,
    isProcessingFiles: false,
    toggleDocSelection: vi.fn(),
    removeAttachment: vi.fn(),
    processFilesParallel: vi.fn(),
    handleToggleFascicoloLink: vi.fn(),
    handleRenameDocumento: vi.fn(),
    handleDeleteDocumento: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseNavigate.mockReturnValue(navigateMock);
    mockedUseParams.mockReturnValue({});
    mockedUseLegalChat.mockReturnValue(defaultChatProps as unknown as ReturnType<typeof useLegalChat>);
  });

  test("non renderizza nulla se lo stato di autenticazione è in loading", () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      status: "loading",
    } as unknown as ReturnType<typeof useAuth>);

    const { container } = render(<ApprofondimentoGiurisprudenziale />);
    expect(container).toBeEmptyDOMElement();
  });

  test("renderizza la landing page se l'utente non è autenticato", () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      status: "unauthenticated",
    } as unknown as ReturnType<typeof useAuth>);

    render(<ApprofondimentoGiurisprudenziale />);

    expect(screen.getByTestId("header-mock")).toBeInTheDocument();
    expect(screen.getByTestId("landing-mock")).toBeInTheDocument();
    expect(screen.queryByTestId("workspace-indagine-mock")).not.toBeInTheDocument();
  });

  test("renderizza l'area di lavoro completa quando l'utente è autenticato", () => {
    mockedUseAuth.mockReturnValue({
      user: { uid: "user-1" },
      status: "authenticated",
    } as unknown as ReturnType<typeof useAuth>);
    mockedUseParams.mockReturnValue({ analisiId: "sess-123" });

    render(<ApprofondimentoGiurisprudenziale />);

    expect(screen.getByTestId("sidebar-storico-mock")).toBeInTheDocument();
    expect(screen.getByText("Workspace Sessione: sess-123")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /nuova ricerca/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /guida operativa/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /parametri avanzati/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /allegati/i })).toBeInTheDocument();
  });

  test("naviga a /analisi al click su 'Nuova Ricerca'", () => {
    mockedUseAuth.mockReturnValue({
      user: { uid: "user-1" },
      status: "authenticated",
    } as unknown as ReturnType<typeof useAuth>);

    render(<ApprofondimentoGiurisprudenziale />);

    const nuovaRicercaBtn = screen.getByRole("button", { name: /nuova ricerca/i });
    fireEvent.click(nuovaRicercaBtn);

    expect(navigateMock).toHaveBeenCalledWith("/analisi");
  });

  test("naviga all'id selezionato dalla sidebar", () => {
    mockedUseAuth.mockReturnValue({
      user: { uid: "user-1" },
      status: "authenticated",
    } as unknown as ReturnType<typeof useAuth>);

    render(<ApprofondimentoGiurisprudenziale />);

    const selectSessionBtn = screen.getByRole("button", { name: /seleziona sess 456/i });
    fireEvent.click(selectSessionBtn);

    expect(navigateMock).toHaveBeenCalledWith("/analisi/sess-456");
  });

  test("apre e chiude la Guida Operativa mostrando i riquadri delle fonti", () => {
    mockedUseAuth.mockReturnValue({
      user: { uid: "user-1" },
      status: "authenticated",
    } as unknown as ReturnType<typeof useAuth>);

    render(<ApprofondimentoGiurisprudenziale />);

    const guidaBtn = screen.getByRole("button", { name: /guida operativa/i });
    fireEvent.click(guidaBtn);

    expect(screen.getByText(/Dall'analisi del quesito alla costruzione della strategia difensiva/i)).toBeInTheDocument();
    expect(screen.getByText("Web Giuridico")).toBeInTheDocument();
    expect(screen.getByText("Banca Dati")).toBeInTheDocument();

    fireEvent.click(guidaBtn);
    expect(screen.queryByText("Web Giuridico")).not.toBeInTheDocument();
  });

  test("apre il pannello dei Parametri Avanzati al click dedicato", () => {
    mockedUseAuth.mockReturnValue({
      user: { uid: "user-1" },
      status: "authenticated",
    } as unknown as ReturnType<typeof useAuth>);

    render(<ApprofondimentoGiurisprudenziale />);

    const settingsBtn = screen.getByRole("button", { name: /parametri avanzati/i });
    fireEvent.click(settingsBtn);

    expect(screen.getByTestId("settings-modal-mock")).toBeInTheDocument();

    const chiudiBtn = screen.getByRole("button", { name: /chiudi impostazioni/i });
    fireEvent.click(chiudiBtn);

    expect(screen.queryByTestId("settings-modal-mock")).not.toBeInTheDocument();
  });

  test("apre il modale di selezione documenti al click su Allegati", () => {
    const setShowDocsModalMock = vi.fn();
    mockedUseLegalChat.mockReturnValue({
      ...defaultChatProps,
      setShowDocsModal: setShowDocsModalMock,
    } as unknown as ReturnType<typeof useLegalChat>);

    mockedUseAuth.mockReturnValue({
      user: { uid: "user-1" },
      status: "authenticated",
    } as unknown as ReturnType<typeof useAuth>);

    render(<ApprofondimentoGiurisprudenziale />);

    const allegatiBtn = screen.getByRole("button", { name: /allegati/i });
    fireEvent.click(allegatiBtn);

    expect(setShowDocsModalMock).toHaveBeenCalledWith(true);
  });

  test("gestisce il flusso di eliminazione sessione con conferma e redirect", async () => {
    mockedUseAuth.mockReturnValue({
      user: { uid: "user-1" },
      status: "authenticated",
    } as unknown as ReturnType<typeof useAuth>);
    mockedUseParams.mockReturnValue({ analisiId: "sess-123" });
    mockedEliminaSessione.mockResolvedValueOnce(undefined);

    render(<ApprofondimentoGiurisprudenziale />);

    const openDeleteBtn = screen.getByRole("button", { name: /richiedi eliminazione/i });
    fireEvent.click(openDeleteBtn);

    expect(screen.getByTestId("confirm-modal")).toBeInTheDocument();
    expect(screen.getByText("Elimina Indagine")).toBeInTheDocument();

    const confirmBtn = screen.getByRole("button", { name: /conferma eliminazione/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockedEliminaSessione).toHaveBeenCalledWith("sess-123");
    });

    expect(navigateMock).toHaveBeenCalledWith("/analisi");
    expect(screen.queryByTestId("confirm-modal")).not.toBeInTheDocument();
  });
});