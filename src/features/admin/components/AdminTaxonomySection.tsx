import React from "react";
import { Loader2 } from "lucide-react";

interface AdminTaxonomySectionProps {
  mergeParams: {
    vecchiaCategoria: string;
    nuovaCategoria: string | null;
  };
  setMergeParams: React.Dispatch<React.SetStateAction<{
    vecchiaCategoria: string;
    nuovaCategoria: string | null;
  }>>;
  isMerging: boolean;
  onMergeSubmit: () => void;
}

export const AdminTaxonomySection: React.FC<AdminTaxonomySectionProps> = ({
  mergeParams,
  setMergeParams,
  isMerging,
  onMergeSubmit,
}) => {
  return (
    <section
      id="admin-taxonomy-section"
      className="relative border border-(--color-border) rounded-lg p-6 md:p-8 bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden"
    >
      {/* LA LINEA DI RIGORE SUPERIORE (Unico tocco di colore) */}
      <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

      <div className="flex flex-col gap-6 mt-1">
        <div>
          <h2 className="text-xl md:text-2xl font-medium text-(--color-text) tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
            Gestione e Pulizia Tassonomia
          </h2>
          <p className="text-xs sm:text-sm text-(--color-muted) font-light mt-1.5 leading-relaxed">
            Scansiona le sottocategorie rare e unificale in categorie più ampie.
          </p>
        </div>

        <div>
          <h3 className="text-sm font-medium text-(--color-text) tracking-tight mb-4" style={{ fontFamily: 'var(--font-serif)' }}>
            2. Unifica Categorie
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <input
              type="text"
              placeholder="Categoria da eliminare (es. 'Resp. Med.')"
              value={mergeParams.vecchiaCategoria}
              onChange={(e) => setMergeParams(prev => ({...prev, vecchiaCategoria: e.target.value}))}
              className="w-full px-3.5 py-2.5 rounded-md border border-(--color-border) bg-(--color-bg) text-xs sm:text-sm text-(--color-text) font-light placeholder:text-(--color-muted) focus:border-(--color-text) outline-none transition-colors"
            />
            <input
              type="text"
              placeholder="Nuova categoria (lascia vuoto per svuotare)"
              value={mergeParams.nuovaCategoria || ""}
              onChange={(e) => setMergeParams(prev => ({...prev, nuovaCategoria: e.target.value}))}
              className="w-full px-3.5 py-2.5 rounded-md border border-(--color-border) bg-(--color-bg) text-xs sm:text-sm text-(--color-text) font-light placeholder:text-(--color-muted) focus:border-(--color-text) outline-none transition-colors"
            />
          </div>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onMergeSubmit}
              disabled={isMerging}
              className="px-6 py-2.5 rounded-md bg-(--color-text) text-(--color-surface) text-xs font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-35 disabled:cursor-not-allowed transition-all shadow-xs outline-none flex items-center gap-2"
            >
              {isMerging && <Loader2 size={14} className="animate-spin" />}
              <span>{isMerging ? "Elaborazione..." : "Sostituisci e Unifica"}</span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};