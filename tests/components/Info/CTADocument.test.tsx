import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

/* ---------- hoisted mocks ---------- */
const { mockNavigate } = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
}));

/* ---------- mock react-router-dom ---------- */
vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

/* ---------- mock react-icons/fa ---------- */
vi.mock("react-icons/fa", () => ({
  FaFileUpload: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="fa-file-upload" {...props} />
  ),
}));

/* ---------- mock ButtonCTA ---------- */
vi.mock("@/shared/components/ButtonCTA", () => ({
  ButtonCTA: ({
    children,
    onClick,
    ...props
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

/* ---------- component ---------- */
import { CTADocument } from "@/features/search/components/CTADocument"; // <-- adegua il path se necessario

describe("CTADocument Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza la sezione accessibile con intestazione, icona, testo descrittivo e badge", () => {
    render(<CTADocument />);

    // Verifica section semantica accessibile
    const section = screen.getByRole("region", {
      name: /Non trovi il provvedimento\? Caricalo\./i,
    });
    expect(section).toBeInTheDocument();
    expect(section).toHaveAttribute("aria-labelledby", "cta-document-heading");

    // Icona upload
    expect(screen.getByTestId("fa-file-upload")).toBeInTheDocument();

    // Heading H2
    const heading = screen.getByRole("heading", {
      name: /Non trovi il provvedimento\? Caricalo\./i,
      level: 2,
    });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveAttribute("id", "cta-document-heading");

    // Paragrafo descrittivo
    expect(
      screen.getByText(
        /Quando il corpus delle Corti Supreme non restituisce il provvedimento che ti serve/i
      )
    ).toBeInTheDocument();

    // Pulsante CTA e dicitura di supporto
    expect(
      screen.getByRole("button", {
        name: "Attiva l'analisi assistita su un documento esterno",
      })
    ).toHaveTextContent("Analizza il documento");

    expect(screen.getByText(/Cloud privato · AI integrata/i)).toBeInTheDocument();
  });

  test("naviga a '/profilo#section1' al click sul pulsante CTA", () => {
    render(<CTADocument />);

    const ctaButton = screen.getByRole("button", {
      name: "Attiva l'analisi assistita su un documento esterno",
    });
    fireEvent.click(ctaButton);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/profilo#section1");
  });
});