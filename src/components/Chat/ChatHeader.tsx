import { 
  FolderPlus, MessageSquare, BookOpen, 
  ArrowRightLeft, Loader2, PanelRight, X 
} from "lucide-react";

interface ChatHeaderProps {
  sessionType: 'temporanea' | 'fascicolo' | 'seleziona' | 'storico';
  sessionTitle: string | undefined;
  threadTitle: string | undefined;
  messagesCount: number;
  viewMode: 'chat' | 'workspace';
  setViewMode: (mode: 'chat' | 'workspace') => void;
  attachedDocsCount: number;
  isConverting: boolean;
  setShowTitleModal: (show: boolean) => void;
  setShowMobileSidebar: (show: boolean) => void;
  closeSession: () => void;
}

export const ChatHeader = ({
  sessionType,
  sessionTitle,
  threadTitle,
  messagesCount,
  viewMode,
  setViewMode,
  attachedDocsCount,
  isConverting,
  setShowTitleModal,
  setShowMobileSidebar,
  closeSession
}: ChatHeaderProps) => {
  return (
    <header className="relative h-14 sm:h-16 shrink-0 px-4 md:px-6 border-b border-(--color-border) flex items-center justify-between bg-(--color-surface) max-w-full w-full z-10">
      
      {/* LA LINEA DI RIGORE SUPERIORE (L'unico tocco di colore ocra) */}
      <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

      {/* Contenitore flessibile sx */}
      <div className="flex items-center gap-3 md:gap-4 h-full overflow-hidden min-w-0 flex-1 mt-1">
        
        {/* Icona racchiusa in blocco geometrico neutro */}
        <div className="w-8 h-8 flex items-center justify-center rounded-md border border-(--color-border) bg-(--color-bg) shrink-0 text-(--color-text) opacity-80">
          {sessionType === 'fascicolo' ? <FolderPlus size={16} /> : <MessageSquare size={16} />}
        </div>
        
        <div className="flex items-center gap-3 overflow-hidden min-w-0 flex-1">
          <h4 
            className="text-base md:text-lg font-medium text-(--color-text) flex items-center gap-2 min-w-0 flex-1 tracking-tight"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            {sessionType === 'fascicolo' ? (
              <div className="flex items-center min-w-0 overflow-hidden w-full">
                <span className="truncate shrink">{sessionTitle || 'Nuovo Fascicolo'}</span>
                {threadTitle && (
                  <>
                    <span className="mx-2 text-(--color-border) shrink-0">/</span>
                    <span className="text-(--color-muted) font-light truncate flex-1 min-w-12">
                      {threadTitle}
                    </span>
                  </>
                )}
              </div>
            ) : (
              <span className="truncate">{sessionTitle || 'Nuova Ricerca'}</span>
            )}
          </h4>
          
          <div className="hidden md:block h-4 w-px bg-(--color-border) shrink-0" />
          
          {/* Badge micro-copy rigoroso */}
          <span className="hidden lg:inline-block text-[10px] font-bold text-(--color-muted) uppercase tracking-widest whitespace-nowrap shrink-0">
            {messagesCount} MSG
          </span>

          {/* SWITCHER VIEW MODE (Monocromatico, stile tab documentale) */}
          <div className="hidden md:flex bg-(--color-bg) p-1 rounded-md border border-(--color-border) shrink-0">
            <button 
              onClick={() => setViewMode('chat')}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-all ${
                viewMode === 'chat' 
                  ? 'bg-(--color-surface) shadow-sm text-(--color-text) border border-(--color-border)' 
                  : 'text-(--color-muted) hover:text-(--color-text) border border-transparent'
              }`}
            >
              <MessageSquare size={12} /> Chat
            </button>
            <button 
              onClick={() => setViewMode('workspace')}
              disabled={attachedDocsCount === 0}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-sm text-[10px] font-bold uppercase tracking-widest transition-all ${
                viewMode === 'workspace' 
                  ? 'bg-(--color-surface) shadow-sm text-(--color-text) border border-(--color-border)' 
                  : 'text-(--color-muted) hover:text-(--color-text) border border-transparent'
              } disabled:opacity-30 disabled:cursor-not-allowed`}
              title={attachedDocsCount === 0 ? "Allega un documento per attivare lo Studio" : "Apri Studio Documento"}
            >
              <BookOpen size={12} /> Studio
            </button>
          </div>

          {/* Pulsante Salva */}
          {sessionType === 'temporanea' && (
            <button 
              onClick={() => setShowTitleModal(true)} 
              disabled={isConverting}
              className="hidden sm:flex group items-center gap-1.5 px-3 py-1 rounded-sm border border-(--color-border) bg-(--color-bg) text-[10px] font-bold text-(--color-text) hover:bg-(--color-surface) transition-colors shrink-0 disabled:opacity-50 outline-none"
            >
              {isConverting ? (
                <Loader2 size={10} className="animate-spin shrink-0" />
              ) : (
                <ArrowRightLeft size={10} className="shrink-0 opacity-70 group-hover:opacity-100" />
              )}
              {isConverting ? "SALVATAGGIO..." : "SALVA"}
            </button>
          )}
        </div>
      </div>

      {/* Contenitore flessibile dx */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0 ml-3 mt-1">
        
        {/* Pulsante Mobile Sidebar */}
        <button 
          onClick={() => setShowMobileSidebar(true)}
          className="lg:hidden p-1.5 rounded-md border border-(--color-border) text-(--color-text) bg-(--color-bg) hover:bg-(--color-surface) transition-colors relative shrink-0 outline-none"
        >
          <PanelRight size={18} className="opacity-80" />
          {/* Pallino neutralizzato: niente giallo, usiamo il text-color per rimanere monocromatici */}
          {attachedDocsCount > 0 && (
            <span className="absolute -top-1 -right-1 w-2 h-2 bg-(--color-text) rounded-sm border border-(--color-surface)" />
          )}
        </button>

        <div className="h-4 w-px bg-(--color-border) shrink-0 hidden xs:block" />
        
        {/* Pulsante Chiudi - Rigoroso e neutrale (niente rosso) */}
        <button 
          onClick={closeSession} 
          className="p-1.5 sm:px-3 sm:py-1.5 text-[10px] font-bold text-(--color-muted) hover:text-(--color-text) sm:hover:bg-(--color-bg) sm:border border-transparent sm:hover:border-(--color-border) rounded-md uppercase tracking-widest transition-all shrink-0 flex items-center gap-1 outline-none"
        >
          <X size={18} className="sm:hidden" />
          <span className="hidden sm:block">Chiudi</span>
        </button>
      </div>
    </header>
  );
};