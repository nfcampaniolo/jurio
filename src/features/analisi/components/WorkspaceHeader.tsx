import React from "react";
import { Edit2, Loader2, CheckCircle2 } from "lucide-react";
import type { DeepAnalysisSession } from "../hooks/types";

interface Props {
  activeSession: DeepAnalysisSession | null;
  titoloEditabile: string;
  isEditingTitle: boolean;
  setIsEditingTitle: (val: boolean) => void;
  setTitoloLocale: (val: string) => void;
  handleSalvaTitolo: () => void;
  isProcessing: boolean;
}

export const WorkspaceHeader: React.FC<Props> = ({
  activeSession,
  titoloEditabile,
  isEditingTitle,
  setIsEditingTitle,
  setTitoloLocale,
  handleSalvaTitolo,
  isProcessing,
}) => {
  return (
    <div className="shrink-0 border-b border-(--color-border) bg-(--color-surface) px-4 sm:px-8 lg:px-16 py-4 flex items-center justify-between">
      <div className="flex items-center gap-2 group min-w-0">
        {isEditingTitle && activeSession ? (
          <input
            autoFocus
            className="text-base sm:text-lg font-medium bg-transparent border-b border-(--color-text) outline-none truncate"
            style={{ fontFamily: "var(--font-serif)" }}
            value={titoloEditabile}
            onChange={(e) => setTitoloLocale(e.target.value)}
            onBlur={handleSalvaTitolo}
            onKeyDown={(e) => e.key === "Enter" && handleSalvaTitolo()}
          />
        ) : (
          <h1
            onClick={() => activeSession && setIsEditingTitle(true)}
            className={`text-base sm:text-lg font-medium tracking-tight truncate ${
              activeSession ? "cursor-pointer" : ""
            }`}
            style={{ fontFamily: "var(--font-serif)" }}
          >
            <em>{titoloEditabile}</em>
          </h1>
        )}
        {!isEditingTitle && activeSession && (
          <Edit2
            size={12}
            className="text-(--color-muted) opacity-0 group-hover:opacity-100 cursor-pointer shrink-0"
            onClick={() => setIsEditingTitle(true)}
          />
        )}
      </div>

      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-(--color-muted) shrink-0">
        {isProcessing ? (
          <span className="flex items-center gap-1.5 text-blue-500">
            <Loader2 size={12} className="animate-spin" /> Elaborazione Mappa...
          </span>
        ) : activeSession?.status === "draft" ? (
          <span>Impostazione</span>
        ) : activeSession?.status === "review" ? (
          <span className="text-orange-500">Revisione Mappa</span>
        ) : activeSession?.status === "completed" ? (
          <span className="text-green-600 flex items-center gap-1">
            <CheckCircle2 size={12} /> Completata
          </span>
        ) : (
          <span>Nuova</span>
        )}
      </div>
    </div>
  );
};