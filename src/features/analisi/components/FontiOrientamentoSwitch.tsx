// src/features/deep-analysis/components/FontiOrientamentoSwitch.tsx

import React, { useState } from "react";
import { ShieldCheck, ShieldAlert, Layers, Search } from "lucide-react";
import type { OrientamentoDialettico, PrecedenteReperito } from "../hooks/types";
import { PrecedenteCard } from "./PrecedenteCard";

interface Props {
  orientamentoFavorevole?: OrientamentoDialettico | null;
  orientamentoContrario?: OrientamentoDialettico | null;
  onToggleEsclusione: (id: string, escluso: boolean) => void;
  nodiMappa?: { id: string; sourceId?: string | null }[];
}

// Funzione di utilità per verificare la validità di una fonte ed escludere ID corrotti o non reperiti
const isFonteValida = (fonte: PrecedenteReperito) => {
  if (!fonte || !fonte.id) return false;

  const idStr = String(fonte.id).trim();
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
    return false;
  }

  return true;
};

export const FontiOrientamentoSwitch: React.FC<Props> = ({
  orientamentoFavorevole,
  orientamentoContrario,
  onToggleEsclusione,
  nodiMappa,
}) => {
  // Sessioni precedenti possono contenere l'id del nodo (prov_xxx) invece di quello del provvedimento
  const idDocumento = (id: string) =>
    nodiMappa?.find((n) => n.id === id && n.sourceId)?.sourceId ?? id;
  const fontiFav = (orientamentoFavorevole?.fonti || []).filter(isFonteValida);
  const fontiCont = (orientamentoContrario?.fonti || []).filter(isFonteValida);

  const favAttive = fontiFav.filter((p) => !p.escluso).length;
  const contAttive = fontiCont.filter((p: PrecedenteReperito) => !p.escluso).length;

  const [tab, setTab] = useState<"favorevole" | "contrario">("favorevole");
  const [searchText, setSearchText] = useState("");
  const [sortBy, setSortBy] = useState<"pertinenza" | "anno">("pertinenza");

  const filterAndSort = (fonti: PrecedenteReperito[]) => {
    const normalizedSearch = searchText.trim().toLocaleLowerCase("it");
    return fonti
      .filter((fonte) => {
        if (!normalizedSearch) return true;
        return [
          fonte.id,
          fonte.organo,
          fonte.numeroProvvedimento,
          fonte.anno?.toString(),
          fonte.massimaUfficiale,
        ].some((field) => field?.toLocaleLowerCase("it").includes(normalizedSearch));
      })
      .sort((first, second) => sortBy === "anno"
        ? (second.anno ?? 0) - (first.anno ?? 0)
        : second.gradoPertinenza - first.gradoPertinenza);
  };
  const fontiFavVisibili = filterAndSort(fontiFav);
  const fontiContVisibili = filterAndSort(fontiCont);

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

      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="relative flex-1">
          <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-(--color-muted)" />
          <input
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Cerca per organo, estremi o massima"
            aria-label="Cerca tra i precedenti"
            className="w-full rounded-md border border-(--color-border) bg-(--color-bg) py-2 pl-9 pr-3 text-xs outline-none focus:border-(--color-text)"
          />
        </label>
        <label className="flex items-center gap-2 text-[11px] text-(--color-muted)">
          Ordina per
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value as "pertinenza" | "anno")}
            className="rounded-md border border-(--color-border) bg-(--color-bg) px-2 py-2 text-xs text-(--color-text) outline-none focus:border-(--color-text)"
          >
            <option value="pertinenza">Pertinenza</option>
            <option value="anno">Anno più recente</option>
          </select>
        </label>
      </div>

      {/* LISTA FAVOREVOLI */}
      <div className={`space-y-3 ${tab === "favorevole" ? "block" : "hidden"}`}>
        {fontiFav.length === 0 ? (
          <p className="text-xs text-(--color-muted) italic py-6 text-center">
            Nessuna fonte favorevole disponibile o valida.
          </p>
        ) : fontiFavVisibili.length === 0 ? (
          <p className="text-xs text-(--color-muted) italic py-6 text-center">Nessun precedente corrisponde alla ricerca.</p>
        ) : (
          fontiFavVisibili.map((fonte: PrecedenteReperito) => (
            <PrecedenteCard
              key={fonte.id}
              precedente={fonte}
              documentoId={idDocumento(fonte.id)}
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
        ) : fontiContVisibili.length === 0 ? (
          <p className="text-xs text-(--color-muted) italic py-6 text-center">Nessun precedente corrisponde alla ricerca.</p>
        ) : (
          fontiContVisibili.map((fonte: PrecedenteReperito) => (
            <PrecedenteCard
              key={fonte.id}
              precedente={fonte}
              documentoId={idDocumento(fonte.id)}
              onToggleEsclusione={onToggleEsclusione}
            />
          ))
        )}
      </div>
    </div>
  );
};