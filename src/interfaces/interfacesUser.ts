import type { Timestamp } from "firebase/firestore";

export type PlanName = "Personale" | "Team" | "Business";

export interface Consents {
  privacy: boolean;   
  terms: boolean;     
  comms: boolean;     
  marketing: boolean; 
}

export interface UserData {
  name: string;
  surname: string;
  email: string | null;
  avatar?: string | null;
  consents: {
    privacy: boolean;
    terms: boolean;
    comms: boolean;
    marketing: boolean;
  };
  assignedTeamId?: string;
  [key: string]: unknown;
}

export type CreateContactInput = {
  name: string;
  email: string;
  subject: string;
  message: string;
  consent: boolean;
  page?: string;
  userAgent?: string;
};

export type RegisterDoc = {
  start?: Timestamp;
  planId?: string;
};

export const consentItems = [
  { key: "privacy", label: "Accetto la Privacy Policy", link: "/privacy", required: true },
  { key: "terms", label: "Accetto i Termini e le Condizioni", link: "/termini", required: true },
  { key: "comms", label: "Ricevere comunicazioni via email" },
  { key: "marketing", label: "Ricevere email promozionali" },
];
  
export const roleOptions = [
  { value: "", label: "" },
  { value: "studente", label: "Studente di giurisprudenza" },
  { value: "praticante", label: "Praticante avvocato" },
  { value: "avvocato", label: "Avvocato" },
  { value: "magistrato", label: "Magistrato" },
  { value: "notaio", label: "Notaio" },
  { value: "inhouse", label: "Consulente legale" },
  { value: "paralegal", label: "Assistente legale" },
  { value: "cancelleria", label: "Personale di cancelleria" },
  { value: "accademico", label: "Accademico" },
  { value: "altro", label: "Altro (specifica)" },
];