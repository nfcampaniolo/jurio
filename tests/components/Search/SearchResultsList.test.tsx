import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import type { Sentenza, Ordinanza } from "@/interfaces/interfaces";

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid={`icon-${name}`} {...props} />
  );
  return {
    Info: Icon("info"),
    Loader2: Icon("loader-2"),
  };
});

/* ---------- mock Document component ---------- */
vi.mock("../Document/Document", () => ({
  Document: ({ documento }: { documento: { id: string; numero_documento?: string } }) => (
    <div data-testid={`mock-document-${documento.id}`}>
      {documento.numero_documento || documento.id}
    </div>
  ),
}));

vi.mock("@/components/Document/Document", () => ({
  Document: ({ documento }: { documento: { id: string; numero_documento?: string } }) => (
    <div data-testid={`mock-document-${documento.id}`}>
      {documento.numero_documento || documento.id}
    </div>
  ),
}));

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", () => ({
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
import { SearchResultsList } from "@/components/Search/SearchResultsList"; // <-- adegua il path se necessario

describe("SearchResultsList Component Suite", () => {
  const mockHandleClick = vi.fn();
  const mockHandleLoadMore = vi.fn();

  const dummyTopMatches: Sentenza[] = [
    { id: "top-1", numero_documento: "Cass. 100/2026" } as unknown as Sentenza,
    { id: "top-2", numero_documento: "Cass. 101/2026" } as unknown as Sentenza,
  ];

  const dummyAllMatches: Ordinanza[] = [
    { id: "sem-1", numero_documento: "Ord. 200/2026" } as unknown as Ordinanza,
    { id: "sem-2", numero_documento: "Ord. 201/2026" } as unknown as Ordinanza,
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderComponent = (
    props: Partial<React.ComponentProps<typeof SearchResultsList>> = {}
  ) => {
    const defaultProps: React.ComponentProps<typeof SearchResultsList> = {
      totalResultsCount: 4,
      isSearching: true,
      effectiveTopMatches: dummyTopMatches,
      effectiveAllMatches: dummyAllMatches,
      visibleTopMatches: dummyTopMatches,
      visibleAllMatches: dummyAllMatches,
      visibleCount: 4,
      loading: false,
      isDbPaginatedMode: false,
      hasMoreDbResults: false,
      handleClick: mockHandleClick,
      handleLoadMore: mockHandleLoadMore,
      ...props,
    };

    return render(<SearchResultsList {...defaultProps} />);
  };

  test("non renderizza nulla se totalResultsCount è 0 e loading è false", () => {
    const { container } = renderComponent({ totalResultsCount: 0, loading: false });
    expect(container).toBeEmptyDOMElement();
  });

  test("renderizza il conteggio dei documenti trovati se totalResultsCount > 0", () => {
    renderComponent({ totalResultsCount: 4 });
    expect(screen.getByText("4 documenti trovati")).toBeInTheDocument();
  });

  test("renderizza le corrispondenze testuali esatte e gestisce il click sul documento", () => {
    renderComponent({ isSearching: true });

    expect(
      screen.getByRole("heading", { name: "Corrispondenze testuali esatte", level: 2 })
    ).toBeInTheDocument();
    expect(screen.getByTestId("mock-document-top-1")).toBeInTheDocument();
    expect(screen.getByTestId("mock-document-top-2")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mock-document-top-1"));
    expect(mockHandleClick).toHaveBeenCalledTimes(1);
    expect(mockHandleClick).toHaveBeenCalledWith(dummyTopMatches[0]);
  });

  test("mostra il box di avviso quando isSearching è true ma non ci sono corrispondenze esatte", () => {
    renderComponent({
      isSearching: true,
      effectiveTopMatches: [],
      visibleTopMatches: [],
    });

    expect(
      screen.getByText(/Nessun risultato esatto o categoria specifica trovata per questa ricerca/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Verifica le corrispondenze semantiche nella sezione qui sotto/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId("icon-info")).toBeInTheDocument();
  });

  test("renderizza la sezione 'Correlazione Semantica' quando isSearching è true e ci sono match semantici", () => {
    renderComponent({ isSearching: true });

    expect(
      screen.getByRole("heading", { name: "Correlazione Semantica", level: 2 })
    ).toBeInTheDocument();
    expect(screen.getByTestId("mock-document-sem-1")).toBeInTheDocument();
    expect(screen.getByTestId("mock-document-sem-2")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mock-document-sem-1"));
    expect(mockHandleClick).toHaveBeenCalledWith(dummyAllMatches[0]);
  });

  test("non mostra le intestazioni di ricerca quando isSearching è false ma mostra comunque i documenti", () => {
    renderComponent({
      isSearching: false,
      effectiveTopMatches: [],
      visibleTopMatches: [],
      effectiveAllMatches: dummyAllMatches,
      visibleAllMatches: dummyAllMatches,
    });

    expect(screen.queryByRole("heading", { name: "Corrispondenze testuali esatte" })).toBeNull();
    expect(screen.queryByRole("heading", { name: "Correlazione Semantica" })).toBeNull();
    expect(screen.getByTestId("mock-document-sem-1")).toBeInTheDocument();
  });

  test("mostra il pulsante 'Mostra altri risultati' quando visibleCount < totalResultsCount e gestisce il click", () => {
    renderComponent({
      totalResultsCount: 10,
      visibleCount: 4,
    });

    const loadMoreBtn = screen.getByRole("button", { name: "Mostra altri risultati" });
    expect(loadMoreBtn).toBeInTheDocument();

    fireEvent.click(loadMoreBtn);
    expect(mockHandleLoadMore).toHaveBeenCalledTimes(1);
  });

  test("mostra il pulsante di caricamento quando isDbPaginatedMode e hasMoreDbResults sono true", () => {
    renderComponent({
      totalResultsCount: 4,
      visibleCount: 4,
      isDbPaginatedMode: true,
      hasMoreDbResults: true,
    });

    expect(screen.getByRole("button", { name: "Mostra altri risultati" })).toBeInTheDocument();
  });

  test("disabilita il pulsante e mostra lo spinner quando loading è true", () => {
    renderComponent({
      totalResultsCount: 10,
      visibleCount: 4,
      loading: true,
    });

    const loadingBtn = screen.getByRole("button", { name: /Caricamento…/i });
    expect(loadingBtn).toBeDisabled();
    expect(screen.getByTestId("icon-loader-2")).toBeInTheDocument();
  });

  test("nasconde il pulsante di paginazione se tutti i risultati sono visibili e non ci sono altri dati dal DB", () => {
    renderComponent({
      totalResultsCount: 4,
      visibleCount: 4,
      isDbPaginatedMode: false,
      hasMoreDbResults: false,
    });

    expect(screen.queryByRole("button", { name: /Mostra altri risultati/i })).toBeNull();
  });
});