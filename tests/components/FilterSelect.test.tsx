import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/* ---------- component ---------- */
import { FilterSelect } from "@/shared/components/FilterSelect"; // <-- adegua il path se necessario

describe("FilterSelect Component Suite", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza la label e il select associati tramite id/htmlFor con le relative opzioni", () => {
    render(
      <FilterSelect
        id="corte-select"
        label="Seleziona Corte"
        value="cassazione"
        onChange={mockOnChange}
      >
        <option value="all">Tutte le corti</option>
        <option value="cassazione">Corte di Cassazione</option>
        <option value="consiglio">Consiglio di Stato</option>
      </FilterSelect>
    );

    const labelElement = screen.getByText("Seleziona Corte");
    expect(labelElement).toBeInTheDocument();
    expect(labelElement).toHaveAttribute("for", "corte-select");

    const selectElement = screen.getByRole("combobox", { name: "Seleziona Corte" });
    expect(selectElement).toBeInTheDocument();
    expect(selectElement).toHaveAttribute("id", "corte-select");
    expect(selectElement).toHaveValue("cassazione");

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(3);
    expect(options[0]).toHaveValue("all");
    expect(options[1]).toHaveValue("cassazione");
    expect(options[2]).toHaveValue("consiglio");
  });

  test("esegue onChange con il nuovo valore selezionato", () => {
    render(
      <FilterSelect
        id="corte-select"
        label="Seleziona Corte"
        value="all"
        onChange={mockOnChange}
      >
        <option value="all">Tutte le corti</option>
        <option value="cassazione">Corte di Cassazione</option>
      </FilterSelect>
    );

    const selectElement = screen.getByRole("combobox", { name: "Seleziona Corte" });
    fireEvent.change(selectElement, { target: { value: "cassazione" } });

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockOnChange).toHaveBeenCalledWith("cassazione");
  });

  test("disabilita il menu a tendina quando disabled è true", () => {
    render(
      <FilterSelect
        id="corte-select"
        label="Seleziona Corte"
        value="all"
        disabled={true}
        onChange={mockOnChange}
      >
        <option value="all">Tutte le corti</option>
      </FilterSelect>
    );

    const selectElement = screen.getByRole("combobox", { name: "Seleziona Corte" });
    expect(selectElement).toBeDisabled();
    expect(selectElement).toHaveClass("disabled:opacity-35", "disabled:cursor-not-allowed");
  });

  test("applica le classi custom passate come prop className", () => {
    const { container } = render(
      <FilterSelect
        id="corte-select"
        label="Seleziona Corte"
        value="all"
        className="custom-filter-class w-1/2"
        onChange={mockOnChange}
      >
        <option value="all">Tutte le corti</option>
      </FilterSelect>
    );

    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper).toHaveClass("min-w-0", "custom-filter-class", "w-1/2");
  });
});