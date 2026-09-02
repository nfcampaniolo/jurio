import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import React from "react";

/* ---------- hoisted mocks ---------- */
const { mockFetchWithSecurity } = vi.hoisted(() => ({
  mockFetchWithSecurity: vi.fn(),
}));

/* ---------- mock env ---------- */
vi.mock("@/config/env", () => ({
  getText: () => "https://api.jurio.it/extract-text",
}));

/* ---------- mock apiClient ---------- */
vi.mock("@/config/apiClient", () => ({
  fetchWithSecurity: (...args: unknown[]) => mockFetchWithSecurity(...args),
}));

/* ---------- mock perf ---------- */
vi.mock("@/services/perf", () => ({
  withTrace: vi.fn(async (_name, _meta, fn: () => Promise<unknown>) => await fn()),
}));

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid={`icon-${name}`} {...props} />
  );
  return {
    MessageSquarePlus: Icon("message-square-plus"),
    Loader2: Icon("loader-2"),
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
import { DocumentViewer } from "@/components/Chat/DocumentViewer"; // <-- adegua il path se necessario
import type { AttachedDocument } from "@/interfaces/interfaces";

describe("DocumentViewer", () => {
  const mockOnClose = vi.fn();
  const mockOnActionRequest = vi.fn();
  const mockOnRemoveQuote = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const createMockDoc = (id: string, name = `Documento ${id}.pdf`, user = "user-123"): AttachedDocument =>
    ({
      id,
      name,
      user,
      size: 1024,
      type: "application/pdf",
    } as unknown as AttachedDocument);

  test("carica ed estrae il testo del documento con successo mostrando lo stato di loading", async () => {
    mockFetchWithSecurity.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: (header: string) => (header === "content-type" ? "application/json" : null),
      },
      json: async () => ({ text: "Contenuto estratto della sentenza n. 1234/2026." }),
    });

    const doc = createMockDoc("doc-success-1");

    render(
      <DocumentViewer
        documents={[doc]}
        onClose={mockOnClose}
        onActionRequest={mockOnActionRequest}
      />
    );

    // Titolo documento
    expect(screen.getByText("Documento doc-success-1.pdf")).toBeInTheDocument();

    // Spinner caricamento
    expect(screen.getByText("Estrazione testo in corso...")).toBeInTheDocument();
    expect(screen.getByTestId("icon-loader-2")).toBeInTheDocument();

    // Attesa completamento estrazione
    await waitFor(() => {
      expect(
        screen.getByText("Contenuto estratto della sentenza n. 1234/2026.")
      ).toBeInTheDocument();
    });

    expect(mockFetchWithSecurity).toHaveBeenCalledWith(
      "https://api.jurio.it/extract-text",
      { storagePath: "users/user-123/documents/doc-success-1.pdf" }
    );
  });

  test("utilizza la cache in memoria per documenti già estratti senza effettuare nuove chiamate di rete", async () => {
    const doc = createMockDoc("doc-success-1"); // Stesso ID del test precedente (già in cache)

    render(
      <DocumentViewer
        documents={[doc]}
        onClose={mockOnClose}
        onActionRequest={mockOnActionRequest}
      />
    );

    // Il contenuto deve essere immediatamente visibile senza loading e senza fetch
    expect(
      screen.getByText("Contenuto estratto della sentenza n. 1234/2026.")
    ).toBeInTheDocument();
    expect(screen.queryByText("Estrazione testo in corso...")).not.toBeInTheDocument();
    expect(mockFetchWithSecurity).not.toHaveBeenCalled();
  });

  test("gestisce errore HTTP e payload con messaggio di errore", async () => {
    mockFetchWithSecurity.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: {
        get: (header: string) => (header === "content-type" ? "application/json" : null),
      },
      json: async () => ({ error: "File danneggiato" }),
    });

    const doc = createMockDoc("doc-error-http");

    render(
      <DocumentViewer
        documents={[doc]}
        onClose={mockOnClose}
        onActionRequest={mockOnActionRequest}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Si è verificato un errore durante l'estrazione del testo/i)
      ).toBeInTheDocument();
    });
  });

  test("gestisce risposta non valida o formato testo mancante", async () => {
    mockFetchWithSecurity.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: () => "text/plain",
      },
      text: async () => "Risposta raw non valida",
    });

    const doc = createMockDoc("doc-invalid-format");

    render(
      <DocumentViewer
        documents={[doc]}
        onClose={mockOnClose}
        onActionRequest={mockOnActionRequest}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText(/Si è verificato un errore durante l'estrazione del testo/i)
      ).toBeInTheDocument();
    });
  });

  test("gestisce fallback su 'default_user' quando la proprietà user del documento non è definita", async () => {
    mockFetchWithSecurity.mockResolvedValueOnce({
      ok: true,
      headers: {
        get: () => "application/json",
      },
      json: async () => ({ text: "Testo documento senza utente" }),
    });

    const docWithoutUser = {
      id: "doc-no-user",
      name: "Doc Senza Utente.pdf",
    } as unknown as AttachedDocument;

    render(
      <DocumentViewer
        documents={[docWithoutUser]}
        onClose={mockOnClose}
        onActionRequest={mockOnActionRequest}
      />
    );

    await waitFor(() => {
      expect(mockFetchWithSecurity).toHaveBeenCalledWith(
        "https://api.jurio.it/extract-text",
        { storagePath: "users/default_user/documents/doc-no-user.pdf" }
      );
    });
  });

  test("chiama onClose quando la lista dei documenti è vuota", () => {
    render(
      <DocumentViewer
        documents={[]}
        onClose={mockOnClose}
        onActionRequest={mockOnActionRequest}
      />
    );

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test("renderizza i tab multipli e permette di passare da un documento all'altro", async () => {
    mockFetchWithSecurity
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({ text: "Testo Atto Principale" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({ text: "Testo Sentenza Collegata" }),
      });

    const doc1 = createMockDoc("doc-tab-1", "Atto Principale.pdf");
    const doc2 = createMockDoc("doc-tab-2", "Sentenza Collegata.pdf");

    render(
      <DocumentViewer
        documents={[doc1, doc2]}
        onClose={mockOnClose}
        onActionRequest={mockOnActionRequest}
      />
    );

    // Verifica presenza bottoni tab
    const tab1 = screen.getByRole("button", { name: "Atto Principale.pdf" });
    const tab2 = screen.getByRole("button", { name: "Sentenza Collegata.pdf" });

    expect(tab1).toBeInTheDocument();
    expect(tab2).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Testo Atto Principale")).toBeInTheDocument();
    });

    // Clicca sul secondo tab
    fireEvent.click(tab2);

    await waitFor(() => {
      expect(screen.getByText("Testo Sentenza Collegata")).toBeInTheDocument();
    });
  });

  test("aggiorna automaticamente il documento attivo se quello corrente viene rimosso dalla lista", async () => {
    mockFetchWithSecurity
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({ text: "Testo Doc A" }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "application/json" },
        json: async () => ({ text: "Testo Doc B" }),
      });

    const docA = createMockDoc("doc-a", "Doc A.pdf");
    const docB = createMockDoc("doc-b", "Doc B.pdf");

    const { rerender } = render(
      <DocumentViewer
        documents={[docA, docB]}
        onClose={mockOnClose}
        onActionRequest={mockOnActionRequest}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Testo Doc A")).toBeInTheDocument();
    });

    // Rerender con solo docB
    rerender(
      <DocumentViewer
        documents={[docB]}
        onClose={mockOnClose}
        onActionRequest={mockOnActionRequest}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Testo Doc B")).toBeInTheDocument();
    });
  });

  test("evidenzia le citazioni attive (renderHighlightedText) e permette di rimuoverle tramite click o tastiera (accessibilità)", async () => {
    mockFetchWithSecurity.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({
        text: "In tema di responsabilità medica, il nesso causale deve essere provato con certezza probabilistica.",
      }),
    });

    const doc = createMockDoc("doc-quotes-1");
    const activeQuotes = ["responsabilità medica", "certezza probabilistica"];

    render(
      <DocumentViewer
        documents={[doc]}
        onClose={mockOnClose}
        onActionRequest={mockOnActionRequest}
        activeQuotes={activeQuotes}
        onRemoveQuote={mockOnRemoveQuote}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("responsabilità medica")).toBeInTheDocument();
    });

    const marks = screen.getAllByTitle("Clicca per rimuovere la citazione");
    expect(marks).toHaveLength(2);

    // 1. Rimozione tramite Click del mouse sul primo mark
    fireEvent.click(marks[0]);
    expect(mockOnRemoveQuote).toHaveBeenCalledWith(0);
    
    mockOnRemoveQuote.mockClear();

    // 2. Rimozione tramite tastiera premendo Invio sul primo mark (Test SonarQube A11y)
    fireEvent.keyDown(marks[0], { key: "Enter" });
    expect(mockOnRemoveQuote).toHaveBeenCalledWith(0);
    
    mockOnRemoveQuote.mockClear();

    // 3. Rimozione tramite tastiera premendo Spazio sul secondo mark (Test SonarQube A11y)
    fireEvent.keyDown(marks[1], { key: " " });
    expect(mockOnRemoveQuote).toHaveBeenCalledWith(1);
  });

  test("gestisce la selezione testo (handleSelection) e l'invio della citazione (handleActionClick)", async () => {
    mockFetchWithSecurity.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ text: "Testo integrale della sentenza per selezione." }),
    });

    const doc = createMockDoc("doc-select-1");

    const { container } = render(
      <DocumentViewer
        documents={[doc]}
        onClose={mockOnClose}
        onActionRequest={mockOnActionRequest}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText("Testo integrale della sentenza per selezione.")
      ).toBeInTheDocument();
    });

    const removeAllRangesMock = vi.fn();
    vi.spyOn(window, "getSelection").mockReturnValue({
      toString: () => "Questo è un estratto selezionato valido",
      removeAllRanges: removeAllRangesMock,
    } as unknown as Selection);

    // Trigger selezione con mouseUp
    const readingArea = container.querySelector(".overflow-y-auto")!;
    fireEvent.mouseUp(readingArea);

    act(() => {
      vi.advanceTimersByTime(60);
    });

    // Pulsante "Cita Testo Selezionato" visibile
    const quoteBtn = screen.getByRole("button", { name: /Cita Testo Selezionato/i });
    expect(quoteBtn).toBeInTheDocument();

    // Click sul pulsante di citazione
    fireEvent.click(quoteBtn);
    expect(mockOnActionRequest).toHaveBeenCalledWith(
      "quote",
      "Questo è un estratto selezionato valido"
    );
    expect(removeAllRangesMock).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: /Cita Testo Selezionato/i })).not.toBeInTheDocument();
  });

  test("ignora selezioni troppo brevi (<= 5 caratteri)", async () => {
    mockFetchWithSecurity.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ text: "Testo breve" }),
    });

    const doc = createMockDoc("doc-short-select");
    const { container } = render(
      <DocumentViewer
        documents={[doc]}
        onClose={mockOnClose}
        onActionRequest={mockOnActionRequest}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Testo breve")).toBeInTheDocument();
    });

    vi.spyOn(window, "getSelection").mockReturnValue({
      toString: () => "abc",
      removeAllRanges: vi.fn(),
    } as unknown as Selection);

    const readingArea = container.querySelector(".overflow-y-auto")!;
    fireEvent.mouseUp(readingArea);

    act(() => {
      vi.advanceTimersByTime(60);
    });

    expect(screen.queryByRole("button", { name: /Cita Testo Selezionato/i })).not.toBeInTheDocument();
  });

  test("azzera la selezione al mouseDown e supporta touchEnd", async () => {
    mockFetchWithSecurity.mockResolvedValueOnce({
      ok: true,
      headers: { get: () => "application/json" },
      json: async () => ({ text: "Testo per test touch e mousedown." }),
    });

    const doc = createMockDoc("doc-touch-select");
    const { container } = render(
      <DocumentViewer
        documents={[doc]}
        onClose={mockOnClose}
        onActionRequest={mockOnActionRequest}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Testo per test touch e mousedown.")).toBeInTheDocument();
    });

    vi.spyOn(window, "getSelection").mockReturnValue({
      toString: () => "Selezione valida da touch device",
      removeAllRanges: vi.fn(),
    } as unknown as Selection);

    const readingArea = container.querySelector(".overflow-y-auto")!;

    // Trigger touchEnd
    fireEvent.touchEnd(readingArea);
    act(() => {
      vi.advanceTimersByTime(60);
    });

    expect(screen.getByRole("button", { name: /Cita Testo Selezionato/i })).toBeInTheDocument();

    // Trigger mouseDown per resettare
    fireEvent.mouseDown(readingArea);
    expect(screen.queryByRole("button", { name: /Cita Testo Selezionato/i })).not.toBeInTheDocument();
  });
});