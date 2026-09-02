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

/* ---------- mock ButtonCTA ---------- */
vi.mock("@/components/ButtonCTA", () => ({
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
import CTASection from "@/components/Info/CTASection";

describe("CTASection Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza la sezione accessibile con intestazione, paragrafo, lista benefit e CTA", () => {
    render(<CTASection />);

    // Section semantica
    const section = screen.getByRole("region", {
      name: /L’essenziale della ricerca giuridica\./i,
    });
    expect(section).toBeInTheDocument();
    expect(section).toHaveAttribute("aria-labelledby", "cta-heading");

    // Intestazione H2
    const heading = screen.getByRole("heading", {
      name: /L’essenziale della ricerca giuridica\./i,
      level: 2,
    });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveAttribute("id", "cta-heading");

    // Paragrafo descrittivo
    expect(
      screen.getByText(
        /Prova Jurio per 7 giorni: giurisprudenza delle Corti Supreme già analizzata/i
      )
    ).toBeInTheDocument();

    // Benefit
    expect(screen.getByText("Nessuna carta richiesta")).toBeInTheDocument();
    expect(screen.getByText("7 giorni full access")).toBeInTheDocument();
    expect(screen.getByText("Cloud privato")).toBeInTheDocument();

    // Pulsante CTA e dicitura di supporto
    const ctaButton = screen.getByRole("button", {
      name: "Attiva la prova gratuita di Jurio",
    });
    expect(ctaButton).toBeInTheDocument();
    expect(ctaButton).toHaveTextContent("Prova gratuita 1 settimana");

    expect(screen.getByText("Attivazione istantanea")).toBeInTheDocument();
  });

  test("naviga a '/login' al click sul pulsante CTA", () => {
    render(<CTASection />);

    const ctaButton = screen.getByRole("button", {
      name: "Attiva la prova gratuita di Jurio",
    });
    fireEvent.click(ctaButton);

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });
});