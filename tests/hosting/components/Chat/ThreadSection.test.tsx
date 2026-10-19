import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid={`icon-${name}`} {...props} />
  );
  return {
    MessageSquare: Icon("message-square"),
    Plus: Icon("plus"),
    Trash2: Icon("trash-2"),
    ChevronRight: Icon("chevron-right"),
    Lock: Icon("lock"),
  };
});

/* ---------- component ---------- */
import { ThreadSection } from "@/features/chat/components/ThreadSection";
import type { ThreadItem } from "@/interfaces/interfaces";

describe("ThreadSection Component Suite", () => {
  const mockOnThreadSelect = vi.fn();
  const mockOnNewThread = vi.fn();
  const mockOnDeleteThread = vi.fn();

  const defaultThreads: ThreadItem[] = [
    {
      id: "thread-1",
      title: "Strategia Difensiva Preliminare",
    } as ThreadItem,
    {
      id: "thread-2",
      title: "", // Test fallback "Nuova Chat"
    } as ThreadItem,
  ];

  const defaultProps = {
    threads: defaultThreads,
    activeThreadId: "thread-1",
    activeFascicoloId: "fascicolo-123",
    onThreadSelect: mockOnThreadSelect,
    onNewThread: mockOnNewThread,
    onDeleteThread: mockOnDeleteThread,
    isReadOnly: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza header, lista delle conversazioni e gestisce il fallback del titolo", () => {
    render(<ThreadSection {...defaultProps} />);

    // Header
    expect(screen.getByRole("heading", { name: /Conversazioni/i, level: 2 })).toBeInTheDocument();
    expect(screen.getByLabelText("Nuova conversazione")).toBeInTheDocument();

    // Titoli dei thread (incluso fallback "Nuova Chat")
    expect(screen.getByText("Strategia Difensiva Preliminare")).toBeInTheDocument();
    expect(screen.getByText("Nuova Chat")).toBeInTheDocument();

    // Icone
    expect(screen.getAllByTestId("icon-message-square").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByTestId("icon-chevron-right")).toHaveLength(2);
    expect(screen.getAllByTestId("icon-trash-2")).toHaveLength(2);
  });

  test("applica le classi di stile corrette per l'elemento attivo vs inattivo", () => {
    render(<ThreadSection {...defaultProps} activeThreadId="thread-1" />);

    const activeItem = screen.getByText("Strategia Difensiva Preliminare").closest('[role="button"]')!;
    const inactiveItem = screen.getByText("Nuova Chat").closest('[role="button"]')!;

    expect(activeItem).toHaveClass("bg-(--color-bg)");
    expect(activeItem).toHaveClass("border-(--color-text)");

    expect(inactiveItem).toHaveClass("bg-(--color-surface)");
    expect(inactiveItem).toHaveClass("border-transparent");
  });

  test("renderizza lo stato vuoto quando non sono presenti conversazioni", () => {
    render(<ThreadSection {...defaultProps} threads={[]} />);

    expect(screen.getByText("Nessuna conversazione attiva")).toBeInTheDocument();
    expect(screen.queryByText("Strategia Difensiva Preliminare")).not.toBeInTheDocument();
  });

  test("invoca onNewThread al click sul pulsante di aggiunta conversazione", () => {
    render(<ThreadSection {...defaultProps} />);

    const newThreadBtn = screen.getByLabelText("Nuova conversazione");
    fireEvent.click(newThreadBtn);

    expect(mockOnNewThread).toHaveBeenCalledTimes(1);
  });

  test("invoca onThreadSelect al click su una conversazione", () => {
    render(<ThreadSection {...defaultProps} />);

    const threadItem = screen.getByText("Strategia Difensiva Preliminare").closest('[role="button"]')!;
    fireEvent.click(threadItem);

    expect(mockOnThreadSelect).toHaveBeenCalledWith("thread-1");
  });

  test("invoca onDeleteThread con stopPropagation al click sul pulsante elimina", () => {
    render(<ThreadSection {...defaultProps} />);

    const deleteButtons = screen.getAllByLabelText("Elimina conversazione");
    fireEvent.click(deleteButtons[0]);

    expect(mockOnDeleteThread).toHaveBeenCalledWith("fascicolo-123", "thread-1");
    // Verifica che il click non abbia scatenato la selezione del thread padre
    expect(mockOnThreadSelect).not.toHaveBeenCalled();
  });

  test("modalità isReadOnly: mostra badge, nasconde il tasto Nuova Chat e i tasti elimina", () => {
    render(<ThreadSection {...defaultProps} isReadOnly={true} />);

    // Badge Sola lettura e icona Lock
    expect(screen.getByText("Sola lettura")).toBeInTheDocument();
    expect(screen.getByTestId("icon-lock")).toBeInTheDocument();

    // Tasto Nuova conversazione non presente
    expect(screen.queryByLabelText("Nuova conversazione")).not.toBeInTheDocument();

    // Tasti elimina non presenti
    expect(screen.queryByLabelText("Elimina conversazione")).not.toBeInTheDocument();
    expect(screen.queryByTestId("icon-trash-2")).not.toBeInTheDocument();
  });

  test("non solleva errori se i callback opzionali non vengono passati", () => {
    render(
      <ThreadSection
        threads={defaultThreads}
        activeFascicoloId="fascicolo-123"
      />
    );

    // Click Nuova Conversazione senza onNewThread
    const newThreadBtn = screen.getByLabelText("Nuova conversazione");
    expect(() => fireEvent.click(newThreadBtn)).not.toThrow();

    // Click Seleziona Thread senza onThreadSelect
    const threadItem = screen.getByText("Strategia Difensiva Preliminare").closest('[role="button"]')!;
    expect(() => fireEvent.click(threadItem)).not.toThrow();

    // Click Elimina Thread senza onDeleteThread
    const deleteBtn = screen.getAllByLabelText("Elimina conversazione")[0];
    expect(() => fireEvent.click(deleteBtn)).not.toThrow();
  });

  describe("Accessibilità (SonarQube A11y)", () => {
    test("simula la selezione del thread tramite tastiera premendo Enter", () => {
      render(<ThreadSection {...defaultProps} />);

      const threadItem = screen.getByText("Strategia Difensiva Preliminare").closest('[role="button"]')!;
      fireEvent.keyDown(threadItem, { key: "Enter" });

      expect(mockOnThreadSelect).toHaveBeenCalledTimes(1);
      expect(mockOnThreadSelect).toHaveBeenCalledWith("thread-1");
    });

    test("simula la selezione del thread tramite tastiera premendo Spazio", () => {
      render(<ThreadSection {...defaultProps} />);

      const threadItem = screen.getByText("Nuova Chat").closest('[role="button"]')!;
      fireEvent.keyDown(threadItem, { key: " " });

      expect(mockOnThreadSelect).toHaveBeenCalledTimes(1);
      expect(mockOnThreadSelect).toHaveBeenCalledWith("thread-2");
    });

    test("ignora i tasti diversi da Enter o Spazio", () => {
      render(<ThreadSection {...defaultProps} />);

      const threadItem = screen.getByText("Strategia Difensiva Preliminare").closest('[role="button"]')!;
      
      fireEvent.keyDown(threadItem, { key: "Tab" });
      fireEvent.keyDown(threadItem, { key: "ArrowDown" });
      fireEvent.keyDown(threadItem, { key: "Escape" });

      expect(mockOnThreadSelect).not.toHaveBeenCalled();
    });
  });
});