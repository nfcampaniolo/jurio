import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";

/* ---------- mock react-router-dom ---------- */
let mockPathname = "/";

vi.mock("react-router-dom", () => ({
  __esModule: true,
  useLocation: () => ({
    pathname: mockPathname,
    search: "",
    hash: "",
    state: null,
    key: "default",
  }),
}));

/* ---------- component ---------- */
import ScrollToTop from "@/shared/components/ScrollToTop"; // <-- adegua il path se necessario

describe("ScrollToTop Component Suite", () => {
  const originalScrollTo = window.scrollTo;

  beforeEach(() => {
    mockPathname = "/";
    window.scrollTo = vi.fn();
  });

  afterEach(() => {
    window.scrollTo = originalScrollTo;
    vi.clearAllMocks();
  });

  test("esegue window.scrollTo(0, 0) al montaggio del componente", () => {
    render(<ScrollToTop />);

    expect(window.scrollTo).toHaveBeenCalledTimes(1);
    expect(window.scrollTo).toHaveBeenCalledWith(0, 0);
  });

  test("esegue window.scrollTo(0, 0) al variare del pathname di navigazione", () => {
    const { rerender } = render(<ScrollToTop />);

    expect(window.scrollTo).toHaveBeenCalledTimes(1);

    // Simula cambio di route
    mockPathname = "/guida/analisi-documenti";
    rerender(<ScrollToTop />);

    expect(window.scrollTo).toHaveBeenCalledTimes(2);
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 0);
  });

  test("non esegue nuovamente scrollTo se il pathname rimane invariato durante il re-render", () => {
    const { rerender } = render(<ScrollToTop />);

    expect(window.scrollTo).toHaveBeenCalledTimes(1);

    // Re-render senza cambio di pathname
    rerender(<ScrollToTop />);

    expect(window.scrollTo).toHaveBeenCalledTimes(1);
  });

  test("non renderizza alcun nodo visibile nel DOM", () => {
    const { container } = render(<ScrollToTop />);

    expect(container).toBeEmptyDOMElement();
  });
});