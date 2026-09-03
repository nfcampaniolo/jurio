import React from "react";
import { MassimaHeader } from "./MassimaHeader";
import { PdfPreviewSidebar } from "./PdfPreviewSidebar";
import { RenderGiurisprudenza } from "./RenderGiurisprudenza";
import { RenderContratto } from "./RenderContratto";
import { RenderDueDiligence } from "./RenderDueDiligence";
import { RenderPreparazioneCaso } from "./RenderPreparazioneCaso";
import { RenderFallback } from "./RenderFallback";

// IMPORT INTERFACCE
import type { GiurisprudenzaData } from "./RenderGiurisprudenza";
import type { AnalisiContrattualeData } from "./RenderContratto";
import type { DueDiligenceData } from "./RenderDueDiligence";
import type { PreparazioneCasoData } from "./RenderPreparazioneCaso";
import type { Sentenza, Ordinanza, Decreto, DocumentoGiurisprudenzaGenerico } from "@/interfaces/interfaces";

// L'unione dei tipi ora è sicura
type JurioDocument = Sentenza | Ordinanza | Decreto | DocumentoGiurisprudenzaGenerico | Record<string, unknown>;

interface Props {
  result: JurioDocument;
  file?: string | null;
  share?: boolean;
  uid?: string;
  id?: string;
}

export const MassimaCard: React.FC<Props> = ({ result, file, share, uid = "", id = "" }) => {
  
  const getRenderer = () => {
    // 1. Render Contratto
    if ('obbligazioni' in result && 'corrispettivi' in result) {
      return <RenderContratto data={result as unknown as AnalisiContrattualeData} />;
    }

    // 2. Render Due Diligence
    // Il check su '!obbligazioni' serve a non confonderlo col contratto, visto che condividono alcuni concetti
    if ('diritti' in result && 'aspetti_da_verificare' in result && !('corrispettivi' in result)) {
      return <RenderDueDiligence data={result as unknown as DueDiligenceData} />;
    }

    // 3. Render Preparazione Caso (Litigation)
    if ('obiettivo_processuale' in result || 'punti_forza' in result) {
      return <RenderPreparazioneCaso data={result as unknown as PreparazioneCasoData} />;
    }
    
    // 4. Render Giurisprudenza (Sentenze, Ordinanze o Memorie Generiche)
    if ('ratio_decidendi' in result || 'massima' in result || result.tipo_documento === "documento_giurisprudenza_generico") {
      return <RenderGiurisprudenza data={result as unknown as GiurisprudenzaData} share={share} uid={uid} id={id} />;
    }
    
    // 5. Fallback generico (Protezione per JSON sconosciuti)
    return <RenderFallback data={result as Record<string, unknown>} />;
  };

  // Type assertion sicura per i metadati dell'Header e Sidebar
  const documentName = 'nome_file' in result ? (result.nome_file as string) : undefined;
  const isGenerico = result.tipo_documento === "documento_giurisprudenza_generico";

  return (
    <div className="flex flex-col lg:flex-row items-start gap-8 m-3">
      <div className="relative flex-1 min-w-0 w-full space-y-6 text-left sm:text-justify border border-(--color-border) rounded-lg p-6 sm:p-8 bg-(--color-surface) shadow-(--shadow-soft) overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

        <MassimaHeader 
          result={result as unknown as Sentenza} 
          isGenerico={isGenerico} 
          docGenerico={isGenerico ? (result as unknown as DocumentoGiurisprudenzaGenerico) : null} 
        />

        <div className="mt-6">
          {getRenderer()}
        </div>
      </div>

      {file && (documentName || 'organo_giudicante' in result) && (
        <PdfPreviewSidebar 
          file={file} 
          share={share} 
          uid={uid} 
          id={id} 
          nomeFile={documentName} 
        />
      )}
    </div>
  );
};