import { Timestamp } from "firebase-admin/firestore";

export interface CheckoutSessionRequestBody {
  id?: string; 
}

export interface CheckoutSessionResponse {
  url: string | null;
  sessionId: string;
}

export interface GetRegisterResponse {
  created: boolean;
  uid: string;
  start: Timestamp;
  expireSec: number | null;
}

export interface GetPriceRequestBody {
  id?: unknown;
}

export interface GetPriceResponse {
  id: string;
  price: number;
  currency: string;
}

export interface ApplyCouponRequestBody {
  couponCode?: unknown;
}

export interface ApplyCouponResponse {
  status: string;
  coupon: {
    code: string;
    percentage: number;
    durationLabel: string;
  };
}