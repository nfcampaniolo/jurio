import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { DeepAnalysisLanding } from "@/features/analisi/components/DeepAnalysisLanding";
import { useReducedMotion } from "framer-motion";

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", async (importOriginal) => {
  const actual = await importOriginal<typeof import("framer-motion")>();
  return {
    ...actual,
    useReducedMotion: vi.fn(() => false),
    motion: {
      h1: ({ children, id, className, style }: React.HTMLAttributes<HTMLHeadingElement>) => (
        <h1 id={id} className={className} style={style}>
          {children}
        </h1>
      ),
      p: ({ children, className }: React.HTMLAttributes<HTMLParagraphElement>) => (
        <p className={className}>{children}</p>
      ),
      li: ({ children, className }: React.LiHTMLAttributes<HTMLLIElement>) => (
        <li className={className}>{children}</li>
      ),
      div: ({ children, className }: React.HTMLAttributes<HTMLDivElement>) => (
        <div className={className}>{children}</div>
      ),
    },
  };
});

/* ---------- mock ButtonCTA e CTASection ---------- */
vi.mock("@/shared/components/ButtonCTA", () => ({
  ButtonCTA: ({ children, onClick, "aria-label": ariaLabel }: { children: React.ReactNode; onClick?: () => void; "aria-label"?: string }) => (
    <button type="button" onClick={onClick} aria-label={ariaLabel}>
      {children}
    </button>
  ),
}));

vi.mock("@/features/search/components/CTASection", () => ({
  default: () => <div data-testid="lazy-cta-section">CTASection Mock</div>,
}));

const mockedUseReducedMotion = vi.mocked(useReducedMotion);

describe("DeepAnalysisLanding Component Suite", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseReducedMotion.mockReturnValue(false);

    // Mock di window.location per testare il reindirizzamento nativo
    const locationMock = {
      ...originalLocation,
      href: "http://localhost:3000/",
    };
    Object.defineProperty(window, "location", {
      value: locationMock,
      writable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      value: originalLocation,
      writable: true,
    });
  });

  test("renderizza l'intestazione principale, la descrizione e le 4 fasi del workflow", () => {
    render(<DeepAnalysisLanding />);

    expect(
      screen.getByRole("heading", { level: 1, name: /l'approfondimento giurisprudenziale per i casi più complessi/i })
    ).toBeInTheDocument();

    expect(
      screen.getByText(/uno strumento evoluto di intelligence giuridica pensato per gli studi legali/i)
    ).toBeInTheDocument();

    const workflowItems = screen.getAllByRole("listitem");
    expect(workflowItems).toHaveLength(4);

    expect(screen.getByText("Inquadramento della Questione")).toBeInTheDocument();
    expect(screen.getByText("Scrutinio delle Fonti Ufficiali")).toBeInTheDocument();
    expect(screen.getByText("Approfondimento Dinamico")).toBeInTheDocument();
    expect(screen.getByText("Sintesi Strategica")).toBeInTheDocument();
  });

  test("renderizza i piani di accesso (Essential e Business)", () => {
    render(<DeepAnalysisLanding />);

    expect(screen.getByText("Essential")).toBeInTheDocument();
    expect(screen.getByText("Indagine giurisprudenziale avanzata")).toBeInTheDocument();

    expect(screen.getByText("Business")).toBeInTheDocument();
    expect(screen.getByText("Elaborazione atti e fascicoli")).toBeInTheDocument();
  });

  test("reindirizza alla pagina dei prezzi al clic sulla CTA dei piani", () => {
    render(<DeepAnalysisLanding />);

    const ctaButton = screen.getByRole("button", { name: /attiva l'analisi assistita su un documento esterno/i });
    fireEvent.click(ctaButton);

    expect(window.location.href).toBe("/prezzi");
  });

  test("renderizza la sezione CTA lazy loaded", async () => {
    render(<DeepAnalysisLanding />);

    const lazySection = await screen.findByTestId("lazy-cta-section");
    expect(lazySection).toBeInTheDocument();
  });

  test("gestisce correttamente la modalità reduced motion senza crashare", () => {
    mockedUseReducedMotion.mockReturnValue(true);

    render(<DeepAnalysisLanding />);

    expect(
      screen.getByRole("heading", { level: 1, name: /l'approfondimento giurisprudenziale per i casi più complessi/i })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });
});