import { describe, test, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

/* ---------- mock optionalService ---------- */
const mockInitializeOptionalServices = vi.fn();

vi.mock("@/services/optionalService", () => ({
  __esModule: true,
  initializeOptionalServices: () => mockInitializeOptionalServices(),
}));

/* ---------- component ---------- */
import FirebaseInit from "@/components/FirebaseInit"; // <-- adegua il path se necessario

describe("FirebaseInit Component Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("chiama initializeOptionalServices una sola volta al montaggio", () => {
    render(<FirebaseInit />);

    expect(mockInitializeOptionalServices).toHaveBeenCalledTimes(1);
  });

  test("non esegue nuovamente l'inizializzazione sui re-render successivi", () => {
    const { rerender } = render(<FirebaseInit />);

    expect(mockInitializeOptionalServices).toHaveBeenCalledTimes(1);

    rerender(<FirebaseInit />);

    expect(mockInitializeOptionalServices).toHaveBeenCalledTimes(1);
  });

  test("non renderizza elementi visibili nel DOM (restituisce null)", () => {
    const { container } = render(<FirebaseInit />);

    expect(container).toBeEmptyDOMElement();
  });
});