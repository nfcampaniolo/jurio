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