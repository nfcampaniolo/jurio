import React, { useState } from 'react';
import { Document } from '@/components/Document/Document';
import { useRelatedDocuments } from '@/hooks/useRelatedDocuments'; 
import type { DocumentoGiurisprudenziale } from "@/interfaces/interfaces";
import { Loader2 } from 'lucide-react';

interface RelatedDocumentsProps {
  uid: string;
  massima: string;
  riferimentiNormativi?: string[]; 
}

type SearchMode = 'normative' | 'semantic';

export const RelatedDocuments: React.FC<RelatedDocumentsProps> = ({ 
  uid, 
  massima, 
  riferimentiNormativi = [] 
}) => {
  const hasNorms = riferimentiNormativi.length > 0;
  
  const [mode, setMode] = useState<SearchMode>(hasNorms ? 'normative' : 'semantic');
  
  // Stati per controllare l'avvio esplicito della ricerca
  const [selectedNorms, setSelectedNorms] = useState<string[]>([]);
  const [appliedNorms, setAppliedNorms] = useState<string[]>([]);
  const [hasSearchedSemantic, setHasSearchedSemantic] = useState<boolean>(false);

  // Determina se l'hook è autorizzato a fare la chiamata
  const shouldFetch = mode === 'normative' ? appliedNorms.length > 0 : hasSearchedSemantic;

  // L'hook riceve shouldFetch. Assicurati di aggiornare useRelatedDocuments 
  const { relatedDocs, loading, error } = useRelatedDocuments({
    uid,
    massima,
    mode,
    selectedNorms: appliedNorms,
    shouldFetch 
  });

  const toggleNorm = (norm: string) => {
    setSelectedNorms(prev => 
      prev.includes(norm) 
        ? prev.filter(n => n !== norm) 
        : [...prev, norm]
    );
  };

  const executeNormativeSearch = () => {
    setAppliedNorms(selectedNorms);
  };

  const executeSemanticSearch = () => {
    setHasSearchedSemantic(true);
  };

  const handleClick = (doc: DocumentoGiurisprudenziale) => {
    const docId = (doc as { id?: string }).id || 
                  (doc as { uid?: string }).uid || 
                  (doc as { urn?: string }).urn;
    if (!docId) return;
    
    const isMobile = window.innerWidth < 768;
    const target = isMobile ? "_self" : "_blank";
    const newWindow = window.open(`/giurisprudenza/${docId}`, target);
    
    if (!isMobile && newWindow) window.focus();
  };
  
  if (error) {
    return (
      <div className="mx-4 sm:mx-0 p-3 bg-red-500/10 text-red-600 dark:text-red-400 text-xs font-light rounded-md border border-red-500/30 shadow-xs mt-6">
        <strong className="font-bold uppercase tracking-wider mr-1.5">Errore:</strong> Errore durante il caricamento dei documenti correlati.
      </div>
    );
  }

  const isNormativeSearchPending = mode === 'normative' && 
    JSON.stringify(selectedNorms) !== JSON.stringify(appliedNorms);

  return (
    <div className="mt-8">
      
      <div className="sticky top-0 bg-(--color-surface) z-10 p-3 sm:p-0 sm:static sm:bg-transparent mb-4 rounded-lg shadow-xs sm:shadow-none border border-(--color-border) sm:border-none">
 
        {/* Toggle Mode */}
        <div className="flex space-x-1.5 bg-(--color-bg) p-1 rounded-md border border-(--color-border)">
          <button
            type="button"
            onClick={() => setMode('normative')}
            disabled={!hasNorms}
            className={`flex-1 px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-sm transition-all cursor-pointer outline-none ${
              mode === 'normative' 
                ? 'bg-(--color-surface) text-(--color-text) shadow-xs border border-(--color-border)' 
                : hasNorms 
                  ? 'text-(--color-muted) hover:text-(--color-text)' 
                  : 'text-(--color-muted) opacity-40 cursor-not-allowed'
            }`}
          >
            Normativa {hasNorms ? `(${riferimentiNormativi.length})` : ''}
          </button>
          
          <button
            type="button"
            onClick={() => setMode('semantic')}
            className={`flex-1 px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-sm transition-all cursor-pointer outline-none ${
              mode === 'semantic' 
                ? 'bg-(--color-surface) text-(--color-text) shadow-xs border border-(--color-border)' 
                : 'text-(--color-muted) hover:text-(--color-text)'
            }`}
          >
            Semantica
          </button>
        </div>

        {/* Controlli Ricerca Normativa */}
        {mode === 'normative' && hasNorms && (
          <div className="relative mt-4 p-4 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden">
            <p className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) mb-2.5 mt-0.5">
              Seleziona le norme da incrociare:
            </p>
            <div className="flex flex-wrap gap-2 mb-3.5">
              {riferimentiNormativi.map(norm => {
                const isSelected = selectedNorms.includes(norm);
                return (
                  <button
                    key={norm}
                    type="button"
                    onClick={() => toggleNorm(norm)}
                    className={`text-xs px-3 py-1.5 rounded-md border transition-all cursor-pointer outline-none shadow-xs ${
                      isSelected 
                        ? 'bg-(--color-text) border-(--color-text) text-(--color-surface) font-bold' 
                        : 'bg-(--color-bg) border-(--color-border) text-(--color-text) hover:border-(--color-text)'
                    }`}
                  >
                    {norm}
                  </button>
                );
              })}
            </div>
            
            <button
              type="button"
              onClick={executeNormativeSearch}
              disabled={selectedNorms.length === 0 || (!isNormativeSearchPending && appliedNorms.length > 0)}
              className="w-full sm:w-auto px-5 py-2.5 rounded-md text-xs font-bold uppercase tracking-widest bg-(--color-text) text-(--color-surface) hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs outline-none cursor-pointer flex items-center justify-center gap-2"
            >
              {loading && mode === 'normative' && <Loader2 size={14} className="animate-spin" />}
              <span>{loading && mode === 'normative' ? 'Ricerca in corso...' : 'Cerca per queste norme'}</span>
            </button>
          </div>
        )}

        {/* Controlli Ricerca Semantica */}
        {mode === 'semantic' && !hasSearchedSemantic && (
          <div className="relative mt-4 p-5 text-center rounded-lg border border-(--color-border) bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
            <p className="text-xs sm:text-sm text-(--color-muted) font-light mb-4 mt-1 leading-relaxed">
              Trova pronunce simili basate sul significato del testo, grazie all'Intelligenza Artificiale.
            </p>
            <button
              type="button"
              onClick={executeSemanticSearch}
              className="w-full sm:w-auto px-5 py-2.5 rounded-md text-xs font-bold uppercase tracking-widest bg-(--color-text) text-(--color-surface) hover:opacity-90 transition-all shadow-xs outline-none cursor-pointer"
            >
              Avvia ricerca semantica
            </button>
          </div>
        )}
      </div>

      {/* Risultati */}
      <div className="mt-4">
        {loading ? (
          <div className="space-y-4 animate-pulse px-4 sm:px-0">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-(--color-surface) rounded-lg border border-(--color-border) w-full shadow-xs"></div>
            ))}
          </div>
        ) : !shouldFetch ? (
          // Lo stato iniziale in cui l'utente non ha ancora cliccato alcun bottone
          <div className="text-center py-12 border border-dashed border-(--color-border) rounded-lg bg-(--color-surface) shadow-xs p-6">
            <p className="text-xs sm:text-sm text-(--color-muted) font-light">
              {mode === 'normative' 
                ? "Seleziona le norme e avvia la ricerca per trovare pronunce correlate." 
                : "Clicca su 'Avvia ricerca semantica' per trovare pronunce simili."}
            </p>
          </div>
        ) : relatedDocs.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-(--color-border) rounded-lg bg-(--color-surface) shadow-xs p-6">
            <p className="text-xs sm:text-sm text-(--color-muted) font-light">
              Nessun documento trovato per i criteri selezionati.
            </p>
          </div>
        ) : (
          <ul className="space-y-4 max-h-[70vh] sm:max-h-screen overflow-y-auto pr-1 custom-scrollbar -mx-2 px-2 sm:mx-0 sm:px-0 pb-10">
            {relatedDocs.map((doc, index) => {
              const currentDoc = doc as DocumentoGiurisprudenziale;
              const docId = (currentDoc as { id?: string }).id || currentDoc.urn || String(index);

              return (
                <li key={docId} className="transition-all active:scale-[0.98] sm:hover:-translate-y-0.5 duration-200">
                  <div 
                    onClick={() => handleClick(currentDoc)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleClick(currentDoc);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className="block cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-(--color-text) rounded-lg"
                  >
                    <Document documento={currentDoc} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};