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
import { AdminMaintenanceSection } from "@/components/Admin/AdminMaintenanceSection"; // <-- adegua il path se necessario
import type { AdminMaintenanceParams, MaintenanceProgressData } from "@/services/admin";

describe("AdminMaintenanceSection", () => {
  const defaultParams: AdminMaintenanceParams = {
    materia: "",
    sezione: "",
    organo_giudicante: "",
    newFonte: "",
    newFonteLogo: "",
  } as AdminMaintenanceParams;

  const mockOnParamChange = vi.fn();
  const mockOnMaintenanceSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza intestazione, controlli select ed esegue i cambi valore", () => {
    render(
      <AdminMaintenanceSection
        maintenanceParams={defaultParams}
        isUpdating={false}
        progressData={null}
        onParamChange={mockOnParamChange}
        onMaintenanceSubmit={mockOnMaintenanceSubmit}
      />
    );

    // Titolo e sottotitolo
    expect(
      screen.getByRole("heading", { name: /Manutenzione Massiva Database/i, level: 2 })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Aggiorna in massa i metadati delle sentenze/i)
    ).toBeInTheDocument();

    // Select: materia
    const materiaSelect = screen.getByDisplayValue("Tutte le materie (Nessun filtro)");
    expect(materiaSelect).toHaveAttribute("name", "materia");
    fireEvent.change(materiaSelect, { target: { value: "Civile" } });
    expect(mockOnParamChange).toHaveBeenCalledTimes(1);

    // Select: sezione
    const sezioneSelect = screen.getByDisplayValue("Tutte le sezioni (Nessun filtro)");
    expect(sezioneSelect).toHaveAttribute("name", "sezione");
    fireEvent.change(sezioneSelect, { target: { value: "PRIMA SEZIONE CIVILE" } });
    expect(mockOnParamChange).toHaveBeenCalledTimes(2);

    // Select: organo_giudicante
    const organoSelect = screen.getByDisplayValue("Tutti gli organi (Nessun filtro)");
    expect(organoSelect).toHaveAttribute("name", "organo_giudicante");
    fireEvent.change(organoSelect, { target: { value: "CORTE DI CASSAZIONE" } });
    expect(mockOnParamChange).toHaveBeenCalledTimes(3);

    // Select: newFonte
    const newFonteSelect = screen.getByDisplayValue("Nessuna nuova fonte da applicare");
    expect(newFonteSelect).toHaveAttribute("name", "newFonte");
    fireEvent.change(newFonteSelect, { target: { value: "https://www.italgiure.giustizia.it/" } });
    expect(mockOnParamChange).toHaveBeenCalledTimes(4);

    // Select: newFonteLogo
    const newFonteLogoSelect = screen.getByDisplayValue("Nessun nuovo logo");
    expect(newFonteLogoSelect).toHaveAttribute("name", "newFonteLogo");
    fireEvent.change(newFonteLogoSelect, {
      target: {
        value: "https://www.cortecostituzionale.it/assets/image/logos/logo_70_orizzontale-d02ce0dafa4c8ec5c1ea75bd8929183b.svg",
      },
    });
    expect(mockOnParamChange).toHaveBeenCalledTimes(5);

    // Bottone submit in stato idle
    const submitButton = screen.getByRole("button", { name: "Avvia Manutenzione" });
    expect(submitButton).toBeEnabled();
    expect(screen.queryByTestId("loader2-icon")).not.toBeInTheDocument();

    fireEvent.click(submitButton);
    expect(mockOnMaintenanceSubmit).toHaveBeenCalledTimes(1);

    // ProgressData non deve essere visibile
    expect(screen.queryByText(/Stato Avanzamento/i)).not.toBeInTheDocument();
  });

  test("gestisce lo stato di aggiornamento in corso (isUpdating = true)", () => {
    render(
      <AdminMaintenanceSection
        maintenanceParams={defaultParams}
        isUpdating={true}
        progressData={null}
        onParamChange={mockOnParamChange}
        onMaintenanceSubmit={mockOnMaintenanceSubmit}
      />
    );

    const submitButton = screen.getByRole("button", { name: /Esecuzione in corso\.\.\./i });
    expect(submitButton).toBeDisabled();
    expect(screen.getByTestId("loader2-icon")).toBeInTheDocument();
    expect(screen.getByTestId("loader2-icon")).toHaveClass("animate-spin");
  });

  test("renderizza progressData completo (status, message, scannedSoFar, updatedSoFar, finalStats)", () => {
    const fullProgress: MaintenanceProgressData = {
      status: "In elaborazione",
      message: "Scansione documenti in corso",
      scannedSoFar: 120,
      updatedSoFar: 45,
      finalStats: {
        fontiAggiornate: 45,
        documentiScansionati: 120,
      },
    } as MaintenanceProgressData;

    render(
      <AdminMaintenanceSection
        maintenanceParams={defaultParams}
        isUpdating={true}
        progressData={fullProgress}
        onParamChange={mockOnParamChange}
        onMaintenanceSubmit={mockOnMaintenanceSubmit}
      />
    );

    expect(screen.getByRole("heading", { name: "Stato Avanzamento", level: 3 })).toBeInTheDocument();
    expect(screen.getByText("Stato:")).toBeInTheDocument();
    expect(screen.getByText("In elaborazione")).toBeInTheDocument();
    expect(screen.getByText("Messaggio:")).toBeInTheDocument();
    expect(screen.getByText("Scansione documenti in corso")).toBeInTheDocument();
    expect(screen.getByText("Scansionati:")).toBeInTheDocument();
    
    // Query puntuale sul contenitore del testo scansionati ed aggiornati
    expect(screen.getByText((content) => content.includes("120") && content.includes("| Aggiornati: 45"))).toBeInTheDocument();

    expect(
      screen.getByText("Task concluso. Fonti aggiornate: 45 / Documenti analizzati: 120.")
    ).toBeInTheDocument();
  });

  test("copertura rami progressData: campi parziali e fallback a 0 per finalStats", () => {
    const partialProgress: MaintenanceProgressData = {
      status: "",
      message: "",
      scannedSoFar: 10,
      updatedSoFar: undefined,
      finalStats: {
        fontiAggiornate: 0,
        documentiScansionati: 0,
      },
    } as unknown as MaintenanceProgressData;

    render(
      <AdminMaintenanceSection
        maintenanceParams={defaultParams}
        isUpdating={false}
        progressData={partialProgress}
        onParamChange={mockOnParamChange}
        onMaintenanceSubmit={mockOnMaintenanceSubmit}
      />
    );

    // I campi con stringa vuota (falsy) non devono essere renderizzati
    expect(screen.queryByText("Stato:")).not.toBeInTheDocument();
    expect(screen.queryByText("Messaggio:")).not.toBeInTheDocument();

    // scannedSoFar presente ma updatedSoFar assente
    expect(screen.getByText("Scansionati:")).toBeInTheDocument();
    expect(screen.queryByText(/\| Aggiornati:/)).not.toBeInTheDocument();

    // Fallback || 0 per finalStats
    expect(
      screen.getByText("Task concluso. Fonti aggiornate: 0 / Documenti analizzati: 0.")
    ).toBeInTheDocument();
  });

  test("copertura rami progressData: scannedSoFar e finalStats non definiti", () => {
    const minimalProgress: MaintenanceProgressData = {
      status: "Avviato",
      message: "Operazione in coda",
      scannedSoFar: undefined,
      updatedSoFar: undefined,
      finalStats: undefined,
    } as unknown as MaintenanceProgressData;

    render(
      <AdminMaintenanceSection
        maintenanceParams={defaultParams}
        isUpdating={false}
        progressData={minimalProgress}
        onParamChange={mockOnParamChange}
        onMaintenanceSubmit={mockOnMaintenanceSubmit}
      />
    );

    expect(screen.getByText("Stato:")).toBeInTheDocument();
    expect(screen.getByText("Avviato")).toBeInTheDocument();
    expect(screen.getByText("Messaggio:")).toBeInTheDocument();
    expect(screen.getByText("Operazione in coda")).toBeInTheDocument();

    // Nessun contatore scansionati o statistiche finali
    expect(screen.queryByText("Scansionati:")).not.toBeInTheDocument();
    expect(screen.queryByText(/Task concluso/i)).not.toBeInTheDocument();
  });
});