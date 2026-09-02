import { motion } from "framer-motion";
import { Scale, Globe, BookOpen } from "lucide-react";
import { Typewriter } from "@/components/Typewriter";
import { type Source, type Message } from "@/interfaces/interfaces";
import { type RefObject } from "react";

// IMPORTA IL COMPONENTE DI FEEDBACK
import { FeedbackComponent } from "@/components/FeedbackComponent";

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

  // Funzione per gestire il feedback inviato dal componente
  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 lg:pr-16 space-y-4 md:space-y-6 scroll-smooth w-full custom-scrollbar">
      {messages.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-center text-neutral-400 space-y-3">
          <Scale size={48} className="opacity-20" />
          <p className="text-sm md:text-base px-4 max-w-sm mx-auto">
            Inizia descrivendo la fattispecie o ponendo una domanda giuridica.
          </p>
        </div>
      ) : (
        messages.map((msg, index) => {
          const isLastMessage = index === messages.length - 1;
          
          // Estrapoliamo l'elenco degli ID dalle fonti, se presenti, da mandare in pasto al feedback
          const sourceIds = msg.sources 
            ? msg.sources.map(s => s.documento_id || s._id_interno || s.url_riferimento || s.link || 'fonte-sconosciuta')
            : [];

          return (
            <motion.div 
              key={msg.id} 
              id={`msg-${msg.id}`}
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }} 
              className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`max-w-[95%] md:max-w-[90%] min-w-0 flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div 
                  className={`p-4 text-[15px] md:text-base wrap-break-word min-w-0 w-full ${
                    msg.role === 'user' 
                      ? 'bg-stone-700 text-white rounded-2xl rounded-br-sm antialiased font-normal tracking-tight shadow-sm md:shadow-md transition-shadow' 
                      : 'bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 rounded-2xl rounded-bl-sm'
                  }`}
                >                            
                  {msg.role === 'model' && !msg.content && isStreaming ? (
                    <div className="flex items-center gap-3 py-1">
                      <div className="flex gap-1.5">
                        <span className="w-2 h-2 bg-stone-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-stone-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-stone-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400 animate-pulse">
                        {agentStatusText || "Elaborazione in corso..."}
                      </span>
                    </div>
                  ) : msg.role === 'model' ? (
                    <Typewriter 
                      key={msg.id} 
                      text={msg.content} 
                      speed={5} 
                      animate={isLastMessage && !msg.isHistorical}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap leading-relaxed wrap-break-word">{msg.content}</p>
                  )}
                </div>
                
                {/* FONTI INLINE */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1 max-w-full">
                    {msg.sources.map((s: Source, idx: number) => {
                      const isWeb = s._type === 'web_search';
                      const sId = s.documento_id || s._id_interno || s.url_riferimento || s.link || `inline-src-${idx}`;
                      const organoPrefix = s.organo_giudicante ? `${s.organo_giudicante}: ` : '';

                      const sTitle = isWeb 
                        ? (s.fonte_web || s.fonte || 'Web') 
                        : (s.identificativo 
                            ? `${organoPrefix} ${s.identificativo}`.trim() 
                            : (s.numero_sentenza 
                                ? `${organoPrefix || 'Sent.'} n. ${s.numero_sentenza}`.trim() 
                                : '')
                          );
                      return (
                        <button 
                          key={`${sId}-${idx}`} 
                          onClick={(e) => handleSourceClick(e, s)}
                          onMouseEnter={() => setActiveSourceId(sId)} 
                          onMouseLeave={() => setActiveSourceId(null)} 
                          className={`text-[10px] md:text-xs font-semibold px-2.5 py-1.5 sm:px-2 sm:py-1 rounded-md transition-all border flex items-center gap-1 max-w-full ${
                            activeSourceId === sId 
                              ? 'bg-stone-100 border-yellow-300 text-yellow-800 dark:bg-stone-900/60 dark:border-yellow-500/50 dark:text-yellow-300 scale-105 shadow-sm' 
                              : 'bg-white border-neutral-200 text-neutral-500 dark:bg-neutral-900 dark:border-neutral-700 dark:text-neutral-400 hover:border-yellow-200 dark:hover:border-yellow-800'
                          }`}
                        >
                          <span className="shrink-0">
                            {isWeb ? <Globe size={10} className="opacity-70" /> : <BookOpen size={10} className="opacity-70" />}
                          </span>
                          <span className="truncate flex-1 min-w-0 max-w-30 sm:max-w-37.5">{sTitle}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* --- COMPONENTE FEEDBACK --- */}
                {msg.role === 'model' && msg.content && (
                 <div className="self-end flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    Valuta questa risposta
                  </span>

                  <FeedbackComponent
                    sourceIds={sourceIds}
                  />
                </div>
                )}
                
              </div>
            </motion.div>
          );
        })
      )}
      <div ref={messagesEndRef} className="h-2" />
    </div>
  );
};