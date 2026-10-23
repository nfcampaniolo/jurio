import { useEffect, useRef, useState, type RefObject } from "react";
import { motion } from "framer-motion";
import { Check, Copy, Scale, Globe, BookOpen } from "lucide-react";
import { toast } from "react-hot-toast";
import { Typewriter } from "@/shared/components/Typewriter";
import { type Source, type Message } from "@/interfaces/interfaces";
import { getSourceCitationLabel } from "../utils/sourceCitationLabel";
import { FeedbackComponent } from "@/shared/components/FeedbackComponent";

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
  agentStatusText: string;
  messagesEndRef: RefObject<HTMLDivElement | null>;
  activeSourceId: string | null;
  setActiveSourceId: (id: string | null) => void;
  handleSourceClick: (e: React.MouseEvent, source: Source) => void;
}

export const MessageList = ({
  messages,
  isStreaming,
  agentStatusText,
  messagesEndRef,
  activeSourceId,
  setActiveSourceId,
  handleSourceClick
}: MessageListProps) => {
  const [completedMessages, setCompletedMessages] = useState<Record<string, boolean>>({});
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
  }, []);

  const copyMessage = async (message: Message) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedMessageId(message.id);
      if (copiedTimeoutRef.current) clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = setTimeout(() => setCopiedMessageId(null), 1500);
    } catch (error) {
      console.error("[MessageList] Impossibile copiare il messaggio:", error);
      toast.error("Impossibile copiare il messaggio.");
    }
  };

  const handleTypingComplete = (id: string) => {
    setCompletedMessages((prev) => ({ ...prev, [id]: true }));
  };

  return (
    <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:pr-12 w-full custom-scrollbar">
      
      {messages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center text-neutral-400 dark:text-neutral-500 space-y-3 my-auto">
          <div className="p-4 rounded-full bg-neutral-100 dark:bg-neutral-800/50 border border-neutral-200/60 dark:border-neutral-800">
            <Scale size={40} className="text-[#e0a32e] opacity-80" />
          </div>
          <p className="text-sm md:text-base px-4 max-w-sm mx-auto font-medium text-neutral-600 dark:text-neutral-400">
            Inizia descrivendo la fattispecie o ponendo un quesito giuridico.
          </p>
        </div>
      ) : (
        <div className="flex flex-col space-y-5 md:space-y-6">
          {messages.map((msg, index) => {
            const isLastMessage = index === messages.length - 1;
            const shouldAnimate = isLastMessage && !msg.isHistorical;
            const isFullyDisplayed = !shouldAnimate || (!isStreaming && completedMessages[msg.id]);
            
            const sourceIds = msg.sources 
              ? msg.sources.map(s => s.documento_id || s._id_interno || s.url_riferimento || s.link || 'fonte-sconosciuta')
              : [];

            return (
              <motion.div 
                key={msg.id} 
                id={`msg-${msg.id}`}
                initial={msg.isHistorical ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }} 
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={`group flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[95%] md:max-w-[88%] min-w-0 flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  
                  {/* BUBBLE MESSAGGIO */}
                  <div 
                    className={`p-4 md:p-5 text-[15px] md:text-base wrap-break-word min-w-0 w-full transition-shadow ${
                      msg.role === 'user' 
                        ? 'bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900 rounded-2xl rounded-br-xs antialiased font-normal shadow-sm' 
                        : 'bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 rounded-2xl rounded-bl-xs border border-neutral-200/70 dark:border-neutral-800/80 shadow-xs'
                    }`}
                  >                            
                    {/* STATO DI ATTESA INIZIALE (PULSATING DOTS) */}
                    {msg.role === 'model' && !msg.content && isStreaming ? (
                      <div className="flex items-center gap-3 py-1">
                        <div className="flex gap-1.5">
                          <span className="w-2 h-2 bg-[#e0a32e] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                          <span className="w-2 h-2 bg-[#e0a32e] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                          <span className="w-2 h-2 bg-[#e0a32e] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                        </div>
                        <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400 animate-pulse">
                          {agentStatusText || "Consultazione archivi in corso..."}
                        </span>
                      </div>
                    ) : msg.role === 'model' ? (
                      <Typewriter 
                        key={msg.id} 
                        text={msg.content} 
                        speed={5} 
                        animate={shouldAnimate}
                        isStreaming={isStreaming && isLastMessage} // FIX FONDAMENTALE PASSATO AL TYPEWRITER
                        onComplete={() => handleTypingComplete(msg.id)}
                      />
                    ) : (
                      <p className="whitespace-pre-wrap leading-relaxed wrap-break-word">{msg.content}</p>
                    )}
                  </div>

                  {msg.content && (
                    <button
                      type="button"
                      onClick={() => void copyMessage(msg)}
                      aria-label={copiedMessageId === msg.id ? "Messaggio copiato" : "Copia messaggio"}
                      title={copiedMessageId === msg.id ? "Messaggio copiato" : "Copia messaggio"}
                      className="self-end inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-neutral-500 opacity-100 transition-opacity hover:bg-neutral-100 hover:text-neutral-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e0a32e] sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
                    >
                      {copiedMessageId === msg.id ? <Check size={14} /> : <Copy size={14} />}
                      <span>{copiedMessageId === msg.id ? "Copiato" : "Copia"}</span>
                    </button>
                  )}

                  {/* FONTI INLINE (PILLOLE ELEGANTE) */}
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-0.5 max-w-full">
                      {msg.sources.map((s: Source, idx: number) => {
                        const isWeb = s._type === 'web_search';
                        const sId = s.documento_id || s._id_interno || s.url_riferimento || s.link || `inline-src-${idx}`;
                        const sTitle = isWeb 
                          ? (s.fonte_web || s.fonte || 'Fonte Web') 
                          : getSourceCitationLabel(s);
                        
                        const isActive = activeSourceId === sId;

                        return (
                          <button 
                            key={`${sId}-${idx}`} 
                            aria-label={sTitle || "Apri fonte"}
                            onClick={(e) => handleSourceClick(e, s)}
                            onMouseEnter={() => setActiveSourceId(sId)} 
                            onMouseLeave={() => setActiveSourceId(null)} 
                            className={`text-xs font-medium px-2.5 py-1 rounded-lg transition-all border flex items-center gap-1.5 max-w-full cursor-pointer ${
                              isActive 
                                ? 'bg-amber-50 border-[#e0a32e] text-amber-900 dark:bg-amber-950/40 dark:border-[#e0a32e]/80 dark:text-amber-200 shadow-xs scale-[1.02]' 
                                : 'bg-neutral-50/80 border-neutral-200/80 text-neutral-600 dark:bg-neutral-900 dark:border-neutral-800 dark:text-neutral-400 hover:border-[#e0a32e]/50 dark:hover:border-[#e0a32e]/50 hover:text-neutral-900 dark:hover:text-neutral-200'
                            }`}
                          >
                            <span className="shrink-0 text-[#e0a32e]">
                              {isWeb ? <Globe size={11} /> : <BookOpen size={11} />}
                            </span>
                            {sTitle && <span className="truncate flex-1 min-w-0 max-w-35 sm:max-w-45">{sTitle}</span>}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {msg.role === "model" && msg.content && (!msg.sources || msg.sources.length === 0) && (
                    <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-300" role="note">
                      Nessuna fonte verificabile disponibile per questa risposta.
                    </p>
                  )}

                  {/* COMPONENTE FEEDBACK */}
                  {msg.role === 'model' && msg.content && isFullyDisplayed && (
                    <motion.div 
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2 }}
                      className="self-end flex items-center gap-2 mt-1 px-1"
                    >
                      <span className="text-xs text-neutral-400 dark:text-neutral-500 font-normal">
                        Valuta questa risposta
                      </span>
                      <FeedbackComponent sourceIds={sourceIds} />
                    </motion.div>
                  )}
                  
                </div>
              </motion.div>
            );
          })}
          
          <div ref={messagesEndRef} className="h-2 shrink-0" />
        </div>
      )}
    </div>
  );
};
