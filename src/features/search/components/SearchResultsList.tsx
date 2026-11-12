import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, Info, Loader2, Scale } from "lucide-react";
import { Document } from "@/features/document/components/Document";
import type { Sentenza, Ordinanza, Decreto, DocumentoGiurisprudenzaGenerico } from "@/interfaces/interfaces";

type Doc = Sentenza | Ordinanza | Decreto | DocumentoGiurisprudenzaGenerico;

const OTHERS_PAGE_SIZE = 10;

interface NormativaResults {
  query: string;
  /** Riferimenti normativi riconosciuti nella query; vuoto = nessun articolo riconosciuto. */
  keys: string[];
  docs: Doc[];
}

interface SearchResultsListProps {
  totalResultsCount: number;
  isSearching: boolean;
  hasSearched: boolean;
  /** Risultati pertinenti (topMatches del vector search o match esatto per numero/categoria). */
  effectiveTopMatches: Doc[];
  /** Tutti gli altri risultati, meno pertinenti. */
  effectiveAllMatches: Doc[];
  /** Risultati della ricerca per riferimento normativo (null se il filtro non è attivo). */
  normativaMatch?: NormativaResults | null;
  visibleCount: number;
  loading: boolean;
  isDbPaginatedMode: boolean;
  hasMoreDbResults: boolean;
  handleClick: (doc: Doc) => void;
  handleLoadMore: () => void;
}

const ResultItem: React.FC<{ doc: Doc; idx: number; onClick: (doc: Doc) => void }> = ({ doc, idx, onClick }) => (
  <motion.div
    className="cursor-pointer"
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: Math.min(idx, 10) * 0.05 }}
    whileHover={{ scale: 1.002 }}
    whileTap={{ scale: 0.998 }}
    onClick={() => onClick(doc)}
  >
    <Document documento={doc} />
  </motion.div>
);

const LoadMoreButton: React.FC<{ onClick: () => void; loading?: boolean; label?: string }> = ({
  onClick,
  loading = false,
  label = "Mostra altri risultati",
}) => (
  <div className="flex justify-center py-6 sm:py-8">
    <button
      onClick={onClick}
      disabled={loading}
      className="px-6 py-3 rounded-md bg-(--color-surface) border border-(--color-border) hover:border-(--color-text) text-(--color-text) transition-all shadow-xs disabled:opacity-60 text-xs font-bold uppercase tracking-widest outline-none flex items-center gap-2"
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      <span>{loading ? "Caricamento…" : label}</span>
    </button>
  </div>
);

const NormativaSection: React.FC<{
  match: NormativaResults;
  visible: number;
  onShowMore: () => void;
  onClick: (doc: Doc) => void;
}> = ({ match, visible, onShowMore, onClick }) => {
  const count = match.docs.length;
  const hasKeys = match.keys.length > 0;

  return (
    <section className="space-y-4 pt-2" aria-labelledby="normativa-results-heading">
      <div className="border-b border-(--color-border) pb-3 px-1">
        <div className="flex items-baseline justify-between gap-4">
          <h2
            id="normativa-results-heading"
            className="flex items-center gap-2 text-base sm:text-lg font-medium text-(--color-text) tracking-tight"
          >
            <Scale size={18} aria-hidden="true" className="text-(--color-muted) shrink-0" />
            Per riferimento normativo
          </h2>
          {hasKeys && (
            <span className="text-xs font-bold uppercase tracking-widest text-(--color-muted) shrink-0">
              {count} {count === 1 ? "documento" : "documenti"}
            </span>
          )}
        </div>
        <p className="text-xs text-(--color-muted) font-light mt-0.5">
          Pronunce che citano le norme indicate nella ricerca
        </p>
      </div>

      {!hasKeys ? (
        <p role="note" className="text-xs sm:text-sm text-(--color-muted) font-light px-1">
          Nessun riferimento normativo riconosciuto in "{match.query}". Indica un articolo, ad esempio "art. 2051 c.c.".
        </p>
      ) : count === 0 ? (
        <p role="note" className="text-xs sm:text-sm text-(--color-muted) font-light px-1">
          Nessuna pronuncia trovata che citi i riferimenti normativi indicati.
        </p>
      ) : (
        <>
          {match.docs.slice(0, visible).map((doc, idx) => (
            <ResultItem key={doc.id} doc={doc} idx={idx} onClick={onClick} />
          ))}
          {visible < count && (
            <LoadMoreButton onClick={onShowMore} label="Mostra altre pronunce per norma" />
          )}
        </>
      )}
    </section>
  );
};

export const SearchResultsList: React.FC<SearchResultsListProps> = ({
  totalResultsCount,
  isSearching,
  hasSearched,
  effectiveTopMatches,
  effectiveAllMatches,
  normativaMatch = null,
  visibleCount,
  loading,
  isDbPaginatedMode,
  hasMoreDbResults,
  handleClick,
  handleLoadMore,
}) => {
  // null = comportamento automatico (aperta solo se non ci sono risultati pertinenti)
  const [othersExpanded, setOthersExpanded] = useState<boolean | null>(null);
  const [othersVisible, setOthersVisible] = useState(OTHERS_PAGE_SIZE);
  const [normativaVisible, setNormativaVisible] = useState(OTHERS_PAGE_SIZE);

  // Ogni nuova ricerca riparte dallo stato iniziale della sezione "altri risultati"
  const [prevLoading, setPrevLoading] = useState(loading);
  if (loading !== prevLoading) {
    setPrevLoading(loading);
    if (loading) {
      setOthersExpanded(null);
      setOthersVisible(OTHERS_PAGE_SIZE);
      setNormativaVisible(OTHERS_PAGE_SIZE);
    }
  }

  const normativaSection = normativaMatch && isSearching && (
    <NormativaSection
      match={normativaMatch}
      visible={normativaVisible}
      onShowMore={() => setNormativaVisible((n) => n + OTHERS_PAGE_SIZE)}
      onClick={handleClick}
    />
  );

  if (totalResultsCount === 0 && !loading) {
    if (!hasSearched) return null;

    return (
      <div className="max-w-5xl mx-auto mt-6 sm:mt-8 px-4 md:px-0 space-y-6 sm:space-y-8">
        <div className="text-center text-sm text-(--color-muted)" role="status">
          Nessun elemento trovato
        </div>
        {normativaSection}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Modalità navigazione per filtri (senza testo): lista unica paginata
  // ---------------------------------------------------------------------------
  if (!isSearching) {
    const visibleDocs = effectiveAllMatches.slice(0, visibleCount);
    return (
      <div className="max-w-5xl mx-auto mt-6 sm:mt-8 space-y-6 sm:space-y-8 px-4 md:px-0">
        <div className="flex items-center justify-between border-b border-(--color-border) pb-3 px-1">
          <p className="text-xs font-bold uppercase tracking-widest text-(--color-muted)">
            {totalResultsCount} documenti trovati
          </p>
        </div>
        <div className="space-y-4">
          {visibleDocs.map((doc, idx) => (
            <ResultItem key={doc.id} doc={doc} idx={idx} onClick={handleClick} />
          ))}
        </div>
        {(visibleCount < effectiveAllMatches.length || (isDbPaginatedMode && hasMoreDbResults)) && (
          <LoadMoreButton onClick={handleLoadMore} loading={loading} />
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Ricerca testuale: risultati pertinenti in primo piano, altri a parte
  // ---------------------------------------------------------------------------
  const pertinentCount = effectiveTopMatches.length;
  const othersCount = effectiveAllMatches.length;
  const hasPertinent = pertinentCount > 0;
  const isOthersOpen = othersExpanded ?? !hasPertinent;

  const visibleTop = effectiveTopMatches.slice(0, visibleCount);
  const visibleOthers = effectiveAllMatches.slice(0, othersVisible);

  return (
    <div className="max-w-5xl mx-auto mt-6 sm:mt-8 space-y-6 sm:space-y-8 px-4 md:px-0">
      {/* RISULTATI PERTINENTI */}
      <section className="space-y-4" aria-labelledby="pertinent-results-heading">
        <div className="flex items-baseline justify-between gap-4 border-b border-(--color-border) pb-3 px-1">
          <h2
            id="pertinent-results-heading"
            className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight"
          >
            Risultati pertinenti
          </h2>
          <span className="text-xs font-bold uppercase tracking-widest text-(--color-muted) shrink-0">
            {pertinentCount} {pertinentCount === 1 ? "documento" : "documenti"}
          </span>
        </div>

        {hasPertinent ? (
          <>
            {visibleTop.map((doc, idx) => (
              <ResultItem key={doc.id} doc={doc} idx={idx} onClick={handleClick} />
            ))}
            {visibleCount < pertinentCount && (
              <LoadMoreButton onClick={handleLoadMore} label="Mostra altri risultati pertinenti" />
            )}
          </>
        ) : (
          !loading && (
            <div
              role="status"
              className="flex items-start gap-3 p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg"
            >
              <Info className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 shrink-0" />
              <p className="text-xs sm:text-sm text-orange-700 dark:text-orange-300 font-light leading-relaxed">
                Nessun risultato pertinente trovato per questa ricerca.
                {othersCount > 0 && (
                  <span className="font-bold sm:ml-1 block sm:inline mt-1 sm:mt-0">
                    Di seguito i risultati con una corrispondenza più debole.
                  </span>
                )}
              </p>
            </div>
          )
        )}
      </section>

      {/* RISULTATI PER RIFERIMENTO NORMATIVO (solo se il filtro è attivo) */}
      {normativaSection}

      {/* ALTRI RISULTATI */}
      {othersCount > 0 && (
        <section className="space-y-4 pt-2" aria-labelledby="other-results-heading">
          <div className="border-b border-(--color-border) pb-3 px-1">
            <h2 id="other-results-heading" className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight">
              <button
                type="button"
                onClick={() => setOthersExpanded(!isOthersOpen)}
                aria-expanded={isOthersOpen}
                aria-controls="other-results-list"
                className="w-full flex items-center justify-between gap-4 text-left outline-none cursor-pointer group"
              >
                <span className="group-hover:underline">Altri risultati</span>
                <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-(--color-muted) shrink-0">
                  {othersCount} {othersCount === 1 ? "documento" : "documenti"}
                  <ChevronDown
                    size={16}
                    aria-hidden="true"
                    className={`transition-transform duration-200 ${isOthersOpen ? "rotate-180" : ""}`}
                  />
                </span>
              </button>
            </h2>
            <p className="text-xs text-(--color-muted) font-light mt-0.5">
              Documenti con una corrispondenza parziale rispetto alla ricerca
            </p>
          </div>

          <AnimatePresence initial={false}>
            {isOthersOpen && (
              <motion.div
                id="other-results-list"
                key="other-results"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
                className="space-y-4 overflow-hidden"
              >
                {visibleOthers.map((doc, idx) => (
                  <ResultItem key={doc.id} doc={doc} idx={idx} onClick={handleClick} />
                ))}
                {othersVisible < othersCount && (
                  <LoadMoreButton onClick={() => setOthersVisible((n) => n + OTHERS_PAGE_SIZE)} />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      )}
    </div>
  );
};
