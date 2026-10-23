//DEEP_ANALYSIS
export interface DeepAnalysisConfig {
  confidenceLevel: number;
  sourceWeb: boolean;
  sourceInternalDB: boolean;
  webLimit: number;
  sourceDoctrine: boolean;
}

export const  DEFAULT_CONFIG: DeepAnalysisConfig = {
  confidenceLevel: 80,
  sourceWeb: true,
  sourceInternalDB: true,
  webLimit: 5,
  sourceDoctrine: true,
};

export interface DeepAnalysisRequestBody {
  action?: "start_research" | "refine_research" | "generate_synthesis";
  sessionId?: string;
  prompt?: string;
  direttivaHitl?: string;
  docs?: string[];
  config?: Partial<DeepAnalysisConfig>;
}

export interface DeepAnalysisJob {
  id: string;
  userId: string;
  action: NonNullable<DeepAnalysisRequestBody["action"]>;
  status: "queued" | "processing" | "completed" | "failed";
  attemptCount?: number;
  resultReady?: boolean;
  prompt?: string;
  direttivaHitl?: string;
  docs?: string[];
  config?: Partial<DeepAnalysisConfig>;
  createdAt?: unknown;
  startedAt?: unknown;
}

//REASONING
export interface ReasoningRequestBody {
  question?: unknown;
  promptId?: unknown;
  extractMultiple?: unknown;
  maxDocuments?: unknown;
}

export interface ReasoningFlowInput {
  question: string;
  customPrompt?: string;
  extractMultiple?: boolean;
  maxDocuments?: number;
}

export interface ReasoningFlowOutput {
  sintesi?: string;
  concetti_chiave?: string[];
  summury?: string;
  [key: string]: any;
}

//PROMPTING
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

//ENHANCE_PROMPT
export interface EnhancePromptMessage {
  role: "user" | "model" | "assistant";
  content: string;
}

export interface EnhancePromptRequestBody {
  prompt?: unknown;
  type?: unknown;
  history?: unknown;
}

//METADATA FASCICOLO
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

//SUPPORT
export interface SupportMessageInput {
  role: "user" | "assistant" | "model";
  content: string;
}

export interface SupportRequestBody {
  messages?: SupportMessageInput[];
}


//EMBEDDING

export interface GenerateEmbeddingRequestBody {
  text?: unknown;
}

export interface GenerateEmbeddingResponse {
  vector: number[];
  status: string;
}
