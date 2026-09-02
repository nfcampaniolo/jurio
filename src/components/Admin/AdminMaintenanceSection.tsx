import React from "react";
import type { AdminMaintenanceParams, MaintenanceProgressData } from "@/services/admin";
import { Loader2 } from "lucide-react";

interface AdminMaintenanceSectionProps {
  maintenanceParams: AdminMaintenanceParams;
  isUpdating: boolean;
  progressData: MaintenanceProgressData | null;
  onParamChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
  onMaintenanceSubmit: () => void;
}

export const AdminMaintenanceSection: React.FC<AdminMaintenanceSectionProps> = ({
  maintenanceParams,
  isUpdating,
  progressData,
  onParamChange,
  onMaintenanceSubmit,
}) => {
  return (
    <section
      id="admin-maintenance-section"
      className="relative border border-(--color-border) rounded-lg p-6 md:p-8 bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden"
    >
      {/* LA LINEA DI RIGORE SUPERIORE (Unico tocco di colore) */}
      <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

      <div className="flex flex-col gap-6 mt-1">
        <div>
          <h2 className="text-xl md:text-2xl font-medium text-(--color-text) tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
            Manutenzione Massiva Database
          </h2>
          <p className="text-xs sm:text-sm text-(--color-muted) font-light mt-1.5 leading-relaxed">
            Aggiorna in massa i metadati delle sentenze applicando filtri specifici.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <select 
            name="materia" 
            value={maintenanceParams.materia} 
            onChange={onParamChange} 
            className="w-full px-3.5 py-2.5 rounded-md border border-(--color-border) bg-(--color-bg) text-xs sm:text-sm text-(--color-text) font-light focus:border-(--color-text) outline-none transition-colors"
          >
            <option value="">Tutte le materie (Nessun filtro)</option>
            <option value="Civile">Civile</option>
            <option value="Penale">Penale</option>
            <option value="Amministrativo">Amministrativo</option>
          </select>

          <select 
            name="sezione" 
            value={maintenanceParams.sezione} 
            onChange={onParamChange} 
            className="w-full px-3.5 py-2.5 rounded-md border border-(--color-border) bg-(--color-bg) text-xs sm:text-sm text-(--color-text) font-light focus:border-(--color-text) outline-none transition-colors"
          >
            <option value="">Tutte le sezioni (Nessun filtro)</option>
            <option value="PRIMA SEZIONE CIVILE">PRIMA SEZIONE CIVILE</option>
            <option value="SECONDA SEZIONE CIVILE">SECONDA SEZIONE CIVILE</option>
            <option value="TERZA SEZIONE CIVILE">TERZA SEZIONE CIVILE</option>
            <option value="QUARTA SEZIONE CIVILE">QUARTA SEZIONE CIVILE</option>
            <option value="QUINTA SEZIONE CIVILE">QUINTA SEZIONE CIVILE</option>
            <option value="SESTA SEZIONE CIVILE">SESTA SEZIONE CIVILE</option>
            <option value="SEZIONI UNITE CIVILI">SEZIONI UNITE CIVILI</option>
            <option value="PRIMA SEZIONE PENALE">PRIMA SEZIONE PENALE</option>
            <option value="SECONDA SEZIONE PENALE">SECONDA SEZIONE PENALE</option>
            <option value="TERZA SEZIONE PENALE">TERZA SEZIONE PENALE</option>
            <option value="QUARTA SEZIONE PENALE">QUARTA SEZIONE PENALE</option>
            <option value="QUINTA SEZIONE PENALE">QUINTA SEZIONE PENALE</option>
            <option value="SESTA SEZIONE PENALE">SESTA SEZIONE PENALE</option>
            <option value="SETTIMA SEZIONE PENALE">SETTIMA SEZIONE PENALE</option>
            <option value="SEZIONI UNITE PENALI">SEZIONI UNITE PENALI</option>
            <option value="SEZIONE II">SEZIONE II</option>
            <option value="SEZIONE III">SEZIONE III</option>
            <option value="SEZIONE IV">SEZIONE IV</option>
            <option value="SEZIONE V">SEZIONE V</option>
            <option value="SEZIONE VI">SEZIONE VI</option>
            <option value="SEZIONE VII">SEZIONE VII</option>
            <option value="PLENARIA">PLENARIA</option>
          </select>

          <select 
            name="organo_giudicante" 
            value={maintenanceParams.organo_giudicante} 
            onChange={onParamChange} 
            className="w-full px-3.5 py-2.5 rounded-md border border-(--color-border) bg-(--color-bg) text-xs sm:text-sm text-(--color-text) font-light focus:border-(--color-text) outline-none transition-colors"
          >
            <option value="">Tutti gli organi (Nessun filtro)</option>
            <option value="CORTE DI CASSAZIONE">CORTE DI CASSAZIONE</option>
            <option value="CONSIGLIO DI STATO">CONSIGLIO DI STATO</option>
            <option value="CORTE COSTITUZIONALE">CORTE COSTITUZIONALE</option>
          </select>

          <select 
            name="newFonte" 
            value={maintenanceParams.newFonte} 
            onChange={onParamChange} 
            className="w-full px-3.5 py-2.5 rounded-md border border-(--color-border) bg-(--color-bg) text-xs sm:text-sm text-(--color-text) font-light focus:border-(--color-text) outline-none transition-colors"
          >
            <option value="">Nessuna nuova fonte da applicare</option>
            <option value="https://www.italgiure.giustizia.it/">https://www.italgiure.giustizia.it/</option>
            <option value="https://www.giustizia-amministrativa.it/">https://www.giustizia-amministrativa.it/</option>
            <option value="https://www.cortecostituzionale.it/">https://www.cortecostituzionale.it/</option>
          </select>

          <select 
            name="newFonteLogo" 
            value={maintenanceParams.newFonteLogo} 
            onChange={onParamChange} 
            className="w-full px-3.5 py-2.5 rounded-md border border-(--color-border) bg-(--color-bg) text-xs sm:text-sm text-(--color-text) font-light focus:border-(--color-text) outline-none transition-colors"
          >
            <option value="">Nessun nuovo logo</option>
            <option value="https://www.cortecostituzionale.it/assets/image/logos/logo_70_orizzontale-d02ce0dafa4c8ec5c1ea75bd8929183b.svg">Logo Corte Costituzionale</option>
            <option value="https://www.giustizia-amministrativa.it/image/layout_set_logo?img_id=116864&t=1771425463926">Logo Giustizia Amministrativa</option>
          </select>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onMaintenanceSubmit}
            disabled={isUpdating}
            className="px-6 py-2.5 rounded-md bg-(--color-text) text-(--color-surface) text-xs font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-35 disabled:cursor-not-allowed transition-all shadow-xs outline-none flex items-center gap-2"
          >
            {isUpdating && <Loader2 size={14} className="animate-spin" />}
            <span>{isUpdating ? "Esecuzione in corso..." : "Avvia Manutenzione"}</span>
          </button>
        </div>

        {progressData && (
          <div className="mt-4 p-5 rounded-md border border-(--color-border) bg-(--color-bg) text-xs sm:text-sm">
            <h3 className="font-bold text-[10px] uppercase tracking-widest text-(--color-text) mb-3">
              Stato Avanzamento
            </h3>
            <div className="flex flex-col gap-1.5 text-(--color-muted) font-light">
              {progressData.status && <p><span className="font-semibold text-(--color-text)">Stato:</span> {progressData.status}</p>}
              {progressData.message && <p><span className="font-semibold text-(--color-text)">Messaggio:</span> {progressData.message}</p>}
              {progressData.scannedSoFar !== undefined && (
                <p>
                  <span className="font-semibold text-(--color-text)">Scansionati:</span> {progressData.scannedSoFar} 
                  {progressData.updatedSoFar !== undefined && ` | Aggiornati: ${progressData.updatedSoFar}`}
                </p>
              )}
              {progressData.finalStats && (
                <div className="mt-2 text-emerald-600 dark:text-emerald-400 font-medium">
                  Task concluso. Fonti aggiornate: {progressData.finalStats.fontiAggiornate || 0} / Documenti analizzati: {progressData.finalStats.documentiScansionati || 0}.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
};