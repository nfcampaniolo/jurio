import React, {useState} from "react";
import { Search } from "lucide-react";
import { AnalysisPromptSection } from "./AnalysisPromptSection";

interface Props {
  quesito: string;
  setQuesito: (val: string) => void;
  isProcessing: boolean;
  onEseguiRicerca: () => void;
}

export const DraftPhase: React.FC<Props> = ({
  quesito,
  setQuesito,
  isProcessing,
  onEseguiRicerca,
}) => {
  const [localLoading, setLocalLoading] = useState(false);

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
      <div className="flex justify-end">
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