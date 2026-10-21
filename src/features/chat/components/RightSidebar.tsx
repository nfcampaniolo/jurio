import React from "react";
import { useLocation } from "react-router-dom";
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
  onRenameThread?: (fascicoloId: string, threadId: string, title: string) => void | Promise<void>;
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
  onRenameThread,
  metadati: initialMetadati = {},
  isReadOnly = false
}) => {
  // useLocation rende il componente reattivo ai cambi di rotta (es. creazione di un nuovo fascicolo)
  const { pathname } = useLocation();
  const activeFascicoloId = pathname.split('/')[2] ?? "";

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
          onRenameThread={onRenameThread}
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