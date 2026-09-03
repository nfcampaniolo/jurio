import React from "react";
import { FaFileContract, FaExclamationTriangle, FaHandshake } from "react-icons/fa";
import { SectionTitle, SectionText, SectionContainer } from "./SharedUI";

// Aggiungi 'export' a queste interfacce
export interface Obbligazione {
  parte_obbligata: string;
  parte_beneficiaria: string;
  descrizione: string;
  rilevanza: "bassa" | "media" | "alta" | "critica";
  conseguenza_inadempimento?: string;
}

export interface RischioContrattuale {
  titolo: string;
  descrizione: string;
  impatto: "basso" | "medio" | "alto" | "critico";
  probabilita: "bassa" | "media" | "alta" | "non_determinabile";
  azione_raccomandata?: string;
}

export interface AnalisiContrattualeData {
  summary?: string;
  obbligazioni?: Obbligazione[];
  rischi_e_contenzioso?: RischioContrattuale[];
}

export const RenderContratto: React.FC<{ data: AnalisiContrattualeData }> = ({ data }) => {
  return (
    <div className="space-y-6">
      
      {data.summary && (
        <SectionContainer className="border-t-0 pt-0">
          <SectionTitle icon={FaFileContract} title="Sintesi Contrattuale" />
          <SectionText>{data.summary}</SectionText>
        </SectionContainer>
      )}

      {data.obbligazioni && data.obbligazioni.length > 0 && (
        <SectionContainer>
          <SectionTitle icon={FaHandshake} title="Obbligazioni Principali" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {data.obbligazioni.map((obb, idx) => (
              <div key={idx} className="p-4 bg-(--color-surface-variant) border border-(--color-border) rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-bold text-(--color-text) uppercase">{obb.parte_obbligata}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                    obb.rilevanza === 'critica' || obb.rilevanza === 'alta' ? 'bg-orange-100 text-orange-800' : 'bg-gray-100 text-gray-700'
                  }`}>
                    {obb.rilevanza}
                  </span>
                </div>
                <p className="text-sm text-(--color-muted) mb-3">{obb.descrizione}</p>
                {obb.conseguenza_inadempimento && (
                  <div className="text-xs bg-red-50 text-red-700 p-2 rounded">
                    <strong>In caso di inadempimento:</strong> {obb.conseguenza_inadempimento}
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionContainer>
      )}

      {data.rischi_e_contenzioso && data.rischi_e_contenzioso.length > 0 && (
        <SectionContainer>
          <SectionTitle icon={FaExclamationTriangle} title="Rischi e Profili di Contenzioso" />
          <div className="space-y-4 mt-4">
            {data.rischi_e_contenzioso.map((rischio, idx) => (
              <div key={idx} className="p-4 bg-red-50/40 border-l-4 border-red-500 rounded-r-lg">
                <h4 className="font-semibold text-sm text-red-900">{rischio.titolo}</h4>
                <p className="text-sm text-red-800/80 mt-1 mb-2">{rischio.descrizione}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="bg-white px-2 py-1 rounded border border-red-100 text-red-700 shadow-sm">
                    Impatto: <strong>{rischio.impatto}</strong>
                  </span>
                  <span className="bg-white px-2 py-1 rounded border border-red-100 text-red-700 shadow-sm">
                    Probabilità: <strong>{rischio.probabilita}</strong>
                  </span>
                </div>
                {rischio.azione_raccomandata && (
                  <p className="mt-3 text-xs text-red-900 font-medium flex items-center gap-1">
                    → {rischio.azione_raccomandata}
                  </p>
                )}
              </div>
            ))}
          </div>
        </SectionContainer>
      )}
    </div>
  );
};