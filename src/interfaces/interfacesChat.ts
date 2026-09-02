import type { Timestamp } from "firebase/firestore";

export type SessionType = 'seleziona' | 'temporanea' | 'fascicolo' | 'storico';

export interface Source {
  documento_id?: string;
  _id_interno?: string;
  id_fascicolo?: string;
  _type?: string;
  type?: string;
  identificativo?: string;
  titolo?: string;
  title?: string;
  numero_sentenza?: string;
  organo_giudicante?: string | null;
  data_pubblicazione?: string | null;
  posizione_originale?: number | null;
  timestamp?: string;
  contenuto?: string;
  testo_estratto?: string | null;
  score?: number | null;
  match_percentage?: number | null;
  relevance?: number;
  _matchCount?: number;
  link?: string;
  url_riferimento?: string | null;
  fonte?: string;
  fonte_web?: string | null;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
  sources?: Source[];
  isHistorical?: boolean;
}

export interface ThreadItem {
  id: string;
  title: string;
}

export interface PastChat {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DBThreadData {
  title?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  [key: string]: unknown;
}

export interface DBThreadPayload {
  threadId: string;
  threadData: DBThreadData;
  messages: Message[];
}