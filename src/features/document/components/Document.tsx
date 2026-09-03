import React, { useState } from "react";
import { Timestamp } from "firebase/firestore";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, TextQuote } from "lucide-react";
import type {
  Ordinanza,
  Decreto,
  DocumentoGiurisprudenziale
} from "@/interfaces/interfaces";

type Props = {
  documento: DocumentoGiurisprudenziale;
};

const isTimestamp = (v: unknown): v is Timestamp => {
  return (
    typeof v === "object" &&
    v !== null &&
    "toDate" in v &&
    typeof (v as { toDate?: unknown }).toDate === "function"
  );
};

const formatDate = (v: unknown): string => {
  if (!v) return "";
  if (isTimestamp(v)) return v.toDate().toLocaleDateString();
  if (typeof v === "string") {
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? v : d.toLocaleDateString();
  }
  if (v instanceof Date) return v.toLocaleDateString();
  return "";
};

const isDocumentoGiurisprudenza = (
  d: DocumentoGiurisprudenziale
): d is DocumentoGiurisprudenziale & { highlighted_preview?: string } => {
  return (
    "organo_giudicante" in d &&
    "massima" in d &&
    typeof (d as { organo_giudicante?: unknown }).organo_giudicante === "string" &&
    typeof (d as { massima?: unknown }).massima === "string"
  );
};

const isOrdinanza = (
  d: DocumentoGiurisprudenziale & { highlighted_preview?: string }
): d is Ordinanza & { highlighted_preview?: string } => d.tipo_documento === "ordinanza";

const isDecreto = (
  d: DocumentoGiurisprudenziale & { highlighted_preview?: string }
): d is Decreto & { highlighted_preview?: string } => d.tipo_documento === "decreto";

export const Document: React.FC<Props> = ({ documento }) => {
  const [showPreview, setShowPreview] = useState(false);

  const badge = documento.tipo_documento.replaceAll("_", " ").toUpperCase();
  const hasPreview = !!documento.highlighted_preview;

  const showFonte =
    "fonte" in documento &&
    ((typeof documento.fonte === "string" && documento.fonte.trim().length > 0) ||
      (typeof documento.logo_fonte === "string" && documento.logo_fonte.trim().length > 0));

  const isGiurisprudenza = isDocumentoGiurisprudenza(documento);

  const isCassazione = 
    isGiurisprudenza && 
    "organo_giudicante" in documento && 
    typeof documento.organo_giudicante === "string" && 
    documento.organo_giudicante.toUpperCase().includes("CASSAZIONE");

  const dataProvvedimento = isGiurisprudenza
    ? "data_sentenza" in documento && documento.data_sentenza
      ? formatDate(documento.data_sentenza)
      : "dataSentenza" in documento && (documento as { dataSentenza?: unknown }).dataSentenza
        ? formatDate((documento as { dataSentenza?: unknown }).dataSentenza)
        : ""
    : "";
  
  return (
    <div className="relative group rounded-lg border border-(--color-border) bg-(--color-surface) p-4 sm:p-6 text-start shadow-(--shadow-soft) overflow-hidden transition-all">
      
      {/* LA LINEA DI RIGORE SUPERIORE */}
      <div className="absolute top-0 left-0 right-0 h-0 bg-(--color-primary) opacity-0 group-hover:opacity-100 group-hover:h-1 transition-all duration-200 z-10" />

      {/* Header badges */}
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between mt-1">
        <span className="w-fit rounded-sm bg-(--color-bg) px-2.5 py-1 text-[10px] font-bold tracking-widest text-(--color-text) border border-(--color-border) uppercase">
          {badge}
        </span>

        {(showFonte || isCassazione) && (
          <div className="flex items-center gap-2 self-start sm:self-auto">
            
            {/* LOGO FONTE */}
            {isCassazione ? (
              <img
                src="https://www.cortedicassazione.it/resources/static/img/portale/CDC-Logo.svg"
                alt="Corte di Cassazione"
                className="h-4 sm:h-5 w-auto grayscale opacity-80"
                loading="lazy"
                decoding="async"
              />
            ) : (
              "logo_fonte" in documento &&
              typeof documento.logo_fonte === "string" &&
              documento.logo_fonte.length > 0 &&
              (documento.logo_fonte.startsWith("http") ? (
                <img
                  src={documento.logo_fonte}
                  alt={"fonte" in documento && typeof documento.fonte === "string" ? documento.fonte : "fonte"}
                  className="h-4 sm:h-5 w-auto grayscale opacity-70"
                  loading="lazy"
                  decoding="async"
                />
              ) : (
                <span className="text-[10px] sm:text-xs font-medium text-(--color-muted)">
                  {documento.logo_fonte}
                </span>
              ))
            )}

            {/* TESTO FONTE / LINK */}
            {"fonte" in documento &&
              typeof documento.fonte === "string" &&
              documento.fonte.length > 0 &&
              (documento.fonte.startsWith("http") ? (
                <a
                  href={documento.fonte}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-[10px] sm:text-xs font-medium text-(--color-muted) uppercase tracking-tight underline hover:text-(--color-text) transition-colors"
                >
                  {documento.fonte}
                </a>
              ) : (
                <span className="text-[10px] sm:text-xs font-medium text-(--color-muted) uppercase tracking-tight">
                  {documento.fonte}
                </span>
              ))}
          </div>
        )}
      </div>

      {/* Identificazione */}
      {isGiurisprudenza && (
        <div className="space-y-1.5 text-(--color-text)">
          {documento.organo_giudicante && (
            <div 
              className="text-base sm:text-lg font-bold leading-tight wrap-break-word"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {documento.organo_giudicante}
            </div>
          )}

          {documento.sezione && (
            <div className="text-sm sm:text-base text-(--color-muted) font-light wrap-break-word">
              {documento.sezione}
            </div>
          )}

          {(documento.numero_sentenza || dataProvvedimento) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs sm:text-sm text-(--color-muted) mt-1">
              {documento.numero_sentenza && (
                <span className="font-semibold text-(--color-text)">
                  n. {documento.numero_sentenza}
                </span>
              )}
              {documento.numero_sentenza && dataProvvedimento && (
                <span className="opacity-50">&bull;</span>
              )}
              {dataProvvedimento && <span>{dataProvvedimento}</span>}
            </div>
          )}

          {documento.ecli && (
            <div className="text-[10px] sm:text-xs text-(--color-muted) font-mono break-all mt-1 opacity-80">
              {documento.ecli}
            </div>
          )}
        </div>
      )}

      {!isGiurisprudenza && (
        <div className="mt-1 text-sm sm:text-base text-(--color-text) font-light">
          <span>Documento caricato</span>
        </div>
      )}

      {/* Specifiche Ordinanza */}
      {isGiurisprudenza && isOrdinanza(documento) && (
        <div className="mt-4 space-y-1.5 text-xs sm:text-sm text-(--color-muted) bg-(--color-bg) p-3 rounded-md border border-(--color-border)">
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-1 sm:gap-x-3">
            {documento.tipo_ordinanza && <span>Ordinanza {documento.tipo_ordinanza}</span>}
            {documento.efficacia_temporale && <span>Efficacia: {documento.efficacia_temporale}</span>}
          </div>

          {documento.tipo_ordinanza === "cautelare" && (
            <div className="space-y-1 mt-2 pt-2 border-t border-(--color-border)">
              {documento.misura_disposta && (
                <div className="wrap-break-word">
                  <span className="font-semibold text-(--color-text)">Misura:</span> {documento.misura_disposta}
                </div>
              )}
              {documento.fumus_boni_iuris && (
                <div className="wrap-break-word">
                  <span className="font-semibold text-(--color-text)">Fumus:</span> {documento.fumus_boni_iuris}
                </div>
              )}
              {documento.periculum_in_mora && (
                <div className="wrap-break-word">
                  <span className="font-semibold text-(--color-text)">Periculum:</span> {documento.periculum_in_mora}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Specifiche Decreto */}
      {isGiurisprudenza && isDecreto(documento) && (
        <div className="mt-4 space-y-1.5 text-xs sm:text-sm text-(--color-muted) bg-(--color-bg) p-3 rounded-md border border-(--color-border)">
          <div className="flex flex-col sm:flex-row sm:flex-wrap gap-1 sm:gap-x-3">
            {documento.tipo_decreto && <span>Decreto {documento.tipo_decreto}</span>}

            {documento.contraddittorio !== null && documento.contraddittorio !== undefined && (
              <span>Contraddittorio: {documento.contraddittorio ? "sì" : "no"}</span>
            )}

            {documento.autorita_monocratica !== null && documento.autorita_monocratica !== undefined && (
              <span>Monocratico: {documento.autorita_monocratica ? "sì" : "no"}</span>
            )}
          </div>

          {documento.contenuto_precettivo && (
            <div className="wrap-break-word mt-2 pt-2 border-t border-(--color-border)">
              <span className="font-semibold text-(--color-text)">Dispositivo:</span> {documento.contenuto_precettivo}
            </div>
          )}
        </div>
      )}

      {/* Massima */}
      {isGiurisprudenza && (documento.highlighted_massima || documento.highlighted_fattispecie || documento.massima) && (
        <div className="mt-4 text-sm sm:text-base text-(--color-text) font-light wrap-break-word leading-relaxed">
          <div
            dangerouslySetInnerHTML={{ 
              __html: documento.highlighted_massima || documento.highlighted_fattispecie || documento.massima || "" 
            }}
            className="[&_mark]:bg-(--color-bg) [&_mark]:text-(--color-text) [&_mark]:px-1 [&_mark]:rounded-sm [&_mark]:border [&_mark]:border-(--color-border)"
          />
        </div>
      )}

      {/* Sezione Highlighted Preview espandibile */}
      {hasPreview && (
        <div className="mt-4 pt-4 border-t border-(--color-border)">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowPreview(!showPreview);
            }}
            className="flex items-center w-full sm:w-auto py-1 gap-2 text-xs sm:text-sm font-semibold text-(--color-text) hover:opacity-80 transition-opacity uppercase tracking-widest outline-none group/btn"
          >
            <TextQuote size={16} className="shrink-0 opacity-70" />
            <span className="flex-1 text-left">{showPreview ? "Nascondi sintesi" : "Mostra sintesi pertinente"}</span>
            <motion.div
              animate={{ rotate: showPreview ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown size={16} className="shrink-0 opacity-70" />
            </motion.div>
          </button>

         <AnimatePresence>
          {showPreview && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 p-4 bg-(--color-bg) rounded-md border-l-2 border-(--color-text) text-sm sm:text-base text-(--color-muted) font-light leading-relaxed">
                <div
                  dangerouslySetInnerHTML={{ __html: documento.highlighted_preview || "" }}
                  className="[&_mark]:bg-(--color-surface) [&_mark]:text-(--color-text) [&_mark]:px-1 [&_mark]:rounded-sm [&_mark]:border [&_mark]:border-(--color-border)"
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      )}

      {/* Footer (URN) */}
      <div className="mt-4 pt-2 flex items-center justify-between overflow-hidden border-t border-(--color-border)/50">
        {isGiurisprudenza && documento.urn && (
          <span className="text-[9px] sm:text-[10px] text-(--color-muted) font-mono opacity-60 truncate w-full pr-2">
            {documento.urn}
          </span>
        )}
      </div>
    </div>
  );
}