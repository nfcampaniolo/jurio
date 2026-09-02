import React from "react";
import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

/* ---------- hoisted mocks ---------- */
const { mockRoleOptions } = vi.hoisted(() => ({
  mockRoleOptions: [
    { value: "avvocato", label: "Avvocato" },
    { value: "magistrato", label: "Magistrato" },
    { value: "praticante", label: "Praticante Avvocato" },
    { value: "altro", label: "Altro" },
  ],
}));

/* ---------- mock modules ---------- */
vi.mock("@/interfaces/interfaces", () => ({
  __esModule: true,
  roleOptions: mockRoleOptions,
}));

vi.mock("@/components/Input", () => ({
  __esModule: true,
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input {...props} />
  ),
}));

vi.mock("framer-motion", () => ({
  __esModule: true,
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

/* ---------- subject under test ---------- */
import { EditProfileForm } from "@/components/Profile/EditProfileForm";

describe("EditProfileForm Component Suite", () => {
  const mockSetName = vi.fn();
  const mockSetSurname = vi.fn();
  const mockSetRole = vi.fn();
  const mockSetRoleOther = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  /* -------------------------------------------------------------------------- */
  /* RENDERING INIZIALE & ACCESSIBILITÀ                                         */
  /* -------------------------------------------------------------------------- */
  describe("Rendering Campi e Accessibilità", () => {
    test("renderizza i campi nome, cognome e select con attributi ARIA collegati", () => {
      render(
        <EditProfileForm
          name="Flavio"
          setName={mockSetName}
          surname="Campaniolo"
          setSurname={mockSetSurname}
          role="avvocato"
          setRole={mockSetRole}
          roleOther=""
          setRoleOther={mockSetRoleOther}
          shouldReduceMotion={false}
        />
      );

      const nameInput = screen.getByPlaceholderText("Nome");
      const surnameInput = screen.getByPlaceholderText("Cognome");
      const selectRole = screen.getByRole("combobox");

      expect(nameInput).toHaveValue("Flavio");
      expect(surnameInput).toHaveValue("Campaniolo");
      expect(selectRole).toHaveValue("avvocato");

      expect(selectRole).toHaveAttribute("id", "role-select");
      expect(selectRole).toHaveAttribute("aria-describedby", "role-description");
      expect(screen.getByText(/La selezione della categoria professionale è facoltativa/i)).toHaveAttribute(
        "id",
        "role-description"
      );
    });

    test("popola la select con tutte le opzioni definite in roleOptions", () => {
      render(
        <EditProfileForm
          name=""
          setName={mockSetName}
          surname=""
          setSurname={mockSetSurname}
          role="avvocato"
          setRole={mockSetRole}
          roleOther=""
          setRoleOther={mockSetRoleOther}
          shouldReduceMotion={false}
        />
      );

      const options = screen.getAllByRole("option");
      expect(options).toHaveLength(4);
      expect(options[0]).toHaveValue("avvocato");
      expect(options[1]).toHaveValue("magistrato");
      expect(options[2]).toHaveValue("praticante");
      expect(options[3]).toHaveValue("altro");
    });
  });

  /* -------------------------------------------------------------------------- */
  /* GESTIONE INPUT & EVENTI                                                    */
  /* -------------------------------------------------------------------------- */
  describe("Gestione Input e Callback", () => {
    test("invia il nuovo valore a setName alla modifica del campo nome", () => {
      render(
        <EditProfileForm
          name=""
          setName={mockSetName}
          surname=""
          setSurname={mockSetSurname}
          role="avvocato"
          setRole={mockSetRole}
          roleOther=""
          setRoleOther={mockSetRoleOther}
          shouldReduceMotion={false}
        />
      );

      fireEvent.change(screen.getByPlaceholderText("Nome"), {
        target: { value: "Nicolò" },
      });

      expect(mockSetName).toHaveBeenCalledTimes(1);
      expect(mockSetName).toHaveBeenCalledWith("Nicolò");
    });

    test("invia il nuovo valore a setSurname alla modifica del campo cognome", () => {
      render(
        <EditProfileForm
          name=""
          setName={mockSetName}
          surname=""
          setSurname={mockSetSurname}
          role="avvocato"
          setRole={mockSetRole}
          roleOther=""
          setRoleOther={mockSetRoleOther}
          shouldReduceMotion={false}
        />
      );

      fireEvent.change(screen.getByPlaceholderText("Cognome"), {
        target: { value: "Rossi" },
      });

      expect(mockSetSurname).toHaveBeenCalledTimes(1);
      expect(mockSetSurname).toHaveBeenCalledWith("Rossi");
    });

    test("invia il nuovo valore a setRole al cambio opzione della select", () => {
      render(
        <EditProfileForm
          name=""
          setName={mockSetName}
          surname=""
          setSurname={mockSetSurname}
          role="avvocato"
          setRole={mockSetRole}
          roleOther=""
          setRoleOther={mockSetRoleOther}
          shouldReduceMotion={false}
        />
      );

      fireEvent.change(screen.getByRole("combobox"), {
        target: { value: "magistrato" },
      });

      expect(mockSetRole).toHaveBeenCalledTimes(1);
      expect(mockSetRole).toHaveBeenCalledWith("magistrato");
    });
  });

  /* -------------------------------------------------------------------------- */
  /* CAMPO CONDIZIONALE ROLE === 'ALTRO'                                        */
  /* -------------------------------------------------------------------------- */
  describe("Campo Condizionale 'Altro'", () => {
    test("non mostra il campo aggiuntivo se role !== 'altro'", () => {
      render(
        <EditProfileForm
          name=""
          setName={mockSetName}
          surname=""
          setSurname={mockSetSurname}
          role="avvocato"
          setRole={mockSetRole}
          roleOther=""
          setRoleOther={mockSetRoleOther}
          shouldReduceMotion={false}
        />
      );

      expect(
        screen.queryByPlaceholderText("Specifica la tua categoria")
      ).not.toBeInTheDocument();
    });

    test("mostra il campo aggiuntivo e richiama setRoleOther se role === 'altro'", () => {
      render(
        <EditProfileForm
          name=""
          setName={mockSetName}
          surname=""
          setSurname={mockSetSurname}
          role="altro"
          setRole={mockSetRole}
          roleOther="Docente Universitario"
          setRoleOther={mockSetRoleOther}
          shouldReduceMotion={null}
        />
      );

      const otherInput = screen.getByPlaceholderText("Specifica la tua categoria");
      expect(otherInput).toBeInTheDocument();
      expect(otherInput).toHaveValue("Docente Universitario");

      fireEvent.change(otherInput, {
        target: { value: "Giurista d'impresa" },
      });

      expect(mockSetRoleOther).toHaveBeenCalledTimes(1);
      expect(mockSetRoleOther).toHaveBeenCalledWith("Giurista d'impresa");
    });
  });
});