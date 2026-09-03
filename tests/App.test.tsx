import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

/* ---------- mock componenti ausiliari ---------- */
vi.mock("@/shared/components/ScrollToTop", () => ({
  default: () => <div data-testid="mock-scroll-to-top" />,
}));

// Abbiamo rimosso il mock di AuthLoader. 
// Lasciamo che React renderizzi quello vero, che è solo pura UI!

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
    
    // Verifica che il vero AuthLoader NON sia presente
    expect(screen.queryByText(/Caricamento…/i)).toBeNull();
  });

  test("mostra AuthLoader come fallback di Suspense quando una rotta lazy è in caricamento", () => {
    window.history.pushState({}, "Loading route", "/loading-test");

    render(<App />);

    // Suspense si attiva: mostra SOLO il fallback e nasconde i children
    expect(screen.getByText(/Caricamento…/i)).toBeInTheDocument();
    
    // Verifica corretta: ScrollToTop NON deve essere nel DOM in questo momento!
    expect(screen.queryByTestId("mock-scroll-to-top")).toBeNull();
  });
});