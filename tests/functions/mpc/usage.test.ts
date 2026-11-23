import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const mocks = vi.hoisted(() => {
  const batchSet = vi.fn();
  const commit = vi.fn();
  const batch = vi.fn(() => ({ set: batchSet, commit }));
  const docRef = (path: string) => ({
    path,
    collection: (sub: string) => ({ doc: (id: string) => docRef(`${path}/${sub}/${id}`) }),
  });
  const collection = vi.fn((name: string) => ({ doc: (id: string) => docRef(`${name}/${id}`) }));
  return { batchSet, commit, batch, db: { batch, collection } };
});

vi.mock("@functions/_deps", () => ({ getDb: () => mocks.db }));

const functionRequire = createRequire(resolve(process.cwd(), "functions/src/mpc/usage.ts"));
const firestoreModule = functionRequire("firebase-admin/firestore");

describe("mcp usage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    vi.spyOn(firestoreModule.FieldValue, "increment").mockImplementation(((n: number) => `inc(${n})`) as never);
    vi.spyOn(firestoreModule.FieldValue, "serverTimestamp").mockReturnValue("server-timestamp" as never);
    mocks.commit.mockResolvedValue(undefined);
  });

  it("normalizes client and tool names into safe Firestore map keys", async () => {
    const { normalizeUsageKey } = await import("@functions/mpc/usage");

    expect(normalizeUsageKey("Claude Desktop")).toBe("claude_desktop");
    expect(normalizeUsageKey("chatgpt.com/connector")).toBe("chatgpt_com_connector");
    expect(normalizeUsageKey("  ")).toBe("unknown");
    expect(normalizeUsageKey(undefined)).toBe("unknown");
    expect(normalizeUsageKey("x".repeat(100))).toHaveLength(40);
  });

  it("computes the day key in the Europe/Rome timezone", async () => {
    const { mcpDayKey } = await import("@functions/mpc/usage");

    expect(mcpDayKey(new Date("2026-11-22T23:30:00Z"))).toBe("2026-11-23");
  });

  it("increments per-user and platform daily counters in a single batch", async () => {
    const { recordMcpToolCall } = await import("@functions/mpc/usage");

    await recordMcpToolCall({ uid: "user-1", client: "claude", tool: "ricercaSemantica", ok: false, durationMs: 1234.6 });

    const expected = {
      calls: "inc(1)",
      errors: "inc(1)",
      durationMsTotal: "inc(1235)",
      tools: { ricercasemantica: "inc(1)" },
      clients: { claude: "inc(1)" },
      updatedAt: "server-timestamp",
    };
    const [[userRef, userData, userOpts], [dailyRef, dailyData]] = mocks.batchSet.mock.calls;
    expect(userRef.path).toMatch(/^mcp_usage\/user-1\/days\/\d{4}-\d{2}-\d{2}$/);
    expect(dailyRef.path).toMatch(/^mcp_usage_daily\/\d{4}-\d{2}-\d{2}$/);
    expect(userData).toEqual(expected);
    expect(dailyData).toEqual(expected);
    expect(userOpts).toEqual({ merge: true });
    expect(mocks.commit).toHaveBeenCalledOnce();
  });

  it("never throws when the write fails", async () => {
    const { recordMcpToolCall } = await import("@functions/mpc/usage");
    mocks.commit.mockRejectedValueOnce(new Error("unavailable"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      recordMcpToolCall({ uid: "u", client: "unknown", tool: "t", ok: true, durationMs: 1 })
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
  });
});
