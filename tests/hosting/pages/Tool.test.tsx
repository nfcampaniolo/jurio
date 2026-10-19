import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

/* ---------- mock helmet ---------- */
vi.mock("@dr.pogodin/react-helmet", () => ({
  Helmet: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-helmet">{children}</div>
  ),
}));

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", async () => {
  const ReactActual = await import("react");
  const passthrough =
    (Tag: string) =>
    ({ children, ...props }: React.HTMLAttributes<HTMLElement> & { [key: string]: unknown }) =>
      ReactActual.createElement(Tag, props, children);

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: passthrough("div"),
    },
  };
});

/* ---------- mock useAuth hook ---------- */
const mockUseAuth = vi.fn();
vi.mock("@/context/useAuth", () => ({
  useAuth: () => mockUseAuth(),
}));

/* ---------- mock layout / core components ---------- */
vi.mock("@/shared/components/Header", () => ({
  Header: () => <header data-testid="mock-header">Header</header>,
}));

vi.mock("@/shared/components/Footer", () => ({
  Footer: () => <footer data-testid="mock-footer">Footer</footer>,
}));

/* ---------- mock search sub-components (named e default exports) ---------- */
vi.mock("@/features/search/components/SearchBar", () => ({
  SearchBar: () => <div data-testid="mock-search-bar">Search Bar Component</div>,
}));

vi.mock("@/features/search/components/ComeFunziona", () => ({
  ComeFunziona: () => <div data-testid="mock-come-funziona">Come Funziona Component</div>,
}));

vi.mock("@/features/search/components/CTASection", () => ({
  default: () => <div data-testid="mock-cta-section">CTA Section Component</div>,
}));

vi.mock("@/features/search/components/CTADocument", () => ({
  CTADocument: () => <div data-testid="mock-cta-document">CTA Document Component</div>,
}));

/* ---------- subject under test ---------- */
import { Tool } from "@/features/search/Tool";

describe("Tool Page Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("mostra lo spinner durante il caricamento dello stato auth", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: true,
      status: "loading",
    });

    const { container } = render(<Tool />);

    expect(screen.getByTestId("mock-header")).toBeInTheDocument();
    expect(screen.getByTestId("mock-footer")).toBeInTheDocument();
    expect(container.querySelector(".animate-spin")).toBeInTheDocument();

    expect(screen.queryByTestId("mock-search-bar")).toBeNull();
    expect(screen.queryByTestId("mock-come-funziona")).toBeNull();
  });

  test("renderizza la vista Guest (ComeFunziona e CTASection) quando l'utente non è autenticato", async () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      status: "unauthenticated",
    });

    render(<Tool />);

    await waitFor(() => {
      expect(screen.getByTestId("mock-come-funziona")).toBeInTheDocument();
      expect(screen.getByTestId("mock-cta-section")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("mock-search-bar")).toBeNull();
    expect(screen.queryByTestId("mock-cta-document")).toBeNull();
  });

  test("renderizza la vista Autenticata (SearchBar e CTADocument) quando l'utente ha una sessione attiva", async () => {
    mockUseAuth.mockReturnValue({
      user: { uid: "usr_flv_2026", email: "nicolocampaniolo@gmail.com" },
      loading: false,
      status: "authenticated",
    });

    render(<Tool />);

    await waitFor(() => {
      expect(screen.getByTestId("mock-search-bar")).toBeInTheDocument();
      expect(screen.getByTestId("mock-cta-document")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("mock-come-funziona")).toBeNull();
    expect(screen.queryByTestId("mock-cta-section")).toBeNull();
  });

  test("configura l'intestazione semantica h1 e i metadati SEO", () => {
    mockUseAuth.mockReturnValue({
      user: null,
      loading: false,
      status: "unauthenticated",
    });

    render(<Tool />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: "Ricerca Giurisprudenziale Avanzata con Intelligenza Artificiale",
      })
    ).toBeInTheDocument();
    expect(screen.getByTestId("mock-helmet")).toBeInTheDocument();
  });
});