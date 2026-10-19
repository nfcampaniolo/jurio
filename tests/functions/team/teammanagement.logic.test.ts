import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const secure = vi.fn();
  const validate = vi.fn();
  const registerGet = vi.fn();
  const teamGet = vi.fn();
  const membersGet = vi.fn();
  const documentQueryGet = vi.fn();
  const batchUpdate = vi.fn();
  const batchDelete = vi.fn();
  const batchCommit = vi.fn();
  const bulkUpdate = vi.fn();
  const bulkClose = vi.fn();
  const enqueueClose = vi.fn();
  const updateDocs = vi.fn();
  const removeVisibility = vi.fn();
  const collection = vi.fn();
  const db = { collection, batch: vi.fn(), bulkWriter: vi.fn() };
  return {
    secure, validate, registerGet, teamGet, membersGet, documentQueryGet, batchUpdate, batchDelete, batchCommit,
    bulkUpdate, bulkClose, enqueueClose, updateDocs, removeVisibility, collection, db,
  };
});

vi.mock("@functions/_deps", () => ({ getDb: () => mocks.db }));
vi.mock("@functions/_utils", () => ({
  withSecureApiEndpoint: mocks.secure,
  validateUserPlanAndLimits: mocks.validate,
}));
vi.mock("@functions/team/_utils", () => ({
  updateUserDocuments: mocks.updateDocs,
  removeUserVisibilityFromDocuments: mocks.removeVisibility,
}));
vi.mock("@functions/email/team/logic", () => ({ enqueueCloseTeamEmail: mocks.enqueueClose }));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    delete: vi.fn(() => ({ delete: true })),
    arrayRemove: vi.fn((value: string) => ({ remove: value })),
    arrayUnion: vi.fn((...values: string[]) => ({ union: values })),
  },
}));

describe("team management endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.secure.mockImplementation(async (_req: unknown, _res: unknown, callback: (uid: string) => Promise<void>) => callback("owner-1"));
    mocks.validate.mockResolvedValue(undefined);
    mocks.registerGet.mockResolvedValue({ exists: true, data: () => ({}) });
    mocks.teamGet.mockResolvedValue({ exists: true, data: () => ({ owners: ["owner-1"], name: "Workspace" }) });
    mocks.membersGet.mockResolvedValue({ docs: [] });
    mocks.documentQueryGet.mockResolvedValue({ docs: [] });
    mocks.db.batch.mockReturnValue({
      update: mocks.batchUpdate,
      delete: mocks.batchDelete,
      commit: mocks.batchCommit,
    });
    mocks.batchCommit.mockResolvedValue(undefined);
    mocks.db.bulkWriter.mockReturnValue({ update: mocks.bulkUpdate, close: mocks.bulkClose });
    mocks.bulkClose.mockResolvedValue(undefined);
    mocks.enqueueClose.mockResolvedValue(undefined);
    mocks.updateDocs.mockResolvedValue(undefined);
    mocks.removeVisibility.mockResolvedValue(undefined);
    mocks.collection.mockImplementation((name: string) => ({
      doc: vi.fn(() => ({
        get: name === "register" ? mocks.registerGet : mocks.teamGet,
        collection: vi.fn(() => ({ get: mocks.membersGet })),
      })),
      where: vi.fn(() => ({ get: mocks.documentQueryGet })),
    }));
  });

  const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });

  it("rejects missing team identifiers before database access", async () => {
    // Arrange
    const { executeShareAllTeamDocuments } = await import("@functions/team/teammanagement.logic");
    const res = response();

    // Act
    await executeShareAllTeamDocuments({ body: { teamId: "!!!" } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.teamGet).not.toHaveBeenCalled();
  });

  it("returns a successful zero-update response for a team without members", async () => {
    // Arrange
    const { executeShareAllTeamDocuments } = await import("@functions/team/teammanagement.logic");
    const res = response();

    // Act
    await executeShareAllTeamDocuments({ body: { teamId: "team-1" } } as never, res as never);

    // Assert
    expect(mocks.validate).toHaveBeenCalledWith("owner-1", "teams", expect.any(Object));
    expect(mocks.db.bulkWriter).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ success: true, updatedCount: 0, message: "Nessun membro nel team" });
  });

  it("deletes an owned team and commits the Firestore batch", async () => {
    // Arrange
    const { executeDeleteTeam } = await import("@functions/team/teammanagement.logic");
    const res = response();

    // Act
    await executeDeleteTeam({ body: { teamId: "team-1" } } as never, res as never);

    // Assert
    expect(mocks.batchDelete).toHaveBeenCalledWith(expect.objectContaining({ collection: expect.any(Function) }));
    expect(mocks.batchCommit).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it("reassigns member documents, removes visibility, and notifies members when deleting a team", async () => {
    // Arrange
    const memberRef = { path: "teams/team-1/members/member-1" };
    mocks.membersGet.mockResolvedValue({
      docs: [
        { id: "owner-1", ref: { path: "members/owner-1" }, data: () => ({ email: "owner@example.test" }) },
        { id: "member-1", ref: memberRef, data: () => ({ email: "member@example.test" }) },
      ],
    });
    const { executeDeleteTeam } = await import("@functions/team/teammanagement.logic");
    const res = response();

    // Act
    await executeDeleteTeam({ body: { teamId: "team-1", revokeDocumentAccess: true } } as never, res as never);

    // Assert
    expect(mocks.updateDocs).toHaveBeenCalledWith("member-1", "owner-1");
    expect(mocks.removeVisibility).toHaveBeenCalledWith("member-1");
    expect(mocks.batchUpdate).toHaveBeenCalledTimes(4);
    expect(mocks.batchDelete).toHaveBeenCalledWith(memberRef);
    expect(mocks.enqueueClose).toHaveBeenCalledWith({ email: ["owner@example.test", "member@example.test"], teamName: "Workspace" });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("prevents non-owners from deleting a team", async () => {
    // Arrange
    mocks.teamGet.mockResolvedValue({ exists: true, data: () => ({ owners: ["someone-else"] }) });
    const { executeDeleteTeam } = await import("@functions/team/teammanagement.logic");
    const res = response();

    // Act
    await executeDeleteTeam({ body: { teamId: "team-1" } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.batchCommit).not.toHaveBeenCalled();
  });

  it("rejects calls for missing team records", async () => {
    // Arrange
    mocks.teamGet.mockResolvedValue({ exists: false });
    const { executeDeleteTeam } = await import("@functions/team/teammanagement.logic");
    const res = response();

    // Act
    await executeDeleteTeam({ body: { teamId: "team-1" } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mocks.batchCommit).not.toHaveBeenCalled();
  });

  it("shares each member's document, chunk, and case history", async () => {
    // Arrange
    mocks.membersGet.mockResolvedValue({ docs: [{ id: "member-1" }, { id: "" }] });
    mocks.documentQueryGet.mockResolvedValue({
      docs: [{ ref: { path: "documents/doc-1" } }],
    });
    const { executeShareAllTeamDocuments } = await import("@functions/team/teammanagement.logic");
    const res = response();

    // Act
    await executeShareAllTeamDocuments({ body: { teamId: "team-1" } } as never, res as never);

    // Assert
    expect(mocks.bulkUpdate).toHaveBeenCalledTimes(3);
    expect(mocks.bulkClose).toHaveBeenCalledOnce();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, updatedCount: 3 }));
  });

  it("blocks history sharing for callers who are not team managers", async () => {
    // Arrange
    mocks.teamGet.mockResolvedValue({ exists: true, data: () => ({ owners: ["other"], co_owners: [] }) });
    const { executeShareAllTeamDocuments } = await import("@functions/team/teammanagement.logic");
    const res = response();

    // Act
    await executeShareAllTeamDocuments({ body: { teamId: "team-1" } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.membersGet).not.toHaveBeenCalled();
    expect(mocks.db.bulkWriter).not.toHaveBeenCalled();
  });
});
