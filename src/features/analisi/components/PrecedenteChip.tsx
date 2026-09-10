// src/features/analisi/components/ReportSintesi/PrecedenteChip.tsx
import React from "react";
import { Landmark, ExternalLink } from "lucide-react";
import { usePrecedente } from "../hooks/usePrecedente";

interface Props {
  id: string;
}

export const PrecedenteChip: React.FC<Props> = ({ id }) => {
  const { precedente, loading } = usePrecedente(id, true);
  const url = `https://jurio.it/giurisprudenza/${id}`;

  if (loading) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-md border border-(--color-border) bg-(--color-bg) px-2 py-0.5 text-[9px] uppercase tracking-wider text-(--color-muted) opacity-60">
        <Landmark size={9} className="animate-pulse" />
        <span>Caricamento...</span>
      </span>
    );
  }

  if (!precedente) return null;

  const parti: string[] = [];
  if (precedente.organo_giudicante?.trim()) {
    parti.push(precedente.organo_giudicante.trim());
  }
  
  if (precedente.numero_sentenza?.trim()) {
    const num = precedente.numero_sentenza.trim();
    parti.push(num.toLowerCase().startsWith("n.") ? num : `N. ${num}`);
  }

  const label = parti.length > 0 ? parti.join(" · ") : "Sentenza Jurio";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 rounded-md border border-(--color-border) bg-(--color-bg) px-2 py-0.5 text-[9px] font-medium text-(--color-muted) transition-colors hover:border-(--color-text) hover:text-(--color-text)"
    >
      <Landmark size={9} />
      <span>{label}</span>
      <ExternalLink size={8} className="opacity-40 ml-0.5" />
    </a>
  );
};