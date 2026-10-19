import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

/* ---------- mock componenti ausiliari ---------- */
vi.mock("@/shared/components/ScrollToTop", () => ({
  default: () => <div data-testid="mock-scroll-to-top" />,
}));

/* ---------- mock rotte applicative ---------- */
vi.mock("@/routes/routes", async () => {
  const ReactModule = await import("react");
  const Suspended = ReactModule.lazy(
    () => new Promise<{ default: React.ComponentType }>(() => {})
  );

  return {
    appRoutes: [
      {
        path: "/",
        element: ReactModule.createElement("div", { "data-testid": "mock-home-page" }, "Home Jurio"),
      },
      {
        path: "/loading-test",
        element: ReactModule.createElement(Suspended),
      },
    ],
  };
});

/* ---------- subject under test ---------- */
import App from "@/App";

describe("App Root Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.pushState({}, "Test page", "/");
  });

  test("renderizza correttamente l'albero dell'applicazione con ScrollToTop e la rotta attiva", () => {
    render(<App />);

    expect(screen.getByTestId("mock-scroll-to-top")).toBeInTheDocument();
    expect(screen.getByTestId("mock-home-page")).toBeInTheDocument();

    // Verifica che AuthLoader non sia presente quando la pagina è pronta
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  test("mostra AuthLoader come fallback di Suspense quando una rotta lazy è in caricamento", () => {
    window.history.pushState({}, "Loading route", "/loading-test");

    render(<App />);

    // Suspense scatta: AuthLoader espone role="status" e il brand "Jurio"
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Jurio")).toBeInTheDocument();

    // ScrollToTop e la rotta non devono essere nel DOM durante il fallback di Suspense
    expect(screen.queryByTestId("mock-scroll-to-top")).not.toBeInTheDocument();
    expect(screen.queryByTestId("mock-home-page")).not.toBeInTheDocument();
  });
});