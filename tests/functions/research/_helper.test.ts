import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getDb: vi.fn(),
  requireAppCheck: vi.fn(),
  requireUidFromAuthHeader: vi.fn(),
  where: vi.fn(),
  db: { collection: vi.fn() },
  tokenGet: vi.fn(),
  tokenDelete: vi.fn(),
  OpenAI: vi.fn(),
}));

vi.mock("@functions/_deps", () => ({ getDb: mocks.getDb }));
vi.mock("@functions/_utils", () => ({
  requireAppCheck: mocks.requireAppCheck,
  requireUidFromAuthHeader: mocks.requireUidFromAuthHeader,
}));
vi.mock("../../../functions/node_modules/openai/index.mjs", () => ({ OpenAI: mocks.OpenAI }));

describe("research helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.OpenAI.mockImplementation(function () {
      return { client: true };
    });
    mocks.getDb.mockReturnValue(mocks.db);
    mocks.db.collection.mockReturnValue({
      doc: vi.fn(() => ({ get: mocks.tokenGet })),
    });
    mocks.tokenGet.mockResolvedValue({
      exists: false,
      ref: { delete: mocks.tokenDelete },
    });
    delete process.env.OPENAI_API_KEY;
  });

  it("creates a lazy OpenAI client and reuses it", async () => {
    // Arrange
    process.env.OPENAI_API_KEY = "test-key";
    vi.resetModules();
    const { getOpenAIClient } = await import("@functions/research/_helper");

    // Act
    const first = getOpenAIClient();
    const second = getOpenAIClient();

    // Assert
    expect(first).toBe(second);
  });

  it("throws when OpenAI is requested without an API key", async () => {
    // Arrange
    vi.resetModules();
    const { getOpenAIClient } = await import("@functions/research/_helper");

    // Act / Assert
    expect(() => getOpenAIClient()).toThrow("OPENAI_API_KEY_MISSING");
  });

  it("authenticates Firebase requests with App Check and the auth header", async () => {
    // Arrange
    mocks.requireUidFromAuthHeader.mockResolvedValue("user-1");
    const { authenticateRequest } = await import("@functions/research/_helper");
    const req = { headers: { authorization: "Bearer firebase-token" } } as never;

    // Act
    const result = await authenticateRequest(req);

    // Assert
    expect(result).toEqual({ uid: "user-1", isOAuthRequest: false });
    expect(mocks.requireAppCheck).toHaveBeenCalledWith(req);
    expect(mocks.requireUidFromAuthHeader).toHaveBeenCalledWith(req);
  });

  it("rejects invalid Firebase auth", async () => {
    // Arrange
    mocks.requireAppCheck.mockRejectedValue(new Error("invalid"));
    const { authenticateRequest } = await import("@functions/research/_helper");

    // Act / Assert
    await expect(authenticateRequest({ headers: {} } as never)).rejects.toThrow("UNAUTHORIZED");
  });

  it("applies valid filters, converts serialized timestamps and skips invalid filters", async () => {
    // Arrange
    const query = { where: mocks.where };
    mocks.where.mockReturnValue(query);
    const { applyFirestoreFilters } = await import("@functions/research/_helper");
    const filters = [
      { field: "status", operator: "==", value: "active" },
      { field: "createdAt", operator: ">=", value: { seconds: 10, nanoseconds: 5 } },
      { field: "ignored", value: 1 },
    ];

    // Act
    const result = applyFirestoreFilters(query, filters);

    // Assert
    expect(result).toBe(query);
    expect(mocks.where).toHaveBeenCalledTimes(2);
    expect(mocks.where.mock.calls[0]).toEqual(["status", "==", "active"]);
    expect(mocks.where.mock.calls[1][2]).toMatchObject({ seconds: 10, nanoseconds: 5 });
  });

  it("truncates text safely and clamps limit parameters", async () => {
    // Arrange
    const { parseLimitParam, safeTruncateText } = await import("@functions/research/_helper");

    // Act
    const truncated = safeTruncateText("abcdef", 3);
    const empty = safeTruncateText(12);
    const low = parseLimitParam(0);
    const high = parseLimitParam(500);
    const fallback = parseLimitParam("not numeric");

    // Assert
    expect(truncated).toBe("abc");
    expect(empty).toBeNull();
    expect([low, high, fallback]).toEqual([1, 100, 50]);
  });
});
