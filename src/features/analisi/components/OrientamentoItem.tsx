// src/features/analisi/components/ReportSintesi/OrientamentoItem.tsx
import React from "react";
import { Gavel, Globe, ExternalLink } from "lucide-react";
import type { PrecedenteReperito } from "../hooks/types";
import { PrecedenteChip } from "./PrecedenteChip";

export interface MappedOrientamento {
  tipo: "Favorevole" | "Contrario";
  titoloTesi: string;
  argomentazioneLogica: string;
  fonti: PrecedenteReperito[];
}

interface Props {
  orientamento: MappedOrientamento;
}

export const OrientamentoItem: React.FC<Props> = ({ orientamento }) => {
  const isFav = orientamento.tipo === "Favorevole";
  const accentColor = isFav ? "border-emerald-500" : "border-amber-500";
  
  return (
    <div className={`pl-4 border-l-2 ${accentColor} space-y-3 print:border-gray-400`}>
      <div className="flex items-center gap-2">
        <Gavel size={13} className="text-(--color-muted) print:text-gray-500" />
        <span className={`text-[10px] font-bold uppercase tracking-widest ${isFav ? 'text-emerald-700 dark:text-emerald-400 print:text-black' : 'text-amber-700 dark:text-amber-400 print:text-black'}`}>
          Orientamento {orientamento.tipo}
        </span>
      </div>

      <p className="text-base font-medium leading-relaxed text-(--color-text) print:text-black" style={{ fontFamily: "var(--font-serif)" }}>
        {orientamento.titoloTesi}
      </p>

      <p className="text-xs font-light leading-relaxed text-(--color-muted) print:text-black">
        {orientamento.argomentazioneLogica}
      </p>

      {orientamento.fonti.length > 0 && (
        <div className="pt-2 print:hidden">
          <span className="mb-2 block text-[9px] font-bold uppercase tracking-widest text-(--color-muted)">
            Fonti giurisprudenziali correlate ({orientamento.fonti.length})
          </span>
          <div className="flex flex-wrap gap-1.5">
            {orientamento.fonti.map((f: PrecedenteReperito) => {
              if (f.fonte === "interna") {
                return <PrecedenteChip key={f.id} id={f.id} />;
              }

              let domain = "Fonte Web";
              try {
                domain = new URL(f.id).hostname.replace("www.", "");
              } catch (error: unknown){
                console.log(error)
              }
              return (
                <a
                  key={f.id}
                  href={f.id}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-(--color-border) bg-(--color-bg) px-2 py-0.5 text-[9px] font-medium text-(--color-muted) transition-colors hover:border-(--color-text) hover:text-(--color-text)"
                >
                  <Globe size={9} />
                  <span>{domain}</span>
                  <ExternalLink size={8} className="opacity-40 ml-0.5" />
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};