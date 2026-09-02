import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", () => ({
  __esModule: true,
  useReducedMotion: vi.fn(() => false),
  motion: {
    section: React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(
      ({ children, ...props }, ref) => (
        <section ref={ref} {...props}>
          {children}
        </section>
      )
    ),
    div: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
      ({ children, ...props }, ref) => (
        <div ref={ref} {...props}>
          {children}
        </div>
      )
    ),
  },
}));

/* ---------- mock react-router-dom ---------- */
vi.mock("react-router-dom", () => ({
  __esModule: true,
  Link: ({
    to,
    children,
    className,
    "aria-label": ariaLabel,
  }: {
    to: string;
    children: React.ReactNode;
    className?: string;
    "aria-label"?: string;
  }) => (
    <a href={to} className={className} aria-label={ariaLabel}>
      {children}
    </a>
  ),
}));

/* ---------- mock react-icons/fa ---------- */
vi.mock("react-icons/fa", () => ({
  __esModule: true,
  FaLock: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-lock" {...props} />
  ),
  FaEnvelope: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-envelope" {...props} />
  ),
}));

/* ---------- component ---------- */
import { AccessDenied } from "@/components/AccessDenied"; // <-- adegua il path se necessario
import { useReducedMotion } from "framer-motion";

describe("AccessDenied Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza la sezione accessibile con aria-labelledby, il titolo principale e il testo informativo", () => {
    render(<AccessDenied />);

    const modalRegion = screen.getByRole("region", {
      name: "Accesso non disponibile",
    });
    expect(modalRegion).toBeInTheDocument();

    expect(
      screen.getByRole("heading", {
        name: "Accesso non disponibile",
        level: 1,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByText(
        /Al momento non hai accesso a questa tipologia di servizio\./i
      )
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /Rivedi i tuoi piani e scegli quello più adatto alle tue esigenze\./i
      )
    ).toBeInTheDocument();
  });

  test("renderizza le icone di blocco (FaLock) e contatto (FaEnvelope)", () => {
    render(<AccessDenied />);

    expect(screen.getByTestId("icon-lock")).toBeInTheDocument();
    expect(screen.getByTestId("icon-envelope")).toBeInTheDocument();
  });

  test("renderizza i link di navigazione con attributi href e aria-label corretti", () => {
    render(<AccessDenied />);

    const plansLink = screen.getByRole("link", {
      name: "Vai alla pagina dei piani disponibili",
    });
    expect(plansLink).toBeInTheDocument();
    expect(plansLink).toHaveAttribute("href", "/profilo/piani");
    expect(plansLink).toHaveTextContent("Vedi piani");

    const contactLink = screen.getByRole("link", {
      name: "Vai alla pagina contatti",
    });
    expect(contactLink).toBeInTheDocument();
    expect(contactLink).toHaveAttribute("href", "/contatti");
    expect(contactLink).toHaveTextContent("Contattaci");
  });

  test("renderizza la micro-copy di supporto in caso di errore", () => {
    render(<AccessDenied />);

    expect(
      screen.getByText(
        "Se pensi si tratti di un errore, scrivici e ti aiuteremo subito."
      )
    ).toBeInTheDocument();
  });

  test("renderizza correttamente il componente quando useReducedMotion restituisce true", () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);

    render(<AccessDenied />);

    expect(
      screen.getByRole("heading", {
        name: "Accesso non disponibile",
        level: 1,
      })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Vai alla pagina dei piani disponibili",
      })
    ).toBeInTheDocument();
  });
});