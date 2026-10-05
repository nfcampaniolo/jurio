import { Timestamp } from "firebase-admin/firestore";

export interface FilterInput {
  field: string;
  operator: FirebaseFirestore.WhereFilterOp;
  value: unknown;
}

export interface SearchRequestBody {
  query?: unknown;
  limit?: unknown;
  filters?: unknown;
}

export interface JurioSentenceDoc {
  tipo_documento: string | null;
  fonte: string | null;
  logo_fonte: string | null;
  organo_giudicante: string | null;
  sezione: string | null;
  numero_sentenza: string | null;
  dataSentenza: Timestamp | Date | string | null;
  data_sentenza: Timestamp | Date | string | null;
  ecli: string | null;
  urn: string | null;
  tipo_ordinanza: string | null;
  efficacia_temporale: string | null;
  misura_disposta: string | null;
  fumus_boni_iuris: string | null;
  periculum_in_mora: string | null;
  tipo_decreto: string | null;
  contraddittorio: boolean | null;
  autorita_monocratica: boolean | null;
  contenuto_precettivo: string | null;
  massima: string | null;
  summary: string | null;
  fattispecie_rilevante: string | null;
}

export interface ScoredJurioItem extends Omit<JurioSentenceDoc, 'massima' | 'summary' | 'fattispecie_rilevante'> {
  id: string;
  url: string;
  massima: string | null;
  summary: string | null;
  fattispecie_rilevante: string | null;
  highlighted_massima?: string | null;
  highlighted_fattispecie?: string | null;
  highlighted_preview?: string | null;
  _matchCount: number;
  _distance: number;
  _rankingDistance: number;
  _source: "direct" | "gemini_fallback";
}

export interface MessageDoc {
  role: string;
  content: string;
  timestamp: any;
}

export interface FascicoloDoc {
  metadati?: Record<string, string>;
}

export interface ExtractedMetadataItem {
  chiave: unknown;
  valore: unknown;
}

export interface EstraiMetadatiResult {
  dati_nuovi_o_aggiornati?: ExtractedMetadataItem[];
}

export interface SupportMessageInput {
  role: "user" | "assistant" | "model";
  content: string;
}

export interface SupportRequestBody {
  messages?: SupportMessageInput[];
}

export interface ReasoningRequestBody {
  question?: unknown;
  promptId?: unknown;
}

export interface ReasoningFlowInput {
  question: string;
  customPrompt?: string;
}

export interface ReasoningFlowOutput {
  sintesi?: string;
  concetti_chiave?: string[];
  summury?: string;
  [key: string]: any;
}

export interface PromptFieldInput {
  type: string;
  description: string;
  name: string;
  isRequired: boolean;
  enumValues?: string | undefined;
}

export interface PromptAgentRequestBody {
  title?: unknown;
  objective?: unknown;
  notes?: unknown;
  fields?: unknown;
}

export interface EnhancePromptMessage {
  role: "user" | "model" | "assistant";
  content: string;
}

export interface EnhancePromptRequestBody {
  prompt?: unknown;
  type?: unknown;
  history?: unknown;
}

export interface MaintenanceTaskBody {
  limit?: number;
  collectionName?: string;
  [key: string]: unknown; 
}

export type ProgressCallback = (message: string, progressData: Record<string, unknown>) => void;

export interface MergeCategoryRequestBody {
  vecchiaCategoria?: unknown;
  nuovaCategoria?: unknown;
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

export interface ManualContentRequestBody {
  id?: unknown;
  text?: unknown;
  links?: unknown;
  images?: unknown;
}

export interface SubmitFeedbackRequestBody {
  isThumbsUp?: unknown;
  notes?: unknown;
  ids?: unknown;
}

export interface DeepAnalysisConfig {
  confidenceLevel: number;
  sourceWeb: boolean;
  sourceInternalDB: boolean;
  temperature: number;
  topK: number;
  webLimit: number;
}

export const DEFAULT_CONFIG: DeepAnalysisConfig = {
  confidenceLevel: 80,
  sourceWeb: true,
  sourceInternalDB: true,
  temperature: 0.2,
  topK: 10,
  webLimit: 5,
};

export interface DeepAnalysisRequestBody {
  action?: "start_research" | "refine_research" | "generate_synthesis";
  sessionId?: string;
  prompt?: string;
  direttivaHitl?: string;
  docs?: string[];
  config?: Partial<DeepAnalysisConfig>;
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

export interface GenerateEmbeddingRequestBody {
  text?: unknown;
}

export interface GenerateEmbeddingResponse {
  vector: number[];
  status: string;
}

export interface ExtractDocumentRequestBody {
  storagePath?: unknown;
}

export interface GetRegisterResponse {
  created: boolean;
  uid: string;
  start: Timestamp;
  expireSec: number | null;
}

export interface GetPriceRequestBody {
  id?: unknown;
}

export interface GetPriceResponse {
  id: string;
  price: number;
  currency: string;
}

export interface CheckoutSessionRequestBody {
  id?: unknown; 
}

export interface CheckoutSessionResponse {
  url: string | null;
  sessionId: string;
}

export interface SyncUserSessionResponse {
  success: boolean;
  sessionId: string;
}

export interface ForceTakeoverSessionResponse {
  success: boolean;
  newSessionId: string;
}

export interface AssignTeamSeatRequestBody {
  teamId?: unknown;
  email?: unknown;
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
  teamId?: unknown;
  email?: unknown;
  voucher?: unknown;
}

export interface SendTeamInviteEmailResponse {
  success: boolean;
  message: string;
  email: string;
}

export interface ShareAllTeamDocumentsRequestBody {
  teamId?: unknown;
}

export interface ShareAllTeamDocumentsResponse {
  success: boolean;
  updatedCount: number;
  message: string;
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
  teamId?: unknown;
  uidDelete?: unknown;
  revokeDocumentAccess?: unknown;
}

export interface RemoveTeamMemberResponse {
  success: boolean;
  message: string;
}

export interface ApplyCouponRequestBody {
  couponCode?: unknown;
}

export interface ApplyCouponResponse {
  status: string;
  coupon: {
    code: string;
    percentage: number;
    durationLabel: string;
  };
}

export interface DeleteTeamRequestBody {
  teamId?: unknown;
  revokeDocumentAccess?: unknown;
}

export interface DeleteTeamResponse {
  success: boolean;
  message: string;
}

export interface CloudFilesListRequestBody {
  provider?: unknown;
  providerToken?: unknown;
}

export interface CloudFileDownloadRequestBody {
  provider?: unknown;
  providerToken?: unknown;
  fileId?: unknown;
}