import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { PanelRight, X, FolderPlus } from "lucide-react";
import { Helmet } from "@dr.pogodin/react-helmet";

// --- Componenti Esistenti ---
import { Header } from "@/components/Info/Header";
import { FilterModal } from "@/components/Chat/Filters";
import { DocumentSelectorPanel } from "@/components/Chat/DocumentSelectorPanel";
import { TitlePromptModal } from "@/components/Chat/TitlePromptModal";
import { AccessDenied } from "@/components/AccessDenied";
import { RightSidebar } from "@/components/Chat/RightSidebar";

// --- Componenti Estratti ---
import { SelectionScreen } from "@/components/Chat/SelectionScreen";
import { ChatWorkspace } from "@/components/Chat/ChatWorkspace";
import { ChatHeader } from "@/components/Chat/ChatHeader";
import { MessageList } from "@/components/Chat/MessageList";
import { ChatInput } from "@/components/Chat/ChatInput";
import { MessageTimeline } from "@/components/Chat/MessageTimeline";

import { useLegalChat } from "@/hooks/useLegalChat";
import { type AttachedDocument } from "@/interfaces/interfaces";

interface LocationState {
  inizializzaTitolo?: string;
  inizializzaDocumenti?: AttachedDocument[];
}

export const LegalChatPage = () => {
  const location = useLocation();
  const state = location.state as LocationState | null;
  const titoloRicevuto = state?.inizializzaTitolo;
  const documentiRicevuti = state?.inizializzaDocumenti;
  
  const chatLogic = useLegalChat({ docs: documentiRicevuti });
  const {
    sessionType,
    isConverting,
    messages,
    inputValue, setInputValue,
    activeSourceId, setActiveSourceId,
    showFilters, setShowFilters,
    showDocsModal, setShowDocsModal,
    attachedDocs,
    filterState, setFilterState, activeFiltersCount, clearFilters,
    messagesEndRef, handleSendMessage, toggleDocSelection, removeAttachment, seo,
    isStreaming, agentStatusText,
    startTempChat,
    startFascicoloSetup,
    closeSession, 
    sessionTitle, 
    threadTitle, 
    archiveDocs,
    isLoadingData,
    processFilesParallel,
    isProcessingFiles,
    handleSourceClick,
    threads,
    activeThreadId,
    convertChatToFascicolo,
    showTitleModal, setShowTitleModal,
    setSessionTitle,
    denyOpen,
    handleToggleFascicoloLink,
    handleDeleteDocumento, handleRenameDocumento,
    setActiveQuote,
    activeQuote,
    isReadOnly
  } = chatLogic;

  // Stati Locali della UI
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [viewMode, setViewMode] = useState<'chat' | 'workspace'>('chat');
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Gestione Overflow Body in base all'accesso negato
  useEffect(() => {
    document.body.style.overflow = denyOpen ? "hidden" : "unset";
    return () => { document.body.style.overflow = "unset"; };
  }, [denyOpen]);
  
  useEffect(() => {
    if (titoloRicevuto) {
      chatLogic.setSessionTitle(titoloRicevuto);
    }
  }, [titoloRicevuto, chatLogic]);
  
  // Auto-resize della Textarea
  useEffect(() => {
    const t = textAreaRef.current;
    if (t) {
      t.style.height = "auto";
      const newHeight = Math.min(t.scrollHeight, window.innerWidth < 768 ? 96 : 128);
      t.style.height = `${newHeight}px`;
    }
  }, [inputValue]);

  const clearAllAttachments = () => {
    attachedDocs.forEach(doc => removeAttachment(doc.id));
  };
  
  const handleDocumentAction = (actionType: 'quote' | 'semaforo' | 'distinguish', selectedText: string) => {
    if (window.innerWidth < 768 && actionType !== 'quote') {
      setViewMode('chat');
    }

    if (actionType === 'quote') {
      setActiveQuote(prev => prev.includes(selectedText) ? prev : [...prev, selectedText]);
      if (window.innerWidth >= 768) {
        setTimeout(() => textAreaRef.current?.focus(), 50);
      }
      return; 
    }

    const promptText = actionType === 'semaforo' 
      ? `Verifica legittimità del seguente principio estratto dal documento: "${selectedText}"`
      : `Trova un distinguish per i seguenti fatti estratti dal documento: "${selectedText}"`;
    
    setInputValue(promptText);
  };

  const removeQuote = (index: number) => {
    setActiveQuote(prev => prev.filter((_, i) => i !== index));
  };

  // --- RENDER INTERFACCIA PRINCIPALE ---
  const renderChatInterface = () => (
    <div className="flex w-full h-full relative overflow-hidden bg-neutral-50 dark:bg-neutral-950">
      
      {/* 1. PANNELLO SINISTRO: WORKSPACE DOCUMENTO */}
      <ChatWorkspace 
        viewMode={viewMode}
        setViewMode={setViewMode}
        attachedDocs={attachedDocs}
        activeQuote={activeQuote}
        handleDocumentAction={handleDocumentAction}
        removeQuote={removeQuote}
      />

      {/* 2. AREA CENTRALE DELLA CHAT */}
      <div className="flex-1 min-w-0 flex flex-col h-full bg-white dark:bg-neutral-900 border-r border-neutral-200 dark:border-neutral-800 relative z-10">
        <ChatHeader
          sessionType={sessionType}
          sessionTitle={sessionTitle}
          threadTitle={threadTitle}
          messagesCount={messages.length}
          viewMode={viewMode}
          setViewMode={setViewMode}
          attachedDocsCount={attachedDocs.length}
          isConverting={isConverting}
          setShowTitleModal={setShowTitleModal}
          setShowMobileSidebar={setShowMobileSidebar}
          closeSession={closeSession}
        />

        <div className="relative flex-1 flex overflow-hidden min-h-0 w-full">
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            agentStatusText={agentStatusText}
            messagesEndRef={messagesEndRef}
            activeSourceId={activeSourceId}
            setActiveSourceId={setActiveSourceId}
            handleSourceClick={handleSourceClick}
          />
          <MessageTimeline messages={messages} />
        </div>

        {/* Input bloccato se isReadOnly è true */}
        <ChatInput
          inputValue={inputValue}
          setInputValue={setInputValue}
          handleSendMessage={handleSendMessage}
          attachedDocs={attachedDocs}
          removeAttachment={removeAttachment}
          clearAllAttachments={clearAllAttachments}
          setViewMode={setViewMode}
          viewMode={viewMode}
          activeQuote={activeQuote}
          removeQuote={removeQuote}
          setShowFilters={setShowFilters}
          activeFiltersCount={activeFiltersCount}
          setShowDocsModal={setShowDocsModal}
          isProcessingFiles={isProcessingFiles}
          isStreaming={isStreaming}
          textAreaRef={textAreaRef}
          isReadOnly={isReadOnly}
        />
      </div>

      <DocumentSelectorPanel 
        isOpen={showDocsModal} 
        onClose={() => setShowDocsModal(false)}
        archiveDocs={archiveDocs}
        attachedDocs={attachedDocs}
        onToggleDoc={toggleDocSelection}
        onProcessFiles={processFilesParallel}
        onToggleFascicoloLink={handleToggleFascicoloLink}
        isLoading={isLoadingData}
        isProcessing={isProcessingFiles}
        onRenameDocumento={handleRenameDocumento}
        onDeleteDocumento={handleDeleteDocumento}
      />

      {/* 3. RIGHT SIDEBAR (FONTI & THREAD FASCICOLO) */}
      <aside className={`
        absolute inset-0 z-50 flex lg:relative lg:inset-auto lg:w-80 xl:w-96 lg:shrink-0
        ${showMobileSidebar ? 'pointer-events-auto' : 'pointer-events-none lg:pointer-events-auto'}
        ${viewMode === 'workspace' ? 'lg:hidden' : 'lg:flex'} 
      `}>
        {/* Overlay Mobile */}
        <div 
          role="button"
          tabIndex={0}
          aria-label="Chiudi barra laterale"
          className={`absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm lg:hidden transition-opacity outline-none focus-visible:ring-1 focus-visible:ring-neutral-400 ${showMobileSidebar ? 'opacity-100' : 'opacity-0'}`} 
          onClick={() => setShowMobileSidebar(false)} 
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setShowMobileSidebar(false);
            }
          }}
        />
        
        <div className={`
          relative w-[85%] sm:w-90 h-full bg-white dark:bg-neutral-900 ml-auto shadow-2xl flex flex-col
          lg:w-full lg:shadow-none lg:ml-0 transition-transform duration-300
          ${showMobileSidebar ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
        `}>
          
          {/* Header Mobile Sidebar */}
          <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-neutral-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/90 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-neutral-900 dark:text-white font-bold text-sm">
              {sessionType === 'fascicolo' ? (
                <><FolderPlus size={18} className="text-yellow-600" /> Gestione Fascicolo</>
              ) : (
                <><PanelRight size={18} className="text-blue-600" /> Dettagli Sessione</>
              )}
            </div>
            <button 
              onClick={() => setShowMobileSidebar(false)}
              className="p-1.5 rounded-lg text-neutral-500 bg-neutral-100 hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto lg:border-l border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-950 pb-[env(safe-area-inset-bottom)]">
            <RightSidebar 
              sessionType={sessionType}
              attachedDocs={attachedDocs}
              removeAttachment={removeAttachment}
              onOpenDocsPanel={() => setShowDocsModal(true)}
              messages={messages}
              activeSourceId={activeSourceId}
              setActiveSourceId={setActiveSourceId}
              threads={threads}
              activeThreadId={activeThreadId ?? undefined}
              onThreadSelect={(id) => {
                chatLogic.startThread(id);
                if (window.innerWidth < 1024) setShowMobileSidebar(false); 
              }}
              onNewThread={() => {
                chatLogic.createNewThread();
                if (window.innerWidth < 1024) setShowMobileSidebar(false);
              }}
              onSourceClick={handleSourceClick}
              onDeleteThread={chatLogic.deleteThread}
              isReadOnly={isReadOnly}
            />
          </div>
        </div>
      </aside>
    </div>
  );

  return (
    <>
      <Helmet>
        <title>{seo.title}</title>
        <meta name="description" content={seo.desc} />
      </Helmet>
      
      <FilterModal 
        isOpen={showFilters} 
        onClose={() => setShowFilters(false)} 
        loading={false}
        filterState={filterState} 
        setFilterState={setFilterState}
        clearFilters={clearFilters}
      />

      <div className="flex flex-col h-dvh w-full bg-white dark:bg-neutral-950 font-sans overflow-hidden">
        <Header />
        
        <main className="flex-1 relative flex overflow-hidden w-full">
          <AnimatePresence mode="wait">
            {sessionType === 'seleziona' && (
              <motion.div key="seleziona" className="w-full h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <SelectionScreen 
                  startTempChat={startTempChat}
                  startFascicoloSetup={startFascicoloSetup}
                  isLoadingData={isLoadingData}
                />
              </motion.div>
            )}
            {(sessionType === 'temporanea' || sessionType === 'fascicolo') && (
              <motion.div key="chat" className="w-full h-full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {renderChatInterface()}
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>
      
      <TitlePromptModal 
        isOpen={showTitleModal}
        onClose={() => setShowTitleModal(false)}
        onConfirm={(title: string) => {
          setShowTitleModal(false);
          setSessionTitle(title);
          convertChatToFascicolo(title);
        }}
        initialTitle={sessionTitle}
      />
      
      <AnimatePresence>
        {denyOpen && <AccessDenied />}
      </AnimatePresence>
    </>
  );
};

export default LegalChatPage;