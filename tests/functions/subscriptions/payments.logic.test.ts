import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const secure = vi.fn();
  const validate = vi.fn();
  const getStripe = vi.fn();
  const getWebhookSecret = vi.fn();
  const normalizePlanId = vi.fn();
  const processSubscription = vi.fn();
  const get = vi.fn();
  const set = vi.fn();
  const customerCreate = vi.fn();
  const checkoutCreate = vi.fn();
  const constructEvent = vi.fn();
  const txSet = vi.fn();
  const txGet = vi.fn();
  const queueEmail = vi.fn();
  const schedule = vi.fn();
  const collection = vi.fn();
  const db = { collection, runTransaction: vi.fn() };
  const timestampNow = vi.fn();
  const stripe = {
    customers: { create: customerCreate },
    checkout: { sessions: { create: checkoutCreate } },
    webhooks: { constructEvent },
  };
  return {
    secure, validate, getStripe, getWebhookSecret, normalizePlanId, processSubscription, get, set,
    customerCreate, checkoutCreate, constructEvent, txSet, txGet, queueEmail, schedule, collection,
    db, timestampNow, stripe,
  };
});

vi.mock("@functions/_deps", () => ({ getDb: () => mocks.db }));
vi.mock("@functions/_utils", () => ({
  withSecureApiEndpoint: mocks.secure,
  validateUserPlanAndLimits: mocks.validate,
}));
vi.mock("@functions/subscriptions/_utils", () => ({
  getStripe: mocks.getStripe,
  getWebhookSecret: mocks.getWebhookSecret,
  normalizePlanId: mocks.normalizePlanId,
  processSubscriptionInTx: mocks.processSubscription,
}));
vi.mock("@functions/email/plans/logic", () => ({ queuePurchaseEmailOnceStripe: mocks.queueEmail }));
vi.mock("@functions/schedules/schedule.logic", () => ({ tryScheduleDowngradeTask: mocks.schedule }));
vi.mock("firebase-admin/firestore", () => ({ Timestamp: { now: mocks.timestampNow } }));

describe("Stripe payment endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.secure.mockImplementation(async (_req: unknown, _res: unknown, callback: (uid: string) => Promise<void>) => callback("user-1"));
    mocks.validate.mockResolvedValue(undefined);
    mocks.normalizePlanId.mockReturnValue("business");
    mocks.getStripe.mockReturnValue(mocks.stripe);
    mocks.getWebhookSecret.mockReturnValue("whsec_test");
    mocks.timestampNow.mockReturnValue({ now: true });
    mocks.customerCreate.mockResolvedValue({ id: "cus-1" });
    mocks.checkoutCreate.mockResolvedValue({ id: "cs-1", url: "https://checkout.test/session" });
    mocks.constructEvent.mockReturnValue({
      id: "evt-12345678",
      type: "checkout.session.completed",
      data: { object: {
        id: "cs-1", metadata: { uid: "user-1", planId: "business" },
        payment_intent: "pi-1", amount_total: 2500, currency: "eur",
      } },
    });
    mocks.processSubscription.mockResolvedValue({ expireSec: 1234, needsTask: true, status: "COMPLETED" });
    mocks.get.mockImplementation(function (this: { exists?: boolean; data?: () => unknown }) {
      return Promise.resolve({ exists: true });
    });
    mocks.set.mockResolvedValue(undefined);
    mocks.txGet.mockResolvedValue({ exists: false });
    mocks.txSet.mockReset();
    mocks.db.runTransaction.mockImplementation((callback: (tx: unknown) => Promise<unknown>) => callback({
      get: mocks.txGet, set: mocks.txSet,
    }));
    mocks.collection.mockImplementation((name: string) => ({
      doc: vi.fn((id?: string) => {
        if (name === "register") return { get: vi.fn().mockResolvedValue({ exists: true, get: () => undefined }) };
        if (name === "plans") return { get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ currency: "eur", price: 25, stripePriceId: "price-1" }) }) };
        if (name === "users") return { get: vi.fn().mockResolvedValue({ get: () => undefined }), set: mocks.set };
        return { id, get: mocks.get, set: mocks.set };
      }),
    }));
    mocks.queueEmail.mockResolvedValue(undefined);
    mocks.schedule.mockResolvedValue(undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), end: vi.fn().mockReturnThis() });

  it("creates a Stripe checkout session using the existing customer account", async () => {
    // Arrange
    mocks.collection.mockImplementation((name: string) => ({
      doc: vi.fn((id?: string) => {
        if (name === "register") return { get: vi.fn().mockResolvedValue({ exists: true, get: () => undefined }) };
        if (name === "plans") return { get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ currency: "eur", stripePriceId: "price-1" }) }) };
        if (name === "users") return { get: vi.fn().mockResolvedValue({ get: () => "cus-existing" }), set: mocks.set };
        return { id, set: mocks.set };
      }),
    }));
    const { executePayWithStripeCreateCheckoutSession } = await import("@functions/subscriptions/payments.logic");
    const res = response();

    // Act
    await executePayWithStripeCreateCheckoutSession({ body: { id: "business" } } as never, res as never);

    // Assert
    expect(mocks.validate).toHaveBeenCalledWith("user-1", "stripe_checkout", expect.any(Object));
    expect(mocks.customerCreate).not.toHaveBeenCalled();
    expect(mocks.checkoutCreate).toHaveBeenCalledWith(expect.objectContaining({
      customer: "cus-existing", line_items: [{ price: "price-1", quantity: 1 }],
      allow_promotion_codes: true,
    }));
    expect(res.json).toHaveBeenCalledWith({ url: "https://checkout.test/session", sessionId: "cs-1" });
  });

  it("creates a Stripe customer and applies an unexpired promotion code", async () => {
    // Arrange
    mocks.collection.mockImplementation((name: string) => ({
      doc: vi.fn((id?: string) => {
        if (name === "register") return { get: vi.fn().mockResolvedValue({
          exists: true,
          get: () => ({ id: "promo_123", expire: { toDate: () => new Date("2099-01-01") } }),
        }) };
        if (name === "plans") return { get: vi.fn().mockResolvedValue({
          exists: true, data: () => ({ stripePriceId: "price-1" }),
        }) };
        if (name === "users") return {
          get: vi.fn().mockResolvedValue({ get: () => undefined }),
          set: mocks.set,
        };
        return { id, set: mocks.set };
      }),
    }));
    const { executePayWithStripeCreateCheckoutSession } = await import("@functions/subscriptions/payments.logic");
    const res = response();

    // Act
    await executePayWithStripeCreateCheckoutSession({ body: { id: "business" } } as never, res as never);

    // Assert
    expect(mocks.customerCreate).toHaveBeenCalledWith({ metadata: { uid: "user-1" } });
    expect(mocks.set).toHaveBeenCalledWith({ stripeCustomerId: "cus-1" }, { merge: true });
    expect(mocks.checkoutCreate).toHaveBeenCalledWith(expect.objectContaining({
      customer: "cus-1",
      discounts: [{ promotion_code: "promo_123" }],
    }));
    expect(mocks.checkoutCreate.mock.calls[0][0]).not.toHaveProperty("allow_promotion_codes");
  });

  it("rejects checkout when the user's register record is missing", async () => {
    // Arrange
    mocks.collection.mockImplementation(() => ({ doc: vi.fn(() => ({ get: vi.fn().mockResolvedValue({ exists: false }) })) }));
    const { executePayWithStripeCreateCheckoutSession } = await import("@functions/subscriptions/payments.logic");
    const res = response();

    // Act
    await executePayWithStripeCreateCheckoutSession({ body: { id: "business" } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mocks.getStripe).not.toHaveBeenCalled();
  });

  it("rejects checkout when the plan has no Stripe price identifier", async () => {
    // Arrange
    mocks.collection.mockImplementation((name: string) => ({
      doc: vi.fn(() => name === "register"
        ? { get: vi.fn().mockResolvedValue({ exists: true }) }
        : { get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ currency: "EUR" }) }) }),
    }));
    const { executePayWithStripeCreateCheckoutSession } = await import("@functions/subscriptions/payments.logic");
    const res = response();

    // Act
    await executePayWithStripeCreateCheckoutSession({ body: { id: "business" } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(mocks.getStripe).not.toHaveBeenCalled();
  });

  it("rejects unsupported plan IDs before looking up Stripe products", async () => {
    // Arrange
    mocks.normalizePlanId.mockReturnValue(null);
    const { executePayWithStripeCreateCheckoutSession } = await import("@functions/subscriptions/payments.logic");
    const res = response();

    // Act
    await executePayWithStripeCreateCheckoutSession({ body: { id: "unknown" } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.getStripe).not.toHaveBeenCalled();
  });

  it("rejects webhook requests that do not use POST or omit the signature", async () => {
    // Arrange
    const { executeStripeWebhook } = await import("@functions/subscriptions/payments.logic");
    const getRes = response();
    const missingSignatureRes = response();

    // Act
    await executeStripeWebhook({ method: "GET", headers: {} } as never, getRes as never);
    await executeStripeWebhook({ method: "POST", headers: {}, rawBody: Buffer.from("payload") } as never, missingSignatureRes as never);

    // Assert
    expect(getRes.status).toHaveBeenCalledWith(405);
    expect(missingSignatureRes.status).toHaveBeenCalledWith(400);
    expect(mocks.constructEvent).not.toHaveBeenCalled();
  });

  it("returns an idempotent success for an already processed event", async () => {
    // Arrange
    mocks.get.mockResolvedValue({ exists: true });
    const { executeStripeWebhook } = await import("@functions/subscriptions/payments.logic");
    const res = response();

    // Act
    await executeStripeWebhook({
      method: "POST", headers: { "stripe-signature": "sig" }, rawBody: Buffer.from("payload"),
    } as never, res as never);

    // Assert
    expect(res.json).toHaveBeenCalledWith({ received: true, already: true });
    expect(mocks.processSubscription).not.toHaveBeenCalled();
  });

  it("rejects invalid webhook signatures without reading Firestore", async () => {
    // Arrange
    mocks.constructEvent.mockImplementation(() => { throw new Error("bad signature"); });
    const { executeStripeWebhook } = await import("@functions/subscriptions/payments.logic");
    const res = response();

    // Act
    await executeStripeWebhook({
      method: "POST", headers: { "stripe-signature": "sig" }, rawBody: Buffer.from("payload"),
    } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Invalid signature" });
    expect(mocks.get).not.toHaveBeenCalled();
  });

  it("acknowledges and records non-checkout webhook events without subscription changes", async () => {
    // Arrange
    mocks.constructEvent.mockReturnValue({ id: "evt-ignored", type: "invoice.created", data: { object: {} } });
    mocks.get.mockResolvedValue({ exists: false });
    const { executeStripeWebhook } = await import("@functions/subscriptions/payments.logic");
    const res = response();

    // Act
    await executeStripeWebhook({
      method: "POST", headers: { "stripe-signature": "sig" }, rawBody: Buffer.from("payload"),
    } as never, res as never);

    // Assert
    expect(mocks.processSubscription).not.toHaveBeenCalled();
    expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ type: "invoice.created", ignored: true }), { merge: true });
    expect(res.json).toHaveBeenCalledWith({ received: true, ignored: "invoice.created" });
  });

  it("processes a completed checkout webhook exactly once", async () => {
    // Arrange
    mocks.get.mockResolvedValue({ exists: false });
    mocks.processSubscription.mockResolvedValue({ expireSec: 1234, needsTask: true });
    const { executeStripeWebhook } = await import("@functions/subscriptions/payments.logic");
    const res = response();

    // Act
    await executeStripeWebhook({
      method: "POST", headers: { "stripe-signature": "sig" }, rawBody: Buffer.from("payload"),
    } as never, res as never);

    // Assert
    expect(mocks.processSubscription).toHaveBeenCalledWith(
      expect.any(Object), expect.any(Object), "user-1", "business",
      expect.objectContaining({ provider: "stripe", stripeSessionId: "cs-1" }), 2500,
    );
    expect(mocks.schedule).toHaveBeenCalledWith("user-1", 1234);
    expect(mocks.queueEmail).toHaveBeenCalledWith(expect.objectContaining({ uid: "user-1", sessionId: "cs-1", paidValue: 25 }));
    expect(res.json).toHaveBeenCalledWith({ received: true, out: { status: "COMPLETED" } });
  });

  it("records completed events with missing metadata and skips processing", async () => {
    // Arrange
    mocks.get.mockResolvedValue({ exists: false });
    mocks.constructEvent.mockReturnValue({
      id: "evt-no-metadata",
      type: "checkout.session.completed",
      data: { object: { id: "cs-no-metadata", metadata: {} } },
    });
    const { executeStripeWebhook } = await import("@functions/subscriptions/payments.logic");
    const res = response();

    // Act
    await executeStripeWebhook({
      method: "POST", headers: { "stripe-signature": "sig" }, rawBody: Buffer.from("payload"),
    } as never, res as never);

    // Assert
    expect(mocks.set).toHaveBeenCalledWith(expect.objectContaining({ missing: true }), { merge: true });
    expect(mocks.processSubscription).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ received: true, skipped: "missing_metadata" });
  });
});
