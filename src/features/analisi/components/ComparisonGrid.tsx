import React, { useState } from "react";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import type { OrientamentoDialettico } from "../hooks/types";

interface Props {
  orientamentoFavorevole?: OrientamentoDialettico | null;
  orientamentoContrario?: OrientamentoDialettico | null;
  onApriHitlPreset: (preset: string) => void | Promise<void>;
  isProcessing: boolean;
}

export const ComparisonGrid: React.FC<Props> = ({
  orientamentoFavorevole,
  orientamentoContrario,
  onApriHitlPreset,
  isProcessing,
}) => {
  const [loadingType, setLoadingType] = useState<"favorevole" | "contrario" | null>(null);
  const handleAction = async (type: "favorevole" | "contrario", preset: string) => {
    if (loadingType || isProcessing) return;
    setLoadingType(type);
    try {
      await onApriHitlPreset(preset);
    } finally {
      setLoadingType(null);
    }
  };

  return (
    <div className="grid md:grid-cols-2 gap-6 items-start">
      {/* Colonna Favorevole */}
      <div className="bg-(--color-surface) border border-emerald-500/30 rounded-xl p-5 shadow-xs flex flex-col justify-between h-full">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-emerald-600">
            <ShieldCheck size={18} />
            <h4 className="text-xs font-bold uppercase tracking-widest">Orientamento Favorevole</h4>
          </div>
          {orientamentoFavorevole ? (
            <div className="space-y-2">
              <h5 className="text-sm font-semibold leading-snug" style={{ fontFamily: "var(--font-serif)" }}>
                {orientamentoFavorevole.titoloTesi}
              </h5>
              <p className="text-xs text-(--color-muted) leading-relaxed font-light">
                {orientamentoFavorevole.argomentazioneLogica}
              </p>
            </div>
          ) : (
            <p className="text-xs text-(--color-muted) italic">Nessun orientamento favorevole rilevato.</p>
          )}
        </div>
        <div className="mt-6 pt-4 border-t border-(--color-border)">
          <button
            onClick={() => handleAction("favorevole", "")}
            disabled={isProcessing || loadingType !== null}
            className="w-full py-2 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 rounded text-[10px] font-bold uppercase tracking-widest transition cursor-pointer disabled:opacity-50"
          >
            {loadingType === "favorevole" ? "Elaborazione..." : "Rafforza Tesi Favorevole"}
          </button>
        </div>
      </div>

      {/* Colonna Contraria */}
      <div className="bg-(--color-surface) border border-amber-500/30 rounded-xl p-5 shadow-xs flex flex-col justify-between h-full">
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-amber-600">
            <ShieldAlert size={18} />
            <h4 className="text-xs font-bold uppercase tracking-widest">Orientamento Contrario / Rischio</h4>
          </div>
          {orientamentoContrario ? (
            <div className="space-y-2">
              <h5 className="text-sm font-semibold leading-snug" style={{ fontFamily: "var(--font-serif)" }}>
                {orientamentoContrario.titoloTesi}
              </h5>
              <p className="text-xs text-(--color-muted) leading-relaxed font-light">
                {orientamentoContrario.argomentazioneLogica}
              </p>
            </div>
          ) : (
            <p className="text-xs text-(--color-muted) italic">Nessun orientamento contrario rilevato.</p>
          )}
        </div>
        <div className="mt-6 pt-4 border-t border-(--color-border)">
          <button
            onClick={() =>
              handleAction(
                "contrario",
                "Cerca precedenti o argomentazioni di distinguish per confutare e smontare la tesi contraria."
              )
            }
            disabled={isProcessing || loadingType !== null}
            className="w-full py-2 bg-amber-50 text-amber-800 hover:bg-amber-100 rounded text-[10px] font-bold uppercase tracking-widest transition cursor-pointer disabled:opacity-50"
          >
            {loadingType === "contrario" ? "Elaborazione..." : "Confuta Tesi Avversa"}
          </button>
        </div>
      </div>
    </div>
  );
};