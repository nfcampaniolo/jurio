import type { Timestamp } from "firebase/firestore";

export type DocumentoGiurisprudenziale =
  | Sentenza
  | Ordinanza
  | Decreto
  | DocumentoGiurisprudenzaGenerico;

export interface Documento {
  id: string;
  createdAt: Date;
  tipo_documento:
    | "sentenza"
    | "ordinanza"
    | "decreto"
    | "documento_giurisprudenza_generico";
  title?: string;
  nome_file?: string;
  fascicoloIds?: string[];
  data_riferimento_documento?: Date | string;
  name?: string;
  user?: string;
  summary?: string;
}

export interface DocumentoGiurisprudenza extends Documento {
  organo_giudicante: string;
  sezione?: string;
  grado_giudizio?: "Primo grado" | "Appello" | "Cassazione";
  numero_sentenza?: string;
  data_sentenza?: string;
  dataSentenza?: Timestamp;
  ecli?: string;
  urn?: string;
  
  fattispecie_rilevante: string;
  questione_di_diritto: string;
  massima: string;
  tipo_massima:
    | "conforme"
    | "difforme"
    | "principio_nuovo"
    | "di_specie"
    | "con_fattispecie"
    | "non_massimabile";

  ratio_decidendi?: string;
  obiter_dicta?: string;
  riferimenti_normativi?: string[];
  precedenti_richiamati?: string[];

  materia?: "Civile" | "Penale" | "Amministrativo" | "Tributario" | "Lavoro" | "Contabile" | "Altro";
  sottocategoria?: string[];

  fonte?: string;
  sources?: string[];
  lingua?: string;
  note?: string;
  logo_fonte?: string;
  presidente?: string;
  relatore?: string;
  highlighted_preview?: string;
  highlighted_massima?: string;
  highlighted_fattispecie?: string;
  user?: string;
}

export interface Sentenza extends DocumentoGiurisprudenza {
  tipo_documento: "sentenza";
}

export interface Ordinanza extends DocumentoGiurisprudenza {
  tipo_documento: "ordinanza";
  tipo_ordinanza:
    | "cautelare"
    | "istruttoria"
    | "interlocutoria"
    | "procedimentale"
    | "decisoria";

  misura_disposta?: string;
  fumus_boni_iuris?: string;
  periculum_in_mora?: string;
  efficacia_temporale?: "provvisoria" | "fino_a_sentenza" | "immediata";
}

export interface Decreto extends DocumentoGiurisprudenza {
  tipo_documento: "decreto";
  tipo_decreto:
    | "ingiuntivo"
    | "cautelare"
    | "monitorio"
    | "archiviazione"
    | "fissazione_udienza"
    | "altro";

  contenuto_precettivo: string;
  contraddittorio?: boolean | null;
  autorita_monocratica?: boolean | null;
}

export interface DocumentoGiurisprudenzaGenerico extends DocumentoGiurisprudenza {
  tipo_documento: "documento_giurisprudenza_generico";
  sottotipo_documento: "memoria" | "parere" | "fattura" | "perizia" | "mail" | "altro";
  fatti?: string; 
  nucleo?: string; 
  conclusioni?: string; 
  riferimenti_normativi?: string[]; 
  sintesi?: string; 
  mittente?: string; 
  destinatario?: string; 
  importo?: number; 
  data_riferimento_documento?: Date | string; 
}

export interface AttachedDocument {
  id: string;
  name: string;
  size?: string;
  fascicoloIds?: string[];
  dataSentenza?: Timestamp;
  user?: string;
}