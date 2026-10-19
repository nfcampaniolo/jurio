export interface FlowChunkPayload {
  status?: string;
  text?: string;
}

export interface ToolContext {
  userId: string;
  fascicoloId: string | null;
  uiFilters: unknown[];
  docs: string[];
  dbLimit: number;
  webLimit: number;
}

export interface ExecutionProfile {
  model: string;
  dbLimit: number;
  webLimit: number;
}