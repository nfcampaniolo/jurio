import React from "react";
import { Globe, ExternalLink } from "lucide-react";
import type { PrecedenteReperito } from "../hooks/types";
import { PrecedenteChip } from "./PrecedenteChip";

interface ArgomentazioneItemProps {
  rawText: string;
  fontiValide: PrecedenteReperito[];
  colorClass: string;
}

type MappedRef = 
  | { type: "web"; url: string; label: string; id: string }
  | { type: "interna"; id: string };

export const ArgomentazioneItem: React.FC<ArgomentazioneItemProps> = ({ rawText, fontiValide, colorClass }) => {
  const parseReferences = (text: string) => {
    if (!text) return { cleanText: "", rawRefs: [] };
    
    let cleaned = text
      .replace(/(?:Argomentazioni e Rischi Operativi|Punti di Forza dell['’]Azione|Rischi ed Eccezioni Avverse|Conclusioni Operative)[:\s]*/gi, "")
      .trim();

    const rawRefs: string[] = [];

    // Estrae e rimuove ID o URL racchiusi tra parentesi tonde o quadre senza escape non necessari
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

  const { cleanText, rawRefs } = parseReferences(rawText);

  const mappedRefs: MappedRef[] = rawRefs.map((ref: string): MappedRef | null => {
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

  return (
    <li className="space-y-2 border-b border-(--color-border)/50 pb-4 last:border-b-0 print:border-gray-200">
      <div className="flex items-start gap-3">
        <span className={`mt-2 h-1.5 w-1.5 shrink-0 rounded-full print:bg-black ${colorClass}`} />
        <span className="text-sm font-medium leading-relaxed text-(--color-text) print:text-black">
          {cleanText}
        </span>
      </div>
      
      {mappedRefs.length > 0 && (
        <div className="ml-4.5 pt-1 print:hidden">
          <div className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-(--color-muted)">
            Fonti correlate
          </div>
          <div className="flex flex-wrap gap-1.5">
            {mappedRefs.map((src, i) => {
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
    </li>
  );
};