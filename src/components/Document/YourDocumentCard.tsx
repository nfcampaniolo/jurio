import React, { useState } from "react";
import { 
  FaTrash, 
  FaFilePdf, 
  FaExternalLinkAlt, 
  FaBalanceScale, 
  FaFileAlt, 
  FaPencilAlt,
  FaCheck,
  FaTimes
} from "react-icons/fa";
import { toast } from "react-hot-toast";
import { getDocumentStorage } from "@/services/storage";
import { useAuth } from "@/context/useAuth";
import type { DocumentoGiurisprudenziale, ViewMode } from "@/interfaces/interfaces";

interface DocumentCardProps {
  doc: DocumentoGiurisprudenziale; 
  isRemoving: boolean;
  mode: ViewMode;
  isOwner?: boolean; 
  onOpen: (doc: DocumentoGiurisprudenziale) => void;
  onRemove: (e: React.MouseEvent, doc: DocumentoGiurisprudenziale) => void;
  onRename: (e: React.MouseEvent, doc: DocumentoGiurisprudenziale) => void;
}

export const DocumentCard: React.FC<DocumentCardProps> = ({ 
  doc, 
  isRemoving, 
  mode, 
  isOwner = true, 
  onOpen, 
  onRemove, 
  onRename 
}) => {
  const { user } = useAuth();
  const [isDownloading, setIsDownloading] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [tempTitle, setTempTitle] = useState(doc.nome_file || doc.organo_giudicante || doc.tipo_documento || "");

  const isGenerico = doc.tipo_documento === "documento_giurisprudenza_generico";
  const tipoLabel = isGenerico ? (doc.sottotipo_documento || "Documento") : doc.tipo_documento;
  const titolo = doc.nome_file || doc.organo_giudicante || doc.tipo_documento || "Documento Generico";
  const dataDoc = isGenerico ? doc.data_riferimento_documento : doc.data_sentenza;
  
  let testoAnteprima = "Nessuna anteprima disponibile.";
  if (doc.tipo_documento === "documento_giurisprudenza_generico") {
    testoAnteprima = doc.sintesi || doc.fatti || doc.massima || doc.summary || testoAnteprima ;
  } else {
    testoAnteprima = doc.massima || doc.fattispecie_rilevante || doc.summary || testoAnteprima;
  }

  const handleDownloadClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isDownloading) return;

    setIsDownloading(true);
    try {
      const storageName = mode === "saved" ? "sentences" : `users/${user?.uid}/documents`;
      const url = await getDocumentStorage(doc.id, storageName);
      
      if (url) window.open(url, "_blank");
      else toast.error("Il file PDF non è più disponibile.");
    } catch (error) {
      console.error(error);
      toast.error("Errore durante il recupero del PDF.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleStartRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTempTitle(doc.nome_file || doc.organo_giudicante || doc.tipo_documento || "");
    setIsRenaming(true);
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsRenaming(false);
  };

  const handleConfirmRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!tempTitle.trim()) {
      toast.error("Il titolo non può essere vuoto.");
      return;
    }
    onRename(e, doc); 
    setIsRenaming(false);
  };

  const canRename = isOwner && mode === "uploaded";

  return (
    <div className="relative group flex flex-col justify-between w-full bg-(--color-surface) border border-(--color-border) rounded-md p-3.5 overflow-hidden shadow-(--shadow-soft) transition-all duration-200">
      {/* Linea superiore di accento: invisibile di default, compare e si ingrandisce all'hover */}
      <div className="absolute top-0 left-0 right-0 h-0 bg-(--color-primary) opacity-0 group-hover:opacity-100 group-hover:h-1 transition-all duration-200 z-10" />

      {/* Contenuto Principale (Cliccabile) */}
      <div
        className="cursor-pointer flex-1 flex flex-col mt-0.5 outline-none focus-visible:ring-1 focus-visible:ring-(--color-text) rounded-sm"
        onClick={() => !isRenaming && onOpen(doc)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (!isRenaming) onOpen(doc);
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Open document ${titolo}`}
      >
        {/* Intestazione compressa: Tag + Data + N. Sentenza */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-wider text-(--color-text) bg-(--color-bg) border border-(--color-border) px-2 py-0.5 rounded-sm shrink-0">
            {isGenerico ? <FaFileAlt className="opacity-70" /> : <FaBalanceScale className="opacity-70" />}
            <span className="truncate max-w-36">{tipoLabel}</span>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-(--color-muted) font-light">
            {doc.numero_sentenza && <span>N. {doc.numero_sentenza}</span>}
            {dataDoc && (
              <span>{dataDoc instanceof Date ? dataDoc.toLocaleDateString("it-IT") : String(dataDoc)}</span>
            )}
          </div>
        </div>

        {/* Titolo o Input di Rinomina con Animazione di Entrata/Uscita */}
        {isRenaming ? (
          <div 
            className="mb-1 flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-200 fill-mode-forwards"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <input
              type="text"
              value={tempTitle}
              onChange={(e) => setTempTitle(e.target.value)}
              autoFocus
              className="w-full text-xs sm:text-sm font-medium bg-(--color-bg) border border-(--color-border) rounded-md px-2 py-1 text-(--color-text) outline-none focus:border-(--color-primary)"
            />
            <button
              type="button"
              onClick={handleConfirmRename}
              className="p-1.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-md hover:bg-emerald-500/20 transition-colors"
              title="Conferma"
            >
              <FaCheck size={11} />
            </button>
            <button
              type="button"
              onClick={handleCancelRename}
              className="p-1.5 bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 rounded-md hover:bg-red-500/20 transition-colors"
              title="Annulla"
            >
              <FaTimes size={11} />
            </button>
          </div>
        ) : (
          <h3 
            className="text-xs sm:text-sm font-medium text-(--color-text) mb-1 line-clamp-1 tracking-tight animate-in fade-in duration-200" 
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {titolo} {doc.sezione ? `· ${doc.sezione}` : ""}
          </h3>
        )}
        
        {/* Anteprima Testuale */}
        <p className="text-[11px] text-(--color-muted) font-light line-clamp-1 leading-normal mb-3">
          {testoAnteprima}
        </p>
      </div>

      {/* Barra Azioni Compatta (In basso con bordi arrotondati solo sotto) */}
      <div className="flex items-center justify-between pt-2.5 px-1 pb-0.5 border-t border-(--color-border) bg-(--color-bg)/50 rounded-b-md gap-1 mt-auto">
        <button 
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpen(doc); }}
          className="text-[10px] font-bold uppercase tracking-wider text-(--color-text) hover:opacity-80 flex items-center gap-1 transition-opacity outline-none py-1 px-1"
        >
          <FaExternalLinkAlt size={9} className="opacity-70" /> Apri
        </button>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleDownloadClick}
            disabled={isDownloading}
            className="p-1.5 text-(--color-text) bg-(--color-surface) border border-(--color-border) rounded-md hover:border-(--color-text) transition-colors disabled:opacity-30 outline-none shadow-xs"
            title="Scarica PDF"
          >
            <FaFilePdf size={11} className={isDownloading ? "animate-pulse" : "opacity-75"} />
          </button>
          
          {canRename && (
            <button
              type="button"
              onClick={handleStartRename}
              className="p-1.5 text-(--color-text) bg-(--color-surface) border border-(--color-border) rounded-md hover:border-(--color-text) transition-colors outline-none shadow-xs"
              title="Rinomina"
            >
              <FaPencilAlt size={11} className="opacity-75" />
            </button>
          )}

          {isOwner && (
            <button
              type="button"
              disabled={isRemoving}
              onClick={(e) => onRemove(e, doc)}
              className="p-1.5 text-red-600 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-md hover:bg-red-500/20 transition-colors disabled:opacity-30 outline-none shadow-xs"
              title={mode === "uploaded" ? "Elimina" : "Rimuovi"}
            >
              <FaTrash size={11} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};