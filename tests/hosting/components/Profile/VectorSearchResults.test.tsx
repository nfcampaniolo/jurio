import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import React from "react";
import type { DocumentoGiurisprudenziale } from "@/interfaces/interfaces";

/* ---------- mock react-icons/fi ---------- */
vi.mock("react-icons/fi", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid={`fi-${name}`} {...props} />
  );
  return {
    FiSearch: Icon("search"),
    FiInfo: Icon("info"),
    FiLoader: Icon("loader"),
  };
});

/* ---------- mock Document child component ---------- */
vi.mock("@/features/document/components/Document", () => ({
  Document: ({ documento }: { documento: DocumentoGiurisprudenziale }) => (
    <div data-testid="mock-document-item">
      <span>{documento.id}</span>
      {documento.numero_sentenza && <span>{documento.numero_sentenza}</span>}
    </div>
  ),
}));

/* ---------- mock framer-motion in JSX puro ---------- */
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    div: ({
      children,
      className,
      onClick,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & { [key: string]: unknown }) => (
      <div className={className} onClick={onClick} {...props}>
        {children}
      </div>
    ),
  },
}));

/* ---------- component ---------- */
import { VectorSearchResults } from "@/features/profile/components/VectorSearchResults"; // <-- adegua il path se necessario

describe("VectorSearchResults Component Suite", () => {
  const mockHandleVectorSearch = vi.fn<() => void>();
  const mockHandleClick = vi.fn<(doc: DocumentoGiurisprudenziale) => void>();

  const dummyMatches: DocumentoGiurisprudenziale[] = [
    {
      id: "doc-cass-01",
      numero_documento: "Cass. Civ. 1234/2026",
    } as unknown as DocumentoGiurisprudenziale,
    {
      id: "doc-cass-02",
      numero_documento: "Cass. Civ. 5678/2026",
    } as unknown as DocumentoGiurisprudenziale,
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = (
    props: Partial<React.ComponentProps<typeof VectorSearchResults>> = {}
  ) => {
    const defaultProps: React.ComponentProps<typeof VectorSearchResults> = {
      hasMassima: true,
      hasFattispecie: false,
      isSearchingVector: false,
      hasSearched: false,
      visibleAllMatches: [],
      handleVectorSearch: mockHandleVectorSearch,
      handleClick: mockHandleClick,
      ...props,
    };

    return render(<VectorSearchResults {...defaultProps} />);
  };

  test("non renderizza la sezione di ricerca se sia hasMassima che hasFattispecie sono false", () => {
    renderComponent({ hasMassima: false, hasFattispecie: false });

    expect(screen.queryByRole("heading", { name: "Cerca nella banca dati" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Cerca documenti analoghi" })).toBeNull();
  });

  test("renderizza la barra di ricerca quando hasMassima o hasFattispecie è true e gestisce il click", () => {
    renderComponent({ hasMassima: false, hasFattispecie: true });

    expect(screen.getByRole("heading", { name: "Cerca nella banca dati", level: 3 })).toBeInTheDocument();
    expect(
      screen.getByText("Sfrutta l'Intelligenza Artificiale per trovare provvedimenti archiviati con tematiche simili a questo documento.")
    ).toBeInTheDocument();

    const searchBtn = screen.getByRole("button", { name: "Cerca documenti analoghi" });
    expect(searchBtn).toBeEnabled();

    expect(screen.getAllByTestId("fi-search")).toHaveLength(2);
    expect(within(searchBtn).getByTestId("fi-search")).toBeInTheDocument();

    fireEvent.click(searchBtn);
    expect(mockHandleVectorSearch).toHaveBeenCalledTimes(1);
  });

  test("mostra lo stato di caricamento con spinner e disabilita il pulsante quando isSearchingVector è true", () => {
    renderComponent({ isSearchingVector: true });

    const searchBtn = screen.getByRole("button", { name: "Cerca documenti analoghi" });
    expect(searchBtn).toBeDisabled();

    expect(screen.getByText("Ricerca nel database in corso...")).toBeInTheDocument();
    expect(screen.getAllByTestId("fi-loader")).toHaveLength(2);
  });

  test("mostra lo stato 'Ricerca effettuata' e disabilita il pulsante quando hasSearched è true", () => {
    renderComponent({ hasSearched: true });

    const searchBtn = screen.getByRole("button", { name: "Cerca documenti analoghi" });
    expect(searchBtn).toBeDisabled();
    expect(screen.getByText("Ricerca effettuata")).toBeInTheDocument();
  });

  test("renderizza la lista dei risultati con il conteggio e gestisce il click sui singoli documenti", () => {
    renderComponent({
      hasSearched: true,
      isSearchingVector: false,
      visibleAllMatches: dummyMatches,
    });

    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText(/risultati/i)).toBeInTheDocument();

    const documentItems = screen.getAllByTestId("mock-document-item");
    expect(documentItems).toHaveLength(2);
    expect(screen.getByText("doc-cass-01")).toBeInTheDocument();
    expect(screen.getByText("doc-cass-02")).toBeInTheDocument();

    // Click sul primo elemento
    fireEvent.click(documentItems[0]);
    expect(mockHandleClick).toHaveBeenCalledTimes(1);
    expect(mockHandleClick).toHaveBeenCalledWith(dummyMatches[0]);
  });

  test("mostra lo stato vuoto (empty state) quando la ricerca è completata ma non ci sono risultati", () => {
    renderComponent({
      hasSearched: true,
      isSearchingVector: false,
      visibleAllMatches: [],
    });

    expect(screen.getByRole("heading", { name: "Nessun documento simile trovato", level: 4 })).toBeInTheDocument();
    expect(
      screen.getByText("Non ci sono documenti nel database che presentino una similarità sufficiente rispetto a questo documento.")
    ).toBeInTheDocument();
    expect(screen.getByTestId("fi-info")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-document-item")).toBeNull();
  });
});