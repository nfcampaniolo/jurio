import { describe, test, expect, vi, beforeEach } from "vitest";

/* ---------- hoisted mocks ---------- */
const {
  mockTrackEvent,
  mockFetchWithSecurity,
  mockGetStripe,
} = vi.hoisted(() => ({
  mockTrackEvent: vi.fn(),
  mockFetchWithSecurity: vi.fn(),
  mockGetStripe: vi.fn(() => ({
    GET_PRICE_URL: "https://api.jurio.it/stripe/get-price",
    STRIPE_CREATE_SESSION_URL: "https://api.jurio.it/stripe/create-session",
  })),
}));

/* ---------- mock dependencies ---------- */
vi.mock("@/services/analytics", () => ({
  __esModule: true,
  trackEvent: (event: string, payload: Record<string, unknown>) =>
    mockTrackEvent(event, payload),
}));

vi.mock("@/config/apiClient", () => ({
  __esModule: true,
  fetchWithSecurity: (url: string, body: unknown) =>
    mockFetchWithSecurity(url, body),
}));

vi.mock("@/config/env", () => ({
  __esModule: true,
  getStripe: () => mockGetStripe(),
}));

/* ---------- subject under test ---------- */
import {
  fetchPlanPrice,
  createCheckoutSessionServer,
  type PlanId,
} from "@/hooks/stripeCheckout"; // <-- adegua il path se necessario

describe("Stripe Checkout Service Suite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  describe("fetchPlanPrice", () => {
    test("recupera e formatta il prezzo del piano con valuta di default EUR", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(JSON.stringify({ id: "personale", price: 29.9 })),
      });

      const result = await fetchPlanPrice("personale");

      expect(mockFetchWithSecurity).toHaveBeenCalledWith(
        "https://api.jurio.it/stripe/get-price",
        { id: "personale" }
      );
      expect(result).toEqual({
        amount: "29.90",
        currency: "EUR",
      });
      expect(mockTrackEvent).not.toHaveBeenCalled();
    });

    test("rispetta una valuta alternativa restituita dall'API (es. USD)", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(JSON.stringify({ id: "business", price: 99, currency: "USD" })),
      });

      const result = await fetchPlanPrice("business");

      expect(result).toEqual({
        amount: "99.00",
        currency: "USD",
      });
    });

    test("traccia analytics_error e solleva eccezione quando la chiamata fallisce (non-200)", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: vi.fn().mockResolvedValue("Piano non trovato"),
      });

      await expect(fetchPlanPrice("team7")).rejects.toThrow("getPrice failed (404): Piano non trovato");

      expect(mockTrackEvent).toHaveBeenCalledWith("analytics_error", {
        name: "fetchPlanPrice",
        reason: "getPrice failed (404): Piano non trovato",
      });
    });

    test("solleva eccezione e traccia errore se il prezzo ricevuto non è numerico o non è finito", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(JSON.stringify({ id: "personale_m", price: "non-numerico" })),
      });

      await expect(fetchPlanPrice("personale_m")).rejects.toThrow("Invalid price from getPrice");

      expect(mockTrackEvent).toHaveBeenCalledWith("analytics_error", {
        name: "fetchPlanPrice",
        reason: "Invalid price from getPrice",
      });
    });
  });

  describe("createCheckoutSessionServer", () => {
    test("traccia 'checkout_start' e genera la sessione con fallback a source 'in_app'", async () => {
      const serverPayload = {
        url: "https://checkout.stripe.com/c/pay/cs_test_12345",
        sessionId: "cs_test_12345",
      };

      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(JSON.stringify(serverPayload)),
      });

      const result = await createCheckoutSessionServer({ planId: "personale" });

      expect(mockTrackEvent).toHaveBeenCalledWith("checkout_start", {
        plan_type: "personale",
        payment_provider: "stripe",
      });
      expect(mockFetchWithSecurity).toHaveBeenCalledWith(
        "https://api.jurio.it/stripe/create-session",
        {
          id: "personale",
          source: "in_app",
          billing_period: undefined,
        }
      );
      expect(result).toEqual({
        url: serverPayload.url,
        sessionId: serverPayload.sessionId,
      });
    });

    test("utilizza il fallback data.id quando sessionId non è presente", async () => {
      const serverPayload = {
        url: "https://checkout.stripe.com/pay/cs_test_fallback",
        id: "cs_test_fallback",
      };

      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(JSON.stringify(serverPayload)),
      });

      const result = await createCheckoutSessionServer({
        planId: "business_m",
        source: "landing",
        billing_period: "monthly",
      });

      expect(mockFetchWithSecurity).toHaveBeenCalledWith(
        "https://api.jurio.it/stripe/create-session",
        {
          id: "business_m",
          source: "landing",
          billing_period: "monthly",
        }
      );
      expect(result.sessionId).toBe("cs_test_fallback");
    });

    test("traccia 'purchase_failed' e 'analytics_error' quando la chiamata API fallisce", async () => {
      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: vi.fn().mockResolvedValue("Stripe card error"),
      });

      await expect(
        createCheckoutSessionServer({ planId: "team3" as PlanId })
      ).rejects.toThrow("create session failed (400): Stripe card error");

      expect(mockTrackEvent).toHaveBeenCalledWith("purchase_failed", {
        plan_type: "team3",
        payment_provider: "stripe",
        stage: "create_session",
        reason: "create session failed (400): Stripe card error",
      });
      expect(mockTrackEvent).toHaveBeenCalledWith("analytics_error", {
        name: "createCheckoutSessionServer",
        reason: "create session failed (400): Stripe card error",
      });
    });

    test("solleva errore se il server risponde con successo ma senza URL di redirect", async () => {
      const payloadWithoutUrl = { sessionId: "cs_test_no_url" };

      mockFetchWithSecurity.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(JSON.stringify(payloadWithoutUrl)),
      });

      await expect(
        createCheckoutSessionServer({ planId: "personale" })
      ).rejects.toThrow(/Missing Checkout URL from server/);

      expect(mockTrackEvent).toHaveBeenCalledWith("purchase_failed", {
        plan_type: "personale",
        payment_provider: "stripe",
        stage: "create_session",
        reason: expect.stringContaining("Missing url. Response:"),
      });
      expect(mockTrackEvent).toHaveBeenCalledWith("analytics_error", {
        name: "createCheckoutSessionServer",
        reason: expect.stringContaining("Missing Checkout URL from server"),
      });
    });

    test("intercetta errori di rete o parsing e registra l'evento su analytics prima di rilanciare", async () => {
      mockFetchWithSecurity.mockRejectedValueOnce(new Error("Network connection dropped"));

      await expect(
        createCheckoutSessionServer({ planId: "business" })
      ).rejects.toThrow("Network connection dropped");

      expect(mockTrackEvent).toHaveBeenCalledWith("analytics_error", {
        name: "createCheckoutSessionServer",
        reason: "Network connection dropped",
      });
    });
  });
});