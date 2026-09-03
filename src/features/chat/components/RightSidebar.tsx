import React from "react";
import { CaseMetadataSection } from "./CaseMetadataSection";
import { ThreadSection } from "./ThreadSection";
import { SourcesSection } from "./SourcesSection";
import type { AttachedDocument, Message, SessionType, Source, ThreadItem } from "@/interfaces/interfaces";

interface RightSidebarProps {
  sessionType: SessionType;
  attachedDocs: AttachedDocument[];
  removeAttachment: (id: string) => void;
  onOpenDocsPanel: () => void; 
  messages: Message[];
  activeSourceId: string | undefined | null;
  setActiveSourceId: (id: string | null) => void;
  threads?: ThreadItem[]; 
  activeThreadId?: string;
  onThreadSelect?: (id: string) => void;
  onNewThread?: () => void;
  onSourceClick?: (e: React.MouseEvent, source: Source) => void;
  onDeleteThread?: (fascicoloId: string, threadId: string) => void;
  metadati?: Record<string, string>;
  isReadOnly?: boolean;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({ 
  sessionType, 
  messages, 
  activeSourceId, 
  setActiveSourceId,
  threads = [], 
  activeThreadId, 
  onThreadSelect, 
  onNewThread, 
  onSourceClick,
  onDeleteThread,
  metadati: initialMetadati = {},
  isReadOnly = false
}) => {
  const getFascicoloIdFromUrl = () => {
    const pathParts = window.location.pathname.split('/');
    return pathParts[2]; 
  };
  const activeFascicoloId = getFascicoloIdFromUrl();

  return (
    <div className="flex flex-col bg-(--color-surface) border-l border-(--color-border) h-full overflow-hidden">
      
      {/* 1. SEZIONE INFO SUL CASO */}
      {sessionType === 'fascicolo' && (
        <CaseMetadataSection 
          activeFascicoloId={activeFascicoloId} 
          initialMetadati={initialMetadati} 
          isReadOnly={isReadOnly}
        />
      )}

      {/* 2. SEZIONE THREADS */}
      {sessionType === 'fascicolo' && (
        <ThreadSection 
          threads={threads}
          activeThreadId={activeThreadId}
          activeFascicoloId={activeFascicoloId}
          onThreadSelect={onThreadSelect}
          onNewThread={onNewThread}
          onDeleteThread={onDeleteThread}
          isReadOnly={isReadOnly}
        />
      )}

      {/* 3. SEZIONE FONTI E RIFERIMENTI */}
      <SourcesSection 
        messages={messages}
        activeSourceId={activeSourceId}
        setActiveSourceId={setActiveSourceId}
        onSourceClick={onSourceClick}
      />

    </div>
  );
};