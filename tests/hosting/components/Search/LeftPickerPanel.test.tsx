import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

/* ---------- hoisted mocks ---------- */
const { mockOnClose, mockRunSearch, mockSetSearchInput, mockSetItems } = vi.hoisted(() => ({
  mockOnClose: vi.fn(),
  mockRunSearch: vi.fn().mockResolvedValue(undefined),
  mockSetSearchInput: vi.fn(),
  mockSetItems: vi.fn(),
}));

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", () => ({
  __esModule: true,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    aside: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => (
      <aside {...props}>{children}</aside>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => ({
  X: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-x" {...props} />,
  Search: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-search" {...props} />,
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-loader" {...props} />,
  Info: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-info" {...props} />,
}));

/* ---------- mock @tanstack/react-virtual ---------- */
vi.mock("@tanstack/react-virtual", () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getTotalSize: () => count * 40,
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: index,
        start: index * 40,
        size: 40,
      })),
  }),
}));

/* ---------- mock interfaces AREE ---------- */
vi.mock("@/interfaces/interfaces", () => ({
  AREE: {
    AREA_1: "Diritto Costituzionale e Parlamentare",
    AREA_2: "Diritto Penale Sostanziale",
    AREA_3: "Diritto Civile - Famiglia, Persone e Minori",
  },
}));

/* ---------- helper for week number matching cache tests ---------- */
const getTestWeekNumber = (date: Date): string => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
};

/* ---------- subject under test ---------- */
import { LeftPickerPanel } from "@/features/search/components/LeftPickerPanel";

describe("LeftPickerPanel Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.spyOn(Storage.prototype, "setItem");
    vi.spyOn(Storage.prototype, "getItem");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  test("non renderizza nulla quando open è false", () => {
    const { container } = render(
      <LeftPickerPanel
        open={false}
        onClose={mockOnClose}
        setSearchInput={mockSetSearchInput}
        runSearch={mockRunSearch}
        items={[]}
        loadingItems={false}
        errorItems={null}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  test("renderizza il pannello con la tab 'Aree' attiva di default e la lista delle materie", () => {
    render(
      <LeftPickerPanel
        open={true}
        onClose={mockOnClose}
        setSearchInput={mockSetSearchInput}
        runSearch={mockRunSearch}
        items={[]}
        loadingItems={false}
        errorItems={null}
      />
    );

    expect(screen.getByText("Filtra per argomento")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Aree/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Sottocategorie$/i })).toBeInTheDocument();
    expect(screen.getByText(/Diritto Costituzionale/i)).toBeInTheDocument();
  });

  test("chiude il pannello cliccando sul pulsante di chiusura X o sul backdrop", () => {
    const { container } = render(
      <LeftPickerPanel
        open={true}
        onClose={mockOnClose}
        setSearchInput={mockSetSearchInput}
        runSearch={mockRunSearch}
        items={[]}
        loadingItems={false}
        errorItems={null}
      />
    );

    const closeBtn = screen.getByTestId("icon-x").closest("button")!;
    fireEvent.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    const backdrop = container.querySelector(".bg-black\\/60")!;
    fireEvent.click(backdrop);
    expect(mockOnClose).toHaveBeenCalledTimes(2);
  });

  test("permette di passare alla tab Sottocategorie visualizzando i relativi elementi", async () => {
    render(
      <LeftPickerPanel
        open={true}
        onClose={mockOnClose}
        setSearchInput={mockSetSearchInput}
        runSearch={mockRunSearch}
        items={["Sub 1", "Sub 2"]}
        loadingItems={false}
        errorItems={null}
      />
    );

    const subTab = screen.getByRole("button", { name: /^Sottocategorie$/i });
    fireEvent.click(subTab);

    expect(screen.getByText("Sub 1")).toBeInTheDocument();
    expect(screen.getByText("Sub 2")).toBeInTheDocument();
  });

  test("filtra dinamicamente la lista in base al termine di ricerca inserito", async () => {
    render(
      <LeftPickerPanel
        open={true}
        onClose={mockOnClose}
        setSearchInput={mockSetSearchInput}
        runSearch={mockRunSearch}
        items={[]}
        loadingItems={false}
        errorItems={null}
      />
    );

    const input = screen.getByPlaceholderText("Cerca area…");
    fireEvent.change(input, { target: { value: "Penale" } });

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Diritto Penale Sostanziale/i })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Diritto Costituzionale/i })).not.toBeInTheDocument();
    });
  });

  test("mostra lo stato vuoto 'Nessun risultato.' quando il filtro non trova corrispondenze", async () => {
    render(
      <LeftPickerPanel
        open={true}
        onClose={mockOnClose}
        setSearchInput={mockSetSearchInput}
        runSearch={mockRunSearch}
        items={[]}
        loadingItems={false}
        errorItems={null}
      />
    );

    const input = screen.getByPlaceholderText("Cerca area…");
    fireEvent.change(input, { target: { value: "xyznonesistente999" } });

    await waitFor(() => {
      expect(screen.getByText(/Nessun risultato/i)).toBeInTheDocument();
    });
  });

  test("seleziona un argomento al click: chiude il pannello, aggiorna l'input ed esegue la ricerca", async () => {
    render(
      <LeftPickerPanel
        open={true}
        onClose={mockOnClose}
        setSearchInput={mockSetSearchInput}
        runSearch={mockRunSearch}
        items={[]}
        loadingItems={false}
        errorItems={null}
      />
    );

    const areaBtn = screen.getByRole("button", { name: /Diritto Penale Sostanziale/i });
    fireEvent.click(areaBtn);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
    expect(mockSetSearchInput).toHaveBeenCalledWith("Diritto Penale Sostanziale");
    expect(mockRunSearch).toHaveBeenCalledWith("Diritto Penale Sostanziale");
  });

  test("mostra lo stato di caricamento nella tab Sottocategorie quando loadingItems è true", () => {
    render(
      <LeftPickerPanel
        open={true}
        onClose={mockOnClose}
        setSearchInput={mockSetSearchInput}
        runSearch={mockRunSearch}
        items={[]}
        loadingItems={true}
        errorItems={null}
      />
    );

    const subTab = screen.getByRole("button", { name: /^Sottocategorie$/i });
    fireEvent.click(subTab);

    expect(screen.getAllByText("Caricamento…").length).toBeGreaterThan(0);
    expect(screen.getByTestId("icon-loader")).toBeInTheDocument();
  });

  test("mostra il messaggio di errore nella tab Sottocategorie quando errorItems è presente", () => {
    render(
      <LeftPickerPanel
        open={true}
        onClose={mockOnClose}
        setSearchInput={mockSetSearchInput}
        runSearch={mockRunSearch}
        items={[]}
        loadingItems={false}
        errorItems="Impossibile caricare le sottocategorie"
      />
    );

    const subTab = screen.getByRole("button", { name: /^Sottocategorie$/i });
    fireEvent.click(subTab);

    expect(screen.getByText("Impossibile caricare le sottocategorie")).toBeInTheDocument();
  });

  test("disabilita tutti gli elementi interattivi quando la prop disabled è true", () => {
    render(
      <LeftPickerPanel
        open={true}
        onClose={mockOnClose}
        disabled={true}
        setSearchInput={mockSetSearchInput}
        runSearch={mockRunSearch}
        items={[]}
        loadingItems={false}
        errorItems={null}
      />
    );

    const input = screen.getByPlaceholderText("Cerca area…");
    expect(input).toBeDisabled();
  });

  test("salva le sottocategorie in localStorage", () => {
    render(
      <LeftPickerPanel
        open={true}
        onClose={mockOnClose}
        setSearchInput={mockSetSearchInput}
        runSearch={mockRunSearch}
        items={["Sub A", "Sub B"]}
        loadingItems={false}
        errorItems={null}
        setItems={mockSetItems}
      />
    );

    expect(localStorage.setItem).toHaveBeenCalledWith(
      "jurio_sottocategorie_cache_v1",
      JSON.stringify(["Sub A", "Sub B"])
    );
  });

  test("recupera le sottocategorie dalla cache se la settimana corrente coincide", () => {
    const currentWeek = getTestWeekNumber(new Date());

    localStorage.setItem("jurio_sottocategorie_week_v1", currentWeek);
    localStorage.setItem("jurio_sottocategorie_cache_v1", JSON.stringify(["Cached Sub 1"]));

    render(
      <LeftPickerPanel
        open={true}
        onClose={mockOnClose}
        setSearchInput={mockSetSearchInput}
        runSearch={mockRunSearch}
        items={[]}
        loadingItems={false}
        errorItems={null}
        setItems={mockSetItems}
      />
    );

    expect(mockSetItems).toHaveBeenCalledWith(["Cached Sub 1"]);
  });
});