import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";

/* ---------- mock react-dom/client ---------- */

/* ---------- mock react-dom/client ---------- */
const mockRender = vi.fn();
const mockCreateRoot = vi.fn();

vi.mock("react-dom/client", () => ({
  createRoot: (container: Element | DocumentFragment) => {
    mockCreateRoot(container);
    return { render: mockRender };
  },
}));

/* ---------- mock css e componenti radice ---------- */
vi.mock("@/index.css", () => ({}));

vi.mock("@/App", () => ({
  default: () => <div data-testid="mock-app">Jurio App</div>,
}));

vi.mock("@/context/AuthProvider", () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-auth-provider">{children}</div>
  ),
}));

vi.mock("@dr.pogodin/react-helmet", () => ({
  HelmetProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-helmet-provider">{children}</div>
  ),
}));

vi.mock("@/context/FirebaseInit", () => ({
  default: () => <div data-testid="mock-firebase-init" />,
}));

vi.mock("react-hot-toast", () => ({
  Toaster: () => <div data-testid="mock-toaster" />,
}));

describe("Index / Root Bootstrap Suite", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    document.body.innerHTML = "";
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  test("inizializza createRoot e renderizza l'albero applicativo quando il container #root esiste", async () => {
    const rootContainer = document.createElement("div");
    rootContainer.id = "root";
    document.body.appendChild(rootContainer);

    // Import dinamico per eseguire il codice top-level del file
    await import("@/main"); // adegua il path al tuo file entry point (es: "@/main")

    expect(mockCreateRoot).toHaveBeenCalledWith(rootContainer);
    expect(mockRender).toHaveBeenCalledTimes(1);

    // Verifica che l'albero React passato contenga il wrapping atteso
    const renderedTree = mockRender.mock.calls[0][0];
    expect(React.isValidElement(renderedTree)).toBe(true);
    expect(renderedTree.type).toBe(React.StrictMode);
  });

  test("solleva un'eccezione se il nodo #root è assente nel DOM", async () => {
    // Il body è privo di div#root
    await expect(import("@/main")).rejects.toThrow("Elemento #root non trovato");
    expect(mockCreateRoot).not.toHaveBeenCalled();
    expect(mockRender).not.toHaveBeenCalled();
  });
});