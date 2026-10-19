import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type {
  ApplyCouponRequestBody,
  ApplyCouponResponse,
  CheckoutSessionRequestBody,
  CheckoutSessionResponse,
  GetPriceRequestBody,
  GetPriceResponse,
  GetRegisterResponse,
} from "@functions/subscriptions/_interfaces";

describe("subscription interface contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("models checkout session input and response fields", () => {
    // Arrange
    const request: CheckoutSessionRequestBody = { id: "plan-pro" };
    const emptyRequest: CheckoutSessionRequestBody = {};
    const response: CheckoutSessionResponse = { url: null, sessionId: "session-1" };

    // Act
    const sessionId = response.sessionId;

    // Assert
    expectTypeOf(request).toMatchTypeOf<CheckoutSessionRequestBody>();
    expectTypeOf(response.url).toMatchTypeOf<string | null>();
    expect([request.id, emptyRequest.id, sessionId]).toEqual(["plan-pro", undefined, "session-1"]);
  });

  it("defines registration, pricing, and coupon contracts", () => {
    // Arrange
    const created: GetRegisterResponse["created"] = true;
    const expires: GetRegisterResponse["expireSec"] = null;
    const priceRequest: GetPriceRequestBody = { id: "pro" };
    const price: GetPriceResponse = { id: "pro", price: 20, currency: "EUR" };
    const couponRequest: ApplyCouponRequestBody = { couponCode: "SAVE" };
    const couponResponse: ApplyCouponResponse = {
      status: "success",
      coupon: { code: "SAVE", percentage: 10, durationLabel: "Una volta" },
    };

    // Act
    const values = [created, expires, priceRequest.id, price.currency, couponRequest.couponCode];

    // Assert
    expectTypeOf<GetRegisterResponse["start"]>().not.toBeAny();
    expectTypeOf(price).toMatchTypeOf<GetPriceResponse>();
    expectTypeOf(couponResponse).toMatchTypeOf<ApplyCouponResponse>();
    expect(values).toEqual([true, null, "pro", "EUR", "SAVE"]);
  });
});
