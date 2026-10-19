import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const functionRequire = createRequire(resolve(process.cwd(), "functions/src/subscriptions/_utils.ts"));
const paramsModule = functionRequire("firebase-functions/params");
const firestoreModule = functionRequire("firebase-admin/firestore");

const mocks = vi.hoisted(() => ({
  defineSecret: vi.fn(),
  secretValues: { stripe: "sk_test", webhook: "whsec_test" } as Record<string, string>,
  Stripe: vi.fn(),
  handleTeamCreationInTx: vi.fn(),
  now: vi.fn(),
  fromMillis: vi.fn(),
  fieldDelete: vi.fn(() => ({ deleted: true })),
  txGet: vi.fn(),
  txSet: vi.fn(),
  doc: vi.fn(),
  collection: vi.fn(),
}));

vi.mock("firebase-functions/params", () => ({
  defineSecret: mocks.defineSecret,
}));
vi.mock("stripe", () => ({ default: mocks.Stripe }));
vi.mock("../../../functions/node_modules/stripe/esm/stripe.esm.node.js", () => ({ default: mocks.Stripe }));
vi.mock("firebase-admin/firestore", () => ({
  Timestamp: { now: mocks.now, fromMillis: mocks.fromMillis },
  FieldValue: { delete: mocks.fieldDelete },
}));
vi.mock("@functions/team/_utils", () => ({
  handleTeamCreationInTx: mocks.handleTeamCreationInTx,
}));

describe("subscription utility functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.defineSecret.mockImplementation((name: string) => ({
      value: () => mocks.secretValues[name === "STRIPE_SECRET_KEY" ? "stripe" : "webhook"],
    }));
    vi.spyOn(paramsModule, "defineSecret").mockImplementation(mocks.defineSecret);
    vi.spyOn(firestoreModule.Timestamp, "now").mockImplementation(mocks.now);
    vi.spyOn(firestoreModule.Timestamp, "fromMillis").mockImplementation(mocks.fromMillis);
    mocks.Stripe.mockImplementation(function () {
      return { stripeClient: true };
    });
    mocks.now.mockReturnValue({ toMillis: () => 1_000_000 });
    mocks.fromMillis.mockImplementation((millis: number) => ({ toMillis: () => millis }));
    mocks.handleTeamCreationInTx.mockResolvedValue({ finalUserStatus: "business", needsTask: true });
    mocks.txSet.mockReset();
    mocks.doc.mockImplementation((id: string) => ({ id, collection: mocks.collection }));
    mocks.collection.mockReturnValue({ doc: mocks.doc });
  });

  it("constructs Stripe and returns its configured webhook secret", async () => {
    // Arrange
    const { getStripe, getWebhookSecret } = await import("@functions/subscriptions/_utils");
    const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } = await import("@functions/subscriptions/_utils");
    vi.spyOn(STRIPE_SECRET_KEY, "value").mockReturnValue("sk_test");
    vi.spyOn(STRIPE_WEBHOOK_SECRET, "value").mockReturnValue("whsec_test");

    // Act
    const stripe = getStripe();
    const secret = getWebhookSecret();

    // Assert
    expect(stripe).toBeTruthy();
    expect(secret).toBe("whsec_test");
    expect(mocks.Stripe).toHaveBeenCalledWith("sk_test");
  });

  it("rejects missing Stripe secrets", async () => {
    // Arrange
    const { getStripe, getWebhookSecret, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } = await import("@functions/subscriptions/_utils");
    vi.spyOn(STRIPE_SECRET_KEY, "value").mockReturnValue("");
    vi.spyOn(STRIPE_WEBHOOK_SECRET, "value").mockReturnValue("");

    // Act / Assert
    expect(() => getStripe()).toThrow("Missing STRIPE_SECRET_KEY");
    expect(() => getWebhookSecret()).toThrow("Missing STRIPE_WEBHOOK_SECRET");
  });

  it("normalizes supported plans and rejects other values", async () => {
    // Arrange
    const { normalizePlanId } = await import("@functions/subscriptions/_utils");

    // Act
    const normalized = normalizePlanId("  BUSINESS_M ");
    const invalid = normalizePlanId({ id: "business" });

    // Assert
    expect(normalized).toBe("business_m");
    expect(invalid).toBeNull();
  });

  it("writes coupon redemption details and reports when a coupon exists", async () => {
    // Arrange
    const registerRef = { id: "register/user-1" };
    const discountUserRef = { id: "discount/user-1" };
    mocks.doc.mockImplementation((id: string) => id === "user-1"
      ? registerRef
      : { id, collection: vi.fn(() => ({ doc: vi.fn(() => discountUserRef) })) });
    mocks.collection.mockImplementation((name: string) => ({ doc: mocks.doc, name }));
    mocks.txGet.mockResolvedValue({ exists: true, data: () => ({ coupon: { name: "WELCOME" } }) });
    const db = { collection: mocks.collection };
    const tx = { get: mocks.txGet, set: mocks.txSet };
    const { processCouponInTx } = await import("@functions/subscriptions/_utils");

    // Act
    const result = await processCouponInTx(tx, db, "user-1", 12.5);

    // Assert
    expect(result).toBe(true);
    expect(mocks.txSet).toHaveBeenCalledWith(discountUserRef, expect.objectContaining({
      uid: "user-1",
      paidValue: 12.5,
    }), { merge: true });
  });

  it("does not write redemption data for users without a coupon", async () => {
    // Arrange
    mocks.txGet.mockResolvedValue({ exists: true, data: () => ({}) });
    const { processCouponInTx } = await import("@functions/subscriptions/_utils");

    // Act
    const result = await processCouponInTx({ get: mocks.txGet, set: mocks.txSet }, { collection: mocks.collection }, "user-2", 0);

    // Assert
    expect(result).toBe(false);
    expect(mocks.txSet).not.toHaveBeenCalled();
  });

  it("applies plan duration, team status and provider data in the subscription transaction", async () => {
    // Arrange
    mocks.txGet.mockResolvedValueOnce({ data: () => ({ durationDays: 30, price: 20 }) })
      .mockResolvedValueOnce({ exists: true, data: () => ({}) });
    const tx = { get: mocks.txGet, set: mocks.txSet };
    const db = { collection: mocks.collection };
    const { processSubscriptionInTx } = await import("@functions/subscriptions/_utils");

    // Act
    const result = await processSubscriptionInTx(tx, db, "user-3", "business_m", { provider: "stripe" }, 2500);

    // Assert
    expect(result.expireSec).toBe(2_593_000);
    expect(result.needsTask).toBe(true);
    expect(mocks.handleTeamCreationInTx).toHaveBeenCalledWith(tx, db, "user-3", "business_m", result.expireSec, expect.any(Object));
    expect(mocks.txSet).toHaveBeenCalledWith(expect.objectContaining({ id: "user-3" }), expect.objectContaining({
      planId: "business",
      provider: "stripe",
      status: "active",
    }), { merge: true });
  });
});
