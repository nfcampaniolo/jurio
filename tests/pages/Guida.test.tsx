import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

/* ---------- mock react-router-dom ---------- */
let mockSlug: string | undefined = undefined;

vi.mock("react-router-dom", () => ({
  __esModule: true,
  useParams: () => ({ slug: mockSlug }),
}));

/* ---------- mock @dr.pogodin/react-helmet ---------- */
vi.mock("@dr.pogodin/react-helmet", () => ({
  __esModule: true,
  Helmet: () => null,
}));

/* ---------- mock GuideLayout ---------- */
vi.mock("@/components/Guida/GuideLayout", () => ({
  __esModule: true,
  default: ({
    currentSlug,
    children,
  }: {
    currentSlug: string;
    children: React.ReactNode;
  }) => (
    <div data-testid="guide-layout" data-slug={currentSlug}>
      {children}
    </div>
  ),
}));

/* ---------- mock guideContent ---------- */
vi.mock("@/hooks/guideContent", () => ({
  __esModule: true,
  guideContent: {
    introduzione: (
      <div data-testid="content-introduzione">Contenuto Introduzione alla Piattaforma</div>
    ),
    "ricerca-giurisprudenza": (
      <div data-testid="content-ricerca">Contenuto Ricerca Giurisprudenza</div>
    ),
  },
}));

/* ---------- component under test ---------- */
import Guida from "@/pages/Guida"; // <-- adegua il path se necessario

describe("Guida Page Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSlug = undefined;
  });

  test("utilizza lo slug di fallback 'introduzione' quando il parametro slug non è presente", () => {
    mockSlug = undefined;
    render(<Guida />);

    const layout = screen.getByTestId("guide-layout");
    expect(layout).toHaveAttribute("data-slug", "introduzione");
    expect(screen.getByTestId("content-introduzione")).toBeInTheDocument();
    expect(screen.getByText("Contenuto Introduzione alla Piattaforma")).toBeInTheDocument();
  });

  test("renderizza il contenuto corrispondente quando lo slug esiste", () => {
    mockSlug = "ricerca-giurisprudenza";
    render(<Guida />);

    const layout = screen.getByTestId("guide-layout");
    expect(layout).toHaveAttribute("data-slug", "ricerca-giurisprudenza");
    expect(screen.getByTestId("content-ricerca")).toBeInTheDocument();
    expect(screen.getByText("Contenuto Ricerca Giurisprudenza")).toBeInTheDocument();
  });

  test("mostra il messaggio di errore 404 quando lo slug richiesto non è presente in guideContent", () => {
    mockSlug = "guida-inesistente";
    render(<Guida />);

    const layout = screen.getByTestId("guide-layout");
    expect(layout).toHaveAttribute("data-slug", "guida-inesistente");

    expect(
      screen.getByRole("heading", { name: "Pagina non trovata", level: 1 })
    ).toBeInTheDocument();
    expect(
      screen.getByText("L'articolo che stai cercando non esiste o è stato spostato.")
    ).toBeInTheDocument();

    expect(screen.queryByTestId("content-introduzione")).not.toBeInTheDocument();
    expect(screen.queryByTestId("content-ricerca")).not.toBeInTheDocument();
  });
});