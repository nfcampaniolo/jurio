import React from "react";
import { FaBook, FaFileAlt, FaCalendarAlt, FaUser, FaEuroSign } from "react-icons/fa";
import type { Sentenza, Ordinanza, Decreto, DocumentoGiurisprudenzaGenerico } from "@/interfaces/interfaces";

interface MassimaHeaderProps {
  result: Sentenza | Ordinanza | Decreto | DocumentoGiurisprudenzaGenerico;
  isGenerico: boolean;
  docGenerico: DocumentoGiurisprudenzaGenerico | null;
}

export const MassimaHeader: React.FC<MassimaHeaderProps> = ({ result, isGenerico, docGenerico }) => {
  return (
    <div className="relative border-b border-(--color-border) pb-5">
      {/* LA LINEA DI RIGORE SUPERIORE (Unico tocco di colore) */}

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm mt-1">
        
        {/* Organo + Sezione / Sottotipo Documento */}
        <div className="flex flex-wrap items-center gap-2 font-medium text-(--color-text)">
          {isGenerico && docGenerico?.sottotipo_documento ? (
            <span className="flex items-center gap-2 uppercase tracking-widest text-xs font-bold text-(--color-text)">
              <FaFileAlt className="opacity-70" />
              {docGenerico.sottotipo_documento}
            </span>
          ) : result.organo_giudicante ? (
            <span 
              className="flex items-center gap-2 font-bold text-base tracking-tight"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              <FaBook className="text-(--color-text) opacity-70" size={14} />
              {result.organo_giudicante}
            </span>
          ) : null}

          {result.sezione && (
            <span className="text-(--color-muted) font-light">
              &bull; {result.sezione}
            </span>
          )}
        </div>

        {/* Metadati */}
        <div className="flex flex-wrap items-center gap-2 text-(--color-muted) text-xs">
          {result.numero_sentenza && (
            <span className="px-2.5 py-1 rounded-sm bg-(--color-bg) border border-(--color-border) font-semibold text-(--color-text)">
              n. {result.numero_sentenza}
            </span>
          )}
          {result.data_sentenza && (
            <span className="px-2.5 py-1 rounded-sm bg-(--color-bg) border border-(--color-border) font-light">
              {result.data_sentenza}
            </span>
          )}
          {result.grado_giudizio && (
            <span className="px-2.5 py-1 rounded-sm bg-(--color-bg) border border-(--color-border) uppercase tracking-wider font-bold text-[10px]">
              {result.grado_giudizio}
            </span>
          )}
          {result.ecli && (
            <span className="px-2.5 py-1 rounded-sm bg-(--color-bg) border border-(--color-border) font-mono text-[10px] opacity-90">
              {result.ecli}
            </span>
          )}

          {docGenerico?.data_riferimento_documento && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-(--color-bg) border border-(--color-border) font-light">
              <FaCalendarAlt className="text-[10px] opacity-70" /> 
              {docGenerico.data_riferimento_documento instanceof Date 
                ? docGenerico.data_riferimento_documento.toLocaleDateString('it-IT') 
                : String(docGenerico.data_riferimento_documento)}
            </span>
          )}
          {docGenerico?.mittente && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-(--color-bg) border border-(--color-border) font-light">
              <FaUser className="text-[10px] opacity-70" /> Da: {docGenerico.mittente}
            </span>
          )}
          {docGenerico?.destinatario && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-(--color-bg) border border-(--color-border) font-light">
              <FaUser className="text-[10px] opacity-70" /> A: {docGenerico.destinatario}
            </span>
          )}
          {docGenerico?.importo !== undefined && docGenerico?.importo !== null && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-(--color-bg) border border-(--color-border) text-(--color-text) font-bold">
              <FaEuroSign className="text-[10px] opacity-70" /> {docGenerico.importo.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};