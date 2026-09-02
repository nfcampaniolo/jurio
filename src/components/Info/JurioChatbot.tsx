import React, { useEffect, useRef } from 'react';
import { useJurioChatbot } from '@/hooks/useJurioChatbot';
import { Typewriter } from '@/components/Typewriter';
import ReactMarkdown from 'react-markdown';
import { 
  MessageSquare, 
  X, 
  RefreshCcw, 
  Send, 
  User, 
  Loader2,
  ExternalLink 
} from 'lucide-react';
import type { ChatMessage, SourceItem } from '@/services/chatLogic';

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

  // 1. Controllo iniziale dell'URL all'avvio del componente
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash === '#bot') {
        setIsOpen(true);
      }
    }
  }, [setIsOpen]);

  // 2. Sincronizzazione dello stato del chatbot con l'hash dell'URL (#bot)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const currentHash = window.location.hash;
    if (isOpen && currentHash !== '#bot') {
      // Aggiunge #bot senza ricaricare la pagina
      window.history.pushState(null, '', '#bot');
    } else if (!isOpen && currentHash === '#bot') {
      // Rimuove l'hash pulendo l'URL se il bot viene chiuso
      window.history.pushState(null, '', window.location.pathname + window.location.search);
    }
  }, [isOpen]);

  // Gestione anche del tasto "Indietro" del browser per aprire/chiudere correttamente
  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#bot') {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [setIsOpen]);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen, currentStatus]);

  return (
    <>
      {/* Finestra della Chat */}
      <div 
        className={`
          fixed z-100 flex flex-col overflow-hidden transition-all duration-300 ease-out
          
          /* MOBILE: Fullscreen */
          inset-0 w-full h-dvh rounded-none border-0
          ${isOpen ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-full opacity-0 pointer-events-none'}
          
          /* DESKTOP: Widget Flottante Ingrandito (Larghezza ~512px, Altezza ~768px) */
          sm:inset-auto sm:bottom-24 sm:right-6 sm:w-3xl sm:h-224 sm:max-h-[85vh] sm:rounded-xl sm:border sm:origin-bottom-right
          sm:${isOpen ? 'sm:translate-y-0 sm:scale-100' : 'sm:scale-90 sm:translate-y-4'}
        `}
        style={{
          backgroundColor: 'var(--color-surface)',
          borderColor: 'var(--color-border)',
          boxShadow: 'var(--shadow-soft)',
          color: 'var(--color-text)',
        }}
      >
        {/* LA LINEA DI RIGORE SUPERIORE */}
        <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

        {/* Header */}
        <div className="px-4 py-3 sm:p-4 flex justify-between items-center z-10 border-b border-(--color-border) bg-(--color-surface)">
          <div className="flex items-center gap-3 mt-1">
            <div className="shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-3xl overflow-hidden bg-(--color-bg) border border-(--color-border) flex items-center justify-center p-0.5">
              <img src="/logo.webp" alt="Jurio Logo" className="w-full h-full object-cover rounded-sm" />
            </div>
            <div>
              <h3 className="font-medium leading-tight text-base sm:text-lg tracking-tight" style={{ fontFamily: 'var(--font-serif)', color: 'var(--color-text)' }}>
                Jurio
              </h3>
              <p className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted)">Support Agent</p>
            </div>
          </div>
          <div className="flex items-center gap-1 opacity-80 hover:opacity-100 transition-opacity mt-1">
            <button 
              onClick={clearChat} 
              title="Svuota chat" 
              className="p-2 sm:p-2.5 bg-(--color-bg) hover:text-(--color-text) rounded-md border border-(--color-border) transition-colors outline-none"
            >
              <RefreshCcw size={16} />
            </button>
            <button 
              onClick={() => setIsOpen(false)} 
              title="Chiudi" 
              className="p-2 sm:p-2.5 bg-(--color-bg) hover:text-(--color-text) rounded-md border border-(--color-border) transition-colors outline-none"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Area Messaggi */}
        <div className="flex-1 p-4 sm:p-6 overflow-y-auto scroll-smooth overscroll-contain bg-(--color-bg)">
          {messages.map((msg: ChatMessage, idx: number) => {
            const isUser = msg.role === "user";
            const isLastMessage = idx === messages.length - 1;

            return (
              <div key={idx} className={`mb-6 flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
                {/* Avatar */}
                <div className={`shrink-0 w-8 h-8 rounded-3xl flex items-center justify-center mt-1 overflow-hidden border border-(--color-border)
                  ${isUser ? "bg-(--color-text) text-(--color-surface)" : "bg-(--color-surface) p-0.5"}`}
                >
                  {isUser ? <User size={16} /> : <img src="/logo.webp" alt="Jurio" className="w-full h-full object-cover rounded-3xl" />}
                </div>

                {/* Bubble & Fonti */}
                <div className="flex flex-col gap-2 max-w-[85%] sm:max-w-[75%]">
                  <div className={`
                    px-4 py-3 rounded-lg text-sm leading-relaxed shadow-sm border border-(--color-border)
                    ${isUser ? "bg-(--color-text) text-(--color-surface) rounded-tr-sm" : "bg-(--color-surface) text-(--color-text) rounded-tl-sm"}`}
                  >
                    <div className={`prose prose-sm max-w-none wrap-break-word font-light
                      ${isUser ? 'prose-invert text-(--color-surface)' : 'text-(--color-text)'}
                      prose-p:my-1 prose-a:underline hover:opacity-80`}
                    >
                      {!isUser && isLastMessage && !isLoading ? (
                        <Typewriter 
                          key={msg.content} 
                          text={msg.content} 
                          speed={10} 
                        />
                      ) : (
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      )}
                    </div>
                  </div>

                 {/* CHIP DELLE FONTI / LINK DI APPROFONDIMENTO */}
                  {!isUser && msg.sources && msg.sources.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {Array.from(
                        new Set(
                          msg.sources.flatMap((src: SourceItem) => src.links || [])
                        )
                      ).map((link: string, idx: number) => (
                        <a
                          key={idx}
                          href={link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-(--color-border) bg-(--color-surface) hover:border-(--color-text) transition-colors text-(--color-muted) hover:text-(--color-text)"
                        >
                          <span>{link}</span>
                          <ExternalLink size={12} />
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {/* Indicatore Typing con Status Dinamico dal Backend */}
          {isLoading && (
            <div className="flex justify-start mb-6 gap-3">
              <div className="shrink-0 w-8 h-8 rounded-md border border-(--color-border) bg-(--color-surface) flex items-center justify-center mt-1 overflow-hidden p-0.5">
                <img src="/logo.webp" alt="Jurio" className="w-full h-full object-cover rounded-sm" />
              </div>
              <div className="px-4 py-3 rounded-lg rounded-tl-sm border border-(--color-border) bg-(--color-surface) flex items-center gap-2 shadow-sm">
                <Loader2 size={16} className="animate-spin text-(--color-text)" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted)">
                  {currentStatus || "Jurio sta elaborando..."}
                </span>
              </div>
            </div>
          )}
          
          {error && (
            <div className="text-red-600 dark:text-red-400 text-xs sm:text-sm text-center mt-4 border border-red-500/30 bg-red-500/5 p-3 rounded-md font-medium">
              {error}
            </div>
          )}
          <div ref={messagesEndRef} className="h-2" />
        </div>

        {/* Input Area */}
        <div className="p-3 sm:p-4 border-t border-(--color-border) z-10 bg-(--color-surface) pb-safe">
          <div className="flex items-end gap-2 border border-(--color-border) rounded-md p-1.5 shadow-sm focus-within:border-(--color-text) transition-all bg-(--color-bg)">
            <textarea 
              value={inputValue}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInputValue(e.target.value)}
              onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Chiedi a Jurio..."
              rows={1}
              className="flex-1 max-h-32 min-h-11 py-2.5 pl-3 bg-transparent border-none resize-none focus:outline-none focus:ring-0 text-base sm:text-sm placeholder:text-(--color-muted) text-(--color-text) font-light"
              disabled={isLoading}
            />
            <button 
              onClick={handleSend}
              disabled={isLoading || !inputValue.trim()}
              className="mb-0.5 mr-0.5 p-2.5 sm:p-3 bg-(--color-text) text-(--color-surface) rounded-md hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shrink-0 outline-none shadow-sm"
              aria-label="Invia messaggio"
            >
              <Send size={16} className={`${inputValue.trim() && !isLoading ? 'translate-x-0.5 -translate-y-0.5' : ''} transition-transform`} />
            </button>
          </div>
          <div className="text-center mt-2 pb-1">
             <span className="text-[9px] text-(--color-muted) uppercase tracking-[0.15em] font-medium opacity-80">Powered by Jurio</span>
          </div>
        </div>
      </div>

      {/* Bottone Floating Esterno */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`
          fixed bottom-6 right-6 z-90
          flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-md shadow-lg 
          bg-(--color-text) hover:opacity-90 text-(--color-surface) transition-all duration-300
          hover:-translate-y-1 active:scale-95 border border-(--color-border)
          ${isOpen ? 'opacity-0 scale-50 pointer-events-none' : 'opacity-100 scale-100'}
        `}
        aria-label="Apri chat di supporto"
      >
        <MessageSquare size={24} />
      </button>
    </>
  );
};

export default JurioChatbot;