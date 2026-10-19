import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type {
  AssignTeamSeatRequestBody,
  AssignTeamSeatResponse,
  DeleteTeamRequestBody,
  DeleteTeamResponse,
  RemoveTeamMemberRequestBody,
  RemoveTeamMemberResponse,
  SendTeamInviteEmailRequestBody,
  SendTeamInviteEmailResponse,
  ShareAllTeamDocumentsRequestBody,
  ShareAllTeamDocumentsResponse,
  VerifyVoucherRequestBody,
  VerifyVoucherResponse,
} from "@functions/team/_interfaces";

describe("team interface contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("models document sharing and team deletion requests and responses", () => {
    // Arrange
    const shareRequest: ShareAllTeamDocumentsRequestBody = { teamId: "team-1" };
    const shareResponse: ShareAllTeamDocumentsResponse = {
      success: true,
      updatedCount: 3,
      message: "Condivisione completata",
    };
    const deleteRequest: DeleteTeamRequestBody = { teamId: "team-1", revokeDocumentAccess: false };
    const deleteResponse: DeleteTeamResponse = { success: true, message: "Team eliminato" };

    // Act
    const responseValues = [shareResponse.updatedCount, deleteRequest.revokeDocumentAccess];

    // Assert
    expectTypeOf(shareRequest).toMatchTypeOf<ShareAllTeamDocumentsRequestBody>();
    expectTypeOf(deleteResponse).toMatchTypeOf<DeleteTeamResponse>();
    expect(responseValues).toEqual([3, false]);
  });

  it("models seat assignment and team invitation payloads", () => {
    // Arrange
    const seatRequest: AssignTeamSeatRequestBody = { teamId: "team-1", email: "user@example.test", voucher: null };
    const seatResponse: AssignTeamSeatResponse = {
      success: true,
      targetUid: "user-1",
      targetEmail: "user@example.test",
      teamName: "Legale",
      voucherUsed: false,
    };
    const inviteRequest: SendTeamInviteEmailRequestBody = { teamId: "team-1", email: "user@example.test" };
    const inviteResponse: SendTeamInviteEmailResponse = {
      success: true,
      message: "Invito inviato",
      email: "user@example.test",
    };

    // Act
    const email = inviteRequest.email;

    // Assert
    expectTypeOf(seatRequest).toMatchTypeOf<AssignTeamSeatRequestBody>();
    expectTypeOf(seatResponse.voucherUsed).toEqualTypeOf<boolean>();
    expectTypeOf(inviteResponse).toMatchTypeOf<SendTeamInviteEmailResponse>();
    expect(email).toBe(inviteResponse.email);
  });

  it("models voucher verification and team member removal contracts", () => {
    // Arrange
    const voucherRequest: VerifyVoucherRequestBody = { voucher: "CODE" };
    const voucherResponse: VerifyVoucherResponse = {
      success: true,
      teams: [{ id: "team-1", name: "Legale" }],
    };
    const removeRequest: RemoveTeamMemberRequestBody = {
      teamId: "team-1",
      uidDelete: false,
      revokeDocumentAccess: true,
    };
    const removeResponse: RemoveTeamMemberResponse = { success: true, message: "Membro rimosso" };

    // Act
    const result = [voucherRequest.voucher, voucherResponse.teams[0]?.id, removeRequest.revokeDocumentAccess];

    // Assert
    expectTypeOf(voucherResponse.teams).toMatchTypeOf<Array<{ id: string; name: string }>>();
    expectTypeOf(removeResponse).toMatchTypeOf<RemoveTeamMemberResponse>();
    expect(result).toEqual(["CODE", "team-1", true]);
  });
});
