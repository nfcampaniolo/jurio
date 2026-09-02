// utils/usageUtils.ts
export interface UsageDoc {
  id: string; // YYYY_MM
  prompting?: number;
  legal_agent?: number;
  review_agent?: number;
  research_agent?: number;
  drafting_agent?: number;
  reasoning?: number;
  speech_to_text?: number;
  research?: number;
}

/**
 * Formatta l'ID "YYYY_MM" in una stringa leggibile come "Luglio 2026"
 */
export const formatMonth = (yyyyMm: string): string => {
  const [year, month] = yyyyMm.split("_");
  const date = new Date(parseInt(year), parseInt(month) - 1, 1);
  const formatter = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" });
  const formatted = formatter.format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
};

/**
 * Calcola il tempo totale risparmiato in minuti in base alle metriche aziendali
 */
export const calculateTimeSaved = (usage: UsageDoc): number => {
  const ricerca = ((usage.research_agent || 0) + (usage.research || 0)) * 10;
  const analisi = ((usage.review_agent || 0) + (usage.reasoning || 0) + (usage.speech_to_text || 0)) * 30;
  const sintesi = (usage.drafting_agent || 0) * 15;
  return ricerca + analisi + sintesi;
};