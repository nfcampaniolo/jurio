import type { AttachedDocument } from "./interfacesDocument";

export interface PastFascicolo {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
  ownerId?: string;
}

export interface DocumentSelectorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  archiveDocs: AttachedDocument[];
  attachedDocs: AttachedDocument[];
  onToggleDoc: (doc: AttachedDocument) => void;
  onProcessFiles: (files: File[], selectedPromptId: string, targetFascicoloId?: string) => Promise<void>;
  onToggleFascicoloLink?: (doc: AttachedDocument, fascicoloId: string, isLinking: boolean) => void; 
  isLoading?: boolean; 
  isProcessing?: boolean; 
  onRenameDocumento?: (id: string, name: string) => Promise<void>;
  onDeleteDocumento?: (id: string) => Promise<void>;
}