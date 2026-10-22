const SAFE_ERROR_NAMES = new Set([
  "Error",
  "TypeError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "URIError",
  "AggregateError",
]);

export function logSafeError(event: string, error: unknown): void {
  writeSafeLog(console.error, event, error);
}

export function logSafeWarning(event: string, error: unknown): void {
  writeSafeLog(console.warn, event, error);
}

export function logSafeInfo(event: string, error: unknown): void {
  writeSafeLog(console.log, event, error);
}

function writeSafeLog(
  log: (event: string, fields: { errorType: string }) => void,
  event: string,
  error: unknown
): void {
  const safeEvent = /^[A-Z][A-Z0-9_]{0,79}$/.test(event) ? event : "APPLICATION_ERROR";
  const name = error instanceof Error ? error.name : "Error";
  const errorType = SAFE_ERROR_NAMES.has(name) ? name : "Error";
  log(safeEvent, { errorType });
}
