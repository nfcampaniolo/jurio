import { describe, test, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
/* ---------- component ---------- */
import { Input } from "@/components/Input"; // <-- adegua il path se necessario

describe("Input Component Suite", () => {
  test("renderizza un elemento input con le classi di stile base", () => {
    render(<Input placeholder="Inserisci testo..." />);

    const inputElement = screen.getByPlaceholderText("Inserisci testo...");
    expect(inputElement).toBeInTheDocument();
    expect(inputElement.tagName).toBe("INPUT");
    expect(inputElement).toHaveClass(
      "w-full",
      "px-4",
      "py-3",
      "rounded-xl",
      "border",
      "focus:outline-none",
      "focus:ring-2",
      "focus:ring-yellow-500"
    );
  });

  test("inoltra correttamente tutti gli attributi HTML nativi (type, value, required, disabled)", () => {
    render(
      <Input
        type="password"
        value="segreto123"
        required
        disabled
        aria-label="Password utente"
        readOnly
      />
    );

    const inputElement = screen.getByLabelText("Password utente");
    expect(inputElement).toHaveAttribute("type", "password");
    expect(inputElement).toHaveValue("segreto123");
    expect(inputElement).toBeRequired();
    expect(inputElement).toBeDisabled();
    expect(inputElement).toHaveAttribute("readonly");
  });

  test("gestisce gli eventi di input e triggera onChange", () => {
    const handleChange = vi.fn();
    render(<Input placeholder="Email" onChange={handleChange} />);

    const inputElement = screen.getByPlaceholderText("Email");
    fireEvent.change(inputElement, { target: { value: "test@jurio.it" } });

    expect(handleChange).toHaveBeenCalledTimes(1);
  });
});