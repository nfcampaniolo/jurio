import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

/* ---------- hoisted mocks per l'hook ---------- */
const {
  mockSetName,
  mockSetSurname,
  mockSetIsAdult,
  mockHandleConsentChange,
  mockSaveToDb,
  mockSetRole,
  mockSetRoleOther,
  hookState,
} = vi.hoisted(() => {
  const state = {
    name: "",
    surname: "",
    isAdult: false,
    consents: { privacy: false, terms: false, comms: false, marketing: false },
    role: "avvocato",
    roleOther: "",
    isSaving: false,
  };
  return {
    mockSetName: vi.fn((val) => { state.name = val; }),
    mockSetSurname: vi.fn((val) => { state.surname = val; }),
    mockSetIsAdult: vi.fn((val) => { state.isAdult = val; }),
    mockHandleConsentChange: vi.fn(),
    mockSaveToDb: vi.fn(),
    mockSetRole: vi.fn((val) => { state.role = val; }),
    mockSetRoleOther: vi.fn((val) => { state.roleOther = val; }),
    hookState: state,
  };
});

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", () => ({
  __esModule: true,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    span: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
      <span {...props}>{children}</span>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useReducedMotion: () => false,
}));

/* ---------- mock react-router-dom Link ---------- */
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => (
      <a href={to} {...props}>{children}</a>
    ),
  };
});

/* ---------- mock hook ---------- */
vi.mock("@/features/auth/hooks/useRegisterPageLogic", () => ({
  useRegisterPageLogic: () => ({
    name: hookState.name,
    setName: mockSetName,
    surname: hookState.surname,
    setSurname: mockSetSurname,
    isAdult: hookState.isAdult,
    setIsAdult: mockSetIsAdult,
    consents: hookState.consents,
    handleConsentChange: mockHandleConsentChange,
    saveToDb: mockSaveToDb,
    role: hookState.role,
    setRole: mockSetRole,
    roleOther: hookState.roleOther,
    setRoleOther: mockSetRoleOther,
    isSaving: hookState.isSaving,
  }),
}));

/* ---------- mock interfacce condivise ---------- */
vi.mock("@/interfaces/interfaces", () => ({
  roleOptions: [
    { value: "avvocato", label: "Avvocato" },
    { value: "magistrato", label: "Magistrato" },
    { value: "altro", label: "Altro" },
  ],
  consentItems: [
    { key: "privacy", label: "Informativa sulla Privacy", required: true, link: "/privacy" },
    { key: "terms", label: "Termini e Condizioni", required: true, link: "/termini" },
  ],
}));

/* ---------- subject under test ---------- */
import { Register } from "@/features/auth/Register";

describe("Register Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookState.name = "";
    hookState.surname = "";
    hookState.isAdult = false;
    hookState.consents = { privacy: false, terms: false, comms: false, marketing: false };
    hookState.role = "avvocato";
    hookState.roleOther = "";
    hookState.isSaving = false;
  });

  test("renderizza correttamente la struttura principale della registrazione", () => {
    render(<Register />);

    expect(screen.getByRole("heading", { name: "Registrazione Utente" })).toBeInTheDocument();
    expect(screen.getByLabelText("Nome")).toBeInTheDocument();
    expect(screen.getByLabelText("Cognome")).toBeInTheDocument();
    expect(screen.getByLabelText("Categoria professionale (opzionale)")).toBeInTheDocument();
    expect(screen.getByLabelText(/Dichiaro di avere più di 18 anni/i)).toBeInTheDocument();
  });

  test("aggiorna i campi di input anagrafici", () => {
    render(<Register />);

    const nameInput = screen.getByLabelText("Nome");
    fireEvent.change(nameInput, { target: { value: "Flavio" } });
    expect(mockSetName).toHaveBeenCalledWith("Flavio");

    const surnameInput = screen.getByLabelText("Cognome");
    fireEvent.change(surnameInput, { target: { value: "Campaniolo" } });
    expect(mockSetSurname).toHaveBeenCalledWith("Campaniolo");
  });

  test("gestisce la spunta sulla maggiore età", () => {
    render(<Register />);

    const isAdultCheckbox = screen.getByLabelText(/Dichiaro di avere più di 18 anni/i);
    fireEvent.click(isAdultCheckbox);
    expect(mockSetIsAdult).toHaveBeenCalledWith(true);
  });

  test("gestisce la selezione della categoria e mostra l'input 'Altro' se selezionato", () => {
    hookState.role = "altro";
    render(<Register />);

    const select = screen.getByLabelText("Categoria professionale (opzionale)");
    fireEvent.change(select, { target: { value: "altro" } });
    expect(mockSetRole).toHaveBeenCalledWith("altro");

    const otherInput = screen.getByPlaceholderText("Specifica la tua categoria");
    fireEvent.change(otherInput, { target: { value: "Consulente Legale" } });
    expect(mockSetRoleOther).toHaveBeenCalledWith("Consulente Legale");
  });

  test("gestisce il cambio dei consensi GDPR", () => {
    render(<Register />);

    const privacyCheckbox = screen.getByLabelText(/Informativa sulla Privacy/i);
    fireEvent.click(privacyCheckbox);

    expect(mockHandleConsentChange).toHaveBeenCalledWith("privacy");
  });

  test("disabilita il pulsante di salvataggio se l'utente non è maggiorenne o se è in corso il salvataggio", () => {
    hookState.isAdult = false;
    hookState.isSaving = false;
    const { rerender } = render(<Register />);

    const saveButton = screen.getByRole("button", { name: "Inizia la tua settimana di prova gratuita" });
    expect(saveButton).toBeDisabled();

    // Rerender in stato di salvataggio
    hookState.isAdult = true;
    hookState.isSaving = true;
    rerender(<Register />);

    const savingButton = screen.getByRole("button", { name: "Salvataggio in corso..." });
    expect(savingButton).toBeDisabled();
  });

  test("abilita ed esegue il salvataggio quando l'utente è maggiorenne e non in fase di salvataggio", () => {
    hookState.isAdult = true;
    hookState.isSaving = false;
    render(<Register />);

    const saveButton = screen.getByRole("button", { name: "Inizia la tua settimana di prova gratuita" });
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);
    expect(mockSaveToDb).toHaveBeenCalledTimes(1);
  });
});