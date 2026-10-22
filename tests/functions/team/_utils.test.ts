import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const where = vi.fn();
  const get = vi.fn();
  const batchUpdate = vi.fn();
  const batchCommit = vi.fn();
  const txGet = vi.fn();
  const txSet = vi.fn();
  const txUpdate = vi.fn();
  const doc = vi.fn();
  const collection = vi.fn();
  const randomInt = vi.fn();
  const db = { collection, batch: vi.fn() };
  return { where, get, batchUpdate, batchCommit, txGet, txSet, txUpdate, doc, collection, randomInt, db };
});

vi.mock("@functions/_deps", () => ({ getDb: () => mocks.db }));
vi.mock("@functions/_utils", () => ({ validateUserPlanAndLimits: vi.fn() }));
vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  return {
    ...actual,
    default: { ...actual, randomInt: mocks.randomInt },
    randomInt: mocks.randomInt,
  };
});
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    arrayRemove: vi.fn((value: string) => ({ remove: value })),
  },
}));

describe("team document and creation utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.randomInt.mockReset();
    mocks.randomInt.mockReturnValue(0);
    const query = { where: mocks.where, get: mocks.get };
    mocks.where.mockReturnValue(query);
    mocks.collection.mockReturnValue(query);
    mocks.db.batch.mockReturnValue({
      update: mocks.batchUpdate,
      commit: mocks.batchCommit,
    });
    mocks.batchCommit.mockResolvedValue(undefined);
    mocks.get.mockResolvedValue({ empty: true, docs: [] });
    mocks.doc.mockImplementation((id?: string) => ({
      id,
      collection: vi.fn(() => ({ doc: mocks.doc })),
    }));
  });

  it("removes a user's document visibility across the managed collections", async () => {
    // Arrange
    const { removeUserVisibilityFromDocuments } = await import("@functions/team/_utils");

    // Act
    await removeUserVisibilityFromDocuments("member-1");

    // Assert
    expect(mocks.where).toHaveBeenCalledTimes(3);
    expect(mocks.where).toHaveBeenCalledWith("visibleTo", "array-contains", "member-1");
    expect(mocks.batchUpdate).not.toHaveBeenCalled();
  });

  it("removes visibility through committed batches when matching documents exist", async () => {
    // Arrange
    const ref = { path: "documents/doc-1" };
    mocks.get.mockResolvedValue({ empty: false, docs: [{ ref }] });
    const { removeUserVisibilityFromDocuments } = await import("@functions/team/_utils");

    // Act
    await removeUserVisibilityFromDocuments("member-1");

    // Assert
    expect(mocks.batchUpdate).toHaveBeenCalledTimes(3);
    expect(mocks.batchCommit).toHaveBeenCalledTimes(3);
  });

  it("splits visibility removals after the Firestore 500-write batch limit", async () => {
    // Arrange
    const docs = Array.from({ length: 501 }, (_, index) => ({ ref: { id: `doc-${index}` } }));
    mocks.get
      .mockResolvedValueOnce({ empty: false, docs })
      .mockResolvedValue({ empty: true, docs: [] });
    const { removeUserVisibilityFromDocuments } = await import("@functions/team/_utils");

    // Act
    await removeUserVisibilityFromDocuments("member-1");

    // Assert
    expect(mocks.batchUpdate).toHaveBeenCalledTimes(501);
    expect(mocks.batchCommit).toHaveBeenCalledTimes(2);
  });

  it("reassigns document ownership using the user field", async () => {
    // Arrange
    const docRef = { path: "documents/doc-1" };
    mocks.get.mockResolvedValue({ empty: false, docs: [{ ref: docRef }] });
    const { updateUserDocuments } = await import("@functions/team/_utils");

    // Act
    await updateUserDocuments("member-1", "owner-1");

    // Assert
    expect(mocks.where).toHaveBeenCalledTimes(3);
    expect(mocks.where).toHaveBeenCalledWith("user", "==", "member-1");
    expect(mocks.batchUpdate).toHaveBeenCalledTimes(3);
    expect(mocks.batchUpdate).toHaveBeenCalledWith(docRef, { user: "owner-1" });
    expect(mocks.batchCommit).toHaveBeenCalledTimes(3);
  });

  it("splits document ownership updates after 500 writes", async () => {
    // Arrange
    const docs = Array.from({ length: 501 }, (_, index) => ({ ref: { id: `doc-${index}` } }));
    mocks.get
      .mockResolvedValueOnce({ empty: false, docs })
      .mockResolvedValue({ empty: true, docs: [] });
    const { updateUserDocuments } = await import("@functions/team/_utils");

    // Act
    await updateUserDocuments("member-1", "owner-1");

    // Assert
    expect(mocks.batchUpdate).toHaveBeenCalledTimes(501);
    expect(mocks.batchCommit).toHaveBeenCalledTimes(2);
  });

  it("skips creating batches when no documents need reassignment", async () => {
    // Arrange
    const { updateUserDocuments } = await import("@functions/team/_utils");

    // Act
    await updateUserDocuments("member-1", "owner-1");

    // Assert
    expect(mocks.where).toHaveBeenCalledTimes(3);
    expect(mocks.batchUpdate).not.toHaveBeenCalled();
    expect(mocks.batchCommit).not.toHaveBeenCalled();
  });

  it("returns immediately for plans outside the team family", async () => {
    // Arrange
    const { handleTeamCreationInTx } = await import("@functions/team/_utils");

    // Act
    const result = await handleTeamCreationInTx({}, mocks.db, "user-1", "personale", 100, {});

    // Assert
    expect(result).toEqual({ finalUserStatus: "personale", needsTask: true });
    expect(mocks.txGet).not.toHaveBeenCalled();
  });

  it("creates a team with available vouchers and an owner membership transactionally", async () => {
    // Arrange
    const teamRef = {
      collection: vi.fn(() => ({ doc: vi.fn(() => "member-ref") })),
    };
    mocks.collection.mockImplementation((name: string) => {
      if (name === "users") return { doc: vi.fn(() => "user-ref") };
      if (name === "teams") return {
        where: vi.fn(() => ({ limit: vi.fn(() => "teams-query") })),
        doc: vi.fn(() => teamRef),
      };
      return { doc: vi.fn(() => "other-ref") };
    });
    mocks.txGet
      .mockResolvedValueOnce({ data: () => ({ status: "prova" }) })
      .mockResolvedValueOnce({ empty: true, docs: [] });
    mocks.randomInt.mockReturnValueOnce(0).mockReturnValueOnce(36 ** 6 - 1);
    const now = { constructor: { fromMillis: vi.fn(() => "expire") } };
    const tx = { get: mocks.txGet, set: mocks.txSet, update: mocks.txUpdate };
    const { handleTeamCreationInTx } = await import("@functions/team/_utils");

    // Act
    const result = await handleTeamCreationInTx(tx, mocks.db, "user-1", "team3", 100, now);

    // Assert
    expect(result).toEqual({ finalUserStatus: "business", needsTask: true });
    expect(mocks.txSet).toHaveBeenCalledTimes(2);
    expect(mocks.txSet).toHaveBeenCalledWith(teamRef, expect.objectContaining({
      owners: ["user-1"],
      member_ids: ["user-1"],
      vouchers: [
        { id: "VCH-000000", duration: 365, used: false },
        { id: "VCH-ZZZZZZ", duration: 365, used: false },
      ],
    }));
    expect(mocks.randomInt).toHaveBeenNthCalledWith(1, 36 ** 6);
    expect(mocks.randomInt).toHaveBeenNthCalledWith(2, 36 ** 6);
    expect(now.constructor.fromMillis).toHaveBeenCalledWith(100000);
  });

  it("extends an existing team for an already-business owner using default voucher count", async () => {
    // Arrange
    const memberRef = { path: "teams/team-1/members/user-1" };
    const existingTeamRef = {
      collection: vi.fn(() => ({ doc: vi.fn(() => memberRef) })),
    };
    mocks.collection.mockImplementation((name: string) => {
      if (name === "users") return { doc: vi.fn(() => "user-ref") };
      if (name === "teams") return {
        where: vi.fn(() => ({ limit: vi.fn(() => "teams-query") })),
      };
      return { doc: vi.fn(() => "other-ref") };
    });
    mocks.txGet
      .mockResolvedValueOnce({ data: () => ({ status: "business" }) })
      .mockResolvedValueOnce({
        empty: false,
        docs: [{ ref: existingTeamRef, data: () => ({ name: "Existing workspace" }) }],
      });
    const now = { constructor: { fromMillis: vi.fn(() => "expire") } };
    const tx = { get: mocks.txGet, set: mocks.txSet, update: mocks.txUpdate };
    const { handleTeamCreationInTx } = await import("@functions/team/_utils");

    // Act
    const result = await handleTeamCreationInTx(tx, mocks.db, "user-1", "team-invalid", 200, now);

    // Assert
    expect(result).toEqual({ finalUserStatus: "business", needsTask: false });
    expect(mocks.txUpdate).toHaveBeenCalledWith(existingTeamRef, {
      vouchers: expect.arrayContaining([expect.objectContaining({ used: false, duration: 365 })]),
    });
    expect(mocks.txSet).toHaveBeenCalledWith(memberRef, { expire: "expire" }, { merge: true });
    expect(now.constructor.fromMillis).toHaveBeenCalledWith(200000);
  });
});
