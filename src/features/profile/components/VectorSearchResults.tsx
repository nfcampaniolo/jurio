import React from "react";
import { motion } from "framer-motion";
import { FiSearch, FiInfo, FiLoader } from "react-icons/fi";
import { Document }  from "@/features/document/components/Document";
import type { DocumentoGiurisprudenziale } from "@/interfaces/interfaces";

interface VectorSearchResultsProps {
  hasMassima: boolean;
  hasFattispecie: boolean;
  isSearchingVector: boolean;
  hasSearched: boolean;
  visibleAllMatches: DocumentoGiurisprudenziale[];
  handleVectorSearch: () => void;
  handleClick: (doc: DocumentoGiurisprudenziale) => void;
}

export const VectorSearchResults: React.FC<VectorSearchResultsProps> = ({
  hasMassima,
  hasFattispecie,
  isSearchingVector,
  hasSearched,
  visibleAllMatches,
  handleVectorSearch,
  handleClick,
}) => {
  return (
    <>
      {(hasMassima || hasFattispecie) && (
        <div className="mt-12 pt-8 border-t border-(--color-border)">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="flex flex-col gap-2">
              <h3 className="text-lg md:text-xl font-medium flex items-center gap-2.5 text-(--color-text) tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
                <FiSearch className="opacity-70" />
                Cerca nella banca dati
              </h3>
              <p className="text-start text-xs md:text-sm text-(--color-muted) font-light max-w-2xl leading-relaxed">
                Sfrutta l'Intelligenza Artificiale per trovare provvedimenti archiviati con tematiche simili a questo documento.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={handleVectorSearch}
                disabled={isSearchingVector || hasSearched}
                className={`
                  relative flex flex-1 lg:flex-none items-center justify-center gap-2 px-5 py-2.5 rounded-md border text-xs font-bold uppercase tracking-widest transition-all duration-200 outline-none
                  ${hasSearched
                    ? "bg-(--color-bg) border-(--color-text) text-(--color-text) shadow-xs"
                    : "bg-(--color-surface) border-(--color-border) text-(--color-text) hover:border-(--color-text)"
                  }
                  disabled:opacity-40 disabled:cursor-not-allowed
                `}
                aria-label="Cerca documenti analoghi"
              >
                {isSearchingVector ? <FiLoader size={15} className="animate-spin" /> : <FiSearch size={15} className="opacity-70" />}
                {hasSearched ? "Ricerca effettuata" : "Cerca documenti analoghi"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isSearchingVector && (
        <motion.div 
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} 
          className="mt-10 flex flex-col items-center justify-center py-12 rounded-lg border border-(--color-border) bg-(--color-surface) shadow-xs"
        >
          <div className="relative">
            <FiLoader className="animate-spin h-8 w-8 text-(--color-text)" />
          </div>
          <p className="mt-4 text-xs font-bold uppercase tracking-widest text-(--color-muted)">
            Ricerca nel database in corso...
          </p>
        </motion.div>
      )}

      {visibleAllMatches.length > 0 && !isSearchingVector && hasSearched && (
        <motion.div
          key="results"
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="mt-8"
        >
          <div className="flex items-center justify-between mb-6 border-b border-(--color-border) pb-3 px-1">
            <h4 className="text-xs font-bold uppercase tracking-widest text-(--color-muted)">
              Trovati <span className="text-(--color-text) font-semibold">{visibleAllMatches.length}</span> risultati
            </h4>
          </div>
          
          <div className="flex flex-col gap-4">
            {visibleAllMatches.map((doc, idx) => (
              <motion.div
                key={doc.id || idx}
                className="cursor-pointer group"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ scale: 1.002 }}
                whileTap={{ scale: 0.998 }}
                onClick={() => handleClick(doc)}
              >
                <Document documento={doc} />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {!isSearchingVector && hasSearched && visibleAllMatches.length === 0 && (
        <motion.div
          key="empty"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-8 p-8 flex flex-col items-center justify-center text-center rounded-lg border border-dashed border-(--color-border) bg-(--color-surface) shadow-xs"
        >
          <div className="h-10 w-10 rounded-md bg-(--color-bg) border border-(--color-border) flex items-center justify-center mb-3 text-(--color-text)">
            <FiInfo className="opacity-70" size={20} />
          </div>
          <h4 className="text-sm font-medium text-(--color-text) tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>Nessun documento simile trovato</h4>
          <p className="text-xs text-(--color-muted) font-light mt-1 max-w-sm leading-relaxed">
            Non ci sono documenti nel database che presentino una similarità sufficiente rispetto a questo documento.
          </p>
        </motion.div>
      )}
    </>
  );
};