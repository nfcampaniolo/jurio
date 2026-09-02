// components/Filters.tsx
import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sliders, X, Trash2 } from "lucide-react";
import { 
  CORTI_SUPREME, SEZIONI_CASSAZIONE_CIVILE, SEZIONI_CASSAZIONE_PENALE, 
  SEZIONI_CONSIGLIO_DI_STATO, TIPI_MASSIMA, TIPO_DOCUMENTI, isGradoGiudizio, isSezioneCorte, isTipoMassima
} from "@/hooks/searchBarTypes";

// --- COMPONENTI UI ---

interface FilterSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'> {
  label: string;
  onChange: (value: string) => void;
}

export const FilterSelect: React.FC<FilterSelectProps> = ({ id, label, value, disabled, onChange, children }) => (
  <div className="flex flex-col w-full">
    <label htmlFor={id} className="block text-xs font-bold uppercase tracking-widest text-(--color-muted) mb-2 ml-1">
      {label}
    </label>
    <select id={id} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} 
      className="w-full bg-(--color-surface) border border-(--color-border) text-(--color-text) text-sm rounded-md p-3 min-h-11 outline-none focus:border-(--color-text) transition-colors dark:scheme-dark">
      {children}
    </select>
  </div>
);

// --- TIPIZZAZIONE RIGOROSA DELLO STATO ---
export interface FilterStateValues {
  filterGrado: string;
  filterSezione: string;
  filterTipo: string;
  filterTipologia: string;
  startDate: string;
  endDate: string;
}

export interface FilterStateSetters {
  setFilterGrado: (v: string) => void;
  setFilterSezione: (v: string) => void;
  setFilterTipo: (v: string) => void;
  setFilterTipologia: (v: string) => void;
  setStartDate: (v: string) => void;
  setEndDate: (v: string) => void;
}

export interface FilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  filterState: FilterStateValues;
  setFilterState: FilterStateSetters;
  clearFilters: () => void;
}

export const FilterModal: React.FC<FilterModalProps> = ({ isOpen, onClose, loading, filterState, setFilterState, clearFilters }) => {
  const { filterGrado, filterSezione, filterTipo, filterTipologia, startDate, endDate } = filterState;
  
  let sezioniOptions: readonly string[] = [];
  if (filterGrado === "Cassazione Civile") sezioniOptions = SEZIONI_CASSAZIONE_CIVILE;
  else if (filterGrado === "Cassazione Penale") sezioniOptions = SEZIONI_CASSAZIONE_PENALE;
  else if (filterGrado === "Consiglio di Stato") sezioniOptions = SEZIONI_CONSIGLIO_DI_STATO;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-99 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, y: 20 }} 
            animate={{ opacity: 1, y: 0 }} 
            exit={{ opacity: 0, y: 20 }} 
            className="relative w-full max-w-5xl bg-(--color-surface) rounded-lg shadow-(--shadow-soft) border border-(--color-border) overflow-hidden flex flex-col"
          >
            {/* LA LINEA DI RIGORE SUPERIORE (Unico tocco di colore) */}
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

            <div className="px-6 py-5 border-b border-(--color-border) flex items-center justify-between bg-(--color-bg)">
              <h2 className="text-lg font-medium text-(--color-text) flex items-center gap-2" style={{ fontFamily: 'var(--font-serif)' }}>
                <Sliders size={18} className="opacity-80" /> Filtri di Ricerca Avanzati
              </h2>
              <button 
                onClick={onClose} 
                className="p-2 hover:bg-(--color-surface) rounded-md transition-colors text-(--color-muted) hover:text-(--color-text) outline-none"
                aria-label="Chiudi filtri"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 md:p-8 overflow-y-auto max-h-[75vh]">
              <div className="w-full grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 py-1 items-end">
                <div className="w-full lg:col-span-2 min-w-0">
                  <FilterSelect id="filter-grado" label="Corte suprema" value={filterGrado} disabled={loading}
                    onChange={(v) => { if (v === "") { setFilterState.setFilterGrado(""); setFilterState.setFilterSezione(""); return; } if (isGradoGiudizio(v)) { setFilterState.setFilterGrado(v); setFilterState.setFilterSezione(""); } }}>
                    <option value="">Tutte le corti</option>
                    {CORTI_SUPREME.map((g) => <option key={g} value={g}>{g}</option>)}
                  </FilterSelect>
                  {sezioniOptions.length > 0 && (
                    <div className="mt-4 w-full">
                      <FilterSelect 
                        id="filter-sezione" 
                        label="Sezione" 
                        value={filterSezione} 
                        disabled={loading} 
                        onChange={(v) => { 
                          if (v === "") return setFilterState.setFilterSezione(""); 
                          if (isSezioneCorte(v)) setFilterState.setFilterSezione(v); 
                        }}
                      >
                        <option value="">Tutte le sezioni</option>
                        {sezioniOptions.map((s) => {
                          const formattedText = s
                            .split(' ')
                            .map((word) => {
                              if (!word) return '';
                              if (word.length <= 3) {
                                return word.toUpperCase();
                              }
                              return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
                            })
                            .join(' ');

                          return (
                            <option key={s} value={s}>
                              {formattedText}
                            </option>
                          );
                        })}
                      </FilterSelect>
                    </div>
                  )}
                </div>

                <FilterSelect id="filter-tipo" label="Tipo massima" value={filterTipo} disabled={loading} onChange={(v) => { if (v === "" || isTipoMassima(v)) setFilterState.setFilterTipo(v); }}>
                  <option value="">Tutte le massime</option>
                  {TIPI_MASSIMA.map((t) => (
                    <option key={t} value={t}>
                      {t.split('_').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                    </option>
                  ))}
                </FilterSelect>

                <FilterSelect id="filter-tipologia" label="Tipo documento" value={filterTipologia} disabled={loading} onChange={(v) => setFilterState.setFilterTipologia(v)}>
                  <option value="">Tutti i documenti</option>
                  {TIPO_DOCUMENTI.map((g) => <option key={g} value={g}>{g}</option>)}
                </FilterSelect>
              </div>

              <div className="flex flex-col lg:flex-row gap-6 mt-6 mb-4 items-center">
                <div className="flex-1 w-full flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 flex flex-col">
                     <label className="block text-xs font-bold uppercase tracking-widest text-(--color-muted) mb-2 ml-1">Dal</label>
                     <input type="date" value={startDate} disabled={loading} onChange={(e) => setFilterState.setStartDate(e.target.value)} className="w-full bg-(--color-surface) border border-(--color-border) text-(--color-text) text-sm rounded-md p-3 min-h-11 outline-none focus:border-(--color-text) transition-colors dark:scheme-dark font-light" />
                  </div>
                  <div className="flex-1 flex flex-col">
                     <label className="block text-xs font-bold uppercase tracking-widest text-(--color-muted) mb-2 ml-1">Al</label>
                     <input type="date" value={endDate} min={startDate} disabled={loading} onChange={(e) => setFilterState.setEndDate(e.target.value)} className="w-full bg-(--color-surface) border border-(--color-border) text-(--color-text) text-sm rounded-md p-3 min-h-11 outline-none focus:border-(--color-text) transition-colors dark:scheme-dark font-light" />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-center mt-8">
                {(filterGrado || filterTipo || filterTipologia || startDate || endDate || filterSezione) && (
                  <button onClick={clearFilters} type="button" className="flex items-center gap-1.5 text-xs text-(--color-muted) hover:text-(--color-text) font-bold uppercase tracking-widest outline-none transition-colors">
                    <Trash2 size={14} /> Resetta filtri
                  </button>
                )}
              </div>
            </div>
            
            <div className="px-6 py-4 bg-(--color-bg) border-t border-(--color-border) flex justify-end">
              <button 
                onClick={onClose} 
                className="px-6 py-2.5 bg-(--color-text) text-(--color-surface) hover:opacity-80 text-xs font-bold uppercase tracking-widest rounded-md transition-opacity outline-none shadow-sm"
              >
                Applica Filtri
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};