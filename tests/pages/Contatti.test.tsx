import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";

/* ---------- mock @dr.pogodin/react-helmet ---------- */
vi.mock("@dr.pogodin/react-helmet", () => ({
  __esModule: true,
  Helmet: () => null,
}));

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", () => ({
  __esModule: true,
  useReducedMotion: vi.fn(() => false),
  motion: {
    div: React.forwardRef<
      HTMLDivElement,
      React.HTMLAttributes<HTMLDivElement> & {
        initial?: unknown;
        animate?: unknown;
        exit?: unknown;
        transition?: unknown;
        layoutId?: unknown;
      }
    >(
      (
        {
          children,
          ...props
        },
        ref
      ) => (
        <div ref={ref} {...props}>
          {children}
        </div>
      )
    ),
  },
}));

/* ---------- mock subcomponents ---------- */
vi.mock("@/components/Info/Header", () => ({
  __esModule: true,
  Header: () => <header data-testid="support-header">Header Navigation</header>,
}));

vi.mock("@/components/Info/SupportForm", () => ({
  __esModule: true,
  SupportForm: () => <section data-testid="support-form">Modulo di Supporto</section>,
}));

vi.mock("@/components/Info/SupportSidebar", () => ({
  __esModule: true,
  SupportSidebar: () => <aside data-testid="support-sidebar">Sidebar Supporto & FAQ</aside>,
}));

vi.mock("@/components/Info/JurioChatbot", () => ({
  __esModule: true,
  default: () => <div data-testid="jurio-chatbot">Jurio AI Assistant Widget</div>,
}));

/* ---------- component ---------- */
import Supporto from "@/pages/Contatti";
import { useReducedMotion } from "framer-motion";

describe("Supporto Page Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useReducedMotion).mockReturnValue(false);
  });

  test("renderizza la struttura principale: Header, Form di supporto e Sidebar informativa", () => {
    render(<Supporto />);

    expect(screen.getByTestId("support-header")).toBeInTheDocument();
    expect(screen.getByTestId("support-form")).toBeInTheDocument();
    expect(screen.getByTestId("support-sidebar")).toBeInTheDocument();
  });

  test("carica e visualizza il widget JurioChatbot tramite lazy Suspense", async () => {
    render(<Supporto />);

    await waitFor(() => {
      expect(screen.getByTestId("jurio-chatbot")).toBeInTheDocument();
    });
  });

  test("renderizza correttamente quando useReducedMotion è attivo", () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);

    render(<Supporto />);

    expect(screen.getByTestId("support-form")).toBeInTheDocument();
    expect(screen.getByTestId("support-sidebar")).toBeInTheDocument();
  });
});