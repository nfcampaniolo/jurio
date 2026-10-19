import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const secure = vi.fn();
  const validate = vi.fn();
  const registerGet = vi.fn();
  const teamGet = vi.fn();
  const teamsGet = vi.fn();
  const enqueue = vi.fn();
  const collection = vi.fn();
  const db = { collection };
  return { secure, validate, registerGet, teamGet, teamsGet, enqueue, collection, db };
});

vi.mock("@functions/_deps", () => ({ getDb: () => mocks.db }));
vi.mock("@functions/_utils", () => ({
  withSecureApiEndpoint: mocks.secure,
  validateUserPlanAndLimits: mocks.validate,
}));
vi.mock("@functions/email/team/logic", () => ({ enqueueVoucherEmail: mocks.enqueue }));

describe("team voucher and invitation endpoints", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.secure.mockImplementation(async (_req: unknown, _res: unknown, callback: (uid: string) => Promise<void>) => callback("owner-1"));
    mocks.validate.mockResolvedValue(undefined);
    mocks.registerGet.mockResolvedValue({ exists: true, data: () => ({}) });
    mocks.teamGet.mockResolvedValue({
      exists: true,
      data: () => ({ owners: ["owner-1"], name: "Workspace", vouchers: [{ id: "VCH-1", used: false }] }),
    });
    mocks.teamsGet.mockResolvedValue({
      forEach: (callback: (doc: unknown) => void) => {
        callback({ id: "team-1", data: () => ({ name: "Alpha", vouchers: [{ id: "VCH-1", used: false }] }) });
        callback({ id: "team-2", data: () => ({ vouchers: [{ id: "VCH-1", used: true }] }) });
      },
    });
    mocks.enqueue.mockResolvedValue(undefined);
    mocks.collection.mockImplementation((name: string) => ({
      get: name === "teams" ? mocks.teamsGet : undefined,
      doc: vi.fn(() => ({ get: name === "register" ? mocks.registerGet : mocks.teamGet })),
    }));
  });

  const response = () => ({ status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() });

  it("finds unclaimed vouchers and returns matching team names", async () => {
    // Arrange
    const { executeVerifyVoucher } = await import("@functions/team/teamsharing.logic");
    const res = response();

    // Act
    await executeVerifyVoucher({ body: { voucher: " vch-1 " } } as never, res as never);

    // Assert
    expect(mocks.validate).toHaveBeenCalledWith("owner-1", "teams", expect.any(Object));
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, teams: [{ id: "team-1", name: "Alpha" }] });
  });

  it("rejects an empty voucher without scanning teams", async () => {
    // Arrange
    const { executeVerifyVoucher } = await import("@functions/team/teamsharing.logic");
    const res = response();

    // Act
    await executeVerifyVoucher({ body: { voucher: " ! " } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mocks.teamsGet).not.toHaveBeenCalled();
  });

  it("sends a valid invitation email for an available team voucher", async () => {
    // Arrange
    const { executeSendTeamInviteEmail } = await import("@functions/team/teamsharing.logic");
    const res = response();

    // Act
    await executeSendTeamInviteEmail({
      body: { teamId: "team-1", email: "  MEMBER@EXAMPLE.TEST ", voucher: "vch-1" },
    } as never, res as never);

    // Assert
    expect(mocks.enqueue).toHaveBeenCalledWith({
      email: "member@example.test", voucherCode: "VCH-1", teamName: "Workspace",
    });
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, email: "member@example.test" }));
  });

  it("denies invitations from callers who are not team managers", async () => {
    // Arrange
    mocks.teamGet.mockResolvedValue({
      exists: true, data: () => ({ owners: ["someone-else"], vouchers: [{ id: "VCH-1", used: false }] }),
    });
    const { executeSendTeamInviteEmail } = await import("@functions/team/teamsharing.logic");
    const res = response();

    // Act
    await executeSendTeamInviteEmail({ body: { teamId: "team-1", email: "a@b.test", voucher: "vch-1" } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(403);
    expect(mocks.enqueue).not.toHaveBeenCalled();
  });

  it("returns not found when the requesting user has no register record", async () => {
    // Arrange
    mocks.registerGet.mockResolvedValue({ exists: false });
    const { executeVerifyVoucher } = await import("@functions/team/teamsharing.logic");
    const res = response();

    // Act
    await executeVerifyVoucher({ body: { voucher: "vch-1" } } as never, res as never);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(mocks.validate).not.toHaveBeenCalled();
  });
});
