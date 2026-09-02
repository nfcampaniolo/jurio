import type { DocumentData } from "firebase/firestore";

export interface ExportedDoc {
  id: string;
  [key: string]: unknown; 
}

export type ExportedMessage = ExportedDoc;

export interface ExportedChat extends ExportedDoc {
  messages: ExportedMessage[];
}

export interface ExportedThread extends ExportedDoc {
  messages: ExportedMessage[];
}

export interface ExportedFascicolo extends ExportedDoc {
  threads: ExportedThread[];
}

export interface UserExportData {
  exportDate: string;
  user: DocumentData | null;
  chats: ExportedChat[];
  fascicoli: ExportedFascicolo[];
  documents: ExportedDoc[];
  document_chunks: ExportedDoc[];
  teams: ExportedDoc[];
}