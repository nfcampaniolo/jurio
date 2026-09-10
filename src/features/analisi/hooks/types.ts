export type SessionStatus = "draft" | "review" | "completed";

export const LIMITE_MASSIMO_DOCUMENTI = 10;

export interface DeepAnalysisConfig {
  confidenceLevel: number;
  sourceWeb: boolean;
  sourceInternalDB: boolean;
  temperature: number;
  topK: number;
}

export interface PrecedenteReperito {
  id: string;
  fonte: "interna" | "web";
  gradoPertinenza: number;
  escluso?: boolean;
  nuova?: boolean;
  organo?: string;
  numeroProvvedimento?: string;
  anno?: number;
  massimaUfficiale?: string;
  ratioDecidendi?: string;
}

export interface OrientamentoDialettico {
  titoloTesi: string;
  argomentazioneLogica: string;
  fonti: PrecedenteReperito[];
}

export interface MappaDialettica {
  orientamentoFavorevole: OrientamentoDialettico | null;
  orientamentoContrario: OrientamentoDialettico | null;
  puntiAperti: string[];
}

export interface CorrenteInterpretativa {
  orientamento: "Prevalente" | "Minoritario" | "Contrasto Giurisprudenziale";
  tesiSostenuta: string;
  fondamentoLogico: string;
  sentenzeCardine: string[];
}

export interface SintesiStrategica {
  titoloReport: string;
  executiveSummary: string;
  contestoENorme: string;
  argomentazioniAzione: string[];
  rischiEEccezioni: string[];
  conclusioniStrategiche: string;
}

export interface DeepAnalysisSession {
  id: string;
  userId: string;
  title: string;
  status: SessionStatus;
  
  promptOriginale: string;
  documentiAllegati: string[];
  configurazione: DeepAnalysisConfig;
  
  inquadramento?: {
    qualificazioneGiuridica: string;
    fattispecieEstratta: string;
    normeRiferimento: string[];
  };
  
  // Nuova struttura della mappa dialettica
  mappaDialettica?: MappaDialettica;
  
  // Campo di compatibilità retroattiva (opzionale)
  precedentiReperiti?: PrecedenteReperito[];
  
  correntiInterpretative?: CorrenteInterpretativa[];
  sintesiStrategica?: SintesiStrategica;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentoAllegato {
  id: string;
  name: string;
  metadata: string;
  type: string;
  dataSentenza?: {
    type: string;
    seconds: number;
    nanoseconds: number;
  };
  user: string;
  [key: string]: unknown;
}

export interface LogStep {
  id: string;
  timestamp: string;
  message: string;
  status: "pending" | "success" | "error";
}

export type Player = "X" | "O";
export type Cell = Player | null;
export type GameResult = "X" | "O" | "draw" | null;