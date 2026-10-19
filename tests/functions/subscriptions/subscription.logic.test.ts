import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const secure = vi.fn();
  const cors = vi.fn();
  const appCheck = vi.fn();
  const validate = vi.fn();
  const minute = vi.fn();
  const daily = vi.fn();
  const refGet = vi.fn();
  const txGet = vi.fn();
  const txSet = vi.fn();
  const txUpdate = vi.fn();
  const enqueueWelcome = vi.fn();
  const enqueueTrial = vi.fn();
  const schedule = vi.fn();
  const collection = vi.fn();
  const db = { collection, runTransaction: vi.fn() };
  const timestampNow = vi.fn();
  const timestampFromMillis = vi.fn();
  return {
    secure, cors, appCheck, validate, minute, daily, refGet, txGet, txSet, txUpdate,
    enqueueWelcome, enqueueTrial, schedule, collection, db, timestampNow, timestampFromMillis,
  };
});

vi.mock("@functions/_deps", () => ({ getDb: () => mocks.db }));
vi.mock("@functions/_utils", () => ({
  withSecureApiEndpoint: mocks.secure,
  corsHandlerDomain: mocks.cors,
  requireAppCheck: mocks.appCheck,
  validateUserPlanAndLimits: mocks.validate,
  consumePerMinuteFeature: mocks.minute,
  consumeDailyFeature: mocks.daily,
}));
vi.mock("@functions/email/comms/logic", () => ({
  enqueueWelcomeEmail: mocks.enqueueWelcome,
  enqueueTrialEmail: mocks.enqueueTrial,
}));
vi.mock("@functions/schedules/schedule.logic", () => ({ scheduleDowngradeTask: mocks.schedule }));
vi.mock("firebase-admin/firestore", () => ({
  Timestamp: {
    now: mocks.timestampNow,
    fromMillis: mocks.timestampFromMillis,
  },
}));

describe("subscription endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.secure.mockImplementation(async (_req: unknown, _res: unknown, callback: (uid: string) => Promise<void>) => callback("user-1"));
    mocks.cors.mockImplementation(async (_req: unknown, _res: unknown, callback: () => Promise<void>) => callback());
    mocks.appCheck.mockResolvedValue(undefined);
    mocks.validate.mockResolvedValue(undefined);
    mocks.minute.mockResolvedValue(undefined);
    mocks.daily.mockResolvedValue(undefined);
    mocks.timestampNow.mockReturnValue({ toMillis: () => 1_000_000 });
    mocks.timestampFromMillis.mockImplementation((millis: number) => ({ toMillis: () => millis }));
    mocks.enqueueWelcome.mockResolvedValue(undefined);
    mocks.enqueueTrial.mockResolvedValue(undefined);
    mocks.schedule.mockResolvedValue(undefined);
    mocks.refGet.mockResolvedValue({ exists: true, data: () => ({ price: 12, currency: "eur" }), get: () => undefined });
    mocks.txGet.mockResolvedValue({ exists: false });
    mocks.txSet.mockReset();
    mocks.txUpdate.mockReset();
    mocks.db.runTransaction.mockImplementation((callback: (tx: unknown) => Promise<unknown>) => callback({
      get: mocks.txGet, set: mocks.txSet, update: mocks.txUpdate,
    }));
    mocks.collection.mockImplementation((name: string) => ({
      doc: vi.fn(() => ({
        get: mocks.refGet,
        update: mocks.txUpdate,
        set: mocks.txSet,
        id: name,
      })),
    }));
  });

  const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), end: vi.fn().mockReturnThis() });

  it("creates a seven-day trial register record and schedules its downgrade", async () => {
    // Arrange
    const { executeGetRegister } = await import("@functions/subscriptions/subscription.logic");
    const res = response();

    // Act
    await executeGetRegister({ body: {} } as never, res as never);

    // Assert
    expect(mocks.validate).toHaveBeenCalledWith("user-1", "register", expect.any(Object));
    expect(mocks.txSet).toHaveBeenCalledTimes(2);
    expect(mocks.schedule).toHaveBeenCalledWith(expect.objectContaining({
      uid: "user-1", queue: "subscription-expire", expireSec: expect.any(Number),
    }));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ created: true, uid: "user-1" }));
  });

  it("returns a stored register record without recreating the trial", async () => {
    // Arrange
    mocks.txGet.mockResolvedValue({ exists: true, data: () => ({ start: "start", expireSec: 123 }) });
    const { executeGetRegister } = await import("@functions/subscriptions/subscription.logic");
    const res = response();

    // Act
    await executeGetRegister({ body: {} } as never, res as never);

    // Assert
    expect(mocks.txSet).not.toHaveBeenCalled();
    expect(mocks.schedule).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ created: false, uid: "user-1", start: "start", expireSec: 123 });
  });

  it("handles CORS preflight and rejects non-POST price requests", async () => {
    // Arrange
    const { executeGetPrice } = await import("@functions/subscriptions/subscription.logic");
    const optionsRes = response();
    const getRes = response();

    // Act
    await executeGetPrice({ method: "OPTIONS" } as never, optionsRes as never);
    await executeGetPrice({ method: "GET" } as never, getRes as never);

    // Assert
    expect(optionsRes.status).toHaveBeenCalledWith(204);
    expect(getRes.status).toHaveBeenCalledWith(405);
    expect(mocks.minute).not.toHaveBeenCalled();
  });

  it("returns a normalized plan price after App Check and rate limiting", async () => {
    // Arrange
    const { executeGetPrice } = await import("@functions/subscriptions/subscription.logic");
    const res = response();

    // Act
    await executeGetPrice({ method: "POST", ip: "127.0.0.1", body: { id: " BUSINESS " } } as never, res as never);

    // Assert
    expect(mocks.appCheck).toHaveBeenCalledOnce();
    expect(mocks.minute).toHaveBeenCalledOnce();
    expect(mocks.daily).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith({ id: "business", price: 12, currency: "EUR" });
  });

  it("rejects price lookups when App Check fails", async () => {
    // Arrange
    mocks.appCheck.mockRejectedValue(new Error("invalid app check"));
    const { executeGetPrice } = await import("@functions/subscriptions/subscription.logic");
    const res = response();

    // Act
    await executeGetPrice({ method: "POST", ip: "127.0.0.1", body: { id: "business" } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mocks.minute).not.toHaveBeenCalled();
    expect(mocks.refGet).not.toHaveBeenCalled();
  });

  it("returns too many requests when either IP rate limit is exceeded", async () => {
    // Arrange
    mocks.daily.mockRejectedValue(new Error("quota exceeded"));
    const { executeGetPrice } = await import("@functions/subscriptions/subscription.logic");
    const res = response();

    // Act
    await executeGetPrice({ method: "POST", ip: "127.0.0.1", body: { id: "business" } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(429);
    expect(mocks.refGet).not.toHaveBeenCalled();
  });

  it("rejects invalid price requests before accessing a plan", async () => {
    // Arrange
    const { executeGetPrice } = await import("@functions/subscriptions/subscription.logic");
    const res = response();

    // Act
    await executeGetPrice({ method: "POST", body: {} } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.refGet).not.toHaveBeenCalled();
  });

  it("returns not found when the requested plan does not exist", async () => {
    // Arrange
    mocks.refGet.mockResolvedValue({ exists: false });
    const { executeGetPrice } = await import("@functions/subscriptions/subscription.logic");
    const res = response();

    // Act
    await executeGetPrice({ method: "POST", body: { id: "missing-plan" } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns an internal error when a plan price is not numeric", async () => {
    // Arrange
    mocks.refGet.mockResolvedValue({ exists: true, data: () => ({ price: "12" }) });
    const { executeGetPrice } = await import("@functions/subscriptions/subscription.logic");
    const res = response();

    // Act
    await executeGetPrice({ method: "POST", body: { id: "broken-plan" } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("returns a generic error when price retrieval throws unexpectedly", async () => {
    // Arrange
    mocks.refGet.mockRejectedValue(new Error("database details"));
    const { executeGetPrice } = await import("@functions/subscriptions/subscription.logic");
    const res = response();

    // Act
    await executeGetPrice({ method: "POST", body: { id: "business" } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal Server Error" });
  });

  it("rejects malformed coupon codes and leaves the register unchanged", async () => {
    // Arrange
    const { executeApplyDiscountCoupon } = await import("@functions/subscriptions/subscription.logic");
    const res = response();

    // Act
    await executeApplyDiscountCoupon({ body: { couponCode: "!!!" } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.txUpdate).not.toHaveBeenCalled();
  });

  it("applies a valid discount coupon to a user without an active coupon", async () => {
    // Arrange
    mocks.refGet.mockResolvedValueOnce({
      exists: true,
      get: () => undefined,
    }).mockResolvedValueOnce({
      exists: true,
      data: () => ({ stripeCustomerId: "coupon_1", discount: 15, durationLabel: "Sempre" }),
    });
    const { executeApplyDiscountCoupon } = await import("@functions/subscriptions/subscription.logic");
    const res = response();

    // Act
    await executeApplyDiscountCoupon({ body: { couponCode: " welcome-15 " } } as never, res as never);

    // Assert
    expect(mocks.txUpdate).toHaveBeenCalledWith({ coupon: { id: "coupon_1", name: "WELCOME-15", discount: 15 } });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: "SUCCESS",
      coupon: { code: "WELCOME-15", percentage: 15, durationLabel: "Sempre" },
    });
  });

  it("rejects a second coupon when the user already has one active", async () => {
    // Arrange
    mocks.refGet.mockResolvedValue({
      exists: true,
      get: () => ({ id: "active-coupon" }),
    });
    const { executeApplyDiscountCoupon } = await import("@functions/subscriptions/subscription.logic");
    const res = response();

    // Act
    await executeApplyDiscountCoupon({ body: { couponCode: "WELCOME" } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.collection).not.toHaveBeenCalledWith("discount");
    expect(mocks.txUpdate).not.toHaveBeenCalled();
  });

  it("rejects coupon codes that do not exist", async () => {
    // Arrange
    mocks.refGet.mockResolvedValueOnce({ exists: true, get: () => undefined })
      .mockResolvedValueOnce({ exists: false });
    const { executeApplyDiscountCoupon } = await import("@functions/subscriptions/subscription.logic");
    const res = response();

    // Act
    await executeApplyDiscountCoupon({ body: { couponCode: "UNKNOWN" } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mocks.txUpdate).not.toHaveBeenCalled();
  });

  it("rejects expired coupon offers", async () => {
    // Arrange
    mocks.refGet.mockResolvedValueOnce({ exists: true, get: () => undefined })
      .mockResolvedValueOnce({ exists: true, data: () => ({ expire: "2000-01-01T00:00:00.000Z" }) });
    const { executeApplyDiscountCoupon } = await import("@functions/subscriptions/subscription.logic");
    const res = response();

    // Act
    await executeApplyDiscountCoupon({ body: { couponCode: "OLD" } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.txUpdate).not.toHaveBeenCalled();
  });
});
