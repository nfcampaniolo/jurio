import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid={`icon-${name}`} {...props} />
  );
  return {
    FolderPlus: Icon("folder-plus"),
    MessageSquare: Icon("message-square"),
    BookOpen: Icon("book-open"),
    ArrowRightLeft: Icon("arrow-right-left"),
    Loader2: Icon("loader-2"),
    PanelRight: Icon("panel-right"),
    X: Icon("x"),
  };
});

/* ---------- component ---------- */
import { ChatHeader } from "@/features/chat/components/ChatHeader"; // <-- adegua il path se necessario

describe("ChatHeader", () => {
  const mockSetViewMode = vi.fn();
  const mockSetShowTitleModal = vi.fn();
  const mockSetShowMobileSidebar = vi.fn();
  const mockCloseSession = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza sessione 'temporanea' in modalità chat con interazioni e salvataggio", () => {
    render(
      <ChatHeader
        sessionType="temporanea"
        sessionTitle="Ricerca Fiscale"
        threadTitle={undefined}
        messagesCount={5}
        viewMode="chat"
        setViewMode={mockSetViewMode}
        attachedDocsCount={0}
        isConverting={false}
        setShowTitleModal={mockSetShowTitleModal}
        setShowMobileSidebar={mockSetShowMobileSidebar}
        closeSession={mockCloseSession}
      />
    );

    // Icona tipo temporanea
    expect(screen.getAllByTestId("icon-message-square").length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByTestId("icon-folder-plus")).not.toBeInTheDocument();

    // Titolo sessione
    expect(screen.getByText("Ricerca Fiscale")).toBeInTheDocument();

    // Conteggio messaggi
    expect(screen.getByText("5 MSG")).toBeInTheDocument();

    // Pulsante Chat (attivo) e Studio (disabilitato per assenza doc)
    const chatBtn = screen.getByRole("button", { name: /Chat/i });
    const studioBtn = screen.getByRole("button", { name: /Studio/i });

    expect(chatBtn).toHaveClass("bg-(--color-surface)");
    expect(studioBtn).toBeDisabled();
    expect(studioBtn).toHaveAttribute("title", "Allega un documento per attivare lo Studio");

    fireEvent.click(chatBtn);
    expect(mockSetViewMode).toHaveBeenCalledWith("chat");

    // Pulsante Salva (visibile e attivo in sessione temporanea)
    const saveBtn = screen.getByRole("button", { name: /SALVA/i });
    expect(saveBtn).toBeEnabled();
    expect(screen.getByTestId("icon-arrow-right-left")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-loader-2")).not.toBeInTheDocument();

    fireEvent.click(saveBtn);
    expect(mockSetShowTitleModal).toHaveBeenCalledWith(true);

    // Sidebar Mobile (senza pallino indicatore documenti)
    const mobileSidebarBtn = screen.getByRole("button", { name: "" });
    fireEvent.click(mobileSidebarBtn);
    expect(mockSetShowMobileSidebar).toHaveBeenCalledWith(true);

    // Pulsante Chiudi
    const closeBtn = screen.getByRole("button", { name: /Chiudi/i });
    fireEvent.click(closeBtn);
    expect(mockCloseSession).toHaveBeenCalledTimes(1);
  });

  test("renderizza sessione 'fascicolo' con thread, modalità workspace e documenti allegati", () => {
    const { container } = render(
      <ChatHeader
        sessionType="fascicolo"
        sessionTitle="Fascicolo Civile 2026"
        threadTitle="Discussione Udienza"
        messagesCount={12}
        viewMode="workspace"
        setViewMode={mockSetViewMode}
        attachedDocsCount={2}
        isConverting={false}
        setShowTitleModal={mockSetShowTitleModal}
        setShowMobileSidebar={mockSetShowMobileSidebar}
        closeSession={mockCloseSession}
      />
    );

    // Icona fascicolo
    expect(screen.getByTestId("icon-folder-plus")).toBeInTheDocument();

    // Titolo e Thread
    expect(screen.getByText("Fascicolo Civile 2026")).toBeInTheDocument();
    expect(screen.getByText("/")).toBeInTheDocument();
    expect(screen.getByText("Discussione Udienza")).toBeInTheDocument();

    // Pulsante Salva non deve esistere in modalità fascicolo
    expect(screen.queryByRole("button", { name: /SALVA/i })).not.toBeInTheDocument();

    // Pulsante Studio (attivo e abilitato)
    const studioBtn = screen.getByRole("button", { name: /Studio/i });
    expect(studioBtn).toBeEnabled();
    expect(studioBtn).toHaveClass("bg-(--color-surface)");
    expect(studioBtn).toHaveAttribute("title", "Apri Studio Documento");

    fireEvent.click(studioBtn);
    expect(mockSetViewMode).toHaveBeenCalledWith("workspace");

    // Indicatore presenza allegati su mobile sidebar
    const dot = container.querySelector(".bg-\\(--color-text\\).rounded-sm");
    expect(dot).toBeInTheDocument();
  });

  test("copre fallback titoli predefiniti quando sessionTitle o threadTitle sono assenti", () => {
    // Caso 1: Fascicolo senza titolo né thread
    const { rerender } = render(
      <ChatHeader
        sessionType="fascicolo"
        sessionTitle={undefined}
        threadTitle={undefined}
        messagesCount={0}
        viewMode="chat"
        setViewMode={mockSetViewMode}
        attachedDocsCount={0}
        isConverting={false}
        setShowTitleModal={mockSetShowTitleModal}
        setShowMobileSidebar={mockSetShowMobileSidebar}
        closeSession={mockCloseSession}
      />
    );

    expect(screen.getByText("Nuovo Fascicolo")).toBeInTheDocument();
    expect(screen.queryByText("/")).not.toBeInTheDocument();

    // Caso 2: Sessione non fascicolo (es. storico) senza titolo
    rerender(
      <ChatHeader
        sessionType="storico"
        sessionTitle={undefined}
        threadTitle={undefined}
        messagesCount={0}
        viewMode="chat"
        setViewMode={mockSetViewMode}
        attachedDocsCount={0}
        isConverting={false}
        setShowTitleModal={mockSetShowTitleModal}
        setShowMobileSidebar={mockSetShowMobileSidebar}
        closeSession={mockCloseSession}
      />
    );

    expect(screen.getByText("Nuova Ricerca")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /SALVA/i })).not.toBeInTheDocument();
  });

  test("gestisce lo stato di salvataggio in corso (isConverting = true)", () => {
    render(
      <ChatHeader
        sessionType="temporanea"
        sessionTitle="Bozza"
        threadTitle={undefined}
        messagesCount={3}
        viewMode="chat"
        setViewMode={mockSetViewMode}
        attachedDocsCount={0}
        isConverting={true}
        setShowTitleModal={mockSetShowTitleModal}
        setShowMobileSidebar={mockSetShowMobileSidebar}
        closeSession={mockCloseSession}
      />
    );

    const savingBtn = screen.getByRole("button", { name: /SALVATAGGIO\.\.\./i });
    expect(savingBtn).toBeDisabled();
    expect(screen.getByTestId("icon-loader-2")).toBeInTheDocument();
    expect(screen.getByTestId("icon-loader-2")).toHaveClass("animate-spin");
    expect(screen.queryByTestId("icon-arrow-right-left")).not.toBeInTheDocument();
  });
});