export type NotificationType = 
  | "billing"
  | "team"
  | "account"
  | "report"
  | "support"
  | "system";

export type EnqueuePurchaseEmailArgs = {
  uid: string;
  provider: "paypal" | "stripe";
  orderId: string;          
  paidValue: number;
  paidCurrency: string;
};

export type QueuePurchasePayPalArgs = {
  requestId: string;
  uid: string;
  orderId: string; 
  paidValue: number;
  paidCurrency: string;
};

export type QueuePurchaseStripeArgs = {
  requestId: string;
  uid: string;
  sessionId: string; 
  paidValue: number;
  paidCurrency: string;
};

export type EnqueueEmailArgs = {
  uid: string;
};

export type EnqueueEmailArgsContact = {
  nome: string, 
  id: string, 
  subject: string, 
  message: string,
  email: string
};

export interface NotificationPayload {
  uid: string;
  title: string;
  message: string;
  type?: NotificationType;
  link?: string;
}

export interface DispatchMailArgs {
  to?: string | string[];
  bcc?: string | string[];
  cc?: string | string[];
  from?: string;
  subject: string;
  html: string;
  notifications?: NotificationPayload | NotificationPayload[]; // Supporta notifica singola o multipla
}

export interface EnqueueVoucherEmailArgs {
  email: string;
  voucherCode: string;
  teamName?: string;
}

export interface EnqueueTeamEmailArgs {
  email: string;
  teamName?: string;
}

export interface EnqueueCloseTeamEmailArgs {
  email: string | string[]; 
  teamName?: string;
}

export interface MonthlyUsageReportData {
  mese: string; 
  haFattoPrompting: boolean; 
  interazioniCount: number; 
  ricerca: { count: number; timeSavedMinutes: number }; 
  analisi: { count: number; timeSavedMinutes: number }; 
  sintesi: { count: number; timeSavedMinutes: number }; 
  deepAnalysis: { count: number; timeSavedMinutes: number }; 
  totalTimeSavedMinutes: number;
}

export interface EnqueueMonthlyUsageEmailArgs {
  email: string | string[];
  reportData: MonthlyUsageReportData;
}