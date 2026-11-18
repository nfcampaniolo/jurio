/**
 * Ricerca nella banca dati Jurio SENZA modelli generativi: riusa lo strumento interno
 * `internalDatabaseSearch` (embedding per la semantica, query Firestore per estremi e norme).
 */
import { internalDatabaseSearch } from "../tools/index";

export const SEARCH_MODES = ["semantic", "exact", "legal_reference"] as const;
export type SearchMode = (typeof SEARCH_MODES)[number];

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

type ToolItem = Record<string, unknown>;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export function titoloProvvedimento(item: { organo?: string; sezione?: string; numero?: string }): string {
  const parts = [item.organo, item.sezione].filter(Boolean).join(", ");
  const numero = item.numero ? `n. ${item.numero}` : "";
  return [parts, numero].filter(Boolean).join(" ") || "Provvedimento";
}

export function mapToolResults(output: unknown): RisultatoRicerca[] {
  if (!Array.isArray(output)) return [];
  return (output as ToolItem[])
    .filter((item) => item && typeof item.id === "string" && !item.error && !item.message)
    .map((item) => {
      const base = {
        organo: str(item.court),
        sezione: str(item.sezione),
        numero: str(item.caseNumber),
      };
      const score = typeof item._score === "number" ? Math.round(item._score * 100) / 100 : undefined;
      return {
        id: String(item.id),
        titolo: titoloProvvedimento(base),
        ...base,
        ecli: str(item.ecli),
        massima: str(item.summary),
        tipoMassima: str(item.tipoMassima) || null,
        score,
        url: str(item.sourceUrl) || undefined,
      };
    });
}

/** Messaggio informativo dello strumento quando non ci sono risultati (es. "Nessuna sentenza trovata..."). */
export function toolMessage(output: unknown): string | null {
  if (!Array.isArray(output)) return null;
  const first = output[0] as ToolItem | undefined;
  return first && typeof first.message === "string" ? first.message : null;
}

export async function searchJurioDatabase(params: {
  mode: SearchMode;
  query: string;
  userId: string;
  limit?: number;
}): Promise<{ risultati: RisultatoRicerca[]; messaggio: string | null }> {
  const input =
    params.mode === "exact"
      ? { searchType: params.mode, caseNumber: params.query }
      : { searchType: params.mode, query: params.query };
  const output = await internalDatabaseSearch(input, {
    context: { userId: params.userId, uiFilters: [], dbLimit: params.limit ?? 10 },
  } as never);
  return { risultati: mapToolResults(output), messaggio: toolMessage(output) };
}
