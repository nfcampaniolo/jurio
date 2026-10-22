import { afterEach, describe, expect, it, vi } from "vitest";
import { logSafeError } from "@functions/_logging";

describe("logSafeError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("keeps exception messages and attached data out of application logs", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const sensitiveMessage = "email=user@example.com uid=private-user";

    logSafeError("API_REQUEST_FAILED", Object.assign(new Error(sensitiveMessage), {
      response: { body: "confidential prompt" },
    }));

    expect(log).toHaveBeenCalledWith("API_REQUEST_FAILED", { errorType: "Error" });
    expect(JSON.stringify(log.mock.calls)).not.toContain(sensitiveMessage);
    expect(JSON.stringify(log.mock.calls)).not.toContain("confidential prompt");
  });

  it("does not log arbitrary exception names", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const error = Object.assign(new Error("secret"), { name: "user@example.com" });

    logSafeError("PROVIDER_REQUEST_FAILED", error);

    expect(log).toHaveBeenCalledWith("PROVIDER_REQUEST_FAILED", { errorType: "Error" });
  });
});
