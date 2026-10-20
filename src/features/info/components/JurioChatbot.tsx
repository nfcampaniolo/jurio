// JurioChatbot.tsx
import React, { useEffect, useRef, useCallback } from 'react';
import { useJurioChatbot } from '@/features/info/hooks/useJurioChatbot';
import { motion, AnimatePresence } from 'framer-motion';
import { Typewriter } from '@/shared/components/Typewriter';
import { 
  MessageSquare, 
  X, 
  RefreshCcw, 
  Send, 
  ExternalLink,
  BookOpen,
  Globe,
  Scale
} from 'lucide-react';
import type { ChatMessage, SourceItem } from '@/features/chat/hooks/chatLogic';

/** Formatta gli URL delle fonti in etichette pulite e leggibili */
function formatSourceLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname === '/' ? '' : parsed.pathname;
    return `${parsed.hostname}${pathname}`;
  } catch {
    return url;
  }
}

const JurioChatbot: React.FC = () => {
  const {
    isOpen,
    setIsOpen,
    messages,
    inputValue,
    setInputValue,
    isLoading,
    currentStatus,
    error,
    handleSend,
    clearChat
  } = useJurioChatbot();
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize dinamico della textarea
  const adjustTextareaHeight = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 128)}px`; // Max 128px (max-h-32)
  }, []);

  useEffect(() => {
    adjustTextareaHeight();
  }, [inputValue, adjustTextareaHeight]);

  // 1. Inizializzazione da URL hash (#bot)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#bot') {
      setIsOpen(true);
    }
  }, [setIsOpen]);

  // 2. Sincronizzazione dell'hash dell'URL con lo stato del widget
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentHash = window.location.hash;
    if (isOpen && currentHash !== '#bot') {
      window.history.pushState(null, '', '#bot');
    } else if (!isOpen && currentHash === '#bot') {
      window.history.pushState(null, '', window.location.pathname + window.location.search);
    }
  }, [isOpen]);

  // 3. Gestione navigazione Back/Forward del browser
  useEffect(() => {
    const handleHashChange = () => {
      setIsOpen(window.location.hash === '#bot');
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [setIsOpen]);

  // 4. Autoscroll morbido al fondo della chat
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, currentStatus]);

  const onKeyDownTextarea = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  return (
    <>
      {/* Modal / Widget Floating Container */}
      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={`
              fixed z-50 flex flex-col overflow-hidden shadow-2xl
              
              /* MOBILE: Fullscreen Viewport */
              inset-0 w-full h-dvh rounded-none border-0
              
              /* DESKTOP: Container Flottante Stile Legal-Tech */
              sm:inset-auto sm:bottom-6 sm:right-6 sm:w-115 sm:h-162.5 sm:max-h-[85vh] sm:rounded-2xl sm:border 
              bg-white dark:bg-neutral-900 border-neutral-200/80 dark:border-neutral-800 text-neutral-900 dark:text-neutral-100
            `}
          >
            {/* Accent Line Superiore in ambra/oro */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-[#e0a32e] z-20" />

            {/* Header */}
            <div className="px-4 py-3.5 sm:px-5 flex justify-between items-center z-10 border-b border-neutral-200/70 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="shrink-0 w-10 h-10 rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex items-center justify-center p-0.5">
                  <img src="/logo.webp" alt="Jurio Logo" className="w-full h-full object-cover rounded-lg" />
                </div>
                <div>
                  <h3 className="font-semibold leading-tight text-base tracking-tight font-serif text-neutral-900 dark:text-neutral-100">
                    Jurio
                  </h3>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[#e0a32e]">Support Agent</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={clearChat} 
                  title="Svuota chat" 
                  className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition-colors outline-none cursor-pointer"
                >
                  <RefreshCcw size={15} />
                </button>
                <button 
                  onClick={() => setIsOpen(false)} 
                  title="Chiudi" 
                  className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-300 transition-colors outline-none cursor-pointer"
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Stream dei Messaggi */}
            <div className="flex-1 p-4 sm:p-5 overflow-y-auto scroll-smooth overscroll-contain bg-neutral-50/50 dark:bg-neutral-950/50 custom-scrollbar">
              {messages.length === 0 ? (
                <div className="flex-1 h-full flex flex-col items-center justify-center text-center space-y-3 my-auto py-16">
                  <div className="p-4 rounded-full bg-neutral-100 dark:bg-neutral-900 border border-neutral-200/60 dark:border-neutral-800">
                    <Scale size={36} className="text-[#e0a32e] opacity-90" />
                  </div>
                  <p className="text-sm px-6 max-w-xs font-medium text-neutral-600 dark:text-neutral-400">
                    Inizia descrivendo la fattispecie o ponendo un quesito giuridico.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col space-y-5">
                  {messages.map((msg: ChatMessage, idx: number) => {
                    const isUser = msg.role === "user";
                    const isLastMessage = idx === messages.length - 1;
                    const messageId = (msg as { id?: string }).id || `msg_${idx}_${msg.role}`;

                    // Nascondi bubble modello se è ancora vuoto durante lo streaming
                    if (!isUser && !msg.content && (!msg.sources || msg.sources.length === 0)) {
                      return null;
                    }

                    const rawLinks = msg.sources?.flatMap((src: SourceItem) => src.links || []) || [];
                    const uniqueLinks = Array.from(new Set(rawLinks));

                    return (
                      <motion.div 
                        key={messageId} 
                        initial={{ opacity: 0, y: 8 }} 
                        animate={{ opacity: 1, y: 0 }} 
                        transition={{ duration: 0.2 }}
                        className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        <div className={`flex flex-col gap-2 max-w-[90%] sm:max-w-[85%] ${isUser ? "items-end" : "items-start"}`}>
                          
                          {/* Bubble Contenuto */}
                          <div className={`
                            p-4 text-sm sm:text-[15px] leading-relaxed shadow-xs border transition-shadow wrap-break-word w-full
                            ${isUser 
                              ? "bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900 rounded-2xl rounded-br-xs font-normal border-transparent" 
                              : "bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 rounded-2xl rounded-bl-xs border-neutral-200/70 dark:border-neutral-800/80"}`}
                          >
                            {isUser ? (
                              <p className="whitespace-pre-wrap leading-relaxed wrap-break-word">{msg.content}</p>
                            ) : (
                              <Typewriter
                                key={messageId}
                                text={msg.content}
                                speed={5}
                                animate={isLastMessage && !isLoading}
                                isStreaming={isLoading && isLastMessage}
                              />
                            )}
                          </div>

                          {/* Fonti e Documenti */}
                          {!isUser && uniqueLinks.length > 0 && (
                            <div className="flex flex-col gap-1 mt-0.5 max-w-full">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 flex items-center gap-1 px-0.5">
                                <BookOpen size={11} className="text-[#e0a32e]" /> Fonti e Documenti Ufficiali:
                              </span>
                              <div className="flex flex-wrap gap-1.5">
                                {uniqueLinks.map((link: string, linkIdx: number) => (
                                  <a
                                    key={`${linkIdx}_${link}`}
                                    href={link}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs font-medium px-2.5 py-1 rounded-lg transition-all border flex items-center gap-1.5 max-w-full cursor-pointer bg-neutral-50/80 border-neutral-200/80 text-neutral-600 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-400 hover:border-[#e0a32e]/50 dark:hover:border-[#e0a32e]/50 hover:text-neutral-900 dark:hover:text-neutral-200"
                                  >
                                    <span className="shrink-0 text-[#e0a32e]">
                                      {link.includes('http') ? <Globe size={11} /> : <BookOpen size={11} />}
                                    </span>
                                    <span className="truncate">{formatSourceLabel(link)}</span>
                                    <ExternalLink size={10} className="opacity-60 shrink-0" />
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                  
                  {/* Indicatore di stato dinamico (Pallini ambra pulsanti) */}
                  {isLoading && (
                    <motion.div 
                      initial={{ opacity: 0, y: 6 }} 
                      animate={{ opacity: 1, y: 0 }} 
                      className="flex justify-start gap-2.5 items-center my-2"
                    >
                      <div className="px-4 py-3 rounded-2xl rounded-bl-xs border border-neutral-200/70 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex items-center gap-3 shadow-xs">
                        <div className="flex gap-1.5">
                          <span className="w-2 h-2 bg-[#e0a32e] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-[#e0a32e] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-[#e0a32e] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 animate-pulse">
                          {currentStatus || "Consultazione archivi in corso..."}
                        </span>
                      </div>
                    </motion.div>
                  )}
                  
                  {error && (
                    <div className="text-red-600 dark:text-red-400 text-xs sm:text-sm text-center mt-4 border border-red-500/30 bg-red-500/5 p-3 rounded-xl font-medium">
                      {error}
                    </div>
                  )}
                  <div ref={messagesEndRef} className="h-2" />
                </div>
              )}
            </div>

            {/* Area di Input Textarea */}
            <div className="p-3.5 sm:p-4 border-t border-neutral-200/70 dark:border-neutral-800 z-10 bg-white dark:bg-neutral-900 pb-safe">
              <div className="flex items-end gap-2 border border-neutral-200 dark:border-neutral-800 rounded-xl p-1.5 shadow-xs focus-within:border-[#e0a32e] dark:focus-within:border-[#e0a32e] transition-all bg-neutral-50/60 dark:bg-neutral-950/60">
                <textarea 
                  ref={textareaRef}
                  value={inputValue}
                  onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInputValue(e.target.value)}
                  onKeyDown={onKeyDownTextarea}
                  placeholder="Scrivi un quesito giuridico..."
                  rows={1}
                  className="flex-1 max-h-32 min-h-10 py-2 pl-3 bg-transparent border-none resize-none focus:outline-none focus:ring-0 text-sm placeholder:text-neutral-400 text-neutral-800 dark:text-neutral-100 font-light"
                  disabled={isLoading}
                />
                <button 
                  onClick={handleSend}
                  disabled={isLoading || !inputValue.trim()}
                  className="mb-0.5 mr-0.5 p-2.5 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-lg hover:opacity-90 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shrink-0 outline-none shadow-xs cursor-pointer"
                  aria-label="Invia messaggio"
                >
                  <Send size={15} className={`${inputValue.trim() && !isLoading ? 'translate-x-0.5 -translate-y-0.5' : ''} transition-transform`} />
                </button>
              </div>
              <div className="text-center mt-2">
                 <span className="text-[9px] text-neutral-400 dark:text-neutral-500 uppercase tracking-[0.15em] font-medium">Powered by Jurio</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Button Modal Trigger */}
      <motion.button 
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className={`
          fixed bottom-6 right-6 z-40
          flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-2xl shadow-xl 
          bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-neutral-100 dark:hover:bg-white dark:text-neutral-900 
          transition-colors border border-neutral-800 dark:border-neutral-200 cursor-pointer
          ${isOpen ? 'pointer-events-none' : 'opacity-100'}
        `}
        aria-label="Apri chat di supporto"
      >
        <MessageSquare size={24} className="text-[#e0a32e]" />
      </motion.button>
    </>
  );
};

export default JurioChatbot;