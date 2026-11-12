import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
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
    ChevronDown: Icon("chevron-down"),
    Scale: Icon("scale"),
  };
});

/* ---------- mock Document component ---------- */
vi.mock("@/features/document/components/Document", () => ({
  Document: ({ documento }: { documento: { id: string; numero_documento?: string } }) => (
    <div data-testid={`mock-document-${documento.id}`}>
      {documento.numero_documento || documento.id}
    </div>
  ),
}));

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", () => {
  const MOTION_PROPS = ["initial", "animate", "exit", "transition", "whileHover", "whileTap"];
  const div = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement> & { [key: string]: unknown }) => {
    const domProps = Object.fromEntries(
      Object.entries(props).filter(([k]) => !MOTION_PROPS.includes(k))
    ) as React.HTMLAttributes<HTMLDivElement>;
    return <div {...domProps}>{children}</div>;
  };
  return {
    motion: { div },
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

/* ---------- component ---------- */
import { SearchResultsList } from "@/features/search/components/SearchResultsList";

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

  const makeDocs = (prefix: string, n: number): Ordinanza[] =>
    Array.from({ length: n }, (_, i) => ({ id: `${prefix}-${i}` }) as unknown as Ordinanza);

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
      hasSearched: true,
      effectiveTopMatches: dummyTopMatches,
      effectiveAllMatches: dummyAllMatches,
      visibleCount: 10,
      loading: false,
      isDbPaginatedMode: false,
      hasMoreDbResults: false,
      handleClick: mockHandleClick,
      handleLoadMore: mockHandleLoadMore,
      ...props,
    };

    return render(<SearchResultsList {...defaultProps} />);
  };

  const othersToggle = () =>
    within(screen.getByRole("heading", { name: /Altri risultati/i, level: 2 })).getByRole("button");

  /* ---------------- stati vuoti ---------------- */

  test("non renderizza nulla se non ci sono risultati e non è stata ancora fatta una ricerca", () => {
    const { container } = renderComponent({ totalResultsCount: 0, hasSearched: false });
    expect(container).toBeEmptyDOMElement();
  });

  test("mostra un messaggio quando una ricerca completata non restituisce risultati", () => {
    renderComponent({ totalResultsCount: 0, effectiveTopMatches: [], effectiveAllMatches: [] });
    expect(screen.getByRole("status")).toHaveTextContent("Nessun elemento trovato");
  });

  /* ---------------- risultati pertinenti ---------------- */

  test("mostra in primo piano i risultati pertinenti con il relativo conteggio e gestisce il click", () => {
    renderComponent();

    const heading = screen.getByRole("heading", { name: "Risultati pertinenti", level: 2 });
    expect(heading).toBeInTheDocument();
    expect(within(heading.closest("section")!).getByText("2 documenti")).toBeInTheDocument();
    expect(screen.getByTestId("mock-document-top-1")).toBeInTheDocument();
    expect(screen.getByTestId("mock-document-top-2")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mock-document-top-1"));
    expect(mockHandleClick).toHaveBeenCalledTimes(1);
    expect(mockHandleClick).toHaveBeenCalledWith(dummyTopMatches[0]);
  });

  test("specifica quando non ci sono risultati pertinenti", () => {
    renderComponent({ effectiveTopMatches: [], totalResultsCount: 2 });

    expect(screen.getByRole("status")).toHaveTextContent(
      /Nessun risultato pertinente trovato per questa ricerca/i
    );
    expect(screen.getByText(/corrispondenza più debole/i)).toBeInTheDocument();
    expect(screen.getByTestId("icon-info")).toBeInTheDocument();
  });

  test("non rimanda agli altri risultati se non ce ne sono", () => {
    renderComponent({ effectiveTopMatches: [], effectiveAllMatches: [], totalResultsCount: 0, loading: true });
    expect(screen.queryByText(/corrispondenza più debole/i)).toBeNull();
  });

  test("pagina i risultati pertinenti tramite handleLoadMore", () => {
    renderComponent({
      effectiveTopMatches: makeDocs("top", 12),
      effectiveAllMatches: [],
      totalResultsCount: 12,
      visibleCount: 10,
    });

    expect(screen.getByTestId("mock-document-top-9")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-document-top-10")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Mostra altri risultati pertinenti" }));
    expect(mockHandleLoadMore).toHaveBeenCalledTimes(1);
  });

  /* ---------------- altri risultati ---------------- */

  test("la sezione 'Altri risultati' è chiusa di default quando ci sono risultati pertinenti", () => {
    renderComponent();

    const toggle = othersToggle();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("mock-document-sem-1")).toBeNull();

    fireEvent.click(toggle);

    expect(othersToggle()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("mock-document-sem-1")).toBeInTheDocument();
    expect(screen.getByTestId("mock-document-sem-2")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mock-document-sem-1"));
    expect(mockHandleClick).toHaveBeenCalledWith(dummyAllMatches[0]);
  });

  test("la sezione 'Altri risultati' è aperta di default quando non ci sono risultati pertinenti", () => {
    renderComponent({ effectiveTopMatches: [], totalResultsCount: 2 });

    expect(othersToggle()).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("mock-document-sem-1")).toBeInTheDocument();
  });

  test("non mostra la sezione 'Altri risultati' se è vuota", () => {
    renderComponent({ effectiveAllMatches: [], totalResultsCount: 2 });
    expect(screen.queryByRole("heading", { name: /Altri risultati/i })).toBeNull();
  });

  test("pagina gli altri risultati localmente, senza chiamare handleLoadMore", () => {
    renderComponent({
      effectiveTopMatches: [],
      effectiveAllMatches: makeDocs("sem", 15),
      totalResultsCount: 15,
    });

    expect(screen.getByTestId("mock-document-sem-9")).toBeInTheDocument();
    expect(screen.queryByTestId("mock-document-sem-10")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Mostra altri risultati" }));

    expect(screen.getByTestId("mock-document-sem-14")).toBeInTheDocument();
    expect(mockHandleLoadMore).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Mostra altri risultati" })).toBeNull();
  });

  /* ---------------- riferimento normativo ---------------- */

  const normaHeading = () =>
    screen.queryByRole("heading", { name: /Per riferimento normativo/i, level: 2 });

  test("non mostra la sezione normativa se il filtro non è attivo", () => {
    renderComponent();
    expect(normaHeading()).toBeNull();
  });

  test("mostra i risultati normativi in una sezione dedicata, tra pertinenti e altri risultati", () => {
    const normaDocs = [{ id: "norma-1" }, { id: "norma-2" }] as unknown as Ordinanza[];
    renderComponent({
      normativaMatch: { query: "art. 2051 c.c.", keys: ["cc|art:2051"], docs: normaDocs },
      totalResultsCount: 6,
    });

    const heading = normaHeading()!;
    const section = heading.closest("section")!;
    expect(within(section).getByText("2 documenti")).toBeInTheDocument();
    expect(within(section).getByTestId("mock-document-norma-1")).toBeInTheDocument();

    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings[0]).toMatch(/Risultati pertinenti/);
    expect(headings[1]).toMatch(/Per riferimento normativo/);
    expect(headings[2]).toMatch(/Altri risultati/);

    fireEvent.click(screen.getByTestId("mock-document-norma-2"));
    expect(mockHandleClick).toHaveBeenCalledWith(normaDocs[1]);
  });

  test("segnala quando nella ricerca non è riconosciuto alcun riferimento normativo", () => {
    renderComponent({ normativaMatch: { query: "danno da cose in custodia", keys: [], docs: [] } });

    const section = normaHeading()!.closest("section")!;
    expect(within(section).getByRole("note")).toHaveTextContent(
      /Nessun riferimento normativo riconosciuto in "danno da cose in custodia"/
    );
  });

  test("segnala quando nessuna pronuncia cita la norma indicata", () => {
    renderComponent({ normativaMatch: { query: "art. 9999 c.c.", keys: ["cc|art:9999"], docs: [] } });

    const section = normaHeading()!.closest("section")!;
    expect(within(section).getByRole("note")).toHaveTextContent(/Nessuna pronuncia trovata/);
  });

  test("mostra la sezione normativa anche quando non ci sono altri risultati", () => {
    renderComponent({
      totalResultsCount: 0,
      effectiveTopMatches: [],
      effectiveAllMatches: [],
      normativaMatch: { query: "art. 9999 c.c.", keys: ["cc|art:9999"], docs: [] },
    });

    expect(screen.getByRole("status")).toHaveTextContent("Nessun elemento trovato");
    expect(normaHeading()).toBeInTheDocument();
  });

  test("pagina localmente i risultati normativi", () => {
    renderComponent({
      effectiveAllMatches: [],
      normativaMatch: { query: "art. 2051 c.c.", keys: ["cc|art:2051"], docs: makeDocs("norma", 13) },
      totalResultsCount: 15,
    });

    expect(screen.queryByTestId("mock-document-norma-10")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Mostra altre pronunce per norma" }));
    expect(screen.getByTestId("mock-document-norma-12")).toBeInTheDocument();
    expect(mockHandleLoadMore).not.toHaveBeenCalled();
  });

  /* ---------------- navigazione per filtri (senza testo) ---------------- */

  test("senza testo di ricerca mostra una lista unica senza intestazioni di sezione", () => {
    renderComponent({
      isSearching: false,
      effectiveTopMatches: [],
      effectiveAllMatches: dummyAllMatches,
      totalResultsCount: 2,
    });

    expect(screen.getByText("2 documenti trovati")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Risultati pertinenti" })).toBeNull();
    expect(screen.queryByRole("heading", { name: /Altri risultati/i })).toBeNull();
    expect(screen.getByTestId("mock-document-sem-1")).toBeInTheDocument();
  });

  test("senza testo di ricerca mostra il pulsante di caricamento quando il DB ha altri risultati", () => {
    renderComponent({
      isSearching: false,
      effectiveTopMatches: [],
      effectiveAllMatches: dummyAllMatches,
      totalResultsCount: 2,
      isDbPaginatedMode: true,
      hasMoreDbResults: true,
    });

    fireEvent.click(screen.getByRole("button", { name: "Mostra altri risultati" }));
    expect(mockHandleLoadMore).toHaveBeenCalledTimes(1);
  });

  test("senza testo di ricerca disabilita il pulsante e mostra lo spinner durante il caricamento", () => {
    renderComponent({
      isSearching: false,
      effectiveTopMatches: [],
      effectiveAllMatches: dummyAllMatches,
      totalResultsCount: 2,
      isDbPaginatedMode: true,
      hasMoreDbResults: true,
      loading: true,
    });

    const loadingBtn = screen.getByRole("button", { name: /Caricamento…/i });
    expect(loadingBtn).toBeDisabled();
    expect(screen.getByTestId("icon-loader-2")).toBeInTheDocument();
  });

  test("senza testo di ricerca nasconde il pulsante se tutto è visibile e il DB non ha altri dati", () => {
    renderComponent({
      isSearching: false,
      effectiveTopMatches: [],
      effectiveAllMatches: dummyAllMatches,
      totalResultsCount: 2,
    });

    expect(screen.queryByRole("button", { name: /Mostra altri risultati/i })).toBeNull();
  });
});
