import type { Timestamp } from "firebase/firestore";
import type { ReactNode } from "react";

export type FilterValue = string | Timestamp | number | boolean | string[] | number[];

export interface SearchFilter {
  field: string;
  operator: "==" | "<" | "<=" | ">" | ">=" | "array-contains" | "in" | "array-contains-any";
  value: FilterValue;
}

export interface EmailMessage {
  from: string;
  to: string[];
  message: {
    subject: string;
    html: string;
    text?: string; 
  };
}

export type ViewMode = "uploaded" | "saved";

export interface Action {
  id: "home" | "search" | "pricing" | "edit" | "logout" | "delete" | "chat" | "team" | "utilizzi";
  label: string;
  icon?: ReactNode;
  destructive?: boolean;
  onClick: () => void;
}

export type SavedRef = {
  sentenzaId: string;
  createdAt: Date;
};

export type RawSaved = Record<string, unknown> & { sentenzaId?: unknown; createdAt?: unknown };

export type SearchTermDoc = {
  term: string;
  updatedAt?: Timestamp;
};

export const AREE: Record<number, string> = {
  1: "Diritto Costituzionale e Parlamentare",
  2: "Diritto Penale Sostanziale",
  3: "Diritto Penale Processuale",
  4: "Diritto dell'Esecuzione Penale e Ordinamento Penitenziario",
  5: "Diritto Civile - Famiglia, Persone e Minori",
  6: "Diritto Civile - Successioni e Donazioni",
  7: "Diritto Civile - Diritti Reali, Proprietà e Condominio",
  8: "Diritto Civile - Obbligazioni, Contratti e Responsabilità",
  9: "Procedura Civile, Arbitrato e ADR (Mediazione/Negoziazione)",
  10: "Esecuzione Forzata Civile e Recupero Crediti",
  11: "Diritto Commerciale, Societario e dell'Impresa",
  12: "Crisi d'Impresa, Insolvenza e Procedure Concorsuali",
  13: "Diritto Bancario, Finanziario e delle Assicurazioni",
  14: "Diritto del Lavoro, Sindacale e Relazioni Industriali",
  15: "Diritto della Previdenza e Assistenza Sociale",
  16: "Diritto Amministrativo Generale e Procedimento",
  17: "Giustizia Amministrativa e Contabilità di Stato",
  18: "Contrattualistica Pubblica, Appalti e Concessioni",
  19: "Edilizia, Urbanistica e Assetto del Territorio",
  20: "Diritto Ambientale e dell'Energia",
  21: "Pubblico Impiego, Concorsi e Personale P.A.",
  22: "Diritto Tributario Sostanziale (Imposte Dirette e Indirette)",
  23: "Contenzioso Tributario, Accertamento e Riscossione",
  24: "Diritto Sanitario, Farmaceutico e Responsabilità Medica",
  25: "Diritto dell'Immigrazione, Asilo e Cittadinanza",
  26: "Tutela dei Dati Personali, Privacy e GDPR",
  27: "Informatica Giuridica, Nuove Tecnologie e Cybercrime",
  28: "Proprietà Intellettuale, Industriale, Marchi e Brevetti",
  29: "Tutela dei Consumatori e Diritto della Concorrenza (Antitrust)",
  30: "Diritto della Navigazione e dei Trasporti",
  31: "Diritto dello Sport e Giustizia Sportiva",
  32: "Diritto degli Enti del Terzo Settore (RUNTS) e No-Profit",
  33: "Diritto dell'Unione Europea",
  34: "Diritto Internazionale (Pubblico e Privato)",
  35: "Diritto Agrario, Forestale e dell'Alimentazione",
  36: "Diritto Ecclesiastico, Canonico e Rapporti Stato-Chiesa",
  37: "Diritto Militare e Giustizia Militare",
  38: "Diritto dell'Informazione, Editoria e Media",
  39: "Diritto Elettorale e Consultazioni Popolari",
  40: "Diritto Doganale, Commercio Internazionale e Accise",
  41: "Ordinamento Minorile (Civile e Penale)"
};