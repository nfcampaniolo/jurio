import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

/* ---------- hoisted mocks ---------- */
const {
  mockToast,
  mockGetStripePublishableKey,
  mockFetchPlanPrice,
  mockCreateCheckoutSessionServer,
} = vi.hoisted(() => ({
  mockToast: {
    success: vi.fn(),
    error: vi.fn(),
  },
  mockGetStripePublishableKey: vi.fn().mockReturnValue("pk_test_123"),
  mockFetchPlanPrice: vi.fn().mockResolvedValue({ amount: "29.99", currency: "EUR" }),
  mockCreateCheckoutSessionServer: vi.fn().mockResolvedValue({
    sessionId: "cs_test_123",
    url: "https://checkout.stripe.com/pay/test",
  }),
}));

/* ---------- mock modules ---------- */
vi.mock("react-hot-toast", () => ({
  toast: mockToast,
}));

vi.mock("@/config/env", () => ({
  getStripePublishableKey: () => mockGetStripePublishableKey(),
}));

vi.mock("@/features/plans/hooks/stripeCheckout", () => ({
  fetchPlanPrice: (planId: string) => mockFetchPlanPrice(planId),
  createCheckoutSessionServer: (params: unknown) => mockCreateCheckoutSessionServer(params),
}));

vi.mock("lucide-react", () => ({
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-loader" {...props} />,
}));

/* ---------- subject under test ---------- */
import StripeCheckout from "@/features/plans/components/StripeCheckout"; // Adatta il path in base alla struttura delle cartelle

describe("StripeCheckout Component Suite", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});

    // Mock window.location.assign
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { assign: vi.fn() },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
    vi.restoreAllMocks();
  });

  test("renderizza lo stato di caricamento se la chiave Stripe è assente o il prezzo è in fetching", () => {
    mockGetStripePublishableKey.mockReturnValueOnce("");

    render(<StripeCheckout planId="business" />);

    expect(screen.getByText("Caricamento Stripe...")).toBeInTheDocument();
    expect(screen.getByTestId("icon-loader")).toBeInTheDocument();
  });

  test("renderizza correttamente il prezzo e i dettagli del piano dopo il fetch", async () => {
    render(<StripeCheckout planId="business" currency="EUR" />);

    await waitFor(() => {
      expect(screen.getByText("business")).toBeInTheDocument();
      expect(screen.getByText("€ 29,99")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Paga con Stripe" })).toBeInTheDocument();
    });

    expect(mockFetchPlanPrice).toHaveBeenCalledWith("business");
  });

  test("calcola e mostra correttamente lo sconto quando è attivo un coupon", async () => {
    const coupon = { code: "PROMO20", percentage: 20 }; // 29.99 - 20% = 23.99

    render(<StripeCheckout planId="business" activeCoupon={coupon} />);

    await waitFor(() => {
      expect(screen.getByText("Coupon 20%")).toBeInTheDocument();
      expect(screen.getByText("€ 23,99")).toBeInTheDocument();
      expect(screen.getByText("€ 29,99")).toBeInTheDocument(); // Prezzo base barrato
    });
  });

  test("gestisce con successo il flusso di pagamento ed esegue il reindirizzamento", async () => {
    const onSuccessMock = vi.fn();

    render(<StripeCheckout planId="business" onSuccess={onSuccessMock} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Paga con Stripe" })).toBeInTheDocument();
    });

    const payButton = screen.getByRole("button", { name: "Paga con Stripe" });
    fireEvent.click(payButton);

    await waitFor(() => {
      expect(mockCreateCheckoutSessionServer).toHaveBeenCalledWith({
        planId: "business",
        source: "in_app",
        couponCode: undefined,
      });
      expect(mockToast.success).toHaveBeenCalledWith("Reindirizzamento al pagamento...");
      expect(onSuccessMock).toHaveBeenCalledWith({
        sessionId: "cs_test_123",
        url: "https://checkout.stripe.com/pay/test",
      });
      expect(window.location.assign).toHaveBeenCalledWith("https://checkout.stripe.com/pay/test");
    });
  });

  test("gestisce gli errori durante la creazione della sessione di pagamento", async () => {
    const onErrorMock = vi.fn();
    mockCreateCheckoutSessionServer.mockRejectedValueOnce(new Error("Stripe API down"));

    render(<StripeCheckout planId="business" onError={onErrorMock} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Paga con Stripe" })).toBeInTheDocument();
    });

    const payButton = screen.getByRole("button", { name: "Paga con Stripe" });
    fireEvent.click(payButton);

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith("Errore durante il pagamento");
      expect(onErrorMock).toHaveBeenCalledWith(expect.any(Error));
    });
  });
});