import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

/* ---------- mock lucide-react ---------- */
vi.mock("lucide-react", () => ({
  Loader2: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="loader2-icon" {...props} />
  ),
}));

/* ---------- component ---------- */
import { AdminTaxonomySection } from "@/components/Admin/AdminTaxonomySection"; // <-- adegua il path se necessario

describe("AdminTaxonomySection", () => {
  const defaultMergeParams = {
    vecchiaCategoria: "Resp. Med.",
    nuovaCategoria: "Responsabilità Medica",
  };

  const mockSetMergeParams = vi.fn();
  const mockOnMergeSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza testi, input e invia il form quando isMerging è false", () => {
    render(
      <AdminTaxonomySection
        mergeParams={defaultMergeParams}
        setMergeParams={mockSetMergeParams}
        isMerging={false}
        onMergeSubmit={mockOnMergeSubmit}
      />
    );

    // Titolo e intestazioni
    expect(
      screen.getByRole("heading", { name: "Gestione e Pulizia Tassonomia", level: 2 })
    ).toBeInTheDocument();
    expect(
      screen.getByText("Scansiona le sottocategorie rare e unificale in categorie più ampie.")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "2. Unifica Categorie", level: 3 })
    ).toBeInTheDocument();

    // Input vecchiaCategoria
    const inputVecchia = screen.getByPlaceholderText("Categoria da eliminare (es. 'Resp. Med.')");
    expect(inputVecchia).toHaveValue("Resp. Med.");

    // Input nuovaCategoria
    const inputNuova = screen.getByPlaceholderText("Nuova categoria (lascia vuoto per svuotare)");
    expect(inputNuova).toHaveValue("Responsabilità Medica");

    // Pulsante submit in stato normale
    const submitButton = screen.getByRole("button", { name: "Sostituisci e Unifica" });
    expect(submitButton).toBeEnabled();
    expect(screen.queryByTestId("loader2-icon")).not.toBeInTheDocument();

    fireEvent.click(submitButton);
    expect(mockOnMergeSubmit).toHaveBeenCalledTimes(1);
  });

  test("gestisce il cambio valore su vecchiaCategoria chiamando la funzione updater di setMergeParams", () => {
    render(
      <AdminTaxonomySection
        mergeParams={defaultMergeParams}
        setMergeParams={mockSetMergeParams}
        isMerging={false}
        onMergeSubmit={mockOnMergeSubmit}
      />
    );

    const inputVecchia = screen.getByPlaceholderText("Categoria da eliminare (es. 'Resp. Med.')");
    fireEvent.change(inputVecchia, { target: { value: "Nuova Vecchia Cat" } });

    expect(mockSetMergeParams).toHaveBeenCalledTimes(1);

    // Esegui la callback passata all'updater
    const updater = mockSetMergeParams.mock.calls[0][0];
    const prevMock = { vecchiaCategoria: "Old", nuovaCategoria: "New" };
    const result = updater(prevMock);
    
    expect(result).toHaveProperty("vecchiaCategoria");
    expect(result.nuovaCategoria).toBe("New");
  });

  test("gestisce il cambio valore su nuovaCategoria chiamando la funzione updater di setMergeParams", () => {
    render(
      <AdminTaxonomySection
        mergeParams={defaultMergeParams}
        setMergeParams={mockSetMergeParams}
        isMerging={false}
        onMergeSubmit={mockOnMergeSubmit}
      />
    );

    const inputNuova = screen.getByPlaceholderText("Nuova categoria (lascia vuoto per svuotare)");
    fireEvent.change(inputNuova, { target: { value: "Categoria Finale" } });

    expect(mockSetMergeParams).toHaveBeenCalledTimes(1);

    // Esegui la callback passata all'updater
    const updater = mockSetMergeParams.mock.calls[0][0];
    const prevMock = { vecchiaCategoria: "Old", nuovaCategoria: "New" };
    const result = updater(prevMock);

    expect(result).toHaveProperty("nuovaCategoria");
    expect(result.vecchiaCategoria).toBe("Old");
  });

  test("copre il fallback quando nuovaCategoria è null", () => {
    const paramsWithNull = {
      vecchiaCategoria: "",
      nuovaCategoria: null,
    };

    render(
      <AdminTaxonomySection
        mergeParams={paramsWithNull}
        setMergeParams={mockSetMergeParams}
        isMerging={false}
        onMergeSubmit={mockOnMergeSubmit}
      />
    );

    const inputNuova = screen.getByPlaceholderText("Nuova categoria (lascia vuoto per svuotare)");
    expect(inputNuova).toHaveValue("");
  });

  test("gestisce lo stato di caricamento (isMerging = true)", () => {
    render(
      <AdminTaxonomySection
        mergeParams={defaultMergeParams}
        setMergeParams={mockSetMergeParams}
        isMerging={true}
        onMergeSubmit={mockOnMergeSubmit}
      />
    );

    const submitButton = screen.getByRole("button", { name: /Elaborazione\.\.\./i });
    expect(submitButton).toBeDisabled();
    expect(screen.getByTestId("loader2-icon")).toBeInTheDocument();
    expect(screen.getByTestId("loader2-icon")).toHaveClass("animate-spin");
  });
});