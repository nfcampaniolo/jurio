import type { Timestamp } from "firebase/firestore";

export interface Voucher {
  id: string;
  duration: number;
  used: boolean;
}

export interface Team {
  id: string;
  name: string;
  owners: string[];
  member_ids: string[];
  visibility_default: string;
  vouchers: Voucher[];
  createdAt: Timestamp;
}

export interface TeamMember {
  uid: string;
  role: "owner" | "co-owner" | "editor" | "viewer";
  date_start: Timestamp;
  expire: Timestamp;
  email?: string; 
}