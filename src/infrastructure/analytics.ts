import type { Analytics } from "firebase/analytics";

export type AnalyticsEvent =
  | "login"
  | "logout"
  | "password_reset_requested"
  | "sign_up"
  | "free_trial_start"
  | "subscription_start"
  | "checkout_start"
  | "purchase_success"
  | "purchase_failed"
  | "sentence_processed"
  | "sentenze_ocr"
  | "sentence_searched"
  | "sentence_opened"
  | "document_opened"
  | "document_uploaded"
  | "document_deleted"
  | "sentence_shared"
  | "sentence_downloaded"
  | "sentence_saved"
  | "saved_sentence_opened"
  | "profile_updated"
  | "analytics_error";

export type EventParamsMap = {
  login: {
    method: "email" | "google" | "apple" | "sso";
    success: boolean;
  };

  logout: Record<string, never>;

  sign_up: {
    method: "email" | "google" | "apple" | "sso";
    success: boolean;
  };

  password_reset_requested: {
    method: "email" | "google" | "apple" | "sso";
  };

  free_trial_start: Record<string, never>;

  subscription_start: {
    plan_type:
      | "business"
      | "business_m"
      | "personale"
      | "personale_m"
      | "team3"
      | "team5"
      | "team7";
    billing_period: "monthly" | "yearly";
    price: number;
    currency: string;
    source?: "landing" | "in_app" | "promo" | "support";
  };

  checkout_start: {
    plan_type:
      | "business"
      | "business_m"
      | "personale"
      | "personale_m"
      | "team3"
      | "team5"
      | "team7";
    payment_provider: "paypal" | "stripe";
  };

  purchase_success: {
    plan_type:
      | "business"
      | "business_m"
      | "personale"
      | "personale_m"
      | "team3"
      | "team5"
      | "team7";
    payment_provider: "paypal" | "stripe";
    order_id: string;
    price?: number;
    currency?: string;
  };

  purchase_failed: {
    plan_type:
      | "business"
      | "business_m"
      | "personale"
      | "personale_m"
      | "team3"
      | "team5"
      | "team7";
    payment_provider: "paypal" | "stripe";
    stage:
      | "create_order"
      | "capture"
      | "create_session";
    reason: string;
  };

  document_uploaded: {
    file_type:
      | "pdf"
      | "doc"
      | "docx"
      | "txt"
      | "rtf"
      | "text"
      | "image"
      | "xlsx"
      | "pptx"
      | "eml"
      | "audio"
      | "unsupported"
      | "other"
      | "video"
      | "csv"
      | "ppt";
    file_size_kb?: number;
    source?: "desktop" | "mobile" | "dragdrop";
    upload_time_ms?: number;
    success: boolean;
    error_type?: string;
  };

  sentenze_ocr: {
    success: boolean;
    processing_time_ms?: number;
    error_type?: string;
  };

  sentence_processed: {
    input_type:
      | "pdf"
      | "doc"
      | "docx"
      | "txt"
      | "rtf"
      | "text"
      | "image"
      | "xlsx"
      | "pptx"
      | "eml"
      | "audio"
      | "unsupported"
      | "other"
      | "video"
      | "csv"
      | "ppt";
    success: boolean;
    processing_time_ms?: number;
    error_type?: string;
  };

  sentence_searched: {
    query_length: number;
    filters_used?: boolean;
    results_count?: number;
  };

  sentence_opened: {
    source:
      | "search"
      | "saved"
      | "direct"
      | "related_documents";
  };

  document_opened: {
    source: "profile" | "direct";
  };

  document_deleted: Record<string, never>;

  sentence_shared: {
    channel:
      | "link"
      | "email"
      | "whatsapp"
      | "copy"
      | "other";
  };

  sentence_downloaded: {
    source?: "search" | "saved" | "shared" | "direct";
  };

  sentence_saved: Record<string, never>;

  saved_sentence_opened: Record<string, never>;

  profile_updated: {
    type: boolean;
  };

  analytics_error: {
    name: AnalyticsEvent | string;
    reason: string;
  };
};

let cachedAnalytics: Analytics | null | undefined;

async function getAnalyticsSafe(): Promise<Analytics | null> {
  if (cachedAnalytics !== undefined) {
    return cachedAnalytics;
  }

  try {
    const {
      initializeOptionalServices,
      getAnalyticsInstance,
    } = await import(
      "@/infrastructure/optionalService"
    );

    await initializeOptionalServices();

    cachedAnalytics = getAnalyticsInstance();
  } catch (error) {
    console.warn(
      "Firebase Analytics non disponibile:",
      error
    );

    cachedAnalytics = null;
  }

  return cachedAnalytics;
}

export function trackEvent<K extends keyof EventParamsMap>(
  name: K,
  params: EventParamsMap[K]
): Promise<void>;

export async function trackEvent(
  name: AnalyticsEvent,
  params: Record<string, unknown>
): Promise<void> {
  const analytics = await getAnalyticsSafe();

  if (!analytics) {
    return;
  }

  const { logEvent } = await import(
    "firebase/analytics"
  );

  logEvent(
    analytics,
    name as string,
    params
  );
}