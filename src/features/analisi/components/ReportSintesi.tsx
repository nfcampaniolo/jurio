import React, { useState } from "react";
import { 
  Scale, 
  BookOpen, 
  ShieldCheck, 
  ShieldAlert, 
  Lightbulb, 
  Copy, 
  CheckCircle2, 
  Network, 
  Download,
  Globe,
  ExternalLink
} from "lucide-react";
import type { DeepAnalysisSession, PrecedenteReperito } from "../hooks/types";

import { ArgomentazioneItem } from "./ArgomentazioneItem";
import { OrientamentoItem, type MappedOrientamento } from "./OrientamentoItem";
import { PrecedenteChip } from "./PrecedenteChip";

interface ReportSintesiProps {
  session: DeepAnalysisSession;
}

type MappedRef = 
  | { type: "web"; url: string; label: string; id: string }
  | { type: "interna"; id: string };

export const ReportSintesi: React.FC<ReportSintesiProps> = ({ session }) => {
  const [copiato, setCopiato] = useState<boolean>(false);

  const { inquadramento, mappaDialettica, sintesiStrategica } = session;
  
  const fontiFav: PrecedenteReperito[] = mappaDialettica?.orientamentoFavorevole?.fonti || [];
  const fontiCont: PrecedenteReperito[] = mappaDialettica?.orientamentoContrario?.fonti || [];
  const tutteLeFonti: PrecedenteReperito[] = [...fontiFav, ...fontiCont];
  const fontiValide: PrecedenteReperito[] = tutteLeFonti.filter((p: PrecedenteReperito) => !p.escluso);

  const parseReferences = (text: string) => {
    if (!text) return { cleanText: "", rawRefs: [] };
    
    let cleaned = text
      .replace(/(?:Argomentazioni e Rischi Operativi|Punti di Forza dell['’]Azione|Rischi ed Eccezioni Avverse|Conclusioni Operative)[:\s]*/gi, "")
      .trim();

    const rawRefs: string[] = [];

    const refPattern = /(?:\(([^)]+)\)|\[([^]]+)\])/g;
    cleaned = cleaned.replace(refPattern, (match, p1, p2) => {
      const group1 = p1 || p2;
      if (group1 && (group1.includes("-") || group1.startsWith("http"))) {
        group1.split(",").map((s: string) => s.trim()).filter(Boolean).forEach((t: string) => rawRefs.push(t));
        return "";
      }
      return match;
    });

    const trailingPattern = /\[(.*?)\]\.?\s*$/;
    const trailingMatch = cleaned.match(trailingPattern);
    if (trailingMatch) {
      trailingMatch[1].split(",").map((s: string) => s.trim()).filter(Boolean).forEach((t: string) => rawRefs.push(t));
      cleaned = cleaned.replace(trailingPattern, "").trim();
    }

    return {
      cleanText: cleaned.replace(/\s+([.,])/g, "$1").replace(/\s+/g, " ").trim(),
      rawRefs: Array.from(new Set(rawRefs))
    };
  };

  const mapRefsToObjects = (rawRefs: string[]): MappedRef[] => {
    return rawRefs.map((ref: string): MappedRef | null => {
      if (ref.startsWith("http")) {
        try {
          const domain = new URL(ref).hostname.replace("www.", "");
          return { type: "web", url: ref, label: domain, id: ref };
        } catch {
          return null;
        }
      }
      
      const found = fontiValide.find((f: PrecedenteReperito) => f.id === ref);
      if (found) {
        if (found.fonte === "web") {
          return { type: "web", url: found.id, label: "Fonte Web", id: found.id };
        }
        return { type: "interna", id: found.id };
      }
      
      return null;
    }).filter((item): item is MappedRef => item !== null);
  };

  const copiaReport = () => {
    const cleanArgs = sintesiStrategica?.argomentazioniAzione?.map((a: string) => parseReferences(a).cleanText) || [];
    const cleanRischi = sintesiStrategica?.rischiEEccezioni?.map((r: string) => parseReferences(r).cleanText) || [];
    const conclusioniParsed = parseReferences(sintesiStrategica?.conclusioniStrategiche || "");

    const testo = `
INQUADRAMENTO GIURIDICO
${inquadramento?.qualificazioneGiuridica || ""}
Norme: ${inquadramento?.normeRiferimento?.join(", ") || ""}

EXECUTIVE SUMMARY
${sintesiStrategica?.executiveSummary || ""}

PUNTI DI FORZA DELL'AZIONE
${cleanArgs.join("\n")}

RISCHI ED ECCEZIONI AVVERSE
${cleanRischi.join("\n")}

CONCLUSIONI OPERATIVE
${conclusioniParsed.cleanText}
    `.trim();

    navigator.clipboard.writeText(testo);
    setCopiato(true);
    setTimeout(() => setCopiato(false), 2000);
  };

  const scaricaPDF = () => window.print();

  if (!sintesiStrategica) return null;

  const orientamenti: MappedOrientamento[] = [];
  if (mappaDialettica?.orientamentoFavorevole) {
    orientamenti.push({ 
      tipo: "Favorevole", 
      titoloTesi: mappaDialettica.orientamentoFavorevole.titoloTesi,
      argomentazioneLogica: mappaDialettica.orientamentoFavorevole.argomentazioneLogica,
      fonti: (mappaDialettica.orientamentoFavorevole.fonti || []).filter((f: PrecedenteReperito) => !f.escluso)
    });
  }
  if (mappaDialettica?.orientamentoContrario) {
    orientamenti.push({ 
      tipo: "Contrario", 
      titoloTesi: mappaDialettica.orientamentoContrario.titoloTesi,
      argomentazioneLogica: mappaDialettica.orientamentoContrario.argomentazioneLogica,
      fonti: (mappaDialettica.orientamentoContrario.fonti || []).filter((f: PrecedenteReperito) => !f.escluso)
    });
  }

  const conclusioniParsed = parseReferences(sintesiStrategica.conclusioniStrategiche || "");
  const conclusioniMappedRefs = mapRefsToObjects(conclusioniParsed.rawRefs);

  return (
    <div className="mx-auto max-w-3xl bg-(--color-surface) rounded-xl border border-(--color-border) shadow-xs overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700 print:border-none print:shadow-none print:bg-white print:text-black print:max-w-none">
      
      {/* HEADER AZIONI */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-(--color-border) bg-(--color-bg) px-8 py-4 print:hidden">
        <div className="flex items-center gap-2.5 text-(--color-muted)">
          <Scale size={16} className="text-(--color-text)" />
          <span className="text-[11px] font-bold uppercase tracking-widest text-(--color-text)">
            Nota Strategica Conclusiva
          </span>
        </div>
        
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={copiaReport}
            className="flex items-center gap-2 rounded-md border border-(--color-border) bg-(--color-surface) px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-(--color-text) transition hover:border-(--color-text) cursor-pointer"
          >
            {copiato ? <CheckCircle2 size={13} className="text-emerald-500" /> : <Copy size={13} />}
            <span className="hidden sm:inline">{copiato ? "Copiato" : "Copia Testo"}</span>
          </button>

          <button
            type="button"
            onClick={scaricaPDF}
            className="flex items-center gap-2 rounded-md bg-(--color-text) px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-widest text-(--color-surface) transition hover:opacity-90 cursor-pointer"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Esporta PDF</span>
          </button>
        </div>
      </div>

      {/* DOCUMENTO EDITORIALE */}
      <div className="px-8 py-10 sm:px-14 sm:py-14 space-y-12 print:p-0 print:space-y-10">
        
        {/* TITOLO E INTESTAZIONE */}
        <header className="space-y-2 border-b border-(--color-border) pb-6 print:border-gray-300">
          <h1 className="text-2xl sm:text-3xl font-medium tracking-tight text-(--color-text) print:text-black" style={{ fontFamily: "var(--font-serif)" }}>
            Sintesi Strategica
          </h1>
          <p className="text-xs text-(--color-muted) font-light print:text-gray-600">
            Pratica: {session.title || "Approfondimento"} · Fonti esaminate: {fontiValide.length}
          </p>
        </header>

        {/* EXECUTIVE SUMMARY */}
        <section className="space-y-3 print:break-inside-avoid">
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) print:text-gray-500">
            Executive Summary
          </h3>
          <p className="text-base font-medium leading-relaxed text-(--color-text) print:text-black" style={{ fontFamily: "var(--font-serif)" }}>
            {sintesiStrategica.executiveSummary}
          </p>
        </section>

        {/* 1. INQUADRAMENTO NORMATIVO */}
        {inquadramento && (
          <section className="space-y-4 print:break-inside-avoid">
            <div className="flex items-center gap-2.5 border-b border-(--color-border) pb-2 print:border-gray-300">
              <BookOpen size={15} className="text-(--color-muted) print:text-gray-500" />
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-(--color-text) print:text-black">
                Inquadramento Normativo
              </h3>
            </div>
            
            <div className="space-y-4">
              <div>
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-(--color-muted) print:text-gray-500">
                  Qualificazione Giuridica
                </span>
                <p className="text-sm font-medium leading-relaxed text-(--color-text) print:text-black" style={{ fontFamily: "var(--font-serif)" }}>
                  {inquadramento.qualificazioneGiuridica}
                </p>
              </div>

              <div>
                <span className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-(--color-muted) print:text-gray-500">
                  Fattispecie Rilevata
                </span>
                <p className="text-xs font-light leading-relaxed text-(--color-muted) print:text-black">
                  {inquadramento.fattispecieEstratta}
                </p>
              </div>

              <div>
                <span className="mb-2 block text-[10px] font-bold uppercase tracking-widest text-(--color-muted) print:text-gray-500">
                  Disposizioni Applicabili
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {inquadramento.normeRiferimento?.map((norma: string, idx: number) => (
                    <span key={idx} className="rounded-md border border-(--color-border) bg-(--color-bg) px-2.5 py-1 text-xs font-medium text-(--color-text) print:border-gray-300 print:bg-white print:text-black">
                      {norma}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 2. MAPPA DIALETTICA */}
        {orientamenti.length > 0 && (
          <section className="space-y-6 print:break-inside-avoid">
            <div className="flex items-center gap-2.5 border-b border-(--color-border) pb-2 print:border-gray-300">
              <Network size={15} className="text-(--color-muted) print:text-gray-500" />
              <h3 className="text-[11px] font-bold uppercase tracking-widest text-(--color-text) print:text-black">
                Mappa Dialettica
              </h3>
            </div>

            <div className="space-y-8">
              {orientamenti.map((orientamento: MappedOrientamento, idx: number) => (
                <OrientamentoItem key={idx} orientamento={orientamento} />
              ))}
            </div>
          </section>
        )}

        {/* 3. ARGOMENTAZIONI E RISCHI */}
        <section className="space-y-8 print:break-inside-avoid">
          <div className="flex items-center gap-2.5 border-b border-(--color-border) pb-2 print:border-gray-300">
            <Scale size={15} className="text-(--color-muted) print:text-gray-500" />
            <h3 className="text-[11px] font-bold uppercase tracking-widest text-(--color-text) print:text-black">
              Argomentazioni e Rischi Operativi
            </h3>
          </div>

          <div className="space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 print:text-black">
                <ShieldCheck size={15} />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  Punti di Forza dell&apos;Azione
                </span>
              </div>
              <ul className="space-y-4 pl-1">
                {sintesiStrategica.argomentazioniAzione?.map((arg: string, idx: number) => (
                  <ArgomentazioneItem 
                    key={idx} 
                    rawText={arg} 
                    fontiValide={fontiValide} 
                    colorClass="bg-emerald-500" 
                  />
                ))}
              </ul>
            </div>

            <div className="space-y-4 pt-4 border-t border-(--color-border)/60 print:border-gray-200">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 print:text-black">
                <ShieldAlert size={15} />
                <span className="text-[10px] font-bold uppercase tracking-widest">
                  Rischi ed Eccezioni Avverse
                </span>
              </div>
              <ul className="space-y-4 pl-1">
                {sintesiStrategica.rischiEEccezioni?.map((ecc: string, idx: number) => (
                  <ArgomentazioneItem 
                    key={idx} 
                    rawText={ecc} 
                    fontiValide={fontiValide} 
                    colorClass="bg-amber-500" 
                  />
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 4. CONCLUSIONI STRATEGICHE */}
        {sintesiStrategica.conclusioniStrategiche && (
          <section className="space-y-3 pt-6 border-t border-(--color-border) print:border-gray-300 print:break-inside-avoid">
            <div className="flex items-center gap-2 text-(--color-primary) dark:text-blue-400 print:text-black">
              <Lightbulb size={16} />
              <h3 className="text-[11px] font-bold uppercase tracking-widest">
                Conclusioni Operative
              </h3>
            </div>
            
            <p className="text-base font-medium leading-relaxed text-(--color-text) print:text-black" style={{ fontFamily: "var(--font-serif)" }}>
              {conclusioniParsed.cleanText}
            </p>

            {conclusioniMappedRefs.length > 0 && (
              <div className="pt-2 print:hidden">
                <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-(--color-muted)">
                  Fonti correlate
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {conclusioniMappedRefs.map((src, i) => {
                    if (src.type === "interna") {
                      return <PrecedenteChip key={`${src.id}-${i}`} id={src.id} />;
                    }

                    return (
                      <a 
                        key={`${src.id}-${i}`} 
                        href={src.url} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="inline-flex items-center gap-1.5 rounded-md border border-(--color-border) bg-(--color-bg) px-2 py-0.5 text-[9px] font-medium text-(--color-muted) transition-colors hover:border-(--color-text) hover:text-(--color-text)"
                      >
                        <Globe size={9} />
                        <span>{src.label}</span>
                        <ExternalLink size={8} className="opacity-40 ml-0.5" />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </section>
        )}

      </div>
    </div>
  );
};