import type { Timestamp } from "firebase/firestore";

export type NotificationType = 
  | "billing" 
  | "team" 
  | "account" 
  | "report" 
  | "support" 
  | "system";

export interface JurioNotification {
  id: string;
  uid: string;
  title: string;
  message: string;
  type: NotificationType;
  link: string;
  isRead: boolean;
  createdAt: Timestamp;
}