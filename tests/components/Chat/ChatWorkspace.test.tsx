import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid={`icon-${name}`} {...props} />
  );
  return {
    FileText: Icon("file-text"),
    X: Icon("x"),
  };
});

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", async () => {
  return {
    motion: {
      div: ({
        children,
        ...props
      }: React.HTMLAttributes<HTMLDivElement> & { [key: string]: unknown }) => (
        <div {...props}>{children}</div>
      ),
    },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

/* ---------- mock DocumentViewer ---------- */
interface DocumentViewerMockProps {
  documents: unknown[];
  onClose: () => void;
  onActionRequest: (actionType: 'quote' | 'semaforo' | 'distinguish', selectedText: string) => void;
  activeQuotes: string[];
  onRemoveQuote: (index: number) => void;
}

vi.mock("@/components/Chat/DocumentViewer", () => ({
  DocumentViewer: ({
    documents,
    onClose,
    onActionRequest,
    activeQuotes,
    onRemoveQuote,
  }: DocumentViewerMockProps) => (
    <div data-testid="document-viewer">
      <span data-testid="doc-count">{documents.length}</span>
      <span data-testid="quotes-count">{activeQuotes.length}</span>
      <button data-testid="viewer-close-btn" onClick={onClose}>
        Chiudi Viewer
      </button>
      <button
        data-testid="viewer-action-btn"
        onClick={() => onActionRequest("quote", "testo selezionato")}
      >
        Azione
      </button>
      <button data-testid="viewer-remove-quote-btn" onClick={() => onRemoveQuote(0)}>
        Rimuovi Citazione
      </button>
    </div>
  ),
}));

/* ---------- component ---------- */
import { ChatWorkspace } from "@/components/Chat/ChatWorkspace"; // <-- adegua il path se necessario
import type { AttachedDocument } from "@/interfaces/interfaces";

describe("ChatWorkspace", () => {
  const mockSetViewMode = vi.fn();
  const mockHandleDocumentAction = vi.fn();
  const mockRemoveQuote = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("non renderizza nulla quando viewMode è 'chat'", () => {
    render(
      <ChatWorkspace
        viewMode="chat"
        setViewMode={mockSetViewMode}
        attachedDocs={[]}
        activeQuote={[]}
        handleDocumentAction={mockHandleDocumentAction}
        removeQuote={mockRemoveQuote}
      />
    );

    expect(screen.queryByTestId("icon-file-text")).not.toBeInTheDocument();
    expect(screen.queryByTestId("document-viewer")).not.toBeInTheDocument();
  });

  test("renderizza l'area workspace con documenti, header corretto e collega gli eventi di DocumentViewer", () => {
    const mockDocs: AttachedDocument[] = [
      { id: "doc-1", name: "AttoDiCitazione.pdf" } as AttachedDocument,
      { id: "doc-2", name: "SentenzaCassazione.pdf" } as AttachedDocument,
    ];
    const mockQuotes = ["Citazione test 1", "Citazione test 2"];

    render(
      <ChatWorkspace
        viewMode="workspace"
        setViewMode={mockSetViewMode}
        attachedDocs={mockDocs}
        activeQuote={mockQuotes}
        handleDocumentAction={mockHandleDocumentAction}
        removeQuote={mockRemoveQuote}
      />
    );

    // Header e Titolo del primo documento
    expect(screen.getByTestId("icon-file-text")).toBeInTheDocument();
    expect(screen.getByText("AttoDiCitazione.pdf")).toBeInTheDocument();

    // Pulsante chiusura header
    const closeHeaderBtn = screen.getByTestId("icon-x").closest("button")!;
    fireEvent.click(closeHeaderBtn);
    expect(mockSetViewMode).toHaveBeenCalledWith("chat");

    // Componente DocumentViewer e props passate
    expect(screen.getByTestId("document-viewer")).toBeInTheDocument();
    expect(screen.getByTestId("doc-count")).toHaveTextContent("2");
    expect(screen.getByTestId("quotes-count")).toHaveTextContent("2");

    // Callback onClose di DocumentViewer
    fireEvent.click(screen.getByTestId("viewer-close-btn"));
    expect(mockSetViewMode).toHaveBeenCalledWith("chat");

    // Callback onActionRequest di DocumentViewer
    fireEvent.click(screen.getByTestId("viewer-action-btn"));
    expect(mockHandleDocumentAction).toHaveBeenCalledWith("quote", "testo selezionato");

    // Callback onRemoveQuote di DocumentViewer
    fireEvent.click(screen.getByTestId("viewer-remove-quote-btn"));
    expect(mockRemoveQuote).toHaveBeenCalledWith(0);
  });

  test("renderizza il fallback del titolo e non renderizza DocumentViewer quando attachedDocs è vuoto", () => {
    render(
      <ChatWorkspace
        viewMode="workspace"
        setViewMode={mockSetViewMode}
        attachedDocs={[]}
        activeQuote={[]}
        handleDocumentAction={mockHandleDocumentAction}
        removeQuote={mockRemoveQuote}
      />
    );

    // Fallback del titolo nell'header
    expect(screen.getByText("Documento in Analisi")).toBeInTheDocument();

    // DocumentViewer non deve essere renderizzato
    expect(screen.queryByTestId("document-viewer")).not.toBeInTheDocument();
  });
});