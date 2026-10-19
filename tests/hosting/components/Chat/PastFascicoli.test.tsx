import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid={`icon-${name}`} {...props} />
  );
  return {
    Clock: Icon("clock"),
    Folder: Icon("folder"),
    ChevronRight: Icon("chevron-right"),
    MessageSquare: Icon("message-square"),
    Files: Icon("files"),
    Loader2: Icon("loader-2"),
    Trash2: Icon("trash-2"),
    Pencil: Icon("pencil"),
  };
});

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", async () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { [key: string]: unknown }) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

/* ---------- component ---------- */
import { PastFascicoli } from "@/features/chat/components/PastFascicoli"; // <-- adegua il path se necessario
import type { PastFascicolo, PastChat } from "@/interfaces/interfaces";

describe("PastFascicoli Component Suite", () => {
  const mockOnSelectFascicolo = vi.fn();
  const mockOnSelectChat = vi.fn();
  const mockOnBack = vi.fn();
  const mockOnDeleteFascicolo = vi.fn();
  const mockOnDeleteChat = vi.fn();
  const mockOnRenameFascicolo = vi.fn();
  const mockOnRenameChat = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = "";
    vi.spyOn(window.history, "replaceState").mockImplementation(() => {});
  });

  afterEach(() => {
    window.location.hash = "";
  });

  const mockFascicoli: PastFascicolo[] = [
    {
      id: "fasc-1",
      title: "Controversia Societaria",
      updatedAt: { toDate: () => new Date("2026-05-10T10:00:00Z") } as unknown,
    } as PastFascicolo,
    {
      id: "fasc-2",
      title: "Pratica Recupero Crediti",
      updatedAt: "2026-06-15T12:00:00Z",
    } as unknown as PastFascicolo,
    {
      id: "fasc-3",
      title: "Data Non Valida",
      updatedAt: "stringa-data-invalida",
    } as unknown as PastFascicolo,
    {
      id: "fasc-4",
      title: "Senza Data",
      updatedAt: null,
    } as unknown as PastFascicolo,
  ];

  const mockChats: PastChat[] = [
    {
      id: "chat-1",
      title: "Ricerca Prelazione Agraria",
      updatedAt: new Date("2026-07-20T14:30:00Z"),
    } as unknown as PastChat,
    {
      id: "chat-2",
      title: "",
      updatedAt: 12345 as unknown,
    } as unknown as PastChat,
  ];

  const defaultProps = {
    fascicoli: mockFascicoli,
    chats: mockChats,
    onSelectFascicolo: mockOnSelectFascicolo,
    onSelectChat: mockOnSelectChat,
    onBack: mockOnBack,
    onDeleteFascicolo: mockOnDeleteFascicolo,
    onDeleteChat: mockOnDeleteChat,
    onRenameFascicolo: mockOnRenameFascicolo,
    onRenameChat: mockOnRenameChat,
  };

  test("renderizza header, conteggi e tab predefinita 'fascicoli' con formattazione date", () => {
    render(<PastFascicoli {...defaultProps} />);

    // Header
    expect(screen.getByRole("heading", { name: /Archivio Consultazioni/i, level: 1 })).toBeInTheDocument();
    expect(screen.getByText("Riprendi il lavoro dai tuoi fascicoli o dalle ricerche veloci.")).toBeInTheDocument();

    // Controlli tab
    expect(screen.getByRole("button", { name: /Fascicoli \(4\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Chat Veloci \(2\)/i })).toBeInTheDocument();

    // Fascicoli renderizzati
    expect(screen.getByText("Controversia Societaria")).toBeInTheDocument();
    expect(screen.getByText("Pratica Recupero Crediti")).toBeInTheDocument();
    expect(screen.getByText("Data Non Valida")).toBeInTheDocument();
    expect(screen.getByText("stringa-data-invalida")).toBeInTheDocument();
    expect(screen.getByText("Senza Data")).toBeInTheDocument();

    // Chat non visibili nel tab fascicoli
    expect(screen.queryByText("Ricerca Prelazione Agraria")).not.toBeInTheDocument();
  });

  test("inizializza il tab 'chats' se l'URL contiene hash #chats", () => {
    window.location.hash = "#chats";

    render(<PastFascicoli {...defaultProps} />);

    // Chat visibili
    expect(screen.getByText("Ricerca Prelazione Agraria")).toBeInTheDocument();
    expect(screen.getByText("Nuova Ricerca")).toBeInTheDocument(); // Fallback per titolo vuoto

    // Fascicoli non visibili
    expect(screen.queryByText("Controversia Societaria")).not.toBeInTheDocument();
  });

  test("permette di cambiare tab e aggiorna l'hash URL con replaceState", () => {
    render(<PastFascicoli {...defaultProps} />);

    const chatTabBtn = screen.getByRole("button", { name: /Chat Veloci \(2\)/i });
    fireEvent.click(chatTabBtn);

    expect(window.history.replaceState).toHaveBeenCalledWith(null, "", "#chats");
    expect(screen.getByText("Ricerca Prelazione Agraria")).toBeInTheDocument();

    const fascicoliTabBtn = screen.getByRole("button", { name: /Fascicoli \(4\)/i });
    fireEvent.click(fascicoliTabBtn);

    expect(window.history.replaceState).toHaveBeenCalledWith(null, "", "#fascicoli");
    expect(screen.getByText("Controversia Societaria")).toBeInTheDocument();
  });

  test("risponde all'evento hashchange da browser navigation e pulisce il listener all'unmount", () => {
    const { unmount } = render(<PastFascicoli {...defaultProps} />);

    // Simula evento hashchange verso #chats
    window.location.hash = "#chats";
    act(() => {
      window.dispatchEvent(new Event("hashchange"));
    });
    expect(screen.getByText("Ricerca Prelazione Agraria")).toBeInTheDocument();

    // Simula evento hashchange verso #fascicoli
    window.location.hash = "#fascicoli";
    act(() => {
      window.dispatchEvent(new Event("hashchange"));
    });
    expect(screen.getByText("Controversia Societaria")).toBeInTheDocument();

    // Simula evento hashchange con hash sconosciuto (nessun cambio)
    window.location.hash = "#altro";
    act(() => {
      window.dispatchEvent(new Event("hashchange"));
    });
    expect(screen.getByText("Controversia Societaria")).toBeInTheDocument();

    // Unmount
    const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");
    unmount();
    expect(removeEventListenerSpy).toHaveBeenCalledWith("hashchange", expect.any(Function));
  });

  test("gestisce la selezione di un fascicolo mostrando lo stato di loading ed evitando chiamate concorrenti", async () => {
    let resolveSelection: () => void = () => {};
    mockOnSelectFascicolo.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSelection = resolve;
        })
    );

    render(<PastFascicoli {...defaultProps} />);

    // Seleziona la card del primo fascicolo
    const card = screen.getByText("Controversia Societaria").closest('[role="button"]')!;

    fireEvent.click(card);

    expect(mockOnSelectFascicolo).toHaveBeenCalledWith(mockFascicoli[0]);
    expect(screen.getByTestId("icon-loader-2")).toBeInTheDocument();

    // Tentativo di secondo click mentre è in caricamento (early return loadingId !== null)
    const secondCard = screen.getByText("Pratica Recupero Crediti").closest('[role="button"]')!;
    fireEvent.click(secondCard);
    expect(mockOnSelectFascicolo).toHaveBeenCalledTimes(1);

    // Risolve la selezione
    act(() => {
      resolveSelection();
    });

    await waitFor(() => {
      expect(screen.queryByTestId("icon-loader-2")).not.toBeInTheDocument();
    });
  });

  test("gestisce le azioni di rinomina ed eliminazione di un fascicolo con stopPropagation", () => {
    render(<PastFascicoli {...defaultProps} />);

    const renameButtons = screen.getAllByLabelText("Rinomina fascicolo");
    const deleteButtons = screen.getAllByLabelText("Elimina fascicolo");

    // Rinomina
    fireEvent.click(renameButtons[0]);
    expect(mockOnRenameFascicolo).toHaveBeenCalledWith("fasc-1", "Controversia Societaria");
    expect(mockOnSelectFascicolo).not.toHaveBeenCalled();

    // Elimina
    fireEvent.click(deleteButtons[0]);
    expect(mockOnDeleteFascicolo).toHaveBeenCalledWith("fasc-1");
    expect(mockOnSelectFascicolo).not.toHaveBeenCalled();
  });

  test("gestisce la selezione di una chat con loading ed evitando chiamate concorrenti", async () => {
    window.location.hash = "#chats";

    let resolveChatSelection: () => void = () => {};
    mockOnSelectChat.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveChatSelection = resolve;
        })
    );

    render(<PastFascicoli {...defaultProps} />);

    const chatCard = screen.getByText("Ricerca Prelazione Agraria").closest('[role="button"]')!;
    fireEvent.click(chatCard);

    expect(mockOnSelectChat).toHaveBeenCalledWith(mockChats[0]);
    expect(screen.getByTestId("icon-loader-2")).toBeInTheDocument();

    // Secondo click concorrente
    const secondChatCard = screen.getByText("Nuova Ricerca").closest('[role="button"]')!;
    fireEvent.click(secondChatCard);
    expect(mockOnSelectChat).toHaveBeenCalledTimes(1);

    // Risolve
    act(() => {
      resolveChatSelection();
    });

    await waitFor(() => {
      expect(screen.queryByTestId("icon-loader-2")).not.toBeInTheDocument();
    });
  });

  test("gestisce le azioni di rinomina ed eliminazione di una chat con fallback titolo e stopPropagation", () => {
    window.location.hash = "#chats";

    render(<PastFascicoli {...defaultProps} />);

    const renameButtons = screen.getAllByLabelText("Rinomina chat");
    const deleteButtons = screen.getAllByLabelText("Elimina chat");

    // Rinomina chat 1 (titolo presente)
    fireEvent.click(renameButtons[0]);
    expect(mockOnRenameChat).toHaveBeenCalledWith("chat-1", "Ricerca Prelazione Agraria");
    expect(mockOnSelectChat).not.toHaveBeenCalled();

    // Rinomina chat 2 (titolo vuoto -> fallback 'Nuova Ricerca')
    fireEvent.click(renameButtons[1]);
    expect(mockOnRenameChat).toHaveBeenCalledWith("chat-2", "Nuova Ricerca");

    // Elimina chat
    fireEvent.click(deleteButtons[0]);
    expect(mockOnDeleteChat).toHaveBeenCalledWith("chat-1");
    expect(mockOnSelectChat).not.toHaveBeenCalled();
  });
});