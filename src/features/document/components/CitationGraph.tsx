'use client';

import React, { useState, useEffect } from 'react';
import { cercaPrecedente } from '@/features/document/hooks/cercaPrecedenti';
import { FaGavel, FaBalanceScale, FaLink, FaChevronRight, FaTimes } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';

export interface SentenceNode {
  id: string;
  organo_giudicante?: string;
  numero_sentenza?: string;
  sezione?: string;
  massima?: string;
  fattispecie_rilevante?: string;
  fatti?: string;
  fonte?: string;
  precedenti_richiamati?: string[];
}

interface CitationBranchProps {
  citazioneTesto: string;
}

const CitationBranch: React.FC<CitationBranchProps> = ({ citazioneTesto }) => {
  const [data, setData] = useState<SentenceNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function fetchPrecedente() {
      setLoading(true);
      const res = await cercaPrecedente(citazioneTesto);
      if (isMounted) {
        setData(res as SentenceNode | null);
        setLoading(false);
      }
    }
    fetchPrecedente();
    return () => { isMounted = false; };
  }, [citazioneTesto]);

  if (loading) {
    return (
      <div className="flex items-center gap-2.5 py-2.5 px-3.5 my-1.5 rounded-lg bg-(--color-surface) border border-(--color-border) text-xs sm:text-sm text-(--color-muted) shadow-xs animate-pulse">
        <span className="w-2 h-2 rounded-full bg-(--color-text) animate-ping shrink-0" />
        <span className="truncate">
          Ricerca precedente: <span className="italic text-(--color-text)">{citazioneTesto}</span>
        </span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-between gap-3 py-2.5 px-3.5 my-1.5 rounded-lg bg-(--color-surface) border border-(--color-border) text-xs sm:text-sm text-(--color-muted)">
        <span className="truncate flex-1 min-w-0">{citazioneTesto}</span>
        <span className="text-[10px] bg-(--color-bg) border border-(--color-border) px-2 py-0.5 rounded font-semibold uppercase tracking-wider text-(--color-muted) shrink-0">
          Non indicizzato
        </span>
      </div>
    );
  }

  const subPrecedenti = data.precedenti_richiamati || [];

  return (
    <div className="my-1.5 text-sm">
      {/* Riga del precedente */}
      <div className="group flex items-center gap-3 bg-(--color-surface) border border-(--color-border) hover:border-(--color-text) rounded-lg p-2.5 sm:p-3 shadow-xs transition-all duration-200">
        
        {/* Toggle Espansione */}
        {subPrecedenti.length > 0 ? (
          <button 
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="w-7 h-7 shrink-0 flex items-center justify-center rounded-md bg-(--color-bg) border border-(--color-border) text-(--color-muted) hover:text-(--color-text) transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-(--color-text)"
            title={isOpen ? "Comprimi rami" : "Espandi sottoprecedenti"}
          >
            <FaChevronRight className={`w-3 h-3 transition-transform duration-200 ease-in-out ${isOpen ? 'rotate-90 text-(--color-text)' : ''}`} />
          </button>
        ) : (
          <span className="w-7 h-7 shrink-0" />
        )}

        {/* Informazioni Sentenza & Massima (Correzione Accessibilità) */}
        <div 
          onClick={() => setIsModalOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault(); // Previene lo scroll con lo spazio
              setIsModalOpen(true);
            }
          }}
          role="button"
          tabIndex={0}
          className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-1.5 md:gap-3 cursor-pointer select-none rounded-sm outline-none focus-visible:ring-1 focus-visible:ring-(--color-text)"
        >
          {/* Badge Organo + Numero Sentenza */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] font-bold text-(--color-text) uppercase tracking-wider bg-(--color-bg) border border-(--color-border) px-2 py-0.5 rounded leading-normal">
              {data.organo_giudicante || "Cassazione"}{data.sezione ? ` • ${data.sezione}` : ""}
            </span>
            <span 
              className="text-xs sm:text-sm font-bold text-(--color-text) tracking-tight" 
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              N. {data.numero_sentenza || "S.N."}
            </span>
          </div>

          {/* Separatore visivo desktop */}
          <span className="hidden md:inline text-(--color-border) select-none">|</span>
          
          {/* Anteprima Massima */}
          <span className="flex-1 min-w-0 text-xs sm:text-[13px] text-(--color-muted) group-hover:text-(--color-text) truncate transition-colors leading-normal">
            {data.massima ? `“${data.massima}”` : "Clicca per visualizzare i dettagli"}
          </span>
        </div>
      </div>

      {/* Ramo ricorsivo */}
      <div className={`grid transition-all duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr] opacity-100 mt-1.5' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
        <div className="overflow-hidden">
          <div className="ml-3.5 pl-3 sm:pl-4 border-l border-(--color-border) space-y-1.5">
            {subPrecedenti.map((subCit, idx) => (
              <CitationBranch key={idx} citazioneTesto={subCit} />
            ))}
          </div>
        </div>
      </div>

      {/* Pannello Laterale */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex justify-start">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />

            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="relative bg-(--color-surface) border-r border-(--color-border) shadow-(--shadow-soft) w-full sm:max-w-xl h-full flex flex-col z-10 text-(--color-text) overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4 p-5 sm:p-6 border-b border-(--color-border) bg-(--color-bg)">
                <div className="space-y-1.5">
                  <span className="inline-block text-[11px] font-semibold text-(--color-text) uppercase tracking-wider bg-(--color-surface) border border-(--color-border) px-2 py-0.5 rounded leading-normal">
                    {data.organo_giudicante} {data.sezione ? `| ${data.sezione}` : ""}
                  </span>
                  <h3 className="text-lg sm:text-xl font-bold tracking-tight leading-snug" style={{ fontFamily: 'var(--font-serif)' }}>
                    Sentenza N. {data.numero_sentenza}
                  </h3>
                </div>

                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-8 h-8 shrink-0 flex items-center justify-center rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-muted) hover:text-(--color-text) transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-(--color-text)"
                  aria-label="Chiudi"
                >
                  <FaTimes className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Contenuto Scorrevole */}
              <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                {(data.fattispecie_rilevante || data.fatti) && (
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-bold text-(--color-muted) uppercase tracking-wider flex items-center gap-2">
                      <FaBalanceScale className="w-3.5 h-3.5 shrink-0 opacity-70" /> 
                      Fattispecie
                    </h4>
                    <p className="text-xs sm:text-[13px] text-(--color-muted) leading-relaxed bg-(--color-bg) p-3.5 rounded-md border border-(--color-border)">
                      {data.fattispecie_rilevante || data.fatti}
                    </p>
                  </div>
                )}

                {data.massima && (
                  <div className="space-y-2">
                    <h4 className="text-[11px] font-bold text-(--color-muted) uppercase tracking-wider flex items-center gap-2">
                      <FaGavel className="w-3.5 h-3.5 shrink-0 opacity-70" /> 
                      Massima / Principio di Diritto
                    </h4>
                    <p className="text-xs sm:text-[13px] text-(--color-text) leading-relaxed bg-(--color-bg) p-3.5 rounded-md border border-(--color-border)">
                      {data.massima}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              {data.id && (
                <div className="p-4 bg-(--color-bg) border-t border-(--color-border) flex justify-end">
                  <a 
                    href={`/giurisprudenza/${data.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => setIsModalOpen(false)}
                    className="w-full sm:w-auto inline-flex justify-center items-center gap-2 px-4 py-2.5 bg-(--color-text) text-(--color-surface) rounded-md text-xs font-semibold uppercase tracking-wider hover:opacity-90 transition-opacity"
                  >
                    <FaLink className="w-3 h-3 shrink-0" /> Visualizza intera sentenza
                  </a>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

interface CitationTreeProps {
  precedenti: string[];
}

export default function CitationTree({ precedenti }: CitationTreeProps) {
  if (!precedenti || precedenti.length === 0) {
    return <p className="text-[12px] sm:text-sm text-(--color-muted) font-light italic">Nessun precedente registrato.</p>;
  }

  return (
    <div className="space-y-1.5 sm:space-y-1">
      {precedenti.map((citazione, index) => (
        <CitationBranch key={index} citazioneTesto={citazione} />
      ))}
    </div>
  );
}