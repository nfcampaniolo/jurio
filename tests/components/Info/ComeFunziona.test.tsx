import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

/* ---------- hoisted mocks ---------- */
const { mockUseReducedMotion } = vi.hoisted(() => ({
  mockUseReducedMotion: vi.fn(() => false),
}));

/* ---------- mock react-icons/fi ---------- */
vi.mock("react-icons/fi", () => {
  const createIcon = (name: string) => (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid={`fi-${name}`} {...props} />
  );
  return {
    FiSearch: createIcon("search"),
    FiUpload: createIcon("upload"),
    FiFileText: createIcon("file-text"),
  };
});

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", async () => ({
  useReducedMotion: () => mockUseReducedMotion(),
  motion: {
    h2: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLHeadingElement> & { [key: string]: unknown }) => (
      <h2 {...props}>{children}</h2>
    ),
    p: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLParagraphElement> & { [key: string]: unknown }) => (
      <p {...props}>{children}</p>
    ),
    li: ({
      children,
      ...props
    }: React.LiHTMLAttributes<HTMLLIElement> & { [key: string]: unknown }) => (
      <li {...props}>{children}</li>
    ),
  },
}));

/* ---------- component ---------- */
import { ComeFunziona } from "@/components/Info/ComeFunziona";

describe("ComeFunziona Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReducedMotion.mockReturnValue(false);
  });

  test("renderizza la sezione accessibile con intestazione, sottotitolo e lista ordinata", () => {
    render(<ComeFunziona />);

    const section = screen.getByRole("region", { name: /Come funziona Jurio/i });
    expect(section).toBeInTheDocument();
    expect(section).toHaveAttribute("aria-labelledby", "come-funziona-heading");

    const heading = screen.getByRole("heading", { name: "Come funziona Jurio", level: 2 });
    expect(heading).toBeInTheDocument();
    expect(heading).toHaveAttribute("id", "come-funziona-heading");

    expect(
      screen.getByText(/Jurio unisce giurisprudenza delle Corti Supreme già elaborata/i)
    ).toBeInTheDocument();

    const list = screen.getByRole("list");
    expect(list).toBeInTheDocument();

    const listItems = screen.getAllByRole("listitem");
    expect(listItems).toHaveLength(3);
  });

  test("renderizza tutti i 3 passaggi con titoli, descrizioni e icone corrispondenti", () => {
    render(<ComeFunziona />);

    // Step 1: Database fonti ufficiali
    expect(
      screen.getByRole("heading", { name: "Fonti ufficiali già analizzate", level: 3 })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Accedi alla giurisprudenza delle Corti Supreme — Cassazione Civile/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId("fi-search")).toBeInTheDocument();

    // Step 2: Upload base dati personale
    expect(
      screen.getByRole("heading", { name: "Base dati personale e riservata", level: 3 })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Carica atti e fascicoli in un ambiente privato, separato e sicuro/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId("fi-upload")).toBeInTheDocument();

    // Step 3: Agente AI
    expect(
      screen.getByRole("heading", { name: "Agente AI per ricerca e sintesi", level: 3 })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/L’Agente AI collega fatti, precedenti e norme/i)
    ).toBeInTheDocument();
    expect(screen.getByTestId("fi-file-text")).toBeInTheDocument();
  });

  test("supporta la modalità accessibilità per animazioni ridotte (shouldReduceMotion = true)", () => {
    mockUseReducedMotion.mockReturnValue(true);

    render(<ComeFunziona />);

    expect(
      screen.getByRole("heading", { name: "Come funziona Jurio", level: 2 })
    ).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });
});