import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cors: vi.fn(),
  appCheck: vi.fn(),
  minute: vi.fn(),
  daily: vi.fn(),
  getUserByEmail: vi.fn(),
  generateLink: vi.fn(),
  enqueue: vi.fn(),
}));

vi.mock("@functions/_deps", () => ({
  getAdminAuth: () => ({ getUserByEmail: mocks.getUserByEmail, generatePasswordResetLink: mocks.generateLink }),
}));
vi.mock("@functions/_utils", () => ({
  corsHandlerDomain: mocks.cors,
  requireAppCheck: mocks.appCheck,
  consumePerMinuteFeature: mocks.minute,
  consumeDailyFeature: mocks.daily,
}));
vi.mock("@functions/email/auth/logic", () => ({ enqueuePasswordResetEmail: mocks.enqueue }));

const FIREBASE_LINK = "https://jurio-it.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=RST-1&apiKey=k";

const passwordUser = { uid: "u1", disabled: false, providerData: [{ providerId: "password" }] };

const request = (body: unknown, extra: Record<string, unknown> = {}) =>
  ({ method: "POST", body, ip: "1.2.3.4", headers: { origin: "https://jurio.it" }, ...extra }) as never;
const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis(), end: vi.fn().mockReturnThis() });

describe("executeSendPasswordResetEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.cors.mockImplementation(async (_req: unknown, _res: unknown, cb: () => Promise<void>) => cb());
    mocks.appCheck.mockResolvedValue(undefined);
    mocks.minute.mockResolvedValue(undefined);
    mocks.daily.mockResolvedValue({ remaining: 1 });
    mocks.getUserByEmail.mockResolvedValue(passwordUser);
    mocks.generateLink.mockResolvedValue(FIREBASE_LINK);
    mocks.enqueue.mockResolvedValue(undefined);
  });

  it("sends the custom email with a link to the Jurio reset page", async () => {
    const { executeSendPasswordResetEmail } = await import("@functions/auth/passwordReset.logic");
    const res = response();

    await executeSendPasswordResetEmail(request({ email: "  User@Example.TEST " }), res as never);

    expect(mocks.minute).toHaveBeenCalledWith("ip_1.2.3.4", "password_reset", 5);
    expect(mocks.minute).toHaveBeenCalledWith(expect.stringMatching(/^email_[a-f0-9]{32}$/), "password_reset_email", 1);
    expect(mocks.getUserByEmail).toHaveBeenCalledWith("user@example.test");
    expect(mocks.enqueue).toHaveBeenCalledWith({
      email: "user@example.test",
      resetUrl: "https://jurio.it/reimposta-password?mode=resetPassword&oobCode=RST-1",
    });
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it("answers the same way for unknown emails without sending anything", async () => {
    mocks.getUserByEmail.mockRejectedValueOnce(Object.assign(new Error("not found"), { code: "auth/user-not-found" }));
    const { executeSendPasswordResetEmail } = await import("@functions/auth/passwordReset.logic");
    const res = response();

    await executeSendPasswordResetEmail(request({ email: "nobody@example.test" }), res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true });
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("does not send a reset to Google-only or disabled accounts", async () => {
    const { executeSendPasswordResetEmail } = await import("@functions/auth/passwordReset.logic");

    mocks.getUserByEmail.mockResolvedValueOnce({ ...passwordUser, providerData: [{ providerId: "google.com" }] });
    const res1 = response();
    await executeSendPasswordResetEmail(request({ email: "g@example.test" }), res1 as never);

    mocks.getUserByEmail.mockResolvedValueOnce({ ...passwordUser, disabled: true });
    const res2 = response();
    await executeSendPasswordResetEmail(request({ email: "d@example.test" }), res2 as never);

    expect(mocks.generateLink).not.toHaveBeenCalled();
    expect(res1.json).toHaveBeenCalledWith({ success: true });
    expect(res2.json).toHaveBeenCalledWith({ success: true });
  });

  it("returns 429 when the IP limit is exceeded", async () => {
    mocks.minute.mockRejectedValueOnce(new Error("rate_limited"));
    const { executeSendPasswordResetEmail } = await import("@functions/auth/passwordReset.logic");
    const res = response();

    await executeSendPasswordResetEmail(request({ email: "user@example.test" }), res as never);

    expect(res.status).toHaveBeenCalledWith(429);
    expect(mocks.getUserByEmail).not.toHaveBeenCalled();
  });

  it("silently skips when the per-email limit is exceeded", async () => {
    mocks.minute.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("rate_limited"));
    const { executeSendPasswordResetEmail } = await import("@functions/auth/passwordReset.logic");
    const res = response();

    await executeSendPasswordResetEmail(request({ email: "user@example.test" }), res as never);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(mocks.getUserByEmail).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("rejects invalid emails, missing App Check and wrong methods", async () => {
    const { executeSendPasswordResetEmail } = await import("@functions/auth/passwordReset.logic");

    const res1 = response();
    await executeSendPasswordResetEmail(request({ email: "not-an-email" }), res1 as never);
    expect(res1.status).toHaveBeenCalledWith(400);

    mocks.appCheck.mockRejectedValueOnce(new Error("no app check"));
    const res2 = response();
    await executeSendPasswordResetEmail(request({ email: "user@example.test" }), res2 as never);
    expect(res2.status).toHaveBeenCalledWith(401);

    const res3 = response();
    await executeSendPasswordResetEmail(request({}, { method: "GET" }), res3 as never);
    expect(res3.status).toHaveBeenCalledWith(405);

    const res4 = response();
    await executeSendPasswordResetEmail(request({}, { method: "OPTIONS" }), res4 as never);
    expect(res4.status).toHaveBeenCalledWith(204);

    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("returns 500 when link generation fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.generateLink.mockRejectedValueOnce(new Error("boom"));
    const { executeSendPasswordResetEmail } = await import("@functions/auth/passwordReset.logic");
    const res = response();

    await executeSendPasswordResetEmail(request({ email: "user@example.test" }), res as never);

    expect(res.status).toHaveBeenCalledWith(500);
  });
});
