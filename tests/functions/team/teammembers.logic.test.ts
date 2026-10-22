import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const secure = vi.fn();
  const validate = vi.fn();
  const registerGet = vi.fn();
  const teamGet = vi.fn();
  const memberGet = vi.fn();
  const getUserByEmail = vi.fn();
  const getUser = vi.fn();
  const txGet = vi.fn();
  const txSet = vi.fn();
  const txUpdate = vi.fn();
  const txDelete = vi.fn();
  const batchUpdate = vi.fn();
  const batchDelete = vi.fn();
  const batchCommit = vi.fn();
  const enqueueWelcome = vi.fn();
  const enqueueRemove = vi.fn();
  const updateDocs = vi.fn();
  const removeVisibility = vi.fn();
  const collection = vi.fn();
  const db = { collection, runTransaction: vi.fn(), batch: vi.fn() };
  const auth = { getUserByEmail, getUser };
  const nowValue = { toMillis: () => 1000 };
  const admin = {
    firestore: {
      Timestamp: { now: vi.fn(() => nowValue), fromMillis: vi.fn((value: number) => ({ toMillis: () => value })) },
      FieldValue: { arrayUnion: vi.fn((uid: string) => ({ union: uid })) },
    },
  };
  return {
    secure, validate, registerGet, teamGet, memberGet, getUserByEmail, getUser, txGet, txSet,
    txUpdate, txDelete, batchUpdate, batchDelete, batchCommit, enqueueWelcome, enqueueRemove,
    updateDocs, removeVisibility, collection, db, auth, admin, nowValue,
  };
});

vi.mock("@functions/_deps", () => ({
  getDb: () => mocks.db,
  getAdminAuth: () => mocks.auth,
  getAdmin: () => mocks.admin,
}));
vi.mock("@functions/_utils", () => ({
  withSecureApiEndpoint: mocks.secure,
  validateUserPlanAndLimits: mocks.validate,
}));
vi.mock("@functions/team/_utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@functions/team/_utils")>()),
  updateUserDocuments: mocks.updateDocs,
  removeUserVisibilityFromDocuments: mocks.removeVisibility,
}));
vi.mock("@functions/email/team/logic", () => ({
  enqueueWelcomeTeamEmail: mocks.enqueueWelcome,
  enqueueRemoveTeamEmail: mocks.enqueueRemove,
}));
vi.mock("firebase-admin/firestore", () => ({
  FieldValue: {
    delete: vi.fn(() => ({ delete: true })),
    arrayRemove: vi.fn((value: string) => ({ remove: value })),
  },
}));

describe("team member endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.secure.mockImplementation(async (_req: unknown, _res: unknown, callback: (uid: string) => Promise<void>) => callback("owner-1"));
    mocks.validate.mockResolvedValue(undefined);
    mocks.registerGet.mockResolvedValue({ exists: true, data: () => ({}) });
    mocks.teamGet.mockResolvedValue({
      exists: true,
      data: () => ({
        owners: ["owner-1"], co_owners: [], member_ids: [], name: "Workspace",
        vouchers: [{ id: "VCH-1", used: false, duration: 30 }],
      }),
    });
    mocks.memberGet.mockResolvedValue({ exists: true, data: () => ({ email: "member@example.test" }) });
    mocks.getUserByEmail.mockResolvedValue({ uid: "member-1" });
    mocks.getUser.mockResolvedValue({ email: "owner@example.test" });
    mocks.txGet
      .mockResolvedValueOnce({ exists: true, data: () => ({
        owners: ["owner-1"], co_owners: [], member_ids: [], vouchers: [{ id: "VCH-1", used: false, duration: 30 }], name: "Workspace",
      }) })
      .mockResolvedValueOnce({ exists: false, data: () => ({}) });
    mocks.db.runTransaction.mockImplementation((callback: (tx: unknown) => Promise<unknown>) => callback({
      get: mocks.txGet, set: mocks.txSet, update: mocks.txUpdate, delete: mocks.txDelete,
    }));
    mocks.db.batch.mockReturnValue({
      update: mocks.batchUpdate, delete: mocks.batchDelete, commit: mocks.batchCommit,
    });
    mocks.batchCommit.mockResolvedValue(undefined);
    mocks.enqueueWelcome.mockResolvedValue(undefined);
    mocks.enqueueRemove.mockResolvedValue(undefined);
    mocks.updateDocs.mockResolvedValue(undefined);
    mocks.removeVisibility.mockResolvedValue(undefined);
    mocks.collection.mockImplementation((name: string) => ({
      doc: vi.fn((id?: string) => ({
        id,
        get: name === "register" ? mocks.registerGet : name === "teams" ? mocks.teamGet : mocks.memberGet,
        collection: vi.fn(() => ({ doc: vi.fn((memberId: string) => ({ id: memberId, get: mocks.memberGet })) })),
      })),
    }));
  });

  const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });

  it("assigns a team seat, consumes a voucher and updates the member", async () => {
    // Arrange
    const { executeAssignTeamSeat } = await import("@functions/team/teammembers.logic");
    const res = response();

    // Act
    await executeAssignTeamSeat({
      body: { teamId: "team-1", email: " MEMBER@EXAMPLE.TEST " },
    } as never, res as never);

    // Assert
    expect(mocks.getUserByEmail).toHaveBeenCalledWith("member@example.test");
    expect(mocks.txUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: "team-1" }), expect.objectContaining({
      member_ids: { union: "member-1" },
      vouchers: [expect.objectContaining({ id: "VCH-1", used: true, assignedTo: "member-1" })],
    }));
    expect(mocks.txSet).toHaveBeenCalledTimes(3);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ targetUid: "member-1", voucherUsed: true }));
  });

  it("returns not found when an invitation targets an unregistered account", async () => {
    // Arrange
    mocks.getUserByEmail.mockRejectedValue({ code: "auth/user-not-found" });
    const { executeAssignTeamSeat } = await import("@functions/team/teammembers.logic");
    const res = response();

    // Act
    await executeAssignTeamSeat({ body: { teamId: "team-1", email: "nobody@example.test" } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mocks.db.runTransaction).not.toHaveBeenCalled();
  });

  it("rejects invitation assignments when the caller is not a team owner", async () => {
    // Arrange
    mocks.txGet.mockReset();
    mocks.txGet
      .mockResolvedValueOnce({ exists: true, data: () => ({ owners: ["other"], co_owners: [], member_ids: [], vouchers: [] }) })
      .mockResolvedValueOnce({ exists: false, data: () => ({}) });
    const { executeAssignTeamSeat } = await import("@functions/team/teammembers.logic");

    // Act / Assert
    await expect(executeAssignTeamSeat({
      body: { teamId: "team-1", email: "member@example.test" },
    } as never, response() as never)).rejects.toThrow("FORBIDDEN");
    expect(mocks.txUpdate).not.toHaveBeenCalled();
  });

  it("assigns the caller's own seat using a voucher and Firebase Auth email", async () => {
    // Arrange
    mocks.txGet.mockReset();
    mocks.txGet
      .mockResolvedValueOnce({ exists: true, data: () => ({
        owners: ["owner-1"], member_ids: [], vouchers: [{ id: "VCH-SELF", used: false }],
      }) })
      .mockResolvedValueOnce({ exists: false, data: () => ({}) });
    mocks.getUser.mockResolvedValue({ email: "owner@example.test" });
    const { executeAssignTeamSeat } = await import("@functions/team/teammembers.logic");
    const res = response();

    // Act
    await executeAssignTeamSeat({ body: { teamId: "team-1", voucher: "vch-self" } } as never, res as never);

    // Assert
    expect(mocks.getUser).toHaveBeenCalledWith("owner-1");
    expect(mocks.getUserByEmail).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      targetUid: "owner-1", targetEmail: "owner@example.test", voucherUsed: true,
    }));
  });

  it("rejects a removal request with missing member identifiers", async () => {
    // Arrange
    const { executeRemoveTeamMember } = await import("@functions/team/teammembers.logic");
    const res = response();

    // Act
    await executeRemoveTeamMember({ body: { teamId: "team-1" } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.batchCommit).not.toHaveBeenCalled();
  });

  it("prevents the sole owner from leaving and orphaning the workspace", async () => {
    // Arrange
    const { executeRemoveTeamMember } = await import("@functions/team/teammembers.logic");
    const res = response();

    // Act
    await executeRemoveTeamMember({ body: { teamId: "team-1", uidDelete: "owner-1" } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.batchCommit).not.toHaveBeenCalled();
  });

  it("removes a member, revokes document visibility and emails the removed member", async () => {
    // Arrange
    mocks.teamGet.mockResolvedValue({ exists: true, data: () => ({ owners: ["owner-1"], name: "Workspace" }) });
    mocks.memberGet.mockResolvedValue({ exists: true, data: () => ({ email: "member@example.test" }) });
    const { executeRemoveTeamMember } = await import("@functions/team/teammembers.logic");
    const res = response();

    // Act
    await executeRemoveTeamMember({
      body: { teamId: "team-1", uidDelete: "member-1", revokeDocumentAccess: true },
    } as never, res as never);

    // Assert
    expect(mocks.updateDocs).toHaveBeenCalledWith("member-1", "owner-1");
    expect(mocks.removeVisibility).toHaveBeenCalledWith("member-1");
    expect(mocks.batchCommit).toHaveBeenCalledOnce();
    expect(mocks.enqueueRemove).toHaveBeenCalledWith({ email: "member@example.test", teamName: "Workspace" });
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
