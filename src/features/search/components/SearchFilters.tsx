import React from "react";
import { Trash2 } from "lucide-react";
import { FilterSelect } from "@/shared/components/FilterSelect";
import { 
  CORTI_SUPREME, 
  TIPI_MASSIMA, 
  SEZIONI_CASSAZIONE_CIVILE, 
  SEZIONI_CASSAZIONE_PENALE, 
  SEZIONI_CONSIGLIO_DI_STATO, 
  SORT_OPTIONS, 
  SORT_LABEL, 
  isTipoMassima, 
  isSortBy, 
  isSezioneCorte, 
  isGradoGiudizio,
  TIPO_DOCUMENTI,
  type SortBy
} from "@/features/search/hooks/searchBarTypes";

interface SearchFiltersProps {
  loading: boolean;
  filterGrado: string;
  setFilterGrado: (val: string) => void; // Cambiato in (val: string) => void o il tipo specifico accettato
  filterSezione: string;
  setFilterSezione: (val: string) => void;
  filterTipo: string;
  setFilterTipo: (val: string) => void;
  filterTipologia: string;
  setFilterTipologia: (val: string) => void;
  sortBy: SortBy; // Assicurati che corrisponda al tipo usato nell'hook
  setSortBy: (val: SortBy) => void; // <-- Allineato al tipo esatto atteso dallo state setter
  numberPages: number;
  setnumberPages: (val: number) => void;
  startDate: string;
  setStartDate: (val: string) => void;
  endDate: string;
  setEndDate: (val: string) => void;
  clearFilters: () => void;
}

export const SearchFilters: React.FC<SearchFiltersProps> = ({
  loading,
  filterGrado,
  setFilterGrado,
  filterSezione,
  setFilterSezione,
  filterTipo,
  setFilterTipo,
  filterTipologia,
  setFilterTipologia,
  sortBy,
  setSortBy,
  numberPages,
  setnumberPages,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  clearFilters,
}) => {
  let sezioniOptions: readonly string[] = [];
  if (filterGrado === "Cassazione Civile") sezioniOptions = SEZIONI_CASSAZIONE_CIVILE;
  else if (filterGrado === "Cassazione Penale") sezioniOptions = SEZIONI_CASSAZIONE_PENALE;
  else if (filterGrado === "Consiglio di Stato") sezioniOptions = SEZIONI_CONSIGLIO_DI_STATO;

  const showSezioni = sezioniOptions.length > 0;

  return (
    <>
      <div className="w-full grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 py-1 items-end">
        <div className="w-full lg:col-span-2 min-w-0">
          <FilterSelect
            id="filter-grado"
            label="Corte suprema"
            value={filterGrado}
            disabled={loading}
            onChange={(v) => {
              if (v === "") { setFilterGrado(""); setFilterSezione(""); return; }
              if (isGradoGiudizio(v)) { setFilterGrado(v); setFilterSezione(""); }
            }}
          >
            <option value="">Tutte le corti</option>
            {CORTI_SUPREME.map((g) => <option key={g} value={g}>{g}</option>)}
          </FilterSelect>

          {showSezioni && (
            <div className="mt-3 w-full">
              <FilterSelect
                id="filter-sezione"
                label="Sezione"
                value={filterSezione}
                disabled={loading}
                onChange={(v) => {
                  if (v === "") return setFilterSezione("");
                  if (isSezioneCorte(v)) setFilterSezione(v);
                }}
              >
                <option value="">Tutte le sezioni</option>
                {sezioniOptions.map((s) => {
                  const formattedText = s
                    .split(' ')
                    .map((word) => {
                      if (!word) return '';
                      if (word.length <= 3) return word.toUpperCase();
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

        <FilterSelect
          id="filter-tipo"
          label="Tipo massima"
          value={filterTipo}
          disabled={loading}
          onChange={(v) => { if (v === "" || isTipoMassima(v)) setFilterTipo(v); }}
        >
          <option value="">Tutte le massime</option>
          {TIPI_MASSIMA.map((t) => {
            const formattedText = t
              .split('_')
              .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
              .join(' ');

            return (
              <option key={t} value={t} className="capitalize" style={{ textTransform: 'capitalize' }}>
                {formattedText}
              </option>
            );
          })}
        </FilterSelect>

        <FilterSelect
          id="filter-tipologia"
          label="Tipo documento"
          value={filterTipologia} 
          disabled={loading}
          onChange={(v) => setFilterTipologia(v)}
        >
          <option value="">Tutti i documenti</option>
          {TIPO_DOCUMENTI.map((g) => <option key={g} value={g}>{g}</option>)}
        </FilterSelect>

        <FilterSelect
          id="filter-sort"
          label="Ordina"
          value={sortBy}
          disabled={loading}
          onChange={(v) => { if (isSortBy(v)) setSortBy(v); }}
        >
          {SORT_OPTIONS.map((s) => <option key={s} value={s}>{SORT_LABEL[s]}</option>)}
        </FilterSelect>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 mt-6 mb-4 items-center">
        <div className="w-full lg:w-32 flex flex-col">
          <label htmlFor="semantic-results" className="block text-[10px] font-bold uppercase tracking-widest text-(--color-muted) mb-1.5 ml-1">
            N. risultati
          </label>
          <input
            type="number"
            id="semantic-results"
            min={10} max={40}
            value={numberPages === 0 ? "" : numberPages}
            disabled={loading}
            onChange={(e) => setnumberPages(parseInt(e.target.value, 10) || 0)}
            onBlur={(e) => {
              const val = parseInt(e.target.value, 10);
              if (isNaN(val) || val < 10) setnumberPages(10);
              else if (val > 40) setnumberPages(40);
            }}
            className="w-full rounded-md border border-(--color-border) px-3.5 py-2.5 text-sm disabled:opacity-60 shadow-xs outline-none bg-(--color-bg) text-(--color-text) font-light focus:border-(--color-text) transition-colors"
          />
        </div>

        <div className="flex-1 w-full flex flex-col sm:flex-row gap-3">
          {[
            { id: 'start-date', label: 'Dal', val: startDate, setter: setStartDate },
            { id: 'end-date', label: 'Al', val: endDate, setter: setEndDate, min: startDate }
          ].map((d) => (
            <div key={d.id} className="flex-1 flex flex-col">
              <label htmlFor={d.id} className="block text-[10px] font-bold uppercase tracking-widest text-(--color-muted) mb-1.5 ml-1">
                {d.label}
              </label>
              <input
                type="date"
                id={d.id}
                value={d.val}
                min={d.min}
                disabled={loading}
                onChange={(e) => d.setter(e.target.value)}
                className="w-full bg-(--color-bg) border border-(--color-border) text-(--color-text) text-xs rounded-md p-2.5 min-h-11 outline-none font-light focus:border-(--color-text) transition-colors dark:scheme-dark"
              />
            </div>
          ))}
        </div>
      </div>
      
      <div className="flex flex-col items-center justify-center gap-4 mt-8 mb-4 w-full">
        {(filterGrado || filterTipo || filterTipologia || startDate || endDate || filterSezione) && (
          <button
            onClick={clearFilters}
            type="button"
            className="flex items-center gap-1.5 text-xs text-(--color-muted) hover:text-red-600 transition-colors duration-200 uppercase tracking-widest font-bold outline-none"
          >
            <Trash2 size={14} className="opacity-70" />
            Resetta filtri
          </button>
        )}
      </div>
    </>
  );
};