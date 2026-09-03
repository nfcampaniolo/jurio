import { type RefObject, useState, useEffect, useRef, useCallback } from "react";
import { FileText, X, Sliders, Paperclip, Loader2, Send, Mic, AlertCircle, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { type AttachedDocument } from "@/interfaces/interfaces";
import type {
  ISpeechRecognition,
  SpeechWindow,
  SpeechRecognitionEvent,
  SpeechRecognitionErrorEvent
} from "@/shared/hooks/speech-recognition"; 

interface ChatInputProps {
  inputValue: string;
  setInputValue: (value: string) => void;
  handleSendMessage: () => void;
  attachedDocs: AttachedDocument[];
  removeAttachment: (id: string) => void;
  clearAllAttachments: () => void;
  setViewMode: (mode: 'chat' | 'workspace') => void;
  viewMode: 'chat' | 'workspace';
  activeQuote: string[];
  removeQuote: (index: number) => void;
  setShowFilters: (show: boolean) => void;
  activeFiltersCount: number;
  setShowDocsModal: (show: boolean) => void;
  isProcessingFiles: boolean;
  isStreaming: boolean;
  textAreaRef: RefObject<HTMLTextAreaElement | null>;
  isReadOnly?: boolean;
}

// --- COMPONENTE VISUALIZZATORE ONDE (Rigoroso e Monocromatico) ---
const VoiceVisualizer = () => {
  return (
    <div className="flex-1 flex items-center justify-center h-10 px-4 bg-(--color-bg) rounded-md border border-(--color-border)">
      <div className="flex items-center gap-1.5 h-6">
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            animate={{ height: ["20%", "100%", "20%"] }}
            transition={{
              repeat: Infinity,
              duration: 0.8 + (i * 0.1),
              ease: "easeInOut",
              delay: i * 0.1
            }}
            className="w-1 bg-(--color-text) rounded-sm opacity-70"
          />
        ))}
        <span className="ml-4 text-[10px] font-bold text-(--color-muted) uppercase tracking-widest animate-pulse">
          Ascolto in corso...
        </span>
      </div>
    </div>
  );
};

export const ChatInput = ({
  inputValue,
  setInputValue,
  handleSendMessage,
  attachedDocs,
  removeAttachment,
  clearAllAttachments,
  setViewMode,
  viewMode,
  activeQuote,
  removeQuote,
  setShowFilters,
  activeFiltersCount,
  setShowDocsModal,
  isProcessingFiles,
  isStreaming,
  textAreaRef,
  isReadOnly = false 
}: ChatInputProps) => {
  
  const [isRecording, setIsRecording] = useState(false);
  const [conflictText, setConflictText] = useState<string | null>(null);
  
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const inputValueRef = useRef(inputValue);
  
  useEffect(() => {
    inputValueRef.current = inputValue;
  }, [inputValue]);

  const handleVoiceResult = useCallback((transcript: string) => {
    if (isReadOnly) return;
    const currentInput = inputValueRef.current.trim();
    const cleanTranscript = transcript.toLowerCase().replace(/[.,!?]/g, "").trim();
    const words = cleanTranscript.split(/\s+/);
    const hasTriggerWord = words.some(w => ['invia', 'manda', 'vai'].includes(w));
    const isShortCommand = words.length < 5;
    const isTriggerCommand = hasTriggerWord && isShortCommand;
    
    if (currentInput.length > 0) {
      if (isTriggerCommand) {
        handleSendMessage();
      } else {
        setConflictText(transcript);
      }
    } else {
      if (isTriggerCommand) {
        return; 
      }
      setInputValue(transcript);
    }
  }, [handleSendMessage, setInputValue, isReadOnly]);

  useEffect(() => {
    const speechWindow = window as unknown as SpeechWindow;
    const SpeechRecognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'it-IT';

      recognition.onresult = (event: SpeechRecognitionEvent) => {
        const transcript = event.results[0][0].transcript.trim();
        handleVoiceResult(transcript);
      };

      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Errore riconoscimento vocale:", event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    }
  }, [handleVoiceResult]);

  const toggleRecording = () => {
    if (isReadOnly) return;
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    } else {
      if (recognitionRef.current) {
        setConflictText(null);
        try {
          recognitionRef.current.start();
          setIsRecording(true);
        } catch (e) {
          console.error("Microfono già in uso o errore di avvio", e);
        }
      } else {
        alert("Il tuo browser non supporta il riconoscimento vocale nativo.");
      }
    }
  };

  const handleConflictResolve = (action: 'replace' | 'append' | 'cancel') => {
    if (!conflictText || isReadOnly) return;

    if (action === 'replace') {
      setInputValue(conflictText);
      setTimeout(() => handleSendMessage(), 100);
    } else if (action === 'append') {
      const currentText = inputValueRef.current.trim();
      setInputValue(currentText ? `${currentText} ${conflictText}` : conflictText);
    }
    
    setConflictText(null);
  };

  return (
    <div className="shrink-0 bg-(--color-surface) border-t border-(--color-border) pb-[env(safe-area-inset-bottom)] w-full">
      <div className="p-3 md:p-4 max-w-5xl mx-auto">
        
        {/* CONTENITORE PRINCIPALE INPUT */}
        <div className="relative bg-(--color-surface) border border-(--color-border) rounded-lg shadow-(--shadow-soft) flex flex-col transition-all duration-300 focus-within:border-(--color-text) overflow-hidden">

          {/* ALLEGATI */}
          {attachedDocs.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-b border-(--color-border) bg-(--color-bg) mt-1">
              {attachedDocs.map(doc => (
                <span 
                  key={doc.id} 
                  role="button"
                  tabIndex={0}
                  onClick={() => setViewMode('workspace')}
                  onKeyDown={(e) => {
                    // Attiva l'azione se l'utente preme Invio o Spazio
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setViewMode('workspace');
                    }
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-(--color-surface) rounded-md text-[11px] font-semibold tracking-wide text-(--color-text) border border-(--color-border) shadow-sm cursor-pointer hover:bg-(--color-bg) transition-colors max-w-[85%] outline-none focus-visible:ring-1 focus-visible:ring-(--color-text)"
                >
                  <FileText size={14} className="text-(--color-text) opacity-70 shrink-0" />
                  <span className="truncate flex-1 min-w-0 uppercase">{doc.name}</span>
                  {!isReadOnly && (
                    <button 
                      onClick={(e) => { e.stopPropagation(); removeAttachment(doc.id); }} 
                      disabled={isProcessingFiles || isStreaming || isReadOnly}
                      className="ml-1 p-0.5 text-(--color-muted) hover:text-(--color-text) hover:bg-(--color-border) transition-colors disabled:opacity-50 rounded-sm flex items-center justify-center shrink-0 outline-none"
                    >
                      <X size={14} />
                    </button>
                  )}
                </span>
              ))}
              {!isReadOnly && (
                <button 
                  onClick={clearAllAttachments}
                  disabled={isProcessingFiles || isStreaming}
                  className="ml-auto text-[10px] font-bold uppercase tracking-widest text-(--color-muted) hover:text-(--color-text) transition-colors px-2 py-1 disabled:opacity-50 shrink-0 outline-none"
                >
                  Rimuovi tutti
                </button>
              )}
            </div>
          )}

          {/* LISTA CITAZIONI ATTIVE */}
          {activeQuote.length > 0 && !conflictText && !isRecording && (
            <div className="flex flex-col gap-1.5 px-4 py-3 border-b border-(--color-border) bg-(--color-bg) max-h-40 overflow-y-auto custom-scrollbar mt-1">
              {activeQuote.map((quote, idx) => (
                <div key={idx} className="flex items-start gap-3 group">
                  <div className="mt-0.5 flex-1 text-sm text-(--color-text) font-serif italic border-l-2 border-(--color-text) pl-3 line-clamp-2" title={quote}>
                    "{quote}"
                  </div>
                  {!isReadOnly && (
                    <button 
                      onClick={() => removeQuote(idx)}
                      className="p-1 opacity-60 group-hover:opacity-100 text-(--color-muted) hover:text-(--color-text) hover:bg-(--color-border) transition-all rounded-sm shrink-0 outline-none"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* BARRA DI INPUT */}
          <div className="flex items-end gap-2 p-2 w-full min-h-14">
            
            {/* Tasti laterali (Filtri / Allega) - Nascosti o disabilitati se in sola lettura */}
            {(!isRecording && !conflictText) && (
              <>
                <button 
                  onClick={() => setShowFilters(true)} 
                  disabled={isProcessingFiles || isStreaming || isReadOnly}
                  className={`w-10 h-10 flex items-center justify-center rounded-md transition-all relative shrink-0 disabled:opacity-50 outline-none
                    ${activeFiltersCount > 0 
                      ? 'bg-(--color-text) text-(--color-surface)' 
                      : 'text-(--color-muted) hover:text-(--color-text) hover:bg-(--color-bg)'}`}
                >
                  <Sliders size={18} />
                  {activeFiltersCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-sm bg-(--color-surface) opacity-40"></span>
                      <span className="relative inline-flex rounded-sm h-2 w-2 bg-(--color-surface) border border-(--color-text)"></span>
                    </span>
                  )}
                </button>

                <button 
                  onClick={() => setShowDocsModal(true)} 
                  disabled={isProcessingFiles || isStreaming || isReadOnly}
                  className="w-10 h-10 flex items-center justify-center text-(--color-muted) hover:text-(--color-text) hover:bg-(--color-bg) rounded-md transition-colors shrink-0 disabled:opacity-50 outline-none"
                >
                  <Paperclip size={18} />
                </button>
              </>
            )}

            {/* AREA CENTRALE */}
            <div className="flex-1 min-w-0 flex items-center">
              <AnimatePresence mode="wait">
                {conflictText && !isReadOnly ? (
                  <motion.div 
                    key="conflict"
                    initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                    className="flex-1 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-(--color-bg) p-2 rounded-md border border-(--color-border)"
                  >
                    <div className="flex items-center gap-2 text-(--color-text) text-xs md:text-sm px-2">
                      <AlertCircle size={16} className="shrink-0 opacity-80" />
                      <span className="truncate max-w-50 md:max-w-xs font-medium" title={conflictText}>
                        Hai detto: "{conflictText}"
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 w-full md:w-auto overflow-x-auto px-1">
                      <button onClick={() => handleConflictResolve('replace')} className="px-3 py-1.5 bg-(--color-text) text-(--color-surface) text-[10px] font-bold uppercase tracking-widest rounded-sm hover:opacity-80 transition-opacity whitespace-nowrap outline-none">
                        Sostituisci
                      </button>
                      <button onClick={() => handleConflictResolve('append')} className="px-3 py-1.5 bg-(--color-surface) text-(--color-text) border border-(--color-border) text-[10px] font-bold uppercase tracking-widest rounded-sm hover:bg-(--color-bg) transition-colors whitespace-nowrap outline-none">
                        Aggiungi
                      </button>
                      <button onClick={() => handleConflictResolve('cancel')} className="p-1.5 text-(--color-muted) hover:text-(--color-text) transition-colors outline-none ml-1">
                        <X size={16} />
                      </button>
                    </div>
                  </motion.div>
                ) : isRecording && !isReadOnly ? (
                  <motion.div key="recording" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex-1">
                    <VoiceVisualizer />
                  </motion.div>
                ) : (
                  <motion.div key="input" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex items-center">
                    <textarea 
                      ref={textAreaRef}
                      value={inputValue} 
                      onChange={(e) => setInputValue(e.target.value)} 
                      onKeyDown={(e) => { 
                        if (e.key === 'Enter' && !e.shiftKey && window.innerWidth >= 768 && !isReadOnly) { 
                          e.preventDefault(); 
                          handleSendMessage(); 
                        } 
                      }} 
                      disabled={isProcessingFiles || isStreaming || isReadOnly} 
                      placeholder={
                        isReadOnly ? "Fascicolo in sola lettura (non sei il proprietario)" :
                        isProcessingFiles ? "Elaborazione in corso..." : 
                        isStreaming ? "Generazione risposta in corso..." : 
                        viewMode === 'workspace' ? "Fai una domanda sul documento analizzato..." : "Inserisci il tuo quesito giuridico..."
                      } 
                      rows={1}
                      className="flex-1 max-h-50 min-h-10 bg-transparent resize-none outline-none py-2.5 px-3 text-[16px] md:text-sm leading-relaxed text-(--color-text) placeholder:text-(--color-muted) disabled:cursor-not-allowed overflow-y-auto custom-scrollbar w-full min-w-0"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* BOTTONI DESTRI (Mic e Send / Lock se ReadOnly) */}
            <div className="flex items-center gap-1 shrink-0 ml-1">
              {isReadOnly ? (
                <div className="flex items-center gap-1.5 px-3 py-2 text-(--color-muted) bg-(--color-bg) border border-(--color-border) rounded-md text-xs font-medium" title="Questo fascicolo è condiviso in sola lettura. Non puoi inviare messaggi.">
                  <Lock size={14} />
                  <span className="hidden md:inline uppercase text-[10px] tracking-widest font-bold">Sola lettura</span>
                </div>
              ) : (
                <>
                  {!conflictText && (
                    <button
                      onClick={toggleRecording}
                      disabled={isProcessingFiles || isStreaming}
                      className={`w-10 h-10 flex items-center justify-center rounded-md transition-all duration-300 shrink-0 disabled:opacity-50 outline-none
                        ${isRecording 
                          ? 'bg-(--color-text) text-(--color-surface) animate-pulse' 
                          : 'text-(--color-muted) hover:text-(--color-text) hover:bg-(--color-bg)'}`}
                      title="Dettatura vocale (oppure dì 'invia' per spedire)"
                    >
                      <Mic size={18} className={isRecording ? "scale-110 transition-transform" : ""} />
                    </button>
                  )}

                  <button 
                    onClick={handleSendMessage} 
                    disabled={(!inputValue.trim() && attachedDocs.length === 0 && !conflictText) || isProcessingFiles || isStreaming || isRecording} 
                    className={`w-10 h-10 flex items-center justify-center rounded-md transition-all duration-200 shrink-0 outline-none
                      ${(!inputValue.trim() && attachedDocs.length === 0 && !conflictText) || isProcessingFiles || isStreaming || isRecording
                        ? 'bg-(--color-bg) text-(--color-muted) border border-(--color-border) cursor-not-allowed' 
                        : 'bg-(--color-text) hover:opacity-80 text-(--color-surface) active:scale-95 shadow-sm'}`}
                  >
                    {isProcessingFiles ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : isStreaming ? (
                      <div className="flex gap-1 items-center justify-center w-full h-full">
                        <span className="w-1 h-1 bg-current rounded-sm animate-bounce [animation-delay:-0.3s]"></span>
                        <span className="w-1 h-1 bg-current rounded-sm animate-bounce [animation-delay:-0.15s]"></span>
                        <span className="w-1 h-1 bg-current rounded-sm animate-bounce"></span>
                      </div>
                    ) : (
                      <Send size={16} className={inputValue.trim() || attachedDocs.length > 0 ? "translate-x-0.5" : ""} />
                    )}
                  </button>
                </>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};