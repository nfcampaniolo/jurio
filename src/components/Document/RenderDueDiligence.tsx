import React from "react";
import { FaShieldAlt, FaClipboardList, FaSearch, FaExclamationCircle, FaBalanceScale, FaExclamationTriangle } from "react-icons/fa";
import { SectionTitle, SectionText, SectionContainer } from "./SharedUI";

// INTERFACCE
export interface Diritto {
  titolare: string;
  descrizione: string;
  condizioni?: string;
  limiti?: string;
}

export interface Obbligo {
  soggetto_obbligato: string;
  descrizione: string;
  scadenza?: string;
  stato?: "adempiuto" | "inadempiuto" | "parzialmente_adempiuto" | "non_verificabile" | "non_applicabile" | "";
}

export interface RischioDueDiligence {
  titolo: string;
  descrizione: string;
  is_responsabilita_potenziale: boolean;
  soggetto_esposto: string;
  categoria: string;
  livello_rilevanza: "bassa" | "media" | "alta" | "critica";
  probabilita: "bassa" | "media" | "alta" | "non_determinabile";
  impatto: "basso" | "medio" | "alto" | "critico";
  priorita: "bassa" | "media" | "alta" | "urgente";
  riferimento: string;
  conseguenza_potenziale: string;
  azione_mitigation: string;
}

export interface AspettoDaVerificare {
  oggetto: string;
  motivazione: string;
  priorita: "bassa" | "media" | "alta" | "urgente";
  documentazione_necessaria?: string[];
  verifica_raccomandata: string;
}

export interface DueDiligenceData {
  oggetto_due_diligence?: string;
  summary?: string;
  diritti?: Diritto[];
  obblighi?: Obbligo[];
  rischi_giuridici?: RischioDueDiligence[];
  aspetti_da_verificare?: AspettoDaVerificare[];
}

export const RenderDueDiligence: React.FC<{ data: DueDiligenceData }> = ({ data }) => {
  return (
    <div className="space-y-6">
      {/* SUMMARY */}
      {data.summary && (
        <SectionContainer className="border-t-0 pt-0">
          <SectionTitle icon={FaShieldAlt} title="Sintesi Due Diligence" subtitle={data.oggetto_due_diligence ? `- ${data.oggetto_due_diligence}` : ""} />
          <SectionText>{data.summary}</SectionText>
        </SectionContainer>
      )}

      {/* DIRITTI E OBBLIGHI (Split in 2 colonne) */}
      {(data.diritti?.length || data.obblighi?.length) ? (
        <SectionContainer>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Colonna Diritti */}
            {data.diritti && data.diritti.length > 0 && (
              <div>
                <SectionTitle icon={FaBalanceScale} title="Diritti Principali" />
                <div className="space-y-3 mt-3">
                  {data.diritti.map((d, i) => (
                    <div key={i} className="p-3 bg-green-50/50 border border-green-100 rounded-md text-sm">
                      <strong className="text-green-800 uppercase text-xs">{d.titolare}</strong>
                      <p className="text-green-900/80 mt-1">{d.descrizione}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Colonna Obblighi */}
            {data.obblighi && data.obblighi.length > 0 && (
              <div>
                <SectionTitle icon={FaClipboardList} title="Obblighi e Adempimenti" />
                <div className="space-y-3 mt-3">
                  {data.obblighi.map((o, i) => (
                    <div key={i} className="p-3 bg-blue-50/50 border border-blue-100 rounded-md text-sm">
                      <div className="flex justify-between items-center">
                        <strong className="text-blue-800 uppercase text-xs">{o.soggetto_obbligato}</strong>
                        {o.stato && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            {o.stato.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                      <p className="text-blue-900/80 mt-1">{o.descrizione}</p>
                      {o.scadenza && <p className="text-xs text-blue-700 mt-2 font-medium">Scadenza: {o.scadenza}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </SectionContainer>
      ) : null}

      {/* RISCHI GIURIDICI E RESPONSABILITÀ */}
      {data.rischi_giuridici && data.rischi_giuridici.length > 0 && (
        <SectionContainer>
          <SectionTitle icon={FaExclamationTriangle} title="Rischi Giuridici e Responsabilità" />
          <div className="space-y-4 mt-4">
            {data.rischi_giuridici.map((rischio, i) => (
              <div key={i} className="p-4 bg-red-50/40 border-l-4 border-red-500 rounded-r-lg">
                <div className="flex justify-between items-start mb-1">
                  <h4 className="font-semibold text-sm text-red-900">{rischio.titolo}</h4>
                  {rischio.is_responsabilita_potenziale && (
                    <span className="text-[10px] uppercase font-bold bg-red-100 text-red-800 px-2 py-0.5 rounded">
                      Resp. Potenziale
                    </span>
                  )}
                </div>
                
                <p className="text-sm text-red-800/80 mb-3">{rischio.descrizione}</p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
                  <div className="bg-white p-2 border border-red-100 rounded shadow-sm text-xs">
                    <span className="block text-red-400 mb-0.5">Soggetto Esposto</span>
                    <strong className="text-red-700 truncate block" title={rischio.soggetto_esposto}>{rischio.soggetto_esposto}</strong>
                  </div>
                  <div className="bg-white p-2 border border-red-100 rounded shadow-sm text-xs">
                    <span className="block text-red-400 mb-0.5">Rilevanza</span>
                    <strong className="text-red-700 capitalize">{rischio.livello_rilevanza}</strong>
                  </div>
                  <div className="bg-white p-2 border border-red-100 rounded shadow-sm text-xs">
                    <span className="block text-red-400 mb-0.5">Impatto</span>
                    <strong className="text-red-700 capitalize">{rischio.impatto}</strong>
                  </div>
                  <div className="bg-white p-2 border border-red-100 rounded shadow-sm text-xs">
                    <span className="block text-red-400 mb-0.5">Priorità</span>
                    <strong className="text-red-700 capitalize">{rischio.priorita}</strong>
                  </div>
                </div>

                {rischio.azione_mitigation && (
                  <div className="text-xs bg-red-100/50 p-2 rounded text-red-900 font-medium flex items-center gap-2">
                    <span>Mitigazione:</span>
                    <span>{rischio.azione_mitigation}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionContainer>
      )}

      {/* ASPETTI DA VERIFICARE */}
      {data.aspetti_da_verificare && data.aspetti_da_verificare.length > 0 && (
        <SectionContainer>
          <SectionTitle icon={FaSearch} title="Checklist: Aspetti da Verificare" />
          <div className="space-y-3 mt-4">
            {data.aspetti_da_verificare.map((v, i) => (
              <div key={i} className="flex gap-4 p-4 bg-yellow-50/50 border-l-4 border-yellow-400 rounded-r-md">
                <FaExclamationCircle className="text-yellow-500 mt-0.5 shrink-0" />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-sm font-semibold text-yellow-900">{v.oggetto}</h4>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${
                      v.priorita === 'urgente' || v.priorita === 'alta' ? 'bg-orange-200 text-orange-800' : 'bg-yellow-200 text-yellow-800'
                    }`}>
                      {v.priorita}
                    </span>
                  </div>
                  <p className="text-xs text-yellow-800/80 mb-2">{v.motivazione}</p>
                  
                  {v.documentazione_necessaria && v.documentazione_necessaria.length > 0 && (
                    <div className="mb-2">
                      <span className="text-[10px] uppercase font-bold text-yellow-600 block mb-0.5">Doc. Necessaria:</span>
                      <ul className="list-disc list-inside text-xs text-yellow-800/80">
                        {v.documentazione_necessaria.map((doc, docIdx) => (
                          <li key={docIdx}>{doc}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="text-xs font-medium text-yellow-700 bg-yellow-100/50 p-1.5 rounded inline-block">
                    Azione: {v.verifica_raccomandata}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </SectionContainer>
      )}
    </div>
  );
};