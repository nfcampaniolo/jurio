/// <reference types="office-js" />
/* global window, crypto, TextEncoder, btoa */
/**
 * Accesso al pannello tramite jurio.it (vedi functions/src/auth/wordLogin.logic.ts).
 * Il pannello conserva il verifier (segreto) e invia solo il suo hash: anche chi vedesse il link
 * aperto nel browser non potrebbe completare l'accesso.
 */
import { fetchPublic } from "../firebase/functions";
import { WEB_APP_URL, WORD_AUTH_URL } from "../config/env";
import { httpErrorMessage } from "../tools/sse";

export interface BrowserLoginSession {
  sessionId: string;
  /** Codice da confrontare con quello mostrato su jurio.it. */
  code: string;
  verifier: string;
  loginUrl: string;
  expiresAt: number;
  intervalMs: number;
}

export type ExchangeResult =
  | { status: "pending" }
  | { status: "approved"; token: string }
  | { status: "denied" }
  | { status: "expired" };

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode.apply(null, Array.from(bytes)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export function createVerifier(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

export async function challengeOf(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return toBase64Url(new Uint8Array(digest));
}

async function post<T>(body: Record<string, unknown>): Promise<T> {
  if (!WORD_AUTH_URL) throw new Error("Accesso tramite jurio.it non configurato.");
  const response = await fetchPublic(WORD_AUTH_URL, body);
  if (!response.ok) throw new Error(await httpErrorMessage(response));
  return (await response.json()) as T;
}

export async function startBrowserLogin(): Promise<BrowserLoginSession> {
  const verifier = createVerifier();
  const data = await post<{ sessionId: string; code: string; expiresIn: number; interval: number }>(
    {
      action: "start",
      challenge: await challengeOf(verifier),
    }
  );
  return {
    sessionId: data.sessionId,
    code: data.code,
    verifier,
    loginUrl: `${WEB_APP_URL}/word-login?s=${encodeURIComponent(data.sessionId)}`,
    expiresAt: Date.now() + data.expiresIn * 1000,
    intervalMs: Math.max(1, data.interval) * 1000,
  };
}

export function exchangeBrowserLogin(session: Pick<BrowserLoginSession, "sessionId" | "verifier">) {
  return post<ExchangeResult>({
    action: "exchange",
    sessionId: session.sessionId,
    verifier: session.verifier,
  });
}

/** Apre la pagina nel browser predefinito del sistema (non nella webview di Word). */
export function openInBrowser(url: string): void {
  const office = typeof Office !== "undefined" ? Office : undefined;
  if (office?.context?.ui?.openBrowserWindow) {
    office.context.ui.openBrowserWindow(url);
    return;
  }
  window.open(url, "_blank", "noopener");
}
