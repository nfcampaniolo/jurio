import { Timestamp } from "firebase-admin/firestore";

export interface ManualContentRequestBody {
  id?: string;
  text?: string;
  links?: string[];
  images?: string;
}

export interface MaintenanceTaskBody {
  limit?: number;
  collectionName?: string;
  [key: string]: unknown; 
}

export type ProgressCallback = (message: string, progressData: any) => void;

export interface SentenceDoc {
  ecli?: string;
  urn?: string;
  organo_giudicante?: string;
  materia?: string;
  sezione?: string;
  tipo_documento?: "sentenza" | "ordinanza" | "decreto";
  tipo_ordinanza?: string;
  tipo_decreto?: string;
  data_sentenza?: string;
  numero_sentenza?: string | number;
  sottocategoria?: unknown;
  createdAt?: Timestamp; // Corretto usando l'import di Firestore
  fonte?: string;
  logo_fonte?: string;
}

export interface MergeCategoryRequestBody {
  vecchiaCategoria?: unknown;
  nuovaCategoria?: unknown;
}

export interface AdminNotificationRequestBody {
  targetMode?: unknown;
  consentFilter?: unknown;
  uid?: unknown;
  sendInApp?: unknown;
  sendEmail?: unknown;
  title?: unknown;
  message?: unknown;
  emailHtml?: unknown;
  link?: unknown;
  type?: unknown;
}

export interface ReasoningAdminRequestBody {
  question?: unknown;
}

export interface ReasoningAdminResponse {
  message: Record<string, unknown>;
  status: string;
  model: string;
  provider: string;
}
