import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { HTMLAttributes, ReactNode, SVGProps } from "react";
import { AccessDenied } from "@/shared/components/AccessDenied";
import { useReducedMotion } from "framer-motion";

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", () => ({
  __esModule: true,
  useReducedMotion: vi.fn(() => false),
  motion: {
    section: ({ children, ...props }: HTMLAttributes<HTMLElement>) => (
      <section {...props}>{children}</section>
    ),
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
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
    children: ReactNode;
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
  FaLock: (props: SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-lock" {...props} />
  ),
  FaCheck: (props: SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-check" {...props} />
  ),
  FaArrowRight: (props: SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-arrow-right" {...props} />
  ),
}));

describe("AccessDenied Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("renderizza la sezione modale accessibile con aria-labelledby, il titolo principale e il testo informativo", () => {
    render(<AccessDenied />);

    const modalDialog = screen.getByRole("dialog");
    expect(modalDialog).toBeInTheDocument();
    expect(modalDialog).toHaveAttribute("aria-modal", "true");
    expect(modalDialog).toHaveAttribute("aria-labelledby", "access-gate-title");

    expect(
      screen.getByRole("heading", {
        name: /Sblocca l[’']accesso con Jurio/i,
        level: 1,
      })
    ).toBeInTheDocument();

    expect(screen.getByText("Esclusivo per Jurio")).toBeInTheDocument();
    expect(
      screen.getByText(/Questa funzionalità è riservata alla community di/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/7 giorni di prova gratuita/i)
    ).toBeInTheDocument();
  });

  test("renderizza le icone corrette (FaLock, FaCheck e FaArrowRight)", () => {
    render(<AccessDenied />);

    expect(screen.getByTestId("icon-lock")).toBeInTheDocument();
    expect(screen.getAllByTestId("icon-check")).toHaveLength(2);
    expect(screen.getByTestId("icon-arrow-right")).toBeInTheDocument();
  });

  test("renderizza i punti di rassicurazione (Nessuna carta richiesta e Accesso completo)", () => {
    render(<AccessDenied />);

    expect(screen.getByText("Nessuna carta richiesta")).toBeInTheDocument();
    expect(
      screen.getByText("Accesso completo per 1 settimana")
    ).toBeInTheDocument();
  });

  test("renderizza i link di navigazione verso prova gratuita, login e supporto", () => {
    render(<AccessDenied />);

    const trialLink = screen.getByRole("link", {
      name: /Inizia la prova gratuita/i,
    });
    expect(trialLink).toBeInTheDocument();
    expect(trialLink).toHaveAttribute("href", "/profilo");

    const loginLink = screen.getByRole("link", {
      name: /Hai già un account\? Accedi/i,
    });
    expect(loginLink).toBeInTheDocument();
    expect(loginLink).toHaveAttribute("href", "/login");

    const supportLink = screen.getByRole("link", {
      name: /Contatta il supporto/i,
    });
    expect(supportLink).toBeInTheDocument();
    expect(supportLink).toHaveAttribute("href", "/contatti");
  });

  test("renderizza correttamente il componente quando useReducedMotion restituisce true", () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);

    render(<AccessDenied />);

    expect(
      screen.getByRole("heading", {
        name: /Sblocca l[’']accesso con Jurio/i,
        level: 1,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", {
        name: /Inizia la prova gratuita/i,
      })
    ).toBeInTheDocument();
  });
});