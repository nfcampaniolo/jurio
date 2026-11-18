/* global Response */
import { fetchWithSecurity } from "../firebase/functions";
import { WORD_AGENT_URL } from "../config/env";
import { httpErrorMessage } from "../tools/sse";

/** Chiamata JSON (azioni senza AI: usage, prompts, search). Lancia un Error leggibile in caso di errore. */
export async function postWordAgent<T>(body: Record<string, unknown>): Promise<T> {
  const response: Response = await fetchWithSecurity(WORD_AGENT_URL, body);
  if (!response.ok) throw new Error(await httpErrorMessage(response));
  return (await response.json()) as T;
}

/** Avvia un'azione AI: la risposta è uno stream SSE da leggere con readSseStream. */
export function startWordAgentStream(body: Record<string, unknown>): Promise<Response> {
  return fetchWithSecurity(WORD_AGENT_URL, body);
}

export type PianoWord = "essential" | "business" | "prova" | "admin" | "nessuno";

export interface UsageResponse {
  piano: PianoWord;
  ai: { limiteMensile: number | null; usateMese: number };
}

export type SearchMode = "semantic" | "exact" | "legal_reference";

export interface RisultatoRicerca {
  id: string;
  titolo: string;
  organo: string;
  sezione: string;
  numero: string;
  ecli: string;
  massima: string;
  tipoMassima: string | null;
  score?: number;
  url?: string;
}

export interface SearchResponse {
  risultati: RisultatoRicerca[];
  messaggio: string | null;
}

export interface PromptOption {
  id: string;
  titolo: string;
  obiettivo: string;
}

export interface PromptsResponse {
  jurio: PromptOption[];
  playbook: PromptOption[];
}
