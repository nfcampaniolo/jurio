import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import type { SortBy } from "@/hooks/searchBarTypes";

/* ---------- mock types & searchBarTypes ---------- */
vi.mock("@/hooks/searchBarTypes", () => ({
  CORTI_SUPREME: ["Cassazione Civile", "Cassazione Penale", "Consiglio di Stato"],
  TIPI_MASSIMA: ["CONFORME", "DIFFORME"],
  SEZIONI_CASSAZIONE_CIVILE: ["SEZ_1", "SEZ_2"],
  SEZIONI_CASSAZIONE_PENALE: ["SEZ_PEN_1"],
  SEZIONI_CONSIGLIO_DI_STATO: ["CDS_1"],
  SORT_OPTIONS: ["pertinenza", "data_asc", "data_desc"],
  SORT_LABEL: {
    pertinenza: "Pertinenza",
    data_asc: "Meno Recenti",
    data_desc: "Più Recenti",
  },
  TIPO_DOCUMENTI: ["Sentenza", "Ordinanza", "Decreto"],
  isTipoMassima: (v: string) => ["CONFORME", "DIFFORME"].includes(v),
  isSortBy: (v: string) => ["pertinenza", "data_asc", "data_desc"].includes(v),
  isSezioneCorte: (v: string) => ["SEZ_1", "SEZ_2", "SEZ_PEN_1", "CDS_1"].includes(v),
  isGradoGiudizio: (v: string) => ["Cassazione Civile", "Cassazione Penale", "Consiglio di Stato"].includes(v),
}));

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement> & { size?: number }) => (
    <svg data-testid={`icon-${name}`} {...props} />
  );
  return {
    Trash2: Icon("trash-2"),
    ChevronDown: Icon("chevron-down"),
  };
});

/* ---------- component ---------- */
import { SearchFilters } from "@/components/Search/SearchFilters"; // <-- adegua il path se necessario

describe("SearchFilters Component Suite", () => {
  const mockSetFilterGrado = vi.fn<(val: string) => void>();
  const mockSetFilterSezione = vi.fn<(val: string) => void>();
  const mockSetFilterTipo = vi.fn<(val: string) => void>();
  const mockSetFilterTipologia = vi.fn<(val: string) => void>();
  const mockSetSortBy = vi.fn<(val: SortBy) => void>();
  const mockSetnumberPages = vi.fn<(val: number) => void>();
  const mockSetStartDate = vi.fn<(val: string) => void>();
  const mockSetEndDate = vi.fn<(val: string) => void>();
  const mockClearFilters = vi.fn<() => void>();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderFilters = (props: Partial<React.ComponentProps<typeof SearchFilters>> = {}) => {
    const defaultProps: React.ComponentProps<typeof SearchFilters> = {
      loading: false,
      filterGrado: "",
      setFilterGrado: mockSetFilterGrado,
      filterSezione: "",
      setFilterSezione: mockSetFilterSezione,
      filterTipo: "",
      setFilterTipo: mockSetFilterTipo,
      filterTipologia: "",
      setFilterTipologia: mockSetFilterTipologia,
      sortBy: "pertinenza" as SortBy,
      setSortBy: mockSetSortBy,
      numberPages: 15,
      setnumberPages: mockSetnumberPages,
      startDate: "",
      setStartDate: mockSetStartDate,
      endDate: "",
      setEndDate: mockSetEndDate,
      clearFilters: mockClearFilters,
      ...props,
    };

    return render(<SearchFilters {...defaultProps} />);
  };

  test("renderizza tutti i selettori base, i campi data e il campo n. risultati", () => {
    renderFilters();

    expect(screen.getByLabelText("Corte suprema")).toBeInTheDocument();
    expect(screen.getByLabelText("Tipo massima")).toBeInTheDocument();
    expect(screen.getByLabelText("Tipo documento")).toBeInTheDocument();
    expect(screen.getByLabelText("Ordina")).toBeInTheDocument();

    expect(screen.getByLabelText("N. risultati")).toHaveValue(15);
    expect(screen.getByLabelText("Dal")).toBeInTheDocument();
    expect(screen.getByLabelText("Al")).toBeInTheDocument();
    
    // Nessun filtro sezione visualizzato inizialmente
    expect(screen.queryByLabelText("Sezione")).toBeNull();
  });

  test("mostra e formatta correttamente le opzioni delle sezioni in base al grado (Cassazione Civile)", () => {
    renderFilters({ filterGrado: "Cassazione Civile" });

    const filterSezione = screen.getByLabelText("Sezione");
    expect(filterSezione).toBeInTheDocument();

    expect(screen.getByText("Sez_1")).toBeInTheDocument();
    expect(screen.getByText("Sez_2")).toBeInTheDocument();
  });

  test("mostra e formatta correttamente le opzioni delle sezioni (Consiglio di Stato)", () => {
    renderFilters({ filterGrado: "Consiglio di Stato" });

    expect(screen.getByLabelText("Sezione")).toBeInTheDocument();
    expect(screen.getByText("Cds_1")).toBeInTheDocument();
  });

  test("gestisce il cambio di grado, aggiornando grado e azzerando la sezione precedente", () => {
    renderFilters();

    const gradoSelect = screen.getByLabelText("Corte suprema");
    fireEvent.change(gradoSelect, { target: { value: "Cassazione Penale" } });

    expect(mockSetFilterGrado).toHaveBeenCalledWith("Cassazione Penale");
    expect(mockSetFilterSezione).toHaveBeenCalledWith("");
  });

  test("azzera grado e sezione quando si seleziona 'Tutte le corti' (valore vuoto)", () => {
    renderFilters({ filterGrado: "Cassazione Civile", filterSezione: "SEZ_1" });

    const gradoSelect = screen.getByLabelText("Corte suprema");
    fireEvent.change(gradoSelect, { target: { value: "" } });

    expect(mockSetFilterGrado).toHaveBeenCalledWith("");
    expect(mockSetFilterSezione).toHaveBeenCalledWith("");
  });

  test("gestisce il cambio di sezione validando l'input", () => {
    renderFilters({ filterGrado: "Cassazione Civile" });

    const sezioneSelect = screen.getByLabelText("Sezione");
    
    // Selezione valida
    fireEvent.change(sezioneSelect, { target: { value: "SEZ_1" } });
    expect(mockSetFilterSezione).toHaveBeenCalledWith("SEZ_1");

    // Azzeramento
    fireEvent.change(sezioneSelect, { target: { value: "" } });
    expect(mockSetFilterSezione).toHaveBeenCalledWith("");
  });

  test("gestisce il cambio tipo massima, tipologia e ordinamento", () => {
    renderFilters();

    const tipoSelect = screen.getByLabelText("Tipo massima");
    fireEvent.change(tipoSelect, { target: { value: "CONFORME" } });
    expect(mockSetFilterTipo).toHaveBeenCalledWith("CONFORME");

    const tipologiaSelect = screen.getByLabelText("Tipo documento");
    fireEvent.change(tipologiaSelect, { target: { value: "Ordinanza" } });
    expect(mockSetFilterTipologia).toHaveBeenCalledWith("Ordinanza");

    const sortSelect = screen.getByLabelText("Ordina");
    fireEvent.change(sortSelect, { target: { value: "data_desc" } });
    expect(mockSetSortBy).toHaveBeenCalledWith("data_desc");
  });

  test("gestisce l'input del numero di risultati (numberPages) inclusi i limiti di validazione onBlur", () => {
    renderFilters();

    const numInput = screen.getByLabelText("N. risultati");

    // Modifica diretta
    fireEvent.change(numInput, { target: { value: "20" } });
    expect(mockSetnumberPages).toHaveBeenCalledWith(20);

    // Azzeramento input
    fireEvent.change(numInput, { target: { value: "" } });
    expect(mockSetnumberPages).toHaveBeenCalledWith(0);

    // Blur sotto limite minimo (imposta 10)
    fireEvent.blur(numInput, { target: { value: "5" } });
    expect(mockSetnumberPages).toHaveBeenCalledWith(10);

    // Blur sopra limite massimo (imposta 40)
    fireEvent.blur(numInput, { target: { value: "50" } });
    expect(mockSetnumberPages).toHaveBeenCalledWith(40);
  });

  test("gestisce i campi data e propaga il min alla data finale", () => {
    renderFilters({ startDate: "2026-01-01" });

    const startInput = screen.getByLabelText("Dal");
    const endInput = screen.getByLabelText("Al");

    expect(endInput).toHaveAttribute("min", "2026-01-01");

    fireEvent.change(startInput, { target: { value: "2026-06-01" } });
    expect(mockSetStartDate).toHaveBeenCalledWith("2026-06-01");

    fireEvent.change(endInput, { target: { value: "2026-12-31" } });
    expect(mockSetEndDate).toHaveBeenCalledWith("2026-12-31");
  });

  test("mostra il pulsante 'Resetta filtri' se c'è almeno un filtro attivo e lo invoca al click", () => {
    const { rerender } = renderFilters();
    expect(screen.queryByRole("button", { name: /Resetta filtri/i })).toBeNull();

    rerender(
      <SearchFilters
        loading={false}
        filterGrado="Cassazione Civile"
        setFilterGrado={mockSetFilterGrado}
        filterSezione=""
        setFilterSezione={mockSetFilterSezione}
        filterTipo=""
        setFilterTipo={mockSetFilterTipo}
        filterTipologia=""
        setFilterTipologia={mockSetFilterTipologia}
        sortBy="relevance"
        setSortBy={mockSetSortBy}
        numberPages={15}
        setnumberPages={mockSetnumberPages}
        startDate=""
        setStartDate={mockSetStartDate}
        endDate=""
        setEndDate={mockSetEndDate}
        clearFilters={mockClearFilters}
      />
    );

    const resetBtn = screen.getByRole("button", { name: /Resetta filtri/i });
    expect(resetBtn).toBeInTheDocument();

    fireEvent.click(resetBtn);
    expect(mockClearFilters).toHaveBeenCalledTimes(1);
  });

  test("disabilita tutti gli input e filtri se loading è true", () => {
    renderFilters({ loading: true, filterGrado: "Cassazione Civile" });

    expect(screen.getByLabelText("Corte suprema")).toBeDisabled();
    expect(screen.getByLabelText("Sezione")).toBeDisabled();
    expect(screen.getByLabelText("Tipo massima")).toBeDisabled();
    expect(screen.getByLabelText("Tipo documento")).toBeDisabled();
    expect(screen.getByLabelText("Ordina")).toBeDisabled();

    expect(screen.getByLabelText("N. risultati")).toBeDisabled();
    expect(screen.getByLabelText("Dal")).toBeDisabled();
    expect(screen.getByLabelText("Al")).toBeDisabled();
  });
});