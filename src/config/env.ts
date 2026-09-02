export const getStripePublishableKey = (): string | undefined => {
  return import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
};
export const getClientId = (): string | undefined => {
  return import.meta.env.VITE_PAYPAL_CLIENT_ID;
};

export function getStripe() {
  const env = import.meta.env as Record<string, unknown>;
  return {
    GET_PRICE_URL: String(env.VITE_GET_PRICE_URL ?? ""),
    STRIPE_CREATE_SESSION_URL: String(env.VITE_STRIPE_CREATE_SESSION_URL ?? ""),
  };
}
export const getVectorSearchUrl = (): string | undefined => {
  return import.meta.env.VITE_VECTOR_SEARCH;
};
export const getSupportUrl = (): string | undefined => {
  return import.meta.env.VITE_SUPPORT;
};
export const getChatUrl = (): string | undefined => {
  return import.meta.env.VITE_LEGAL_AGENT_ENDPOINT;
};
export const getReasonUrl = (): string | undefined => {
  return import.meta.env.VITE_REASON_ENDPOINT;
};
export const getText = (): string | undefined => {
  return import.meta.env.VITE_EXTRACT_DOCUMENT_TEXT_URL;
};
export function getAdminUrl() {
  const env = import.meta.env as Record<string, unknown>;
  return {
    ADMIN_MAINTENANCE_TASK_ENDPOINT: String(env.VITE_ADMIN_MAINTENANCE_TASK_ENDPOINT ?? ""),
    ADMIN_SUBSTITUTION_TASK_ENDPOINT: String(env.VITE_ADMIN_SUBSTITUTION_TASK_ENDPOINT ?? ""),
    ADMIN_CONTENT_UPLOAD_ENDPOINT: String(env.VITE_ADMIN_CONTENT_UPLOAD_ENDPOINT ?? ""),
  };
};
export function getAssign() {
  const env = import.meta.env as Record<string, unknown>;
  return {
    ASSIGN_SEAT_URL: String(env.VITE_ASSIGN_SEAT_URL ?? ""),
    SEND_INVITE_URL: String(env.VITE_SEND_INVITE_URL ?? ""),
    VERIFY_VOUCHER_URL: String(env.VITE_VERIFY_VOUCHER_URL ?? ""),
    SHARE_ALL_URL: String(env.VITE_SHARE_ALL_URL ?? ""),
    REMOVE_MEMBER_ENDPOINT: String(env.VITE_REMOVE_MEMBER_ENDPOINT ?? ""),
    DELETE_TEAM_ENDPOINT: String(env.VITE_DELETE_TEAM_ENDPOINT ?? ""),
  };
};

export function getCloudUrl() {
  const env = import.meta.env as Record<string, unknown>;
  return {
    LIST_CLOUD_ENDPOINT: String(env.VITE_LIST_CLOUD_ENDPOINT ?? ""),
    DOWNLOAD_CLOUD_ENDPOINT: String(env.VITE_DOWNLOAD_CLOUD_ENDPOINT ?? ""),
  };
};

export const getPrompt = (): string | undefined => {
  return import.meta.env.VITE_PROMPT_AGENT_ENDPOINT;
};
export const getFeedback = (): string | undefined => {
  return import.meta.env.VITE_FEEDBACK_ENDPOINT;
};