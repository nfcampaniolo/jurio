import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

/* ---------- tipi mock StripeCheckout ---------- */
interface MockStripeCheckoutProps {
  planId: string;
  activeCoupon?: { code: string; percentage: number } | null;
  onSuccess: (details: { id: string }) => void;
  onError: (err: Error) => void;
}

/* ---------- mock StripeCheckout ---------- */
vi.mock("@/components/Plans/StripeCheckout", () => ({
  default: ({ planId, activeCoupon, onSuccess, onError }: MockStripeCheckoutProps) => (
    <div data-testid="mock-stripe-checkout" data-plan-id={planId}>
      <span>Piano Selezionato: {planId}</span>
      {activeCoupon && <span>Coupon Applicato: {activeCoupon.code} ({activeCoupon.percentage}%)</span>}
      <button type="button" onClick={() => onSuccess({ id: "sess_test_123" })}>
        Simula Successo Stripe
      </button>
      <button type="button" onClick={() => onError(new Error("Errore autorizzazione carta"))}>
        Simula Errore Stripe
      </button>
    </div>
  ),
}));

/* ---------- mock framer-motion ---------- */
vi.mock("framer-motion", async () => {
  const ReactActual = await import("react");
  type Props = React.PropsWithChildren<Record<string, unknown>>;

  const passthrough =
    (Tag: string) =>
    ({ children, ...props }: Props) =>
      ReactActual.createElement(Tag, props, children);

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion: {
      div: passthrough("div"),
      button: passthrough("button"),
    },
  };
});

/* ---------- component ---------- */
import PaymentModal from "@/components/Plans/PaymentModal"; // <-- adegua il path se necessario

describe("PaymentModal Component Suite", () => {
  const mockOnClose = vi.fn<() => void>();

  beforeEach(() => {
    vi.clearAllMocks();
    document.body.style.overflow = "";
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("non renderizza nulla nel DOM quando la prop open è false", () => {
    render(
      <PaymentModal
        open={false}
        onClose={mockOnClose}
        planName="Essential Annuale"
        basePrice={49}
      />
    );

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  test("renderizza il modale accessibile con blocco dello scroll del body quando open è true", () => {
    const { unmount } = render(
      <PaymentModal
        open={true}
        onClose={mockOnClose}
        planName="Business Annuale"
        basePrice={99}
      />
    );

    const dialog = screen.getByRole("dialog", { name: "Pagamento – Piano Business Annuale" });
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-modal", "true");

    expect(screen.getByRole("heading", { name: "Pagamento – Piano Business Annuale", level: 3 })).toBeInTheDocument();
    expect(document.body.style.overflow).toBe("hidden");

    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  test("gestisce la chiusura tramite pulsante ✕, pulsante Annulla, backdrop e tasto Escape", () => {
    const { rerender } = render(
      <PaymentModal
        open={true}
        onClose={mockOnClose}
        planName="Essential Annuale"
        basePrice={49}
      />
    );

    // 1. Click su pulsante di chiusura ✕
    const closeIconBtn = screen.getByRole("button", { name: "Chiudi" });
    fireEvent.click(closeIconBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    // 2. Click su pulsante Annulla
    const cancelBtn = screen.getByRole("button", { name: "Annulla" });
    fireEvent.click(cancelBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(2);

    // 3. Pressione tasto Escape
    fireEvent.keyDown(window, { key: "Escape" });
    expect(mockOnClose).toHaveBeenCalledTimes(3);

    // 4. Click sul backdrop overlay
    const backdropBtn = screen.getByRole("button", { name: "Chiudi modale" });
    fireEvent.mouseDown(backdropBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(4);

    // Se open passa a false, l'evento Escape non deve più invocare onClose
    rerender(
      <PaymentModal
        open={false}
        onClose={mockOnClose}
        planName="Essential Annuale"
      />
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(mockOnClose).toHaveBeenCalledTimes(4);
  });

  test("converte correttamente le diverse tipologie di piano in planId per Stripe", () => {
    const testCases: Array<{ planName: string; expectedId: string }> = [
      { planName: "Essential Annuale", expectedId: "personale" },
      { planName: "Business Annuale", expectedId: "business" },
      { planName: "Essential Mensile", expectedId: "personale_m" },
      { planName: "Business Mensile", expectedId: "business_m" },
      { planName: "Team 3", expectedId: "team3" },
      { planName: "Team 5", expectedId: "team5" },
      { planName: "Team 7", expectedId: "team7" },
      { planName: "Piano Custom Sconosciuto", expectedId: "personale" },
    ];

    testCases.forEach(({ planName, expectedId }) => {
      const { unmount } = render(
        <PaymentModal
          open={true}
          onClose={mockOnClose}
          planName={planName}
          basePrice={100}
        />
      );

      const stripeMock = screen.getByTestId("mock-stripe-checkout");
      expect(stripeMock).toHaveAttribute("data-plan-id", expectedId);
      expect(screen.getByText(`Piano Selezionato: ${expectedId}`)).toBeInTheDocument();

      unmount();
    });
  });

  test("calcola e formatta il prezzo base standard senza sconti (interi e decimali con virgola)", () => {
    // Prezzo intero
    const { rerender } = render(
      <PaymentModal
        open={true}
        onClose={mockOnClose}
        planName="Essential Annuale"
        basePrice={49}
      />
    );

    expect(screen.getByText("Totale:")).toBeInTheDocument();
    expect(screen.getByText("€ 49")).toBeInTheDocument();

    // Prezzo decimale passato come stringa con virgola
    rerender(
      <PaymentModal
        open={true}
        onClose={mockOnClose}
        planName="Essential Mensile"
        basePrice="9,90"
      />
    );

    expect(screen.getByText("€ 9,90")).toBeInTheDocument();
  });

  test("mostra lo sconto nativo barrato quando initialPrice è maggiore di basePrice", () => {
    render(
      <PaymentModal
        open={true}
        onClose={mockOnClose}
        planName="Business Annuale"
        basePrice={80}
        initialPrice={100}
      />
    );

    expect(screen.getByText("€ 80")).toBeInTheDocument();
    expect(screen.getByText("€ 100")).toHaveClass("line-through");
    expect(screen.queryByText("Doppio Sconto Attivo")).toBeNull();
  });

  test("applica la riduzione percentuale del coupon promozionale sul prezzo base", () => {
    render(
      <PaymentModal
        open={true}
        onClose={mockOnClose}
        planName="Essential Annuale"
        basePrice={100}
        activeCoupon={{ code: "JURIO20", percentage: 20 }}
      />
    );

    // 100 - (100 * 0.20) = 80
    expect(screen.getByText("€ 80")).toBeInTheDocument();
    expect(screen.getByText("€ 100")).toHaveClass("line-through");
    expect(screen.getByText("Coupon Applicato: JURIO20 (20%)")).toBeInTheDocument();
    expect(screen.queryByText("Doppio Sconto Attivo")).toBeNull();
  });

  test("gestisce il Doppio Sconto Attivo combinando sconto nativo e coupon", () => {
    render(
      <PaymentModal
        open={true}
        onClose={mockOnClose}
        planName="Team 3"
        basePrice={100}
        initialPrice={150}
        activeCoupon={{ code: "PROMO50", percentage: 50 }}
      />
    );

    // Doppio sconto: initial = 150 (barrato), final = 100 - (100 * 0.50) = 50
    expect(screen.getByText("Doppio Sconto Attivo")).toBeInTheDocument();
    expect(screen.getByText("€ 50")).toBeInTheDocument();
    expect(screen.getByText("€ 150")).toHaveClass("line-through");
  });

  test("gestisce i callback di successo ed errore emessi da StripeCheckout", () => {
    render(
      <PaymentModal
        open={true}
        onClose={mockOnClose}
        planName="Business Annuale"
        basePrice={99}
      />
    );

    // Simulazione errore Stripe
    const errorBtn = screen.getByRole("button", { name: "Simula Errore Stripe" });
    fireEvent.click(errorBtn);
    expect(console.error).toHaveBeenCalledWith("Stripe error", expect.any(Error));
    expect(mockOnClose).not.toHaveBeenCalled();

    // Simulazione successo Stripe -> chiude il modale
    const successBtn = screen.getByRole("button", { name: "Simula Successo Stripe" });
    fireEvent.click(successBtn);
    expect(console.log).toHaveBeenCalledWith("Stripe session created", { id: "sess_test_123" });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});