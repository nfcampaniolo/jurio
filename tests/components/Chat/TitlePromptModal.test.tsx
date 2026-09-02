import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

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

/* ---------- component ---------- */
import { TitlePromptModal } from "@/components/Chat/TitlePromptModal"; 

describe("TitlePromptModal Component Suite", () => {
  const mockOnClose = vi.fn();
  const mockOnConfirm = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    onConfirm: mockOnConfirm,
    initialTitle: "Pratica Iniziale",
  };

  test("non renderizza nulla quando isOpen è false", () => {
    render(<TitlePromptModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByText("Definisci il titolo")).not.toBeInTheDocument();
  });

  test("renderizza modale, input con initialTitle e pulsanti di azione quando isOpen è true", () => {
    render(<TitlePromptModal {...defaultProps} />);

    expect(screen.getByRole("heading", { name: "Definisci il titolo", level: 3 })).toBeInTheDocument();

    const input = screen.getByPlaceholderText("Es: Pratica Rossi vs Bianchi");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue("Pratica Iniziale");

    expect(screen.getByRole("button", { name: "Annulla" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Conferma" })).toBeInTheDocument();
  });

  test("invoca onClose al click sul backdrop", () => {
    const { container } = render(<TitlePromptModal {...defaultProps} />);

    const backdrop = container.querySelector(".fixed.inset-0.z-50.bg-black\\/60")!;
    fireEvent.click(backdrop);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test("invoca onClose al click sul pulsante 'Annulla'", () => {
    render(<TitlePromptModal {...defaultProps} />);

    const cancelBtn = screen.getByRole("button", { name: "Annulla" });
    fireEvent.click(cancelBtn);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  test("modifica il testo dell'input e invoca onConfirm con il nuovo valore al click su 'Conferma'", () => {
    render(<TitlePromptModal {...defaultProps} />);

    const input = screen.getByPlaceholderText("Es: Pratica Rossi vs Bianchi");
    fireEvent.change(input, { target: { value: "Pratica Modificata 2026" } });
    expect(input).toHaveValue("Pratica Modificata 2026");

    const confirmBtn = screen.getByRole("button", { name: "Conferma" });
    fireEvent.click(confirmBtn);

    expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    expect(mockOnConfirm).toHaveBeenCalledWith("Pratica Modificata 2026");
  });

  test("invia initialTitle se si conferma senza modificare il valore", () => {
    render(<TitlePromptModal {...defaultProps} initialTitle="Titolo Invariato" />);

    const confirmBtn = screen.getByRole("button", { name: "Conferma" });
    fireEvent.click(confirmBtn);

    expect(mockOnConfirm).toHaveBeenCalledWith("Titolo Invariato");
  });
});