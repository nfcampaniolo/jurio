import { afterEach, describe, expect, it, vi } from "vitest";
import { buildActionUrl, emailRateKey, logActionLinkOutsideProd } from "@functions/auth/_utils";

describe("auth link helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("builds links on allowed origins and falls back to production", () => {
    const link = "https://x.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=C1";
    expect(buildActionUrl(link, "https://jurio-it-dev.web.app", "/reimposta-password", "resetPassword"))
      .toBe("https://jurio-it-dev.web.app/reimposta-password?mode=resetPassword&oobCode=C1");
    expect(buildActionUrl(link, "https://evil.example", "/reimposta-password", "resetPassword"))
      .toBe("https://jurio.it/reimposta-password?mode=resetPassword&oobCode=C1");
  });

  it("throws when the Firebase link has no oobCode", () => {
    expect(() => buildActionUrl("https://x.test/a", undefined, "/p", "verifyEmail")).toThrow("OOB_CODE_MISSING");
  });

  it("hashes emails into stable rate-limit keys", () => {
    expect(emailRateKey("a@b.it")).toBe(emailRateKey("a@b.it"));
    expect(emailRateKey("a@b.it")).not.toContain("a@b.it");
  });

  it("logs links only outside production", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubEnv("GCLOUD_PROJECT", "jurio-it");
    logActionLinkOutsideProd("L", "s", "u");
    expect(info).not.toHaveBeenCalled();
    vi.stubEnv("GCLOUD_PROJECT", "jurio-it-dev");
    logActionLinkOutsideProd("L", "s", "u");
    expect(info).toHaveBeenCalledWith("[DEV] L s url=u");
  });
});
