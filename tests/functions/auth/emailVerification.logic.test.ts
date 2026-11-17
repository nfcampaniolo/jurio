import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  secure: vi.fn(),
  minute: vi.fn(),
  daily: vi.fn(),
  getUser: vi.fn(),
  generateLink: vi.fn(),
  enqueue: vi.fn(),
}));

vi.mock("@functions/_deps", () => ({
  getAdminAuth: () => ({ getUser: mocks.getUser, generateEmailVerificationLink: mocks.generateLink }),
}));
vi.mock("@functions/_utils", () => ({
  withSecureApiEndpoint: mocks.secure,
  consumePerMinuteFeature: mocks.minute,
  consumeDailyFeature: mocks.daily,
}));
vi.mock("@functions/email/auth/logic", () => ({ enqueueEmailVerificationEmail: mocks.enqueue }));

const FIREBASE_LINK =
  "https://jurio-it.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=CODE-123&apiKey=key&lang=it";

describe("executeSendVerificationEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.secure.mockImplementation(async (_req: unknown, _res: unknown, callback: (uid: string) => Promise<void>) => callback("user-1"));
    mocks.minute.mockResolvedValue(undefined);
    mocks.daily.mockResolvedValue({ remaining: 7 });
    mocks.getUser.mockResolvedValue({ email: "user@example.test", emailVerified: false });
    mocks.generateLink.mockResolvedValue(FIREBASE_LINK);
    mocks.enqueue.mockResolvedValue(undefined);
  });

  const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });

  it("sends a custom email that links to the Jurio verification page of the calling origin", async () => {
    // Arrange
    const { executeSendVerificationEmail } = await import("@functions/auth/emailVerification.logic");
    const res = response();

    // Act
    await executeSendVerificationEmail({ headers: { origin: "https://jurio-it-dev.web.app" } } as never, res as never);

    // Assert
    expect(mocks.minute).toHaveBeenCalledWith("user-1", "email_verification", 1);
    expect(mocks.daily).toHaveBeenCalledWith("user-1", "email_verification", 8);
    expect(mocks.generateLink).toHaveBeenCalledWith("user@example.test");
    expect(mocks.enqueue).toHaveBeenCalledWith({
      email: "user@example.test",
      verificationUrl: "https://jurio-it-dev.web.app/verifica-email?mode=verifyEmail&oobCode=CODE-123",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, alreadyVerified: false });
  });

  it("logs the verification link only outside the production project", async () => {
    // Arrange
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { executeSendVerificationEmail } = await import("@functions/auth/emailVerification.logic");

    // Act
    vi.stubEnv("GCLOUD_PROJECT", "jurio-it");
    await executeSendVerificationEmail({ headers: {} } as never, response() as never);
    const prodCalls = info.mock.calls.length;
    vi.stubEnv("GCLOUD_PROJECT", "jurio-it-dev");
    await executeSendVerificationEmail({ headers: {} } as never, response() as never);

    // Assert
    expect(prodCalls).toBe(0);
    expect(info).toHaveBeenCalledWith(expect.stringContaining("oobCode=CODE-123"));
    vi.unstubAllEnvs();
    info.mockRestore();
  });

  it("falls back to the production site for unknown origins", async () => {
    // Arrange
    const { executeSendVerificationEmail } = await import("@functions/auth/emailVerification.logic");
    const res = response();

    // Act
    await executeSendVerificationEmail({ headers: { origin: "https://evil.example" } } as never, res as never);

    // Assert
    expect(mocks.enqueue).toHaveBeenCalledWith(expect.objectContaining({
      verificationUrl: "https://jurio.it/verifica-email?mode=verifyEmail&oobCode=CODE-123",
    }));
  });

  it("does nothing for an already verified account", async () => {
    // Arrange
    mocks.getUser.mockResolvedValueOnce({ email: "user@example.test", emailVerified: true });
    const { executeSendVerificationEmail } = await import("@functions/auth/emailVerification.logic");
    const res = response();

    // Act
    await executeSendVerificationEmail({ headers: {} } as never, res as never);

    // Assert
    expect(res.json).toHaveBeenCalledWith({ success: true, alreadyVerified: true });
    expect(mocks.minute).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("rejects accounts without an email address", async () => {
    // Arrange
    mocks.getUser.mockResolvedValueOnce({ emailVerified: false });
    const { executeSendVerificationEmail } = await import("@functions/auth/emailVerification.logic");
    const res = response();

    // Act
    await executeSendVerificationEmail({ headers: {} } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.generateLink).not.toHaveBeenCalled();
  });

  it("propagates rate limiting without generating a link", async () => {
    // Arrange
    mocks.minute.mockRejectedValueOnce(new Error("rate_limited"));
    const { executeSendVerificationEmail } = await import("@functions/auth/emailVerification.logic");
    const res = response();

    // Act + Assert
    await expect(executeSendVerificationEmail({ headers: {} } as never, res as never)).rejects.toThrow("rate_limited");
    expect(mocks.generateLink).not.toHaveBeenCalled();
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });
});
