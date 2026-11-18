// types.ts
export interface Fonte {
  id?: string;
  titolo?: string;
  url?: string;
  score?: number; // Usato da Search
  tipo?: string; // Usato da Review
  riferimento?: string; // Usato da Review
  data?: string; // Usato da Review
  rilevanza?: string; // Usato da Review
}

export interface Contrasto {
  riferimento: string;
  descrizione: string;
}

export interface TesiReview {
  id: string;
  testoOriginale: string;
  tesiGiuridica: string;
  semaforo: "VERDE" | "GIALLO" | "ROSSO";
  livelloVerifica: string;
  motivazione: string;
  orientamento: string;
  fonti: Fonte[];
  contrasti?: Contrasto[];
  notaRicerca?: string;
}
