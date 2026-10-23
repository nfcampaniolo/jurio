import { randomUUID } from "node:crypto";

export type DeepAnalysisAction =
  | "start_research"
  | "refine_research"
  | "generate_synthesis";

export type DeepAnalysisPhase =
  | "queue"
  | "job"
  | "query_planning"
  | "tool_search"
  | "research_mapping"
  | "research_mapping_retry"
  | "refine_mapping"
  | "synthesis";

type DeepAnalysisLogEvent =
  | "job_queued"
  | "job_started"
  | "job_finished"
  | "phase_finished"
  | "phase_failed"
  | "tool_search_finished"
  | "tool_search_failed";

type DeepAnalysisLogFields = {
  correlationId: string;
  action?: DeepAnalysisAction;
  phase?: DeepAnalysisPhase;
  status?: "queued" | "started" | "completed" | "failed";
  durationMs?: number;
  queueWaitMs?: number;
  attempt?: number;
  tool?: "internalDatabaseSearch" | "doctrineSearch" | "webSearch" | "userFileSearch";
  resultCount?: number;
  sourceCount?: number;
  errorType?: string;
};

const safeErrorTypes = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "URIError",
  "AggregateError",
]);

export function createDeepAnalysisCorrelationId(value?: string): string {
  return value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : randomUUID();
}

export function getSafeErrorType(error: unknown): string {
  const name = error instanceof Error ? error.name : "Error";
  return safeErrorTypes.has(name) ? name : "Error";
}

export function logDeepAnalysisEvent(
  event: DeepAnalysisLogEvent,
  fields: DeepAnalysisLogFields
): void {
  const payload: Record<string, string | number> = {
    severity: event.endsWith("failed") || fields.status === "failed" ? "ERROR" : "INFO",
    component: "deep_analysis",
    event,
    correlationId: createDeepAnalysisCorrelationId(fields.correlationId),
  };

  if (fields.action) payload.action = fields.action;
  if (fields.phase) payload.phase = fields.phase;
  if (fields.status) payload.status = fields.status;
  if (fields.tool) payload.tool = fields.tool;
  if (fields.errorType) {
    payload.errorType = safeErrorTypes.has(fields.errorType) ? fields.errorType : "Error";
  }

  for (const key of ["durationMs", "queueWaitMs", "attempt", "resultCount", "sourceCount"] as const) {
    const value = fields[key];
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      payload[key] = Math.round(value);
    }
  }

  const serialized = JSON.stringify(payload);
  if (payload.severity === "ERROR") console.error(serialized);
  else console.info(serialized);
}
