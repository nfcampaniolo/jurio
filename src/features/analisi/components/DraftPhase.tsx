import React, {useState} from "react";
import { Database, Globe, Search } from "lucide-react";
import { AnalysisPromptSection } from "./AnalysisPromptSection";
import type { DeepAnalysisConfig } from "../hooks/types";

interface Props {
  quesito: string;
  setQuesito: (val: string) => void;
  isProcessing: boolean;
  onEseguiRicerca: () => void;
  configurazione?: DeepAnalysisConfig;
  documentiAllegatiCount?: number;
}

export const DraftPhase: React.FC<Props> = ({
  quesito,
  setQuesito,
  isProcessing,
  onEseguiRicerca,
  configurazione,
  documentiAllegatiCount,
}) => {
  const [localLoading, setLocalLoading] = useState(false);
  const riepilogoConfig = configurazione ?? {
    confidenceLevel: 80,
    sourceWeb: true,
    sourceInternalDB: true,
  };

  const handleCtaClick = async () => {
    if (localLoading || isProcessing || !quesito.trim()) return;
    
    setLocalLoading(true);
    try {
      onEseguiRicerca();
    } finally {
      setLocalLoading(false);
    }
  };
  
  return (
    <div className="space-y-6">
      <AnalysisPromptSection
        prompt={quesito}
        setPrompt={setQuesito}
        isProcessing={isProcessing}
      />
      <div className="flex flex-col-reverse gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-(--color-muted)" aria-label="Riepilogo parametri dell'indagine">
            <span className="font-semibold text-(--color-text)">Ricerca:</span>
            {riepilogoConfig.sourceInternalDB && <span className="inline-flex items-center gap-1.5"><Database size={12} /> Banca dati</span>}
            {riepilogoConfig.sourceWeb && <span className="inline-flex items-center gap-1.5"><Globe size={12} /> Web</span>}
            <span>{documentiAllegatiCount ?? 0} documenti allegati</span>
            <span>Soglia di pertinenza {riepilogoConfig.confidenceLevel}%</span>
          </div>
          <button
            type="button"
            onClick={handleCtaClick}
            disabled={!quesito.trim() || isProcessing || localLoading}
            className="flex items-center gap-2 px-6 py-3 bg-(--color-text) text-(--color-surface) rounded-md text-xs font-bold uppercase tracking-widest disabled:opacity-50 cursor-pointer"
          >
            <Search size={14} /> 
            {localLoading || isProcessing ? "Elaborazione..." : "Costruisci Mappa Dialettica"}
          </button>
      </div>
    </div>
  );
};