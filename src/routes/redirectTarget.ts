/**
 * Destinazione dopo il login: la pagina protetta da cui l'utente è stato rimandato al login
 * (ProtectedRoute passa `state.from`), altrimenti il profilo. Solo percorsi interni.
 */
export function redirectTargetFrom(state: unknown, fallback = "/profilo"): string {
  const from = (state as { from?: { pathname?: unknown; search?: unknown } } | null)?.from;
  const path = from?.pathname;
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") || path === "/login") {
    return fallback;
  }
  return path + (typeof from?.search === "string" ? from.search : "");
}
