import { beforeEach, describe, expect, it, vi } from "vitest";
import { corsOptions } from "@functions/mpc/config/cors";

describe("MPC CORS configuration", () => {
  const originCallback = corsOptions.origin;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it.each([
    undefined,
    "https://jurio.it",
    "https://claude.ai",
    "https://chat.openai.com",
    "https://chat.mistral.ai",
  ])("allows a configured origin or a request without origin: %s", (origin) => {
    const callback = vi.fn();

    if (typeof originCallback !== "function") throw new Error("Expected a CORS origin callback");
    originCallback(origin, callback);

    expect(callback).toHaveBeenCalledWith(null, true);
  });

  it("rejects origins outside the allowlist", () => {
    const callback = vi.fn();

    if (typeof originCallback !== "function") throw new Error("Expected a CORS origin callback");
    originCallback("https://attacker.example", callback);

    expect(callback).toHaveBeenCalledOnce();
    expect(callback.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(callback.mock.calls[0][0]?.message).toContain("Origine non consentita");
  });

  it("enables credentialed requests", () => {
    expect(corsOptions.credentials).toBe(true);
  });
});
