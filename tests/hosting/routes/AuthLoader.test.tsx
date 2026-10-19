import { describe, test, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import AuthLoader, { AuthLoader as NamedAuthLoader } from "@/routes/AuthLoader";

describe("AuthLoader Component Suite", () => {
  test("renderizza il contenitore con role='status' e attributi ARIA di accessibilità", () => {
    render(<AuthLoader />);

    const statusElement = screen.getByRole("status");
    expect(statusElement).toBeInTheDocument();
    expect(statusElement).toHaveAttribute("aria-live", "polite");
    expect(statusElement).toHaveAttribute("aria-busy", "true");
  });

  test("mostra il testo identificativo del brand", () => {
    render(<AuthLoader />);

    expect(screen.getByText("Jurio")).toBeInTheDocument();
  });

  test("renderizza l'icona SVG dello spinner con la classe di animazione", () => {
    const { container } = render(<AuthLoader />);

    const svgElement = container.querySelector("svg");
    expect(svgElement).toBeInTheDocument();
    expect(svgElement).toHaveClass("animate-spin");
  });

  test("supporta sia il named export che il default export", () => {
    const { unmount } = render(<NamedAuthLoader />);
    expect(screen.getByRole("status")).toBeInTheDocument();
    unmount();

    render(<AuthLoader />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});