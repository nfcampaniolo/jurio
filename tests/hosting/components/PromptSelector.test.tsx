import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

/* ---------- mock Element.prototype.animate ---------- */
beforeEach(() => {
  Element.prototype.animate = vi.fn().mockReturnValue({
    cancel: vi.fn(),
    finish: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
  });
});

/* ---------- mock FilterSelect ---------- */
vi.mock("@/shared/components/FilterSelect", () => ({
  __esModule: true,
  FilterSelect: ({
    id,
    value,
    onChange,
    disabled,
    children,
  }: {
    id: string;
    value: string;
    onChange: (val: string) => void;
    disabled?: boolean;
    children: React.ReactNode;
  }) => (
    <select
      id={id}
      data-testid="mock-filter-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
    >
      {children}
    </select>
  ),
}));

/* ---------- mock usePromptSelector ---------- */
const mockHandleChange = vi.fn();

let mockSelectorReturn = {
  savedPrompts: [] as Array<{ id: string; title: string; objective?: string }>,
  publicPrompts: [] as Array<{ id: string; title: string; objective?: string }>,
  selectedCustomPrompt: null as { id: string; title: string; objective?: string } | null,
  handleChange: mockHandleChange,
};

vi.mock("@/shared/hooks/usePromptSelector", () => ({
  __esModule: true,
  usePromptSelector: () => mockSelectorReturn,
}));

/* ---------- component ---------- */
import { PromptSelector } from "@/shared/components/PromptSelector"; // <-- adegua il path se necessario

describe("PromptSelector Component Suite", () => {
  const mockOnChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSelectorReturn = {
      savedPrompts: [],
      publicPrompts: [],
      selectedCustomPrompt: null,
      handleChange: mockHandleChange,
    };
  });

  test("renderizza la label, il link al prompt-builder e l'opzione standard di default", () => {
    render(<PromptSelector value="default" onChange={mockOnChange} />);

    expect(screen.getByText("Modello di Analisi")).toBeInTheDocument();
    
    const linkBuilder = screen.getByRole("link", { name: /Vai ai tuoi prompt →/i });
    expect(linkBuilder).toBeInTheDocument();
    expect(linkBuilder).toHaveAttribute("href", "/profilo/prompt-builder");

    expect(screen.getByRole("option", { name: "Analisi Standard" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Crea nuovo prompt..." })).toBeInTheDocument();
  });

  test("mostra la descrizione dettagliata dell'estrazione giuridica quando il valore è 'default'", () => {
    render(<PromptSelector value="default" onChange={mockOnChange} />);

    expect(
      screen.getByText("Modello di default per l'estrazione giuridica:")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/anonimizzazione obbligatoria/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/ad altissima densità informativa ottimizzato per l'indicizzazione/i)
    ).toBeInTheDocument();
  });

  test("renderizza i gruppi optgroup per Modelli Pubblici e I Miei Prompt quando presenti", () => {
    mockSelectorReturn.publicPrompts = [
      { id: "pub-1", title: "Ricerca Penale", objective: "Analisi capi di imputazione" },
    ];
    mockSelectorReturn.savedPrompts = [
      { id: "priv-1", title: "Contratti Locazione", objective: "Verifica clausole risolutive" },
    ];

    render(<PromptSelector value="pub-1" onChange={mockOnChange} />);

    expect(screen.getByRole("group", { name: "Modelli Pubblici" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Ricerca Penale" })).toBeInTheDocument();

    expect(screen.getByRole("group", { name: "I Miei Prompt" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Contratti Locazione" })).toBeInTheDocument();
  });

  test("mostra la descrizione e il badge 'Personalizzato' per un prompt custom dell'utente", () => {
    const customPrompt = {
      id: "priv-1",
      title: "Contratti Locazione",
      objective: "Verifica clausole risolutive e conformità",
    };
    mockSelectorReturn.savedPrompts = [customPrompt];
    mockSelectorReturn.selectedCustomPrompt = customPrompt;

    render(<PromptSelector value="priv-1" onChange={mockOnChange} />);

    // Verifica sia l'option che il titolo nel box descrittivo
    const titleElements = screen.getAllByText("Contratti Locazione");
    expect(titleElements.length).toBeGreaterThanOrEqual(2);

    expect(screen.getByText("Personalizzato")).toBeInTheDocument();
    expect(
      screen.getByText("Verifica clausole risolutive e conformità")
    ).toBeInTheDocument();
  });

  test("mostra il badge 'Pubblico' per un prompt di sistema condiviso", () => {
    const publicPrompt = {
      id: "pub-1",
      title: "Ricerca Penale",
      objective: "Analisi reati tributari",
    };
    mockSelectorReturn.publicPrompts = [publicPrompt];
    mockSelectorReturn.selectedCustomPrompt = publicPrompt;

    render(<PromptSelector value="pub-1" onChange={mockOnChange} />);

    // Verifica sia l'option che il titolo nel box descrittivo
    const titleElements = screen.getAllByText("Ricerca Penale");
    expect(titleElements.length).toBeGreaterThanOrEqual(2);

    expect(screen.getByText("Pubblico")).toBeInTheDocument();
    expect(screen.getByText("Analisi reati tributari")).toBeInTheDocument();
  });

  test("mostra il fallback se il prompt custom non ha un obiettivo specificato", () => {
    const promptWithoutObjective = {
      id: "pub-2",
      title: "Prompt Senza Descrizione",
    };
    mockSelectorReturn.publicPrompts = [promptWithoutObjective];
    mockSelectorReturn.selectedCustomPrompt = promptWithoutObjective;

    render(<PromptSelector value="pub-2" onChange={mockOnChange} />);

    expect(
      screen.getByText("Nessun obiettivo o descrizione specificata per questo prompt.")
    ).toBeInTheDocument();
  });

  test("esegue handleChange al cambio di selezione", () => {
    render(<PromptSelector value="default" onChange={mockOnChange} />);

    const select = screen.getByTestId("mock-filter-select");
    fireEvent.change(select, { target: { value: "create_new" } });

    expect(mockHandleChange).toHaveBeenCalledTimes(1);
    expect(mockHandleChange).toHaveBeenCalledWith("create_new");
  });

  test("disabilita il selettore quando disabled è true", () => {
    render(<PromptSelector value="default" disabled={true} onChange={mockOnChange} />);

    const select = screen.getByTestId("mock-filter-select");
    expect(select).toBeDisabled();
  });
});