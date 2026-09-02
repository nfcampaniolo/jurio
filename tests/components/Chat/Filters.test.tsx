import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => {
  const Icon = (name: string) => (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid={`icon-${name}`} {...props} />
  );
  return {
    Sliders: Icon("sliders"),
    X: Icon("x"),
    Trash2: Icon("trash-2"),
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

/* ---------- mock searchBarTypes ---------- */
vi.mock("@/hooks/searchBarTypes", () => ({
  CORTI_SUPREME: [
    "Cassazione Civile",
    "Cassazione Penale",
    "Consiglio di Stato",
    "Corte Costituzionale",
  ] as const,
  SEZIONI_CASSAZIONE_CIVILE: [
    "sez un civ",
    "sezione prima civile",
    "sezione lavoro",
  ] as const,
  SEZIONI_CASSAZIONE_PENALE: [
    "sezione prima penale",
    "sez un pen",
  ] as const,
  SEZIONI_CONSIGLIO_DI_STATO: [
    "sezione giurisdizionale",
    "sez adunanza plenaria",
  ] as const,
  TIPI_MASSIMA: [
    "massima_ufficiale",
    "orientamento_maggioritario",
  ] as const,
  TIPO_DOCUMENTI: [
    "Sentenza",
    "Ordinanza",
    "Decreto",
  ] as const,
  isGradoGiudizio: (v: string) =>
    [
      "Cassazione Civile",
      "Cassazione Penale",
      "Consiglio di Stato",
      "Corte Costituzionale",
    ].includes(v),
  isSezioneCorte: (v: string) => v !== "",
  isTipoMassima: (v: string) =>
    ["massima_ufficiale", "orientamento_maggioritario"].includes(v),
}));

/* ---------- components ---------- */
import { FilterModal, FilterSelect, type FilterStateValues, type FilterStateSetters } from "@/components/Chat/Filters";

describe("Filters Component Suite", () => {
  const mockSetFilterGrado = vi.fn();
  const mockSetFilterSezione = vi.fn();
  const mockSetFilterTipo = vi.fn();
  const mockSetFilterTipologia = vi.fn();
  const mockSetStartDate = vi.fn();
  const mockSetEndDate = vi.fn();

  const mockOnClose = vi.fn();
  const mockClearFilters = vi.fn();

  const emptyFilterState: FilterStateValues = {
    filterGrado: "",
    filterSezione: "",
    filterTipo: "",
    filterTipologia: "",
    startDate: "",
    endDate: "",
  };

  const mockSetFilterState: FilterStateSetters = {
    setFilterGrado: mockSetFilterGrado,
    setFilterSezione: mockSetFilterSezione,
    setFilterTipo: mockSetFilterTipo,
    setFilterTipologia: mockSetFilterTipologia,
    setStartDate: mockSetStartDate,
    setEndDate: mockSetEndDate,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* -------------------------------------------------------------------------- */
  /* FilterSelect (Unit)                                                        */
  /* -------------------------------------------------------------------------- */
  test("FilterSelect renderizza label, id, opzioni e scatena onChange", () => {
    const mockOnChange = vi.fn();
    render(
      <FilterSelect id="test-select" label="Test Label" value="opt1" onChange={mockOnChange}>
        <option value="opt1">Opzione 1</option>
        <option value="opt2">Opzione 2</option>
      </FilterSelect>
    );

    expect(screen.getByLabelText("Test Label")).toBeInTheDocument();
    const select = screen.getByRole("combobox", { name: "Test Label" });
    expect(select).toHaveValue("opt1");

    fireEvent.change(select, { target: { value: "opt2" } });
    expect(mockOnChange).toHaveBeenCalledWith("opt2");
  });

  /* -------------------------------------------------------------------------- */
  /* FilterModal (Integration & Branch Coverage)                                */
  /* -------------------------------------------------------------------------- */
  test("non renderizza nulla quando isOpen è false", () => {
    render(
      <FilterModal
        isOpen={false}
        onClose={mockOnClose}
        loading={false}
        filterState={emptyFilterState}
        setFilterState={mockSetFilterState}
        clearFilters={mockClearFilters}
      />
    );

    expect(screen.queryByText("Filtri di Ricerca Avanzati")).not.toBeInTheDocument();
  });

  test("renderizza modalità aperta, header, pulsante di chiusura e bottone Applica Filtri", () => {
    render(
      <FilterModal
        isOpen={true}
        onClose={mockOnClose}
        loading={false}
        filterState={emptyFilterState}
        setFilterState={mockSetFilterState}
        clearFilters={mockClearFilters}
      />
    );

    expect(screen.getByRole("heading", { name: /Filtri di Ricerca Avanzati/i, level: 2 })).toBeInTheDocument();
    expect(screen.getByTestId("icon-sliders")).toBeInTheDocument();

    // Chiusura tramite X
    const closeBtn = screen.getByLabelText("Chiudi filtri");
    fireEvent.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    // Chiusura tramite "Applica Filtri"
    const applyBtn = screen.getByRole("button", { name: "Applica Filtri" });
    fireEvent.click(applyBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(2);
  });

  test("gestisce la selezione di Corte Suprema (filterGrado) e il reset a vuoto", () => {
    render(
      <FilterModal
        isOpen={true}
        onClose={mockOnClose}
        loading={false}
        filterState={emptyFilterState}
        setFilterState={mockSetFilterState}
        clearFilters={mockClearFilters}
      />
    );

    const gradoSelect = screen.getByRole("combobox", { name: "Corte suprema" });

    // 1. Selezione valida: Cassazione Civile
    fireEvent.change(gradoSelect, { target: { value: "Cassazione Civile" } });
    expect(mockSetFilterGrado).toHaveBeenCalledWith("Cassazione Civile");
    expect(mockSetFilterSezione).toHaveBeenCalledWith("");

    // 2. Reset a vuoto ""
    fireEvent.change(gradoSelect, { target: { value: "" } });
    expect(mockSetFilterGrado).toHaveBeenCalledWith("");
    expect(mockSetFilterSezione).toHaveBeenCalledWith("");
  });

  test("renderizza le sezioni per Cassazione Civile con formattazione testo e gestisce il cambio", () => {
    render(
      <FilterModal
        isOpen={true}
        onClose={mockOnClose}
        loading={false}
        filterState={{ ...emptyFilterState, filterGrado: "Cassazione Civile", filterSezione: "sez un civ" }}
        setFilterState={mockSetFilterState}
        clearFilters={mockClearFilters}
      />
    );

    // Verifica presenza del select Sezione
    const sezioneSelect = screen.getByRole("combobox", { name: "Sezione" });
    expect(sezioneSelect).toBeInTheDocument();

    // Verifica formattazione: "sez un civ" -> "SEZ UN CIV", "sezione prima civile" -> "Sezione Prima Civile"
    expect(screen.getByRole("option", { name: "SEZ UN CIV" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Sezione Prima Civile" })).toBeInTheDocument();

    // Cambio sezione valido
    fireEvent.change(sezioneSelect, { target: { value: "sezione prima civile" } });
    expect(mockSetFilterSezione).toHaveBeenCalledWith("sezione prima civile");

    // Reset sezione a vuoto ""
    fireEvent.change(sezioneSelect, { target: { value: "" } });
    expect(mockSetFilterSezione).toHaveBeenCalledWith("");
  });

  test("renderizza le sezioni per Cassazione Penale e Consiglio di Stato", () => {
    // 1. Cassazione Penale
    const { rerender } = render(
      <FilterModal
        isOpen={true}
        onClose={mockOnClose}
        loading={false}
        filterState={{ ...emptyFilterState, filterGrado: "Cassazione Penale" }}
        setFilterState={mockSetFilterState}
        clearFilters={mockClearFilters}
      />
    );

    expect(screen.getByRole("option", { name: "SEZ UN PEN" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Sezione Prima Penale" })).toBeInTheDocument();

    // 2. Consiglio di Stato
    rerender(
      <FilterModal
        isOpen={true}
        onClose={mockOnClose}
        loading={false}
        filterState={{ ...emptyFilterState, filterGrado: "Consiglio di Stato" }}
        setFilterState={mockSetFilterState}
        clearFilters={mockClearFilters}
      />
    );

    expect(screen.getByRole("option", { name: "Sezione Giurisdizionale" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "SEZ Adunanza Plenaria" })).toBeInTheDocument();

    // 3. Altro grado senza sezioni specifiche (es. Corte Costituzionale)
    rerender(
      <FilterModal
        isOpen={true}
        onClose={mockOnClose}
        loading={false}
        filterState={{ ...emptyFilterState, filterGrado: "Corte Costituzionale" }}
        setFilterState={mockSetFilterState}
        clearFilters={mockClearFilters}
      />
    );

    expect(screen.queryByRole("combobox", { name: "Sezione" })).not.toBeInTheDocument();
  });

  test("gestisce il cambio di 'Tipo massima' (filterTipo) e opzioni formattate", () => {
    render(
      <FilterModal
        isOpen={true}
        onClose={mockOnClose}
        loading={false}
        filterState={emptyFilterState}
        setFilterState={mockSetFilterState}
        clearFilters={mockClearFilters}
      />
    );

    const tipoSelect = screen.getByRole("combobox", { name: "Tipo massima" });

    // Verifica formattazione con underscore: "massima_ufficiale" -> "Massima Ufficiale"
    expect(screen.getByRole("option", { name: "Massima Ufficiale" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Orientamento Maggioritario" })).toBeInTheDocument();

    // Selezione valida
    fireEvent.change(tipoSelect, { target: { value: "massima_ufficiale" } });
    expect(mockSetFilterTipo).toHaveBeenCalledWith("massima_ufficiale");

    // Reset a ""
    fireEvent.change(tipoSelect, { target: { value: "" } });
    expect(mockSetFilterTipo).toHaveBeenCalledWith("");
  });

  test("gestisce il cambio di 'Tipo documento' (filterTipologia)", () => {
    render(
      <FilterModal
        isOpen={true}
        onClose={mockOnClose}
        loading={false}
        filterState={emptyFilterState}
        setFilterState={mockSetFilterState}
        clearFilters={mockClearFilters}
      />
    );

    const tipologiaSelect = screen.getByRole("combobox", { name: "Tipo documento" });
    fireEvent.change(tipologiaSelect, { target: { value: "Sentenza" } });
    expect(mockSetFilterTipologia).toHaveBeenCalledWith("Sentenza");
  });

  test("gestisce i campi data 'Dal' e 'Al' (startDate e endDate)", () => {
    const { container } = render(
      <FilterModal
        isOpen={true}
        onClose={mockOnClose}
        loading={false}
        filterState={{ ...emptyFilterState, startDate: "2026-01-01", endDate: "2026-12-31" }}
        setFilterState={mockSetFilterState}
        clearFilters={mockClearFilters}
      />
    );

    const dateInputs = container.querySelectorAll('input[type="date"]');
    const startDateInput = dateInputs[0];
    const endDateInput = dateInputs[1];

    expect(startDateInput).toHaveValue("2026-01-01");
    expect(endDateInput).toHaveValue("2026-12-31");
    expect(endDateInput).toHaveAttribute("min", "2026-01-01");

    fireEvent.change(startDateInput, { target: { value: "2026-03-01" } });
    expect(mockSetStartDate).toHaveBeenCalledWith("2026-03-01");

    fireEvent.change(endDateInput, { target: { value: "2026-09-01" } });
    expect(mockSetEndDate).toHaveBeenCalledWith("2026-09-01");
  });

  test("mostra il pulsante 'Resetta filtri' se almeno un filtro è attivo e invoca clearFilters", () => {
    // 1. Stato completamente vuoto -> Nessun pulsante di reset
    const { rerender } = render(
      <FilterModal
        isOpen={true}
        onClose={mockOnClose}
        loading={false}
        filterState={emptyFilterState}
        setFilterState={mockSetFilterState}
        clearFilters={mockClearFilters}
      />
    );

    expect(screen.queryByRole("button", { name: /Resetta filtri/i })).not.toBeInTheDocument();

    // 2. Almeno un filtro valorizzato (es. filterGrado)
    rerender(
      <FilterModal
        isOpen={true}
        onClose={mockOnClose}
        loading={false}
        filterState={{ ...emptyFilterState, filterGrado: "Cassazione Civile" }}
        setFilterState={mockSetFilterState}
        clearFilters={mockClearFilters}
      />
    );

    const resetBtn = screen.getByRole("button", { name: /Resetta filtri/i });
    expect(resetBtn).toBeInTheDocument();
    expect(screen.getByTestId("icon-trash-2")).toBeInTheDocument();

    fireEvent.click(resetBtn);
    expect(mockClearFilters).toHaveBeenCalledTimes(1);

    // 3. Copertura rami per gli altri filtri individuali
    const singleFilterBranches = [
      { filterSezione: "Lavoro" },
      { filterTipo: "massima_ufficiale" },
      { filterTipologia: "Sentenza" },
      { startDate: "2026-01-01" },
      { endDate: "2026-12-31" },
    ];

    singleFilterBranches.forEach((branchState) => {
      rerender(
        <FilterModal
          isOpen={true}
          onClose={mockOnClose}
          loading={false}
          filterState={{ ...emptyFilterState, ...branchState }}
          setFilterState={mockSetFilterState}
          clearFilters={mockClearFilters}
        />
      );
      expect(screen.getByRole("button", { name: /Resetta filtri/i })).toBeInTheDocument();
    });
  });

  test("disabilita tutti i controlli select e input quando loading è true", () => {
    const { container } = render(
      <FilterModal
        isOpen={true}
        onClose={mockOnClose}
        loading={true}
        filterState={{ ...emptyFilterState, filterGrado: "Cassazione Civile" }}
        setFilterState={mockSetFilterState}
        clearFilters={mockClearFilters}
      />
    );

    const selects = screen.getAllByRole("combobox");
    selects.forEach((select) => {
      expect(select).toBeDisabled();
    });

    const dateInputs = container.querySelectorAll('input[type="date"]');
    dateInputs.forEach((input) => {
      expect(input).toBeDisabled();
    });
  });
});