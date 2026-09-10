// src/features/deep-analysis/components/FontiOrientamentoSwitch.tsx

import React, { useState } from "react";
import { ShieldCheck, ShieldAlert, Layers } from "lucide-react";
import type { OrientamentoDialettico, PrecedenteReperito } from "../hooks/types";
import { PrecedenteCard } from "./PrecedenteCard";

interface Props {
  orientamentoFavorevole?: OrientamentoDialettico | null;
  orientamentoContrario?: OrientamentoDialettico | null;
  onToggleEsclusione: (id: string, escluso: boolean) => void;
}

// Funzione di utilità per verificare la validità di una fonte ed escludere ID corrotti o non reperiti
const isFonteValida = (fonte: PrecedenteReperito) => {
  if (!fonte || !fonte.id) return false;

  const idStr = String(fonte.id).trim();
  // Doppio cast per soddisfare il type checker senza allentare la type safety globale
  const anyFonte = fonte as unknown as Record<string, unknown>;

  const testoDescrittivo = [
    idStr,
    typeof anyFonte.titolo === "string" ? anyFonte.titolo : "",
    typeof anyFonte.estremi === "string" ? anyFonte.estremi : "",
    typeof anyFonte.descrizione === "string" ? anyFonte.descrizione : "",
    typeof anyFonte.sintesi === "string" ? anyFonte.sintesi : "",
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  // Scarta se l'oggetto indica esplicitamente che il precedente non è stato trovato
  if (
    testoDescrittivo.includes("non trovato") ||
    testoDescrittivo.includes("not found") ||
    Boolean(anyFonte.notFound) ||
    Boolean(anyFonte.error)
  ) {
    console.warn(`[Filtro UI] Scartata fonte non reperita: ${idStr}`);
    return false;
  }

  if (fonte.fonte === "web") {
    try {
      new URL(fonte.id);
      return true;
    } catch {
      return false;
    }
  }

  // Scarta formati ID anomali (slash, due punti, spazi o stringhe incomplete)
  if (
    idStr.includes("/") ||
    idStr.includes(":") ||
    idStr.includes(" ") ||
    idStr.length < 5
  ) {
    console.warn(`[Filtro UI] Scartata visualizzazione fonte con ID non valido: ${idStr}`);
    return false;
  }

  return true;
};

export const FontiOrientamentoSwitch: React.FC<Props> = ({
  orientamentoFavorevole,
  orientamentoContrario,
  onToggleEsclusione,
}) => {
  const fontiFav = (orientamentoFavorevole?.fonti || []).filter(isFonteValida);
  const fontiCont = (orientamentoContrario?.fonti || []).filter(isFonteValida);

  const favAttive = fontiFav.filter((p) => !p.escluso).length;
  const contAttive = fontiCont.filter((p: PrecedenteReperito) => !p.escluso).length;

  const [tab, setTab] = useState<"favorevole" | "contrario">("favorevole");

  return (
    <div className="bg-(--color-surface) border border-(--color-border) rounded-xl p-4 sm:p-6 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-(--color-border)">
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-(--color-muted)" />
          <h4 className="text-xs font-bold uppercase tracking-widest text-(--color-text)">
            Esplora Fonti e Precedenti
          </h4>
        </div>

        {/* SWITCH / TABS PER COMMUTARE TRA A E B */}
        <div className="flex items-center bg-(--color-bg) p-1 rounded-lg border border-(--color-border)">
          <button
            type="button"
            onClick={() => setTab("favorevole")}
            className={`flex-1 sm:flex-none flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition cursor-pointer ${
              tab === "favorevole"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-(--color-muted) hover:text-(--color-text)"
            }`}
          >
            <ShieldCheck size={14} />
            Favorevoli ({favAttive}/{fontiFav.length})
          </button>

          <button
            type="button"
            onClick={() => setTab("contrario")}
            className={`flex-1 sm:flex-none flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition cursor-pointer ${
              tab === "contrario"
                ? "bg-amber-600 text-white shadow-xs"
                : "text-(--color-muted) hover:text-(--color-text)"
            }`}
          >
            <ShieldAlert size={14} />
            Contrarie ({contAttive}/{fontiCont.length})
          </button>
        </div>
      </div>

      {/* LISTA FAVOREVOLI */}
      <div className={`space-y-3 ${tab === "favorevole" ? "block" : "hidden"}`}>
        {fontiFav.length === 0 ? (
          <p className="text-xs text-(--color-muted) italic py-6 text-center">
            Nessuna fonte favorevole disponibile o valida.
          </p>
        ) : (
          fontiFav.map((fonte: PrecedenteReperito) => (
            <PrecedenteCard
              key={fonte.id}
              precedente={fonte}
              onToggleEsclusione={onToggleEsclusione}
            />
          ))
        )}
      </div>

      {/* LISTA CONTRARIE */}
      <div className={`space-y-3 ${tab === "contrario" ? "block" : "hidden"}`}>
        {fontiCont.length === 0 ? (
          <p className="text-xs text-(--color-muted) italic py-6 text-center">
            Nessuna fonte contraria disponibile o valida.
          </p>
        ) : (
          fontiCont.map((fonte: PrecedenteReperito) => (
            <PrecedenteCard
              key={fonte.id}
              precedente={fonte}
              onToggleEsclusione={onToggleEsclusione}
            />
          ))
        )}
      </div>
    </div>
  );
};