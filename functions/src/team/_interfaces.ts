export interface ShareAllTeamDocumentsRequestBody {
  teamId?: string;
}

export interface ShareAllTeamDocumentsResponse {
  success: boolean;
  updatedCount: number;
  message: string;
}

export interface DeleteTeamRequestBody {
  teamId?: string;
  revokeDocumentAccess?: boolean;
}

export interface DeleteTeamResponse {
  success: boolean;
  message: string;
}

export interface AssignTeamSeatRequestBody {
  teamId?: string;
  email?: string;
  voucher?: unknown;
}

export interface AssignTeamSeatResponse {
  success: boolean;
  targetUid: string;
  targetEmail: string;
  teamName: string;
  voucherUsed: boolean;
}

export interface SendTeamInviteEmailRequestBody {
  teamId?: string;
  email?: string;
  voucher?: unknown;
}

export interface SendTeamInviteEmailResponse {
  success: boolean;
  message: string;
  email: string;
}

export interface VerifyVoucherRequestBody {
  voucher?: unknown;
}

export interface VerifyVoucherResponse {
  success: boolean;
  teams: Array<{
    id: string;
    name: string;
  }>;
}

export interface RemoveTeamMemberRequestBody {
  teamId?: string;
  uidDelete?: boolean;
  revokeDocumentAccess?: boolean;
}

export interface RemoveTeamMemberResponse {
  success: boolean;
  message: string;
}