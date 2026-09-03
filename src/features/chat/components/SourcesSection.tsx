import React, { useMemo } from "react";
import { BookOpen, Search } from "lucide-react";
import type { Message, Source } from "@/interfaces/interfaces";

interface SourcesSectionProps {
  messages: Message[];
  activeSourceId: string | undefined | null;
  setActiveSourceId: (id: string | null) => void;
  onSourceClick?: (e: React.MouseEvent, source: Source) => void;
}

export const SourcesSection: React.FC<SourcesSectionProps> = ({
  messages,
  activeSourceId,
  setActiveSourceId,
  onSourceClick,
}) => {
  const uniqueSources = useMemo(() => {
    const allSources = messages.flatMap(m => m.sources || []);
    const sourcesMap = new Map<string, Source>();

    allSources.forEach(source => {
      const rawKey = 
        source.documento_id || 
        source._id_interno || 
        source.url_riferimento || 
        source.link || 
        source.identificativo || 
        (source.numero_sentenza ? `${source.organo_giudicante || 'sent'}-${source.numero_sentenza}` : null) ||
        source.titolo || 
        source.title || 
        JSON.stringify(source);

      const uniqueKey = String(rawKey).trim().toLowerCase();

      if (!sourcesMap.has(uniqueKey)) {
        sourcesMap.set(uniqueKey, source);
      } else {
        const existing = sourcesMap.get(uniqueKey)!;
        const existingScore = Number(existing.match_percentage || existing.relevance || 0);
        const newScore = Number(source.match_percentage || source.relevance || 0);
        if (newScore > existingScore) {
          sourcesMap.set(uniqueKey, source);
        }
      }
    });

    return Array.from(sourcesMap.values());
  }, [messages]);

  return (
    <div className="relative flex flex-col flex-1 overflow-hidden bg-(--color-surface)">
      {/* LA LINEA DI RIGORE SUPERIORE (Unico tocco di colore) */}
      <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

      <div className="p-4 border-b border-(--color-border) bg-(--color-bg) shrink-0 mt-1">
        <h2 className="font-bold text-[10px] uppercase tracking-widest flex items-center gap-2 text-(--color-muted)">
          <BookOpen size={14} className="opacity-70" /> Fonti Citate
        </h2>
      </div>

      <div className="flex-1 p-4 space-y-3 overflow-y-auto pb-8 scrollbar-hide bg-(--color-surface)">
        {uniqueSources.length === 0 ? (
          <div className="text-center py-10 flex flex-col items-center justify-center gap-2">
            <Search className="w-6 h-6 text-(--color-muted) opacity-50" />
            <p className="text-[10px] font-bold text-(--color-muted) uppercase tracking-widest">In attesa di riferimenti...</p>
          </div>
        ) : (
          uniqueSources.map((source: Source, idx: number) => {
            const isWeb = source._type === 'web_search';
            const sourceId = source.documento_id || source._id_interno || source.url_riferimento || source.link || source.identificativo || `src-${idx}`;
            
            const organoPrefix = source.organo_giudicante ? `${source.organo_giudicante}: ` : '';
            const sourceType = isWeb 
              ? (source.fonte_web || source.fonte || 'Web') 
              : (source.identificativo 
                  ? `${organoPrefix} ${source.identificativo}`.trim() 
                  : (source.numero_sentenza 
                      ? `${organoPrefix || 'Sent.'} n. ${source.numero_sentenza}`.trim() 
                      : '')
                );
                
            const scoreValue = source.match_percentage || source.relevance || (source._matchCount ? Math.min(Math.round(source._matchCount * 12), 98) : (isWeb ? 95 : 85));
            const relevanceScore = scoreValue ? `${scoreValue}% match` : "";
            const displayTitle = isWeb ? source.titolo : (source.numero_sentenza ? `Sentenza n. ${source.numero_sentenza}` : source.title);

            const isActive = activeSourceId === sourceId;

            return (
              <div 
                key={sourceId} 
                onClick={(e) => onSourceClick ? onSourceClick(e, source) : (isWeb && source.link && window.open(source.link, '_blank'))}                
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (onSourceClick) {
                      onSourceClick(e as unknown as React.MouseEvent, source);
                    } else if (isWeb && source.link) {
                      window.open(source.link, '_blank');
                    }
                  }
                }}
                onMouseEnter={() => setActiveSourceId(sourceId)} 
                onMouseLeave={() => setActiveSourceId(null)} 
                role="button"
                tabIndex={0}
                className={`p-3 rounded-md border transition-all cursor-pointer outline-none ${
                  isActive 
                    ? 'border-(--color-text) bg-(--color-bg) shadow-sm scale-[1.01]' 
                    : 'border-(--color-border) bg-(--color-surface) hover:border-(--color-text)'
                }`}
              >
                <div className="flex items-center justify-between gap-1.5 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-sm bg-(--color-bg) border border-(--color-border) text-(--color-text)">
                    {sourceType}
                  </span>
                  <span className="text-[10px] font-light text-(--color-muted) italic">
                    {relevanceScore}
                  </span>
                </div>
                
                <h4 className="text-xs font-medium mb-3 leading-tight line-clamp-2 text-(--color-text) tracking-tight" style={{ fontFamily: 'var(--font-serif)' }} title={displayTitle}>
                  {displayTitle}
                </h4>
                
                <div className="h-0.75 w-full bg-(--color-border) rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-(--color-text) transition-all duration-500" 
                    style={{ width: `${Number(scoreValue) || 0}%` }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};