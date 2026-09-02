import React from "react";
import { FileText, CheckCircle2, Pencil, Trash2, FolderPlus, FolderMinus } from "lucide-react";
import type { AttachedDocument } from "@/interfaces/interfaces";
import { getAuth } from "firebase/auth"; // <-- Importa Firebase Auth

interface DocumentCardProps {
  doc: AttachedDocument;
  fallbackIndex: number;
  listType: string;
  isSelected: boolean;
  isLinkedToCurrent?: boolean;
  fascicoloId?: string;
  totalCount: number;
  maxAllowed: number;
  onToggleDoc: (doc: AttachedDocument) => void;
  onToggleFascicoloLink?: (doc: AttachedDocument, fascicoloId: string, isLinking: boolean) => void;
  openRenameModal: (doc: AttachedDocument) => void;
  openDeleteModal: (doc: AttachedDocument) => void;
  onRenameDocumento?: (id: string, name: string) => Promise<void>;
  onDeleteDocumento?: (id: string) => Promise<void>;
  onErrorLimit: () => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({
  doc,
  fallbackIndex,
  listType,
  isSelected,
  isLinkedToCurrent,
  fascicoloId,
  totalCount,
  maxAllowed,
  onToggleDoc,
  onToggleFascicoloLink,
  openRenameModal,
  openDeleteModal,
  onRenameDocumento,
  onDeleteDocumento,
  onErrorLimit,
}) => {
  const auth = getAuth();
  const currentUserId = auth.currentUser?.uid;

  // Verifica se il documento appartiene all'utente corrente
  const isOwner = doc.user === currentUserId;

  const uniqueKey = (doc.id && doc.id.trim() !== "") ? doc.id : `fallback-${listType}-${fallbackIndex}`;

  const handleToggle = () => {
    if (!isSelected && totalCount >= maxAllowed) {
      onErrorLimit();
      return;
    }
    onToggleDoc(doc);
  };

  return (
    <div
      key={uniqueKey}
      onClick={handleToggle}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault(); // Previene lo scroll della pagina con lo Spazio
          handleToggle();
        }
      }}
      role="button"
      tabIndex={0}
      className={`group flex items-center justify-between p-3.5 rounded-lg border transition-all cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-(--color-text) ${
        isSelected 
          ? 'border-(--color-text) bg-(--color-bg) shadow-sm' 
          : 'border-(--color-border) bg-(--color-surface) hover:border-(--color-text) hover:bg-(--color-bg)'
      }`}
    >
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="p-2 rounded-md border border-(--color-border) bg-(--color-bg) text-(--color-text) opacity-80 shrink-0">
          <FileText size={18} />
        </div>
        <div className="flex flex-col overflow-hidden text-left">
          <span className="text-sm font-bold text-(--color-text) truncate" style={{ fontFamily: 'var(--font-serif)' }}>
            {doc.name}
          </span>
        </div>
      </div>
  
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {/* Mostra i tasti di modifica/eliminazione SOLO se l'utente è il proprietario */}
        {isOwner && (onRenameDocumento || onDeleteDocumento) && (
          <div className="flex gap-1">
            {onRenameDocumento && (
              <button
                onClick={(e) => { e.stopPropagation(); openRenameModal(doc); }}
                className="p-1.5 rounded-sm text-(--color-muted) hover:text-(--color-text) hover:bg-(--color-border) transition-colors outline-none"
                title="Rinomina"
                aria-label="Rinomina documento"
              >
                <Pencil size={15}/>
              </button>
            )}
            {onDeleteDocumento && (
              <button
                onClick={(e) => { e.stopPropagation(); openDeleteModal(doc); }}
                className="p-1.5 rounded-sm text-(--color-muted) hover:text-red-600 hover:bg-(--color-border) transition-colors outline-none"
                title="Elimina"
                aria-label="Elimina documento"
              >
                <Trash2 size={15}/>
              </button>
            )}
          </div>
        )}
         
        {/* Anche il collegamento al fascicolo può essere subordinato o gestito se necessario */}
        {isOwner && fascicoloId && onToggleFascicoloLink && (
          <button
            onClick={(e) => {
              e.stopPropagation(); 
              onToggleFascicoloLink(doc, fascicoloId, !isLinkedToCurrent);
            }}
            title={isLinkedToCurrent ? "Rimuovi dal fascicolo" : "Aggiungi al fascicolo"}
            className="p-1.5 rounded-sm border border-(--color-border) text-(--color-muted) hover:text-(--color-text) hover:bg-(--color-bg) transition-colors outline-none"
            aria-label={isLinkedToCurrent ? "Rimuovi dal fascicolo" : "Aggiungi al fascicolo"}
          >
            {isLinkedToCurrent ? <FolderMinus size={16} /> : <FolderPlus size={16} />}
          </button>
        )}

        <div className="ml-2">
          {isSelected ? (
            <CheckCircle2 className="w-5 h-5 text-(--color-text)" />
          ) : (
            <div className="w-5 h-5 rounded-sm border border-(--color-border) group-hover:border-(--color-text) transition-colors" />
          )}
        </div>
      </div>
    </div>
  );
};