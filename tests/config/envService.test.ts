import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";

/* ---------- module under test ---------- */
import {
  getStripePublishableKey,
  getClientId,
  getStripe,
  getVectorSearchUrl,
  getSupportUrl,
  getChatUrl,
  getReasonUrl,
  getText,
  getAdminUrl,
  getAssign,
  getCloudUrl,
  getPrompt,
  getFeedback,
} from "@/config/env"; // <-- adegua il path del file se necessario

describe("envService Suite", () => {

  beforeEach(() => {
    vi.stubEnv("VITE_STRIPE_PUBLISHABLE_KEY", "pk_test_12345");
    vi.stubEnv("VITE_PAYPAL_CLIENT_ID", "paypal_client_999");
    vi.stubEnv("VITE_GET_PRICE_URL", "https://api.jurio.it/prices");
    vi.stubEnv("VITE_STRIPE_CREATE_SESSION_URL", "https://api.jurio.it/stripe/session");
    vi.stubEnv("VITE_VECTOR_SEARCH", "https://api.jurio.it/vector-search");
    vi.stubEnv("VITE_SUPPORT", "https://api.jurio.it/support");
    vi.stubEnv("VITE_LEGAL_AGENT_ENDPOINT", "https://api.jurio.it/legal-agent");
    vi.stubEnv("VITE_REASON_ENDPOINT", "https://api.jurio.it/reason");
    vi.stubEnv("VITE_EXTRACT_DOCUMENT_TEXT_URL", "https://api.jurio.it/extract-text");
    vi.stubEnv("VITE_ADMIN_MAINTENANCE_TASK_ENDPOINT", "https://api.jurio.it/admin/maintenance");
    vi.stubEnv("VITE_ADMIN_SUBSTITUTION_TASK_ENDPOINT", "https://api.jurio.it/admin/substitution");
    vi.stubEnv("VITE_ADMIN_CONTENT_UPLOAD_ENDPOINT", "https://api.jurio.it/admin/upload");
    vi.stubEnv("VITE_ASSIGN_SEAT_URL", "https://api.jurio.it/team/assign");
    vi.stubEnv("VITE_SEND_INVITE_URL", "https://api.jurio.it/team/invite");
    vi.stubEnv("VITE_VERIFY_VOUCHER_URL", "https://api.jurio.it/voucher/verify");
    vi.stubEnv("VITE_SHARE_ALL_URL", "https://api.jurio.it/team/share-all");
    vi.stubEnv("VITE_REMOVE_MEMBER_ENDPOINT", "https://api.jurio.it/team/remove");
    vi.stubEnv("VITE_DELETE_TEAM_ENDPOINT", "https://api.jurio.it/team/delete");
    vi.stubEnv("VITE_LIST_CLOUD_ENDPOINT", "https://api.jurio.it/cloud/list");
    vi.stubEnv("VITE_DOWNLOAD_CLOUD_ENDPOINT", "https://api.jurio.it/cloud/download");
    vi.stubEnv("VITE_PROMPT_AGENT_ENDPOINT", "https://api.jurio.it/prompt-agent");
    vi.stubEnv("VITE_FEEDBACK_ENDPOINT", "https://api.jurio.it/feedback");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("recupera le chiavi e gli identificatori client", () => {
    expect(getStripePublishableKey()).toBe("pk_test_12345");
    expect(getClientId()).toBe("paypal_client_999");
  });

  test("recupera la configurazione degli endpoint Stripe", () => {
    expect(getStripe()).toEqual({
      GET_PRICE_URL: "https://api.jurio.it/prices",
      STRIPE_CREATE_SESSION_URL: "https://api.jurio.it/stripe/session",
    });
  });

  test("recupera gli endpoint dei moduli IA, OCR e supporto", () => {
    expect(getVectorSearchUrl()).toBe("https://api.jurio.it/vector-search");
    expect(getSupportUrl()).toBe("https://api.jurio.it/support");
    expect(getChatUrl()).toBe("https://api.jurio.it/legal-agent");
    expect(getReasonUrl()).toBe("https://api.jurio.it/reason");
    expect(getText()).toBe("https://api.jurio.it/extract-text");
    expect(getPrompt()).toBe("https://api.jurio.it/prompt-agent");
    expect(getFeedback()).toBe("https://api.jurio.it/feedback");
  });

  test("recupera gli endpoint dell'area Admin", () => {
    expect(getAdminUrl()).toEqual({
      ADMIN_MAINTENANCE_TASK_ENDPOINT: "https://api.jurio.it/admin/maintenance",
      ADMIN_SUBSTITUTION_TASK_ENDPOINT: "https://api.jurio.it/admin/substitution",
      ADMIN_CONTENT_UPLOAD_ENDPOINT: "https://api.jurio.it/admin/upload",
    });
  });

  test("recupera gli endpoint per la gestione del team e voucher", () => {
    expect(getAssign()).toEqual({
      ASSIGN_SEAT_URL: "https://api.jurio.it/team/assign",
      SEND_INVITE_URL: "https://api.jurio.it/team/invite",
      VERIFY_VOUCHER_URL: "https://api.jurio.it/voucher/verify",
      SHARE_ALL_URL: "https://api.jurio.it/team/share-all",
      REMOVE_MEMBER_ENDPOINT: "https://api.jurio.it/team/remove",
      DELETE_TEAM_ENDPOINT: "https://api.jurio.it/team/delete",
    });
  });

  test("recupera gli endpoint dello storage cloud", () => {
    expect(getCloudUrl()).toEqual({
      LIST_CLOUD_ENDPOINT: "https://api.jurio.it/cloud/list",
      DOWNLOAD_CLOUD_ENDPOINT: "https://api.jurio.it/cloud/download",
    });
  });

  test("restituisce stringhe vuote o undefined quando le variabili d'ambiente non sono definite", () => {
    vi.unstubAllEnvs();
    vi.stubEnv("VITE_STRIPE_PUBLISHABLE_KEY", undefined);
    vi.stubEnv("VITE_GET_PRICE_URL", undefined);
    vi.stubEnv("VITE_STRIPE_CREATE_SESSION_URL", undefined);

    expect(getStripePublishableKey()).toBeUndefined();
    expect(getStripe()).toEqual({
      GET_PRICE_URL: "",
      STRIPE_CREATE_SESSION_URL: "",
    });
  });
});