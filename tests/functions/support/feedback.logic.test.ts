import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { resolve } from "node:path";

const mocks = vi.hoisted(() => {
  const userGet = vi.fn();
  const doc = vi.fn(() => ({ get: userGet }));
  const add = vi.fn();
  const sentencesDoc = vi.fn((id: string) => ({ id }));
  const collection = vi.fn((name: string) => name === "register" ? { doc } : name === "complaints" ? { add } : { doc: sentencesDoc });
  const getAll = vi.fn();
  const batchUpdate = vi.fn();
  const commit = vi.fn();
  const db = { collection, getAll, batch: vi.fn(() => ({ update: batchUpdate, commit })) };
  return {
    userGet, doc, add, sentencesDoc, collection, getAll, batchUpdate, commit, db,
    getDb: vi.fn(() => db),
    secureEndpoint: vi.fn(async (_req: unknown, _res: unknown, handler: (uid: string) => Promise<void>) => handler("user-1")),
    validate: vi.fn(),
    increment: vi.fn((n: number) => ({ increment: n })),
    serverTimestamp: vi.fn(() => "server-time"),
  };
});

vi.mock("@functions/_utils", () => ({
  withSecureApiEndpoint: mocks.secureEndpoint,
  validateUserPlanAndLimits: mocks.validate,
}));
vi.mock("@functions/_deps", () => ({ getDb: mocks.getDb }));

const sourceRequire = createRequire(resolve(process.cwd(), "functions/src/support/feedback.logic.ts"));
const firestoreModule = sourceRequire("firebase-admin/firestore");
void firestoreModule;
const firestorePath = resolve(
  sourceRequire.resolve("firebase-admin/firestore").replace("/lib/firestore/index.js", "/lib/esm/firestore/index.js"),
);
vi.doMock(firestorePath, async () => {
  const actual = await vi.importActual<typeof firestoreModule>(firestorePath);
  const fieldValue = Object.create(actual.FieldValue);
  Object.assign(fieldValue, {
    increment: mocks.increment,
    serverTimestamp: mocks.serverTimestamp,
  });
  return { ...actual, FieldValue: fieldValue };
});
const { executeSubmitFeedback } = await import("@functions/support/feedback.logic");

function response() {
  return {
    status: vi.fn(function (this: unknown) { return this; }),
    json: vi.fn(function (this: unknown) { return this; }),
  };
}

describe("feedback endpoint", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userGet.mockResolvedValue({ exists: true });
    mocks.validate.mockResolvedValue(undefined);
    mocks.add.mockResolvedValue(undefined);
    mocks.getAll.mockResolvedValue([{ exists: true, ref: { id: "sentence-a" } }, { exists: false, ref: { id: "missing" } }]);
    mocks.commit.mockResolvedValue(undefined);
  });

  it("returns 404 for missing account and rejects invalid ratings or oversized notes", async () => {
    // Arrange
    mocks.userGet.mockResolvedValueOnce({ exists: false });
    const missing = response();

    // Act
    await executeSubmitFeedback({ body: {} } as never, missing as never);

    // Assert
    expect(missing.status).toHaveBeenCalledWith(404);
    expect(mocks.validate).not.toHaveBeenCalled();

    // Arrange
    const invalid = response();

    // Act
    await executeSubmitFeedback({ body: { isThumbsUp: "yes" } } as never, invalid as never);

    // Assert
    expect(invalid.status).toHaveBeenCalledWith(400);

    // Arrange
    const oversized = response();

    // Act
    await executeSubmitFeedback({ body: { isThumbsUp: false, notes: "x".repeat(2001) } } as never, oversized as never);

    // Assert
    expect(oversized.status).toHaveBeenCalledWith(413);
    expect(mocks.add).not.toHaveBeenCalled();
  });

  it("rejects more than 30 IDs and returns success without usable IDs", async () => {
    // Arrange
    const tooMany = response();

    // Act
    await executeSubmitFeedback({ body: { isThumbsUp: false, ids: Array(31).fill("id$") } } as never, tooMany as never);

    // Assert
    expect(tooMany.status).toHaveBeenCalledWith(400);

    // Arrange
    const empty = response();

    // Act
    await executeSubmitFeedback({ body: { isThumbsUp: false, ids: [null, "  "] } } as never, empty as never);

    // Assert
    expect(empty.status).toHaveBeenCalledWith(200);
    expect(empty.json).toHaveBeenCalledWith({ success: true, message: "Nessun ID valido fornito." });
    expect(mocks.add).not.toHaveBeenCalled();
  });

  it("stores a complaint with normalized IDs and trimmed notes for a negative rating", async () => {
    // Arrange
    const res = response();

    // Act
    await executeSubmitFeedback({
      body: { isThumbsUp: false, notes: "  Broken result  ", ids: ["  https://example.test/doc  ", 12, "other$"] },
    } as never, res as never);

    // Assert
    expect(mocks.add).toHaveBeenCalledWith({
      uid: "user-1",
      urls: ["https://example.test/doc", "other$"],
      reason: "Broken result",
      status: "pending",
      createdAt: "server-time",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: "Reclamo registrato con successo." });
  });

  it("ignores invalid positive-feedback IDs and increments only existing valid sentence documents", async () => {
    // Arrange
    const ignored = response();

    // Act
    await executeSubmitFeedback({
      body: { isThumbsUp: true, ids: ["https://external.test/a$", "not/valid", "with/slash$"] },
    } as never, ignored as never);

    // Assert
    expect(ignored.json).toHaveBeenCalledWith({
      success: true, message: "Feedback ignorato: IDs non validi o link esterni.",
    });
    expect(mocks.getAll).not.toHaveBeenCalled();

    // Arrange
    const res = response();

    // Act
    await executeSubmitFeedback({ body: { isThumbsUp: true, ids: ["sentence-a", "missing"] } } as never, res as never);

    // Assert
    expect(mocks.getAll).toHaveBeenCalledWith({ id: "sentence-a" }, { id: "missing" });
    expect(mocks.batchUpdate).toHaveBeenCalledOnce();
    expect(mocks.batchUpdate).toHaveBeenCalledWith({ id: "sentence-a" }, { feedbacks: { increment: 1 } });
    expect(mocks.increment).toHaveBeenCalledWith(1);
    expect(mocks.commit).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith({
      success: true, message: "Feedback positivo registrato per 1 documenti.",
    });
  });

  it("does not commit a positive-feedback batch if every referenced document is missing", async () => {
    // Arrange
    mocks.getAll.mockResolvedValueOnce([{ exists: false, ref: { id: "missing" } }]);
    const res = response();

    // Act
    await executeSubmitFeedback({ body: { isThumbsUp: true, ids: ["missing"] } } as never, res as never);

    // Assert
    expect(mocks.batchUpdate).not.toHaveBeenCalled();
    expect(mocks.commit).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      success: true, message: "Feedback positivo registrato per 0 documenti.",
    });
  });
});
