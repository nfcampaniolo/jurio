import type { Sentenza } from "@/interfaces/interfaces";

export const CORTI_SUPREME = [
  "Cassazione Civile", 
  "Cassazione Penale", 
  "Consiglio di Stato", 
  "Corte Costituzionale"
] as const;

export const TIPI_MASSIMA = [
  "conforme",
  "difforme",
  "principio_nuovo",
  "di_specie",
  "con_fattispecie",
] as const;

export const TIPO_DOCUMENTI = [
  "Sentenza", 
  "Ordinanza", 
  "Ordinanza cautelare", 
  "Decreto"
] as const;

/** Ordinamento */
export const SORT_OPTIONS = ["relevance", "date_desc", "date_asc"] as const;

export const SORT_LABEL: Record<(typeof SORT_OPTIONS)[number], string> = {
  relevance: "Rilevanza",
  date_desc: "Data (più recenti)",
  date_asc: "Data (meno recenti)",
};

/** Sezioni Corti */
export const SEZIONI_CASSAZIONE_CIVILE = [
  "PRIMA SEZIONE CIVILE",
  "SECONDA SEZIONE CIVILE",
  "TERZA SEZIONE CIVILE",
  "QUARTA SEZIONE CIVILE",
  "QUINTA SEZIONE CIVILE",
  "SESTA SEZIONE CIVILE",
  "SEZIONI UNITE CIVILI",
] as const;

export const SEZIONI_CASSAZIONE_PENALE = [
  "PRIMA SEZIONE PENALE",
  "SECONDA SEZIONE PENALE",
  "TERZA SEZIONE PENALE",
  "QUARTA SEZIONE PENALE",
  "QUINTA SEZIONE PENALE",
  "SESTA SEZIONE PENALE",
  "SETTIMA SEZIONE PENALE",
  "SEZIONE FERIALE PENALE",
  "SEZIONI UNITE PENALI",
] as const;

export const SEZIONI_CONSIGLIO_DI_STATO = [
  "SEZIONE II",
  "SEZIONE III",
  "SEZIONE IV",
  "SEZIONE V",
  "SEZIONE VI",
  "SEZIONE VII",
  "PLENARIA",
] as const;

export const TUTTE_LE_SEZIONI = [
  ...SEZIONI_CASSAZIONE_CIVILE,
  ...SEZIONI_CASSAZIONE_PENALE,
  ...SEZIONI_CONSIGLIO_DI_STATO
] as const;

/** Tipi derivati dalle const */
export type GradoGiudizio = (typeof CORTI_SUPREME)[number];
export type TipoMassima = (typeof TIPI_MASSIMA)[number];
export type SortBy = (typeof SORT_OPTIONS)[number];
export type SezioneCorte = (typeof TUTTE_LE_SEZIONI)[number];

/** State della SearchBar */
export interface SearchBarState {
  searchInput: string;
  suggestions: string[];
  activeIndex: number;
  showSuggestions: boolean;
  results: Sentenza[];
  visibleCount: number;

  filterGrado: GradoGiudizio | "";
  filterTipo: TipoMassima | "";

  sortBy: SortBy;
  filterSezione: SezioneCorte | ""; // Aggiornato per riflettere tutte le corti
}

/** Type-guard utili per <select /> (evita cast e errori TS) */
export const isSortBy = (v: string): v is SortBy =>
  (SORT_OPTIONS as readonly string[]).includes(v);

export const isGradoGiudizio = (v: string): v is GradoGiudizio =>
  (CORTI_SUPREME as readonly string[]).includes(v);

export const isTipoMassima = (v: string): v is TipoMassima =>
  (TIPI_MASSIMA as readonly string[]).includes(v);

export const isSezioneCorte = (v: string): v is SezioneCorte =>
  (TUTTE_LE_SEZIONI as readonly string[]).includes(v);


export type GenkitFilterField = 
  | "organo_giudicante" | "materia" | "sezione" | "tipo_documento" 
  | "tipologia_ordinanza" | "tipo_massima" | "dataSentenza";

export interface GenkitFilter {
  field: GenkitFilterField;
  operator: "==" | "<" | "<=" | ">" | ">=" | "array-contains" | "in" | "array-contains-any";
  value: string | number | boolean | Date | null | string[];
}

export interface FilterStateValues {
  filterGrado: string;
  filterSezione: string;
  filterTipo: string;
  filterTipologia: string;
  startDate: string;
  endDate: string;
}

export function buildGenkitFilters(uiState: FilterStateValues): GenkitFilter[] {
  const filters: GenkitFilter[] = [];

  if (uiState.filterGrado === "Cassazione Civile") {
    filters.push({ field: "organo_giudicante", operator: "==", value: "CORTE DI CASSAZIONE" });
    filters.push({ field: "materia", operator: "==", value: "Civile" });
  } else if (uiState.filterGrado === "Cassazione Penale") {
    filters.push({ field: "organo_giudicante", operator: "==", value: "CORTE DI CASSAZIONE" });
    filters.push({ field: "materia", operator: "==", value: "Penale" });
  } else if (uiState.filterGrado === "Consiglio di Stato") {
    filters.push({ field: "organo_giudicante", operator: "==", value: "CONSIGLIO DI STATO" });
  } else if (uiState.filterGrado === "Corte Costituzionale") {
    filters.push({ field: "organo_giudicante", operator: "==", value: "CORTE COSTITUZIONALE" });
  }

  if (uiState.filterSezione) filters.push({ field: "sezione", operator: "==", value: uiState.filterSezione });
  if (uiState.filterTipo) filters.push({ field: "tipo_massima", operator: "==", value: uiState.filterTipo });

  if (uiState.filterTipologia) {
    if (uiState.filterTipologia === "Ordinanza Cautelare") {
      filters.push({ field: "tipo_documento", operator: "==", value: "Ordinanza" });
      filters.push({ field: "tipologia_ordinanza", operator: "==", value: "Cautelare" });
    } else {
      filters.push({ field: "tipo_documento", operator: "==", value: uiState.filterTipologia });
    }
  }

  if (uiState.startDate) filters.push({ field: "dataSentenza", operator: ">=", value: uiState.startDate });
  if (uiState.endDate) filters.push({ field: "dataSentenza", operator: "<=", value: uiState.endDate });

  return filters;
}