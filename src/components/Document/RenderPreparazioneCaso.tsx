import React from "react";
import { FaChessKnight, FaBullseye, FaFistRaised, FaHeartBroken, FaCalendarCheck } from "react-icons/fa";
import { SectionTitle, SectionText, SectionContainer } from "./SharedUI";

// INTERFACCE
export interface Fatto {
  evento: string;
  data?: string;
  accertato: boolean;
  rilevanza: string;
}

export interface SwotItem {
  titolo: string;
  descrizione: string;
  fondamento: string;
}

export interface AzioneSuccessiva {
  azione: string;
  obiettivo: string;
  priorita: string;
  termine?: string;
}

export interface PreparazioneCasoData {
  oggetto_caso?: string;
  obiettivo_processuale?: string;
  stato_del_caso?: string;
  summary?: string;
  fatti?: Fatto[];
  punti_forza?: SwotItem[];
  punti_debolezza?: SwotItem[];
  azioni_successive?: AzioneSuccessiva[];
}

export const RenderPreparazioneCaso: React.FC<{ data: PreparazioneCasoData }> = ({ data }) => {
  return (
    <div className="space-y-6">
      {/* SUMMARY E STRATEGIA */}
      <SectionContainer className="border-t-0 pt-0">
        <SectionTitle icon={FaChessKnight} title="Inquadramento Strategico" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="p-3 bg-(--color-surface-variant) rounded-md border border-(--color-border)">
            <span className="text-xs text-(--color-muted) uppercase tracking-wider block mb-1">Obiettivo</span>
            <p className="text-sm font-medium text-(--color-text)">{data.obiettivo_processuale || "Non definito"}</p>
          </div>
          <div className="p-3 bg-(--color-surface-variant) rounded-md border border-(--color-border)">
            <span className="text-xs text-(--color-muted) uppercase tracking-wider block mb-1">Stato Attuale</span>
            <p className="text-sm font-medium text-(--color-text)">{data.stato_del_caso || "Non definito"}</p>
          </div>
        </div>
        {data.summary && <SectionText>{data.summary}</SectionText>}
      </SectionContainer>

      {/* SWOT ANALYSIS: FORZA VS DEBOLEZZA */}
      {(data.punti_forza?.length || data.punti_debolezza?.length) ? (
        <SectionContainer>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {data.punti_forza && data.punti_forza.length > 0 && (
              <div>
                <SectionTitle icon={FaFistRaised} title="Punti di Forza" />
                <ul className="space-y-3 mt-3">
                  {data.punti_forza.map((p, i) => (
                    <li key={i} className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-md">
                      <strong className="text-emerald-800 text-sm block">{p.titolo}</strong>
                      <span className="text-emerald-700/80 text-xs mt-1 block">{p.descrizione}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {data.punti_debolezza && data.punti_debolezza.length > 0 && (
              <div>
                <SectionTitle icon={FaHeartBroken} title="Vulnerabilità" />
                <ul className="space-y-3 mt-3">
                  {data.punti_debolezza.map((p, i) => (
                    <li key={i} className="p-3 bg-red-50/50 border border-red-100 rounded-md">
                      <strong className="text-red-800 text-sm block">{p.titolo}</strong>
                      <span className="text-red-700/80 text-xs mt-1 block">{p.descrizione}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </SectionContainer>
      ) : null}

      {/* TIMELINE FATTI */}
      {data.fatti && data.fatti.length > 0 && (
        <SectionContainer>
          <SectionTitle icon={FaCalendarCheck} title="Timeline Fatti Rilevanti" />
          <div className="space-y-2 mt-4 pl-2 border-l-2 border-(--color-border)">
            {data.fatti.map((f, i) => (
              <div key={i} className="relative pl-4 pb-4">
                {/* Pallino timeline */}
                <div className={`absolute -left-1.25 top-1.5 w-2 h-2 rounded-full ${f.accertato ? 'bg-green-500' : 'bg-gray-300'}`} />
                <div className="flex items-center gap-2 mb-1">
                  {f.data && <span className="text-xs font-bold text-(--color-muted)">{f.data}</span>}
                  {!f.accertato && <span className="text-[9px] uppercase px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">Allegazione</span>}
                </div>
                <p className="text-sm text-(--color-text)">{f.evento}</p>
              </div>
            ))}
          </div>
        </SectionContainer>
      )}

      {/* AZIONI SUCCESSIVE */}
      {data.azioni_successive && data.azioni_successive.length > 0 && (
        <SectionContainer>
          <SectionTitle icon={FaBullseye} title="To-Do: Azioni Successive" />
          <div className="space-y-3 mt-4">
            {data.azioni_successive.map((azione, i) => (
              <div key={i} className="flex justify-between items-center p-3 bg-(--color-surface-variant) rounded border border-(--color-border)">
                <div>
                  <h4 className="text-sm font-semibold text-(--color-text)">{azione.azione}</h4>
                  <p className="text-xs text-(--color-muted) mt-0.5">{azione.obiettivo}</p>
                </div>
                {azione.termine && <span className="text-xs font-mono bg-white px-2 py-1 border border-gray-200 rounded">Entro: {azione.termine}</span>}
              </div>
            ))}
          </div>
        </SectionContainer>
      )}
    </div>
  );
};