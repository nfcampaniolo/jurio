import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

/* ---------- hoisted mocks ---------- */
const { mockUseReducedMotion } = vi.hoisted(() => ({
  mockUseReducedMotion: vi.fn(() => false),
}));

/* ---------- mock @dr.pogodin/react-helmet ---------- */
vi.mock("@dr.pogodin/react-helmet", () => ({
  __esModule: true,
  Helmet: () => null,
}));

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", () => ({
  __esModule: true,
  useReducedMotion: () => mockUseReducedMotion(),
  motion: {
    article: React.forwardRef<
      HTMLElement,
      React.HTMLAttributes<HTMLElement> & {
        initial?: unknown;
        animate?: unknown;
        transition?: unknown;
      }
    >(({ children, ...props }, ref) => (
      <article ref={ref} {...props}>
        {children}
      </article>
    )),
  },
}));

/* ---------- mock subcomponents ---------- */
vi.mock("@/shared/components/Header", () => ({
  __esModule: true,
  Header: () => <header data-testid="main-header">Header</header>,
}));

vi.mock("@/shared/components/Footer", () => ({
  __esModule: true,
  Footer: () => <footer data-testid="main-footer">Footer</footer>,
}));

/* ---------- component under test ---------- */
import SupportoWord from "@/features/guide/components/SupportoWord"; // <-- adegua il path se necessario

describe("SupportoWord Page Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReducedMotion.mockReturnValue(false);
  });

  test("renderizza Header, Footer, badge di stato e i titoli delle sezioni informative", () => {
    render(<SupportoWord />);

    expect(screen.getByTestId("main-header")).toBeInTheDocument();
    expect(screen.getByTestId("main-footer")).toBeInTheDocument();

    expect(screen.getByRole("status")).toHaveTextContent("In fase di implementazione");
    expect(
      screen.getByRole("heading", { name: "Integrazione Microsoft Word", level: 1 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Roadmap di rilascio", level: 2 })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Soluzioni alternative immediate", level: 2 })
    ).toBeInTheDocument();
  });

  test("renderizza il link diretto alla chat con href e aria-label conformi", () => {
    render(<SupportoWord />);

    const chatLink = screen.getByRole("link", {
      name: /Accedi alla chat per i servizi di sintesi/i,
    });
    expect(chatLink).toBeInTheDocument();
    expect(chatLink).toHaveAttribute("href", "/chat");
    expect(screen.getByText("Accedi alla Chat")).toBeInTheDocument();
  });

  test("renderizza correttamente la struttura quando useReducedMotion è attivo", () => {
    mockUseReducedMotion.mockReturnValue(true);

    render(<SupportoWord />);

    expect(
      screen.getByRole("heading", { name: "Integrazione Microsoft Word", level: 1 })
    ).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});