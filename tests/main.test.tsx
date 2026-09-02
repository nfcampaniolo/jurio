import { describe, test, expect, vi, beforeEach } from "vitest";
import React from "react";

/* ---------- hoisted mocks ---------- */
const { mockRender, mockCreateRoot } = vi.hoisted(() => {
  const renderFn = vi.fn();
  const createRootFn = vi.fn<(container: Element | DocumentFragment) => { render: typeof renderFn }>(
    () => ({
      render: renderFn,
    })
  );
  return {
    mockRender: renderFn,
    mockCreateRoot: createRootFn,
  };
});

/* ---------- mock react-dom/client ---------- */
vi.mock("react-dom/client", () => ({
  __esModule: true,
  createRoot: (container: Element | DocumentFragment) => mockCreateRoot(container),
}));

/* ---------- mock components & providers ---------- */
vi.mock("./App", () => ({
  __esModule: true,
  default: () => <div data-testid="mock-app">App Component</div>,
}));

vi.mock("@/context/AuthProvider", () => ({
  __esModule: true,
  AuthProvider: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="mock-auth-provider">{children}</div>
  ),
}));

vi.mock("@/components/FirebaseInit", () => ({
  __esModule: true,
  default: () => <div data-testid="mock-firebase-init" />,
}));

vi.mock("@dr.pogodin/react-helmet", () => ({
  __esModule: true,
  HelmetProvider: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="mock-helmet-provider">{children}</div>
  ),
}));

vi.mock("react-hot-toast", () => ({
  __esModule: true,
  Toaster: () => <div data-testid="mock-toaster" />,
}));

vi.mock("./index.css", () => ({}));

describe("Main Entry Point Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    document.body.innerHTML = "";
  });

  test("inizializza createRoot e renderizza l'albero React quando #root è presente nel DOM", async () => {
    const rootContainer = document.createElement("div");
    rootContainer.id = "root";
    document.body.appendChild(rootContainer);

    await import("@/main");

    expect(mockCreateRoot).toHaveBeenCalledTimes(1);
    expect(mockCreateRoot).toHaveBeenCalledWith(rootContainer);
    expect(mockRender).toHaveBeenCalledTimes(1);
  });

  test("solleva un'eccezione esplicita se l'elemento #root non è presente nel DOM", async () => {
    await expect(import("@/main")).rejects.toThrow("Elemento #root non trovato");

    expect(mockCreateRoot).not.toHaveBeenCalled();
    expect(mockRender).not.toHaveBeenCalled();
  });
});