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
    <div className="flex shrink-0 items-center justify-between border-b border-(--color-border) bg-(--color-surface) px-4 py-4 sm:px-8 lg:px-16">
      <div className="group flex min-w-0 items-center gap-2">
        {isEditingTitle && activeSession ? (
          <input
            autoFocus
            className="truncate border-b border-(--color-text) bg-transparent text-base font-medium outline-none sm:text-lg"
            style={{ fontFamily: "var(--font-serif)" }}
            value={titoloEditabile}
            onChange={(e) => setTitoloLocale(e.target.value)}
            onBlur={handleSalvaTitolo}
            onKeyDown={(e) => e.key === "Enter" && handleSalvaTitolo()}
          />
        ) : (
          <h1
            role={activeSession ? "button" : undefined}
            tabIndex={activeSession ? 0 : undefined}
            onClick={() => activeSession && setIsEditingTitle(true)}
            onKeyDown={(e) => {
              if (activeSession && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                setIsEditingTitle(true);
              }
            }}
            className={[
              "truncate text-base font-medium tracking-tight sm:text-lg",
              activeSession
                ? "cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-(--color-text)"
                : "",
            ].join(" ")}
            style={{ fontFamily: "var(--font-serif)" }}
          >
            <em>{titoloEditabile}</em>
          </h1>
        )}
        {!isEditingTitle && activeSession && (
          <button
            type="button"
            onClick={() => setIsEditingTitle(true)}
            aria-label="Modifica titolo"
            className="shrink-0 cursor-pointer rounded-sm text-(--color-muted) opacity-0 outline-none transition-opacity hover:text-(--color-text) focus:opacity-100 focus-visible:ring-2 focus-visible:ring-(--color-text) group-hover:opacity-100"
          >
            <Edit2 size={12} />
          </button>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-(--color-muted)">
        {isProcessing ? (
          <span className="flex items-center gap-1.5 text-blue-500">
            <Loader2 size={12} className="animate-spin" /> Elaborazione Mappa...
          </span>
        ) : activeSession?.status === "draft" ? (
          <span>Impostazione</span>
        ) : activeSession?.status === "review" ? (
          <span className="text-orange-500">Revisione Mappa</span>
        ) : activeSession?.status === "completed" ? (
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle2 size={12} /> Completata
          </span>
        ) : (
          <span>Nuova</span>
        )}
      </div>
    </div>
  );
};