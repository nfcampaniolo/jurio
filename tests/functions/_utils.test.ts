import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { JurioFeatureType } from "@functions/_constants";

const mocks = vi.hoisted(() => {
  const verifyToken = vi.fn();
  const getAppCheck = vi.fn(() => ({ verifyToken }));
  const verifyIdToken = vi.fn();
  const auth = { verifyIdToken };
  const db = {
    collection: vi.fn(),
    runTransaction: vi.fn(),
  };
  const transaction = {
    get: vi.fn(),
    set: vi.fn(),
  };
  const serverTimestamp = vi.fn(() => "server-timestamp");
  const constants = {
    ALLOWED_ORIGINS: ["https://jurio.example"],
    ALLOWED_PLANS: new Set(["prova", "admin"]),
    JURIO_USAGE_LIMITS: {
      research: { prova: { perMinute: 2, perDay: 5 } },
      legal_agent: { prova: { perMinute: 3, perDay: 7 } },
    },
  };

  return {
    verifyToken,
    getAppCheck,
    verifyIdToken,
    auth,
    db,
    transaction,
    serverTimestamp,
    constants,
    corsOptions: undefined as unknown,
  };
});

vi.mock("../../functions/node_modules/cors/lib/index.js", () => ({
  default: vi.fn((options) => {
    mocks.corsOptions = options;
    return (_req: unknown, _res: unknown, next: (error?: unknown) => void) => next();
  }),
}));

vi.mock("../../functions/node_modules/firebase-admin/lib/esm/app-check/index.js", () => ({
  getAppCheck: mocks.getAppCheck,
}));

vi.mock("@functions/_deps", () => ({
  getDb: () => mocks.db,
  getAdminAuth: () => mocks.auth,
}));

vi.mock("@functions/_constants", () => mocks.constants);

import {
  consumeDailyFeature,
  consumePerMinuteFeature,
  corsHandlerDomain,
  dayKeyRome,
  minuteKeyRome,
  requireAppCheck,
  requireUidFromAuthHeader,
  validateUserPlanAndLimits,
  withSecureApiEndpoint,
} from "@functions/_utils";
import { createRequire } from "node:module";
import { resolve } from "node:path";

type SecureRequest = Parameters<typeof withSecureApiEndpoint>[0];
type SecureResponse = Parameters<typeof withSecureApiEndpoint>[1];

const functionRequire = createRequire(resolve(process.cwd(), "functions/src/_utils.ts"));
const firestoreModule = functionRequire("firebase-admin/firestore");
vi.spyOn(firestoreModule.FieldValue, "serverTimestamp").mockImplementation(mocks.serverTimestamp);
const originalFunctionsEmulator = process.env.FUNCTIONS_EMULATOR;

afterEach(() => {
  if (originalFunctionsEmulator === undefined) {
    delete process.env.FUNCTIONS_EMULATOR;
  } else {
    process.env.FUNCTIONS_EMULATOR = originalFunctionsEmulator;
  }
});

function responseMock(overrides: Partial<{ headersSent: boolean; writableEnded: boolean }> = {}) {
  const res = Object.assign({
    headersSent: false,
    writableEnded: false,
    status: vi.fn(),
    json: vi.fn(),
    send: vi.fn(),
    end: vi.fn(),
  }, overrides);
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  res.send.mockReturnValue(res);
  res.end.mockReturnValue(res);
  return res;
}

describe("functions/src/_utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    process.env.FUNCTIONS_EMULATOR = "true";
    mocks.verifyToken.mockResolvedValue(undefined);
    mocks.verifyIdToken.mockResolvedValue({ uid: "user-1" });
    mocks.transaction.get.mockResolvedValue({ exists: false, data: () => undefined });
    mocks.transaction.set.mockResolvedValue(undefined);
    mocks.db.runTransaction.mockImplementation((work: (tx: typeof mocks.transaction) => unknown) =>
      Promise.resolve(work(mocks.transaction))
    );
    mocks.db.collection.mockImplementation((collection: string) => ({
      doc: (id: string) => ({
        collection: (subcollection: string) => ({
          doc: (key: string) => ({ path: `${collection}/${id}/${subcollection}/${key}` }),
        }),
        get: vi.fn().mockResolvedValue({ exists: true, data: () => ({ planId: "prova" }) }),
      }),
    }));
  });

  describe("App Check and authentication", () => {
    it("skips App Check in the Functions emulator", async () => {
      // Arrange
      process.env.FUNCTIONS_EMULATOR = "true";

      // Act
      await expect(requireAppCheck({ headers: {} })).resolves.toBeUndefined();

      // Assert
      expect(mocks.getAppCheck).not.toHaveBeenCalled();
    });

    it.each([undefined, null, 42])("rejects a missing or non-string App Check token: %s", async (token) => {
      // Arrange
      process.env.FUNCTIONS_EMULATOR = "false";

      // Act
      const result = requireAppCheck({ headers: { "x-firebase-appcheck": token } });

      // Assert
      await expect(result).rejects.toThrow("Missing App Check token");
      expect(mocks.getAppCheck).not.toHaveBeenCalled();
    });

    it("verifies a string App Check token outside the emulator", async () => {
      // Arrange
      process.env.FUNCTIONS_EMULATOR = "false";

      // Act
      await requireAppCheck({ headers: { "x-firebase-appcheck": "valid-token" } });

      // Assert
      expect(mocks.getAppCheck).toHaveBeenCalledOnce();
      expect(mocks.verifyToken).toHaveBeenCalledWith("valid-token");
    });

    it("converts a failed App Check verification to the public invalid-token error", async () => {
      // Arrange
      process.env.FUNCTIONS_EMULATOR = "false";
      mocks.verifyToken.mockRejectedValueOnce(new Error("verification details"));

      // Act
      const result = requireAppCheck({ headers: { "x-firebase-appcheck": "bad-token" } });

      // Assert
      await expect(result).rejects.toThrow("Invalid App Check token");
    });

    it.each([undefined, {}, { authorization: "Basic token" }, { authorization: "bearer token" }])(
      "rejects invalid authorization headers",
      async (headers) => {
        // Arrange / Act
        const result = requireUidFromAuthHeader({ headers });

        // Assert
        await expect(result).rejects.toThrow(/Missing Authorization/);
        expect(mocks.verifyIdToken).not.toHaveBeenCalled();
      }
    );

    it("extracts and verifies the bearer token, returning the decoded UID", async () => {
      // Arrange
      mocks.verifyIdToken.mockResolvedValueOnce({ uid: "decoded-user" });

      // Act
      const result = await requireUidFromAuthHeader({ headers: { authorization: "Bearer abc.def" } });

      // Assert
      expect(result).toBe("decoded-user");
      expect(mocks.verifyIdToken).toHaveBeenCalledWith("abc.def");
    });

    it("propagates Firebase token verification failures", async () => {
      // Arrange
      mocks.verifyIdToken.mockRejectedValueOnce(new Error("expired"));

      // Act
      const result = requireUidFromAuthHeader({ headers: { authorization: "Bearer expired-token" } });

      // Assert
      await expect(result).rejects.toThrow("expired");
    });
  });

  describe("Rome time keys", () => {
    it("formats the minute in the Europe/Rome time zone, including the UTC offset", () => {
      // Arrange
      const date = new Date("2025-01-02T03:04:59.000Z");

      // Act
      const result = minuteKeyRome(date);

      // Assert
      expect(result).toBe("2025-01-02T04:04");
    });

    it("formats the calendar day in Europe/Rome across a UTC date boundary", () => {
      // Arrange
      const date = new Date("2025-01-01T23:30:00.000Z");

      // Act
      const result = dayKeyRome(date);

      // Assert
      expect(result).toBe("2025-01-02");
    });
  });

  describe("CORS and secure endpoint wrapper", () => {
    it("configures CORS methods, headers and origin policy", () => {
      // Arrange
      const options = mocks.corsOptions as {
        methods: string[];
        allowedHeaders: string[];
        origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => void;
      };

      // Act
      const missingOrigin = vi.fn();
      const allowedOrigin = vi.fn();
      const rejectedOrigin = vi.fn();
      options.origin(undefined, missingOrigin);
      options.origin("https://jurio.example", allowedOrigin);
      options.origin("https://evil.example", rejectedOrigin);

      // Assert
      expect(options.methods).toEqual(["POST", "OPTIONS"]);
      expect(options.allowedHeaders).toEqual(["Content-Type", "Authorization", "X-Firebase-AppCheck"]);
      expect(missingOrigin).toHaveBeenCalledWith(null, false);
      expect(allowedOrigin).toHaveBeenCalledWith(null, true);
      expect(rejectedOrigin).toHaveBeenCalledWith(expect.any(Error));
    });

    it("answers OPTIONS without authenticating or calling the handler", async () => {
      // Arrange
      const req = { method: "OPTIONS", headers: {} };
      const res = responseMock();
      const handler = vi.fn<(uid: string) => Promise<void>>();

      // Act
      await withSecureApiEndpoint(req as unknown as SecureRequest, res as unknown as SecureResponse, handler);

      // Assert
      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.end).toHaveBeenCalledOnce();
      expect(handler).not.toHaveBeenCalled();
      expect(mocks.verifyIdToken).not.toHaveBeenCalled();
    });

    it("rejects non-POST methods without authenticating", async () => {
      // Arrange
      const req = { method: "GET", headers: {} };
      const res = responseMock();
      const handler = vi.fn<(uid: string) => Promise<void>>();

      // Act
      await withSecureApiEndpoint(req as unknown as SecureRequest, res as unknown as SecureResponse, handler);

      // Assert
      expect(res.status).toHaveBeenCalledWith(405);
      expect(res.send).toHaveBeenCalledWith("Method Not Allowed");
      expect(handler).not.toHaveBeenCalled();
    });

    it("authenticates a POST request then invokes its handler with the UID", async () => {
      // Arrange
      const req = { method: "POST", headers: { authorization: "Bearer token" } };
      const res = responseMock();
      const handler = vi.fn<(uid: string) => Promise<void>>().mockResolvedValue(undefined);

      // Act
      await withSecureApiEndpoint(req as unknown as SecureRequest, res as unknown as SecureResponse, handler);

      // Assert
      expect(handler).toHaveBeenCalledWith("user-1");
      expect(res.status).not.toHaveBeenCalled();
    });

    it.each([
      ["NOT_FOUND", 404, { error: "Not Found", details: "NOT_FOUND" }],
      ["record not found", 404, { error: "Not Found", details: "record not found" }],
      ["FORBIDDEN", 403, { error: "Forbidden", details: "FORBIDDEN" }],
      ["Accesso alla risorsa negato", 403, { error: "Forbidden", details: "Accesso alla risorsa negato" }],
      ["TOO_MANY_REQUESTS", 429, { error: "Too Many Requests", details: "Limite di utilizzo superato." }],
      ["quota_exceeded", 429, { error: "Too Many Requests", details: "Limite di utilizzo superato." }],
      ["Limite raggiunto", 429, { error: "Too Many Requests", details: "Limite di utilizzo superato." }],
      ["ToolLoop exceeded", 422, { error: "ToolLoop", details: "ToolLoop exceeded" }],
      ["other failure", 500, { error: "Process failed", details: "other failure" }],
    ])("maps handler error %s to HTTP %i", async (message, status, body) => {
      // Arrange
      const req = { method: "POST", headers: { authorization: "Bearer token" } };
      const res = responseMock();
      const handler = vi.fn<(uid: string) => Promise<void>>().mockRejectedValue(new Error(message));

      // Act
      await withSecureApiEndpoint(req as unknown as SecureRequest, res as unknown as SecureResponse, handler);

      // Assert
      expect(res.status).toHaveBeenCalledWith(status);
      expect(res.json).toHaveBeenCalledWith(body);
    });

    it("returns a generic internal error for non-Error throws", async () => {
      // Arrange
      const req = { method: "POST", headers: { authorization: "Bearer token" } };
      const res = responseMock();
      const handler = vi.fn<(uid: string) => Promise<void>>().mockRejectedValue("secret");

      // Act
      await withSecureApiEndpoint(req as unknown as SecureRequest, res as unknown as SecureResponse, handler);

      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Process failed", details: "Internal error" });
    });

    it("ends an already-started response instead of writing a second body", async () => {
      // Arrange
      const req = { method: "POST", headers: { authorization: "Bearer token" } };
      const res = responseMock({ headersSent: true, writableEnded: false });
      const handler = vi.fn<(uid: string) => Promise<void>>().mockRejectedValue(new Error("failed"));

      // Act
      await withSecureApiEndpoint(req as unknown as SecureRequest, res as unknown as SecureResponse, handler);

      // Assert
      expect(res.end).toHaveBeenCalledOnce();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("plan validation and usage counters", () => {
    it("loads a user, validates the plan, and consumes both configured feature limits", async () => {
      // Arrange
      const userDoc = vi.fn().mockResolvedValue({ exists: true, data: () => ({ planId: "prova" }) });
      mocks.db.collection.mockImplementation((collection: string) => ({
        doc: (id: string) => ({
          collection: (subcollection: string) => ({
            doc: (key: string) => ({ path: `${collection}/${id}/${subcollection}/${key}` }),
          }),
          get: userDoc,
        }),
      }));

      // Act
      await validateUserPlanAndLimits("user-1", "legal_agent" satisfies JurioFeatureType);

      // Assert
      expect(userDoc).toHaveBeenCalledOnce();
      expect(mocks.db.runTransaction).toHaveBeenCalledTimes(2);
      expect(mocks.transaction.set).toHaveBeenCalledTimes(2);
      expect(mocks.transaction.set).toHaveBeenCalledWith(
        expect.objectContaining({ path: expect.stringContaining("/minutes/") }),
        { count: 1, updatedAt: "server-timestamp" },
        { merge: true }
      );
      expect(mocks.transaction.set).toHaveBeenCalledWith(
        expect.objectContaining({ path: expect.stringContaining("/days/") }),
        { count: 1, updatedAt: "server-timestamp" },
        { merge: true }
      );
    });

    it("uses a preloaded user snapshot without reading the register collection", async () => {
      // Arrange
      const snapshot = { exists: true, data: () => ({ planId: "prova" }) };

      // Act
      await validateUserPlanAndLimits(
        "user-1",
        "research",
        snapshot as unknown as Parameters<typeof validateUserPlanAndLimits>[2]
      );

      // Assert
      expect(mocks.db.collection).not.toHaveBeenCalledWith("register");
      expect(mocks.db.runTransaction).toHaveBeenCalledTimes(2);
    });

    it("throws NOT_FOUND for a missing account before consuming usage", async () => {
      // Arrange
      mocks.db.collection.mockImplementationOnce(() => ({
        doc: () => ({ get: vi.fn().mockResolvedValue({ exists: false }) }),
      }));

      // Act
      const result = validateUserPlanAndLimits("missing", "research");

      // Assert
      await expect(result).rejects.toThrow("NOT_FOUND");
      expect(mocks.db.runTransaction).not.toHaveBeenCalled();
    });

    it.each([undefined, null, "unknown"])("throws FORBIDDEN for unsupported plans: %s", async (planId) => {
      // Arrange
      const snapshot = { exists: true, data: () => ({ planId }) };

      // Act
      const result = validateUserPlanAndLimits(
        "user-1",
        "research",
        snapshot as unknown as Parameters<typeof validateUserPlanAndLimits>[2]
      );

      // Assert
      await expect(result).rejects.toThrow("FORBIDDEN");
      expect(mocks.db.runTransaction).not.toHaveBeenCalled();
    });

    it("wraps any rate-limit failure as TOO_MANY_REQUESTS", async () => {
      // Arrange
      mocks.transaction.get.mockResolvedValueOnce({
        exists: true,
        data: () => ({ count: 3 }),
      });
      const snapshot = { exists: true, data: () => ({ planId: "prova" }) };

      // Act
      const result = validateUserPlanAndLimits(
        "user-1",
        "research",
        snapshot as unknown as Parameters<typeof validateUserPlanAndLimits>[2]
      );

      // Assert
      await expect(result).rejects.toThrow("TOO_MANY_REQUESTS");
      expect(mocks.db.runTransaction).toHaveBeenCalled();
    });

    it("increments a minute counter and writes a timestamp on an allowed transaction", async () => {
      // Arrange
      mocks.transaction.get.mockResolvedValueOnce({ exists: true, data: () => ({ count: 1 }) });

      // Act
      await consumePerMinuteFeature("user-1", "research", 2);

      // Assert
      expect(mocks.transaction.get).toHaveBeenCalledWith(
        expect.objectContaining({ path: expect.stringMatching(/^rate\/user-1\/minutes\/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}_research$/) })
      );
      expect(mocks.transaction.set).toHaveBeenCalledWith(
        expect.objectContaining({ path: expect.stringContaining("/minutes/") }),
        { count: 2, updatedAt: "server-timestamp" },
        { merge: true }
      );
    });

    it("rejects a minute transaction above its limit without writing", async () => {
      // Arrange
      mocks.transaction.get.mockResolvedValueOnce({ exists: true, data: () => ({ count: 2 }) });

      // Act
      const result = consumePerMinuteFeature("user-1", "research", 2);

      // Assert
      await expect(result).rejects.toMatchObject({
        message: "rate_limited",
        code: "rate_limited",
        feature: "research",
        prev: 2,
      });
      expect(mocks.transaction.set).not.toHaveBeenCalled();
    });

    it("increments a daily counter and returns the remaining allowance", async () => {
      // Arrange
      mocks.transaction.get.mockResolvedValueOnce({ exists: true, data: () => ({ count: 2 }) });

      // Act
      const result = await consumeDailyFeature("user-1", "research", 5);

      // Assert
      expect(result).toEqual({ remaining: 2 });
      expect(mocks.transaction.get).toHaveBeenCalledWith(
        expect.objectContaining({ path: expect.stringMatching(/^usage\/user-1\/days\/\d{4}-\d{2}-\d{2}_research$/) })
      );
      expect(mocks.transaction.set).toHaveBeenCalledWith(
        expect.objectContaining({ path: expect.stringContaining("/days/") }),
        { count: 3, updatedAt: "server-timestamp" },
        { merge: true }
      );
    });

    it("rejects a daily transaction above its limit without writing", async () => {
      // Arrange
      mocks.transaction.get.mockResolvedValueOnce({ exists: true, data: () => ({ count: 5 }) });

      // Act
      const result = consumeDailyFeature("user-1", "research", 5);

      // Assert
      await expect(result).rejects.toMatchObject({
        message: "quota_exceeded",
        code: "quota_exceeded",
        feature: "research",
        prev: 5,
      });
      expect(mocks.transaction.set).not.toHaveBeenCalled();
    });
  });

  it("exports the CORS middleware created from the configured policy", () => {
    // Arrange / Act
    const result = corsHandlerDomain;

    // Assert
    expect(typeof result).toBe("function");
  });
});
