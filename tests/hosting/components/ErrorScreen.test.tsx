import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { ErrorScreen } from "@/shared/components/ErrorScreen"; // adegua il path di import in base alla tua struttura

/* ---------- Mock Lucide Icons ---------- */
vi.mock("lucide-react", () => ({
  AlertCircle: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-alert-circle" {...props} />
  ),
  RotateCw: (props: React.SVGProps<SVGSVGElement>) => (
    <svg data-testid="icon-rotate-cw" {...props} />
  ),
}));

describe("ErrorScreen Component Suite", () => {
  const originalReload = window.location.reload;

  beforeEach(() => {
    vi.clearAllMocks();
    // Sovrascriviamo solo il metodo reload mantenendo intatto l'oggetto Location nativo
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...window.location,
        reload: vi.fn(),
      },
    });
  });

  afterEach(() => {
    // Ripristiniamo il reload originale a fine test
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...window.location,
        reload: originalReload,
      },
    });
  });
  
  test("renderizza i messaggi di default e l'icona standard quando non vengono passate props custom", () => {
    render(<ErrorScreen />);

    expect(
      screen.getByRole("heading", { level: 2, name: "Ops, qualcosa è andato storto" })
    ).toBeInTheDocument();
    
    expect(
      screen.getByText("Si è verificato un errore imprevisto.")
    ).toBeInTheDocument();

    expect(screen.getByTestId("icon-alert-circle")).toBeInTheDocument();
    expect(screen.getByTestId("icon-rotate-cw")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Riprova/i })).toBeInTheDocument();
  });

  test("renderizza un messaggio personalizzato e i dettagli tecnici quando forniti", () => {
    render(
      <ErrorScreen
        message="Impossibile connettersi al server di database."
        details="FirebaseError: [code=unavailable]: The service is currently unavailable"
      />
    );

    expect(
      screen.getByText("Impossibile connettersi al server di database.")
    ).toBeInTheDocument();
    
    expect(
      screen.getByText("FirebaseError: [code=unavailable]: The service is currently unavailable")
    ).toBeInTheDocument();
    
    expect(screen.getByText("Dettagli errore:")).toBeInTheDocument();
  });

  test("renderizza un'icona personalizzata se passata via props", () => {
    render(
      <ErrorScreen
        icon={<span data-testid="custom-error-icon">🔥</span>}
      />
    );

    expect(screen.getByTestId("custom-error-icon")).toBeInTheDocument();
    expect(screen.queryByTestId("icon-alert-circle")).toBeNull();
  });

  test("invoca la funzione onRetry personalizzata al click sul bottone 'Riprova'", () => {
    const mockOnRetry = vi.fn();
    render(<ErrorScreen onRetry={mockOnRetry} />);

    const retryButton = screen.getByRole("button", { name: /Riprova/i });
    fireEvent.click(retryButton);

    expect(mockOnRetry).toHaveBeenCalledTimes(1);
    expect(window.location.reload).not.toHaveBeenCalled();
  });

  test("esegue window.location.reload se onRetry non viene fornito al click su 'Riprova'", () => {
    render(<ErrorScreen />);

    const retryButton = screen.getByRole("button", { name: /Riprova/i });
    fireEvent.click(retryButton);

    expect(window.location.reload).toHaveBeenCalledTimes(1);
  });
});