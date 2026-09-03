// stripeCheckout.ts (hook/module)
import { trackEvent } from "@/infrastructure/analytics";
import { fetchWithSecurity } from "@/config/apiClient";
import { getStripe} from "@/config/env";
export type StripeCurrency = "EUR" | "USD" | "GBP";
export type PlanId = "personale" | "business" | "personale_m" | "business_m" | "team3" | "team5" | "team7";

export type StripeCheckoutProps = {
  planId: PlanId;
  currency?: StripeCurrency;
  couponCode?: string;
  onSuccess?: (details: unknown) => void; // NOTA: qui è "session created / redirect started"
  onError?: (err: unknown) => void;
};

type PriceResponse = { id: string; price: number; currency?: string };

if (!getStripe().GET_PRICE_URL || !getStripe().STRIPE_CREATE_SESSION_URL) {
  throw new Error("Missing API endpoint env variables");
}
export async function fetchPlanPrice(
  planId: PlanId
): Promise<{ amount: string; currency: StripeCurrency }> {
  const r = await fetchWithSecurity(getStripe().GET_PRICE_URL, { id: planId });
  const text = await r.text();
  if (!r.ok) {
    trackEvent("analytics_error", {
      name: "fetchPlanPrice",
      reason: `getPrice failed (${r.status}): ${text}`,
    });
    throw new Error(`getPrice failed (${r.status}): ${text}`);
  }

  const data = JSON.parse(text) as PriceResponse;
  if (typeof data.price !== "number" || !Number.isFinite(data.price)) {
    trackEvent("analytics_error", { name: "fetchPlanPrice", reason: "Invalid price from getPrice" });
    throw new Error("Invalid price from getPrice");
  }

  return {
    amount: data.price.toFixed(2),
    currency: (data.currency ?? "EUR") as StripeCurrency,
  };
}

export type CreateStripeSessionArgs = {
  planId: PlanId;
  source?: "in_app" | "landing" | "promo" | "support";
  billing_period?: "monthly" | "yearly"; // passalo solo se lo sai davvero
  couponCode?: string;
};

export type CreateStripeSessionResponse = {
  url: string;        // <-- non optional
  sessionId?: string;
};

export async function createCheckoutSessionServer(
  args: CreateStripeSessionArgs
): Promise<CreateStripeSessionResponse> {
  const { planId, source, billing_period } = args;

  // tracking: checkout start
  trackEvent("checkout_start", { plan_type: planId, payment_provider: "stripe" });

  try {
    console.log("Creating Stripe session for plan:", planId);
    
    // fetchWithSecurity si occupa già di headers, POST e JSON.stringify
    const r = await fetchWithSecurity(getStripe().STRIPE_CREATE_SESSION_URL, {
      id: planId,
      source: source ?? "in_app",
      billing_period
    });

    const text = await r.text();
    if (!r.ok) {
      trackEvent("purchase_failed", {
        plan_type: planId,
        payment_provider: "stripe",
        stage: "create_session",
        reason: `create session failed (${r.status}): ${text}`,
      });
      throw new Error(`create session failed (${r.status}): ${text}`);
    }

    const data = JSON.parse(text) as { url?: string; sessionId?: string; id?: string };
    const url = data.url;
    const sessionId = data.sessionId ?? data.id;

    if (!url) {
      trackEvent("purchase_failed", {
        plan_type: planId,
        payment_provider: "stripe",
        stage: "create_session",
        reason: `Missing url. Response: ${text}`,
      });
      throw new Error(`Missing Checkout URL from server. Response: ${text}`);
    }

    return { url, sessionId };
  } catch (err) {
    trackEvent("analytics_error", {
      name: "createCheckoutSessionServer",
      reason: err instanceof Error ? err.message : "unknown_error",
    });
    throw err;
  }
}