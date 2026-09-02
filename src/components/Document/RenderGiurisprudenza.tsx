import React from "react";
import { 
  FaGavel, 
  FaParagraph, 
  FaBalanceScale, 
  FaLink, 
  FaListUl, 
  FaLightbulb, 
  FaStickyNote, 
  FaAlignLeft, 
  FaBullseye, 
  FaCheckDouble
} from "react-icons/fa";
import { RelatedDocuments } from "@/components/Document/LinkedSentences";
import { SectionTitle, SectionText, SectionContainer } from "./SharedUI";
import CitationTree from "@/components/Document/CitationGraph"; // Assicurati che il path sia corretto

// Definiamo un'interfaccia unificata per i dati in ingresso
export interface GiurisprudenzaData {
  tipo_documento?: string;
  organo_giudicante?: string; // Aggiunto per il nodo radice del grafo
  numero_sentenza?: string;   // Aggiunto per il nodo radice del grafo
  sintesi?: string;
  fattispecie_rilevante?: string;
  fatti?: string;
  materia?: string;
  sottocategoria?: string[];
  questione_di_diritto?: string;
  nucleo?: string;
  conclusioni?: string;
  massima?: string;
  tipo_massima?: string;
  ratio_decidendi?: string;
  obiter_dicta?: string;
  riferimenti_normativi?: string[];
  precedenti_richiamati?: string[];
  sources?: string[];
  fonte?: string;
  logo_fonte?: string;
}

interface RenderGiurisprudenzaProps {
  data: GiurisprudenzaData;
  share?: boolean;
  uid?: string;
  id?: string;
}

export const RenderGiurisprudenza: React.FC<RenderGiurisprudenzaProps> = ({ data, share, id = "" }) => {
  const isGenerico = data.tipo_documento === "documento_giurisprudenza_generico";

  const tipoMassimaLabels: Record<string, string> = {
    conforme: "Conforme",
    difforme: "Difforme",
    principio_nuovo: "Principio Nuovo",
    di_specie: "Di Specie",
    con_fattispecie: "Con Fattispecie",
    non_massimabile: "Non Massimabile",
  };

  const renderList = (items: string[]) => (
    <ul className="list-disc list-inside text-sm md:text-base text-(--color-muted) font-light space-y-1">
      {items.map((item, idx) => (
        <li key={idx}>{item}</li>
      ))}
    </ul>
  );

  return (
    <div className="space-y-6">
      
      {/* Sintesi (Documenti Generici) */}
      {data.sintesi && (
        <SectionContainer className="border-t-0 pt-0">
          <SectionTitle icon={FaAlignLeft} title="Sintesi Documento" />
          <SectionText>{data.sintesi}</SectionText>
        </SectionContainer>
      )}

      {/* Fatti / Fattispecie */}
      {(data.fattispecie_rilevante || data.fatti) && (
        <SectionContainer className={isGenerico && !data.sintesi ? "border-t-0 pt-0" : ""}>
          <SectionTitle 
            icon={FaBalanceScale} 
            title={isGenerico ? "Esposizione dei Fatti" : "Fattispecie"} 
            subtitle={data.materia ? <span>&bull; <strong className="font-semibold text-(--color-text)">{data.materia}</strong></span> : undefined}
          />
          <SectionText>{data.fattispecie_rilevante || data.fatti}</SectionText>
          {Array.isArray(data.sottocategoria) && data.sottocategoria.length > 0 && (
            <p className="text-xs text-(--color-muted) font-light mt-2 italic">
              {data.sottocategoria.join(", ")}
            </p>
          )}
        </SectionContainer>
      )}

      {/* Nucleo / Questione di Diritto */}
      {(data.questione_di_diritto || data.nucleo) && (
        <SectionContainer>
          <SectionTitle 
            icon={isGenerico ? FaBullseye : FaParagraph} 
            title={isGenerico ? "Nucleo / Merito" : "Questione di diritto"} 
          />
          <SectionText>{data.questione_di_diritto || data.nucleo}</SectionText>
        </SectionContainer>
      )}

      {/* Conclusioni */}
      {data.conclusioni && (
        <SectionContainer>
          <SectionTitle icon={FaCheckDouble} title="Conclusioni / Richieste" />
          <SectionText>{data.conclusioni}</SectionText>
        </SectionContainer>
      )}

      {/* Massima (Solo per giurisprudenza) */}
      {!isGenerico && data.massima && (
        <SectionContainer>
          <SectionTitle 
            icon={FaGavel} 
            title={data.tipo_massima === 'non_massimabile' ? 'Sommario' : 'Massima'}
            subtitle={data.tipo_massima ? <span> &bull; <strong className="font-semibold text-(--color-text)">{tipoMassimaLabels[data.tipo_massima] || data.tipo_massima}</strong></span> : undefined}
          />
          <SectionText>{data.massima}</SectionText>
        </SectionContainer>
      )}

      {/* Ratio decidendi */}
      {data.ratio_decidendi && (
        <SectionContainer>
          <SectionTitle icon={FaLightbulb} title="Ratio decidendi" />
          <SectionText>{data.ratio_decidendi}</SectionText>
        </SectionContainer>
      )}

      {/* Obiter dicta */}
      {data.obiter_dicta && (
        <SectionContainer>
          <SectionTitle icon={FaStickyNote} title="Obiter dicta" />
          <SectionText>{data.obiter_dicta}</SectionText>
        </SectionContainer>
      )}

      {/* Riferimenti Normativi e Precedenti */}
      {((data.riferimenti_normativi && data.riferimenti_normativi.length > 0) || (data.precedenti_richiamati && data.precedenti_richiamati.length > 0)) && (
        <SectionContainer>
          {/* Riferimenti Normativi */}
          {data.riferimenti_normativi && data.riferimenti_normativi.length > 0 && (
            <div className={data.precedenti_richiamati && data.precedenti_richiamati.length > 0 ? "mb-6" : ""}>
              <SectionTitle icon={FaListUl} title="Riferimenti Normativi" />
              {renderList(data.riferimenti_normativi)}
            </div>
          )}
          
          {/* Precedenti Richiamati + Grafo delle Citazioni */}
          {data.precedenti_richiamati && data.precedenti_richiamati.length > 0 && (
            <div className="space-y-6">
              <div>
                <SectionTitle icon={FaListUl} title="Precedenti Richiamati" />
                <div className="pt-4 border-t border-(--color-border)/30">
                <CitationTree precedenti={data.precedenti_richiamati} />
              </div>
              </div>
            </div>
          )}
        </SectionContainer>
      )}

      {/* Fonti Aggiuntive */}
      {data.sources && data.sources.length > 0 && (
        <SectionContainer>
          <SectionTitle icon={FaLink} title="Fonti" />
          {renderList(data.sources)}
        </SectionContainer>
      )}

      {/* Fonte Logo e Link Esterno */}
      {(data.fonte || data.logo_fonte) && (
        <div className="flex items-end gap-2 pt-4 border-t border-(--color-border)/50 mt-6">
          {data.logo_fonte && (
            data.logo_fonte.startsWith("http") ? (
              <img src={data.logo_fonte} alt={data.fonte ?? "fonte"} className="h-4 w-auto grayscale opacity-70" />
            ) : (
              <span className="text-xs text-(--color-muted) font-light">{data.logo_fonte}</span>
            )
          )}
          {data.fonte && (
            data.fonte.startsWith("http") ? (
              <a href={data.fonte} target="_blank" rel="noopener noreferrer" className="text-xs text-(--color-muted) underline hover:text-(--color-text) transition-colors">
                {data.fonte}
              </a>
            ) : (
              <span className="text-xs text-(--color-muted) font-light">{data.fonte}</span>
            )
          )}
        </div>
      )}

      {/* Documenti Correlati (Semantic Search) */}
      {share && !isGenerico && data.massima && (
        <SectionContainer className="mt-6">
          <SectionTitle icon={FaLink} title="Documenti Correlati" />
          <div className="mt-4">
            <RelatedDocuments uid={id} massima={data.massima} riferimentiNormativi={data.riferimenti_normativi}/>
          </div>
        </SectionContainer>
      )}
      
    </div>
  );
};