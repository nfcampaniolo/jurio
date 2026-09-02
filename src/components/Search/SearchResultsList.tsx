import React from "react";
import { motion } from "framer-motion";
import { Info, Loader2 } from "lucide-react";
import { Document } from "../Document/Document";
import type { Sentenza, Ordinanza, Decreto, DocumentoGiurisprudenzaGenerico } from "@/interfaces/interfaces";

interface SearchResultsListProps {
  totalResultsCount: number;
  isSearching: boolean;
  effectiveTopMatches: (Sentenza | Ordinanza | Decreto | DocumentoGiurisprudenzaGenerico)[];
  effectiveAllMatches: (Sentenza | Ordinanza | Decreto | DocumentoGiurisprudenzaGenerico)[];
  visibleTopMatches: (Sentenza | Ordinanza | Decreto | DocumentoGiurisprudenzaGenerico)[];
  visibleAllMatches: (Sentenza | Ordinanza | Decreto | DocumentoGiurisprudenzaGenerico)[];
  visibleCount: number;
  loading: boolean;
  isDbPaginatedMode: boolean;
  hasMoreDbResults: boolean;
  handleClick: (doc: Sentenza | Ordinanza | Decreto | DocumentoGiurisprudenzaGenerico) => void;
  handleLoadMore: () => void;
}

export const SearchResultsList: React.FC<SearchResultsListProps> = ({
  totalResultsCount,
  isSearching,
  effectiveTopMatches,
  effectiveAllMatches,
  visibleTopMatches,
  visibleAllMatches,
  visibleCount,
  loading,
  isDbPaginatedMode,
  hasMoreDbResults,
  handleClick,
  handleLoadMore,
}) => {
  if (totalResultsCount === 0 && !loading) return null;

  return (
    <div className="max-w-5xl mx-auto mt-6 sm:mt-8 space-y-6 sm:space-y-8 px-4 md:px-0">
      <div className="flex items-center justify-between border-b border-(--color-border) pb-3 px-1">
        <p className="text-xs font-bold uppercase tracking-widest text-(--color-muted)">
          {totalResultsCount} documenti trovati
        </p>
      </div>

      {isSearching && (
        <div className="space-y-4">
          <h2 className="text-base sm:text-lg font-medium text-(--color-text) px-1 tracking-tight">
            Corrispondenze testuali esatte
          </h2>
          
          {effectiveTopMatches.length > 0 ? (
            visibleTopMatches.map((doc, idx) => (
              <motion.div
                key={doc.id}
                className="cursor-pointer"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                whileHover={{ scale: 1.002 }}
                whileTap={{ scale: 0.998 }}
                onClick={() => handleClick(doc)}
              >
                <Document documento={doc} />
              </motion.div>
            ))
          ) : (
            <div className="flex items-start gap-3 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg">
              <Info className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
              <p className="text-xs sm:text-sm text-orange-700 dark:text-orange-300 font-light leading-relaxed">
                Nessun risultato esatto o categoria specifica trovata per questa ricerca. 
                <span className="font-bold sm:ml-1 block sm:inline mt-1 sm:mt-0">Verifica le corrispondenze semantiche nella sezione qui sotto.</span>
              </p>
            </div>
          )}
        </div>
      )}

      {(effectiveAllMatches.length > 0 || !isSearching) && (
        <div className="space-y-4">
          {isSearching && (
            <h2 className="text-base sm:text-lg font-medium text-(--color-text) px-1 pt-4 tracking-tight">
              Correlazione Semantica
            </h2>
          )}
          
          {visibleAllMatches.map((doc, idx) => (
            <motion.div
              key={doc.id}
              className="cursor-pointer"
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
      )}

      {(visibleCount < totalResultsCount || (isDbPaginatedMode && hasMoreDbResults)) && (
        <div className="flex justify-center py-6 sm:py-8">
          <button
            onClick={handleLoadMore}
            disabled={loading}
            className="px-6 py-3 rounded-md bg-(--color-surface) border border-(--color-border) hover:border-(--color-text) text-(--color-text) transition-all shadow-xs disabled:opacity-60 text-xs font-bold uppercase tracking-widest outline-none flex items-center gap-2"
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            <span>{loading ? "Caricamento…" : "Mostra altri risultati"}</span>
          </button>
        </div>
      )}
    </div>
  );
};