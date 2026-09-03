import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom'; 
import { motion } from 'framer-motion';
import { FileText, Plus, Loader2 } from 'lucide-react';
import { DocumentSelectorPanel } from './DocumentSelectorPanel'; 
import { useLegalChat } from "@/features/chat/hooks/useLegalChat"; 
import { v4 as uuidv4 } from "uuid";
import { toast } from "react-hot-toast";

export const FascicoloSetupPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isConverting = searchParams.get('convert') === 'true';

  // 2. Estrai tutto quello che serve dal tuo hook centralizzato
  const chatLogic = useLegalChat();
  const {
    archiveDocs,
    isLoadingData: isLoadingArchive,   
    isProcessingFiles: isProcessing,   
    processFilesParallel: handleProcessFiles,
    attachedDocs,
    toggleDocSelection: handleToggleDoc,
    sessionTitle, setSessionTitle
  } = chatLogic;

  // Stati locali rimasti (gestiscono solo l'UI di questa specifica pagina)
  const [showDocsModal, setShowDocsModal] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // --- HANDLER NAVIGAZIONE ---
  const handleCancel = (): void => {
    navigate(-1); 
  };

  const handleSubmit = async (): Promise<void> => {
    if (!sessionTitle.trim()) return;
  
    setIsSaving(true);
    try {
      const newThreadId = uuidv4(); 
      const newFascicoloId = uuidv4(); 
      
      // Passiamo i dati vitali tramite lo state del router
      navigate(`/fascicolo/${newFascicoloId}/${newThreadId}`, {
        state: {
          inizializzaTitolo: sessionTitle,
          inizializzaDocumenti: attachedDocs
        }
      });
      
    } catch (error) {
      console.error("Errore durante il salvataggio del fascicolo:", error);
      toast.error("Errore durante la creazione della pratica. Riprova.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-(--color-bg) flex flex-col items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 8 }} 
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-xl bg-(--color-surface) rounded-lg border border-(--color-border) shadow-(--shadow-soft) overflow-hidden flex flex-col"
      >
        {/* LA LINEA DI RIGORE SUPERIORE (Unico tocco di colore) */}
        <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

        {/* Header */}
        <div className="p-6 sm:p-7 border-b border-(--color-border) flex items-start gap-3.5 mt-1 bg-(--color-bg)">
          <div className="space-y-1">
            <h1 className="text-lg sm:text-xl font-medium text-(--color-text) tracking-tight">
              {isConverting ? 'Converti in Fascicolo' : 'Nuovo Fascicolo'}
            </h1>
            <p className="text-xs text-(--color-muted) font-light leading-relaxed">
              Inizializza la pratica definendo il titolo e i documenti legali di partenza.
            </p>
          </div>
        </div>

        {/* Corpo del Form */}
        <div className="p-6 sm:p-7 flex-1 space-y-5 bg-(--color-surface)">
          
          {/* Input Nome Fascicolo */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) ml-1">
              {isConverting ? 'Nome del Nuovo Fascicolo' : 'Nome del Fascicolo'}
            </label>
            <input 
              type="text" 
              value={sessionTitle} 
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSessionTitle(e.target.value)}
              placeholder="Es. Pratica Rossi vs Bianchi" 
              className="w-full px-3.5 py-2.5 text-sm rounded-md border border-(--color-border) bg-(--color-bg) text-(--color-text) font-light placeholder:text-(--color-muted) outline-none focus:border-(--color-text) transition-colors shadow-xs"
            />
          </div>
          
          {/* Sezione Documentazione Allegata */}
          <div className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) ml-1">
                Documenti Collegati ({attachedDocs.length})
              </label>
              
              <button
                type="button"
                onClick={() => setShowDocsModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold uppercase tracking-widest bg-(--color-text) text-(--color-surface) rounded-md hover:opacity-90 transition-all outline-none shadow-xs"
              >
                <Plus size={14} className="opacity-80" /> Gestisci Documenti
              </button>
            </div>

            {/* Lista Documenti Attivi */}
            {attachedDocs.length === 0 ? (
              <div className="p-4 rounded-md border border-dashed border-(--color-border) text-center bg-(--color-bg)">
                <p className="text-xs text-(--color-muted) font-light">Nessun documento pronto per questo fascicolo.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {attachedDocs.map(doc => (
                  <div 
                    key={doc.id} 
                    className="flex items-center gap-2.5 px-3 py-2 bg-(--color-bg) border border-(--color-border) rounded-md shadow-xs"
                  >
                    <FileText size={14} className="text-(--color-text) opacity-70 shrink-0" />
                    <span className="text-xs font-medium text-(--color-text) truncate tracking-tight">
                      {doc.name}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Footer Azioni */}
        <div className="p-4 sm:p-6 border-t border-(--color-border) bg-(--color-bg) flex justify-end gap-2.5">
          <button 
            type="button"
            onClick={handleCancel} 
            className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-(--color-muted) hover:text-(--color-text) transition-colors outline-none"
          >
            Annulla
          </button>          
          <button 
            type="button"
            onClick={handleSubmit} 
            disabled={isSaving || (!isConverting && attachedDocs.length === 0) || sessionTitle.trim() === ""} 
            className="px-5 py-2.5 bg-(--color-text) text-(--color-surface) disabled:opacity-35 disabled:cursor-not-allowed text-xs font-bold uppercase tracking-widest rounded-md hover:opacity-90 transition-all shadow-xs flex items-center gap-2 outline-none"
          >
            {isSaving && <Loader2 size={14} className="animate-spin" />}
            <span>{isSaving ? "Salvataggio..." : isConverting ? 'Completa Conversione' : 'Crea Fascicolo'}</span>
          </button>
        </div>
      </motion.div>
      
      {/* Il selettore prende i dati direttamente passati dall'hook */}
      <DocumentSelectorPanel 
        isOpen={showDocsModal}
        onClose={() => setShowDocsModal(false)}
        archiveDocs={archiveDocs}
        attachedDocs={attachedDocs}
        onToggleDoc={handleToggleDoc}
        onProcessFiles={handleProcessFiles}
        isLoading={isLoadingArchive}
        isProcessing={isProcessing}
      />
    </div>
  );
};

export default FascicoloSetupPage;