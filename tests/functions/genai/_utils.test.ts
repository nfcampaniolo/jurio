import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const batch = { update: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) };
  const collection = { doc: vi.fn((id: string) => ({ id })) };
  const db = { batch: vi.fn(() => batch), collection: vi.fn(() => collection) };
  return { batch, collection, db };
});

vi.mock("@functions/_deps", () => ({ getDb: () => mocks.db }));
import { assertResourceOwner, hashIpForRateLimiting, incrementRagCounter } from "@functions/genai/_utils";

describe("GenAI shared helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.batch.commit.mockResolvedValue(undefined);
  });

  it("accepts only the user owner field and rejects mismatches", () => {
    expect(() => assertResourceOwner({ user: "u1" }, "u1")).not.toThrow();
    expect(() => assertResourceOwner({ ownerId: "u1" }, "u1")).toThrow("Accesso alla risorsa negato.");
    expect(() => assertResourceOwner({ userId: "u1" }, "u1")).toThrow("Accesso alla risorsa negato.");
    expect(() => assertResourceOwner({}, "u1", "custom")).toThrow("custom");
    expect(() => assertResourceOwner({ user: "u2" }, "u1")).toThrow("Accesso alla risorsa negato.");
  });

  it("hashes an address deterministically without returning it", () => {
    const first = hashIpForRateLimiting("192.0.2.1");
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(hashIpForRateLimiting("192.0.2.1")).toBe(first);
    expect(first).not.toContain("192.0.2.1");
  });

  it("does nothing for an empty ID list and batches increments for IDs", async () => {
    await incrementRagCounter("sentences", []);
    expect(mocks.db.batch).not.toHaveBeenCalled();
    await incrementRagCounter("sentences", ["a", "b"]);
    expect(mocks.db.collection).toHaveBeenCalledWith("sentences");
    expect(mocks.batch.update).toHaveBeenCalledTimes(2);
    expect(mocks.batch.commit).toHaveBeenCalledOnce();
  });

  it("absorbs database failures after reporting the attempted batch", async () => {
    mocks.batch.commit.mockRejectedValueOnce(new Error("offline"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(incrementRagCounter("sentences", ["a"])).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledOnce();
  });
});
