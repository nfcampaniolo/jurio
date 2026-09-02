import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquarePlus, Loader2 } from 'lucide-react';
import { type AttachedDocument } from '@/interfaces/interfaces';
import { fetchWithSecurity } from "@/config/apiClient";
import { withTrace } from "@/services/perf";
import { getText } from "@/config/env";

const EXTRACT_DOCUMENT_TEXT_URL = getText(); 

const documentCache: Record<string, string> = {};

interface DocumentViewerProps {
  documents: AttachedDocument[];
  onClose: () => void;
  onActionRequest: (actionType: 'quote' | 'semaforo' | 'distinguish', selectedText: string) => void;
  activeQuotes?: string[];
  onRemoveQuote?: (index: number) => void; 
}

export const DocumentViewer: React.FC<DocumentViewerProps> = ({ 
  documents, 
  onClose, 
  onActionRequest,
  activeQuotes = [],
  onRemoveQuote
}) => {
  const [activeDocId, setActiveDocId] = useState<string>(documents[0]?.id || '');
  
  const [docContent, setDocContent] = useState<string>("");
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  const [selectedText, setSelectedText] = useState("");
  const viewerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (documents.length > 0 && !documents.find(d => d.id === activeDocId)) {
      setActiveDocId(documents[0].id);
    }
    if (documents.length === 0) {
      onClose();
    }
  }, [documents, activeDocId, onClose]);

  const activeDoc = documents.find(d => d.id === activeDocId);

  // --- EFFETTO CARICAMENTO DOCUMENTO ---
  useEffect(() => {
    if (!activeDoc) return;

    let isMounted = true; 
    const currentDocId = activeDoc.id; 

    // 1. Controllo della CACHE
    if (documentCache[currentDocId]) {
      setDocContent(documentCache[currentDocId]);
      setIsLoading(false);
      setSelectedText("");
      return; 
    }

    // 2. FETCH (Se non è in cache)
    const loadDocumentText = async () => {
      setIsLoading(true);
      setDocContent("");
      setSelectedText("");

      try {
        if(!EXTRACT_DOCUMENT_TEXT_URL) throw new Error("URL Cloud Function non configurato");
        const userId = activeDoc.user || "default_user";
        const filePath = `users/${userId}/documents/${currentDocId}.pdf`;
        console.log("Tentativo di estrazione del documento:", filePath);
        const EXTRACT_ENDPOINT = EXTRACT_DOCUMENT_TEXT_URL;

        const { res, payload, rawText } = await withTrace(
          "extract_document_text",
          { doc_id: currentDocId, path_len: filePath.length },
          async () => {
            const response = await fetchWithSecurity(EXTRACT_ENDPOINT, { storagePath: filePath });
            const contentType = response.headers.get("content-type") || "";

            if (contentType.includes("application/json")) {
              const data = await response.json().catch(() => null);
              return { res: response, payload: data };
            } else {
              const text = await response.text().catch(() => null);
              return { res: response, rawText: text };
            }
          }
        );

        if (!isMounted) return;

        if (!res.ok || (payload && payload.error)) {
          throw new Error(payload?.error || rawText || `Errore HTTP: ${res.status}`);
        }

        let extractedText = "";
        if (payload && payload.text) {
          extractedText = payload.text;
        } else {
          throw new Error("Formato risposta non valido: testo mancante.");
        }

        // SALVA IN CACHE prima di aggiornare lo stato
        documentCache[currentDocId] = extractedText;
        setDocContent(extractedText);

      } catch (error: unknown) {
        if (!isMounted) return;
        console.error("Errore nel recupero del documento", error);
        setDocContent("⚠️ Si è verificato un errore durante l'estrazione del testo. Verifica che il file sia un PDF valido e riprova.");
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    loadDocumentText();

    return () => {
      isMounted = false;
    };
  }, [activeDoc]);

  const renderHighlightedText = (text: string, quotes: string[]) => {
    if (!quotes || quotes.length === 0) return text;
    
    const sortedQuotes = [...quotes].sort((a, b) => b.length - a.length);
    const escapedQuotes = sortedQuotes.map(q => q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const flexQuotes = escapedQuotes.map(q => q.replace(/\\?[ \n\r\t]+/g, '\\s+'));
    const regex = new RegExp(`(${flexQuotes.join('|')})`, 'gi');
    
    const parts = text.split(regex);
    
    return parts.map((part, i) => {
      const normalizedPart = part.replace(/\s+/g, ' ').toLowerCase().trim();
      const quoteIndex = quotes.findIndex(q => 
        q.replace(/\s+/g, ' ').toLowerCase().trim() === normalizedPart
      );
      
      if (quoteIndex !== -1 && part.trim() !== '') {
        return (
          <mark 
            key={i} 
            role="button"
            tabIndex={0}
            title="Clicca per rimuovere la citazione"
            onClick={(e) => {
              e.stopPropagation(); 
              if (onRemoveQuote) {
                onRemoveQuote(quoteIndex);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault(); // Previene lo scroll della pagina se si usa Spazio
                e.stopPropagation();
                if (onRemoveQuote) {
                  onRemoveQuote(quoteIndex);
                }
              }
            }}
            className="cursor-pointer bg-(--color-surface) text-(--color-text) border-b-2 border-(--color-text) rounded-sm px-0.5 transition-colors duration-200 outline-none focus-visible:ring-1 focus-visible:ring-(--color-text)"
          >
            {part}
          </mark>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const handleSelection = () => {
    setTimeout(() => {
      const selection = window.getSelection();
      const text = selection?.toString().trim() || "";
      
      if (text.length > 5) {
        setSelectedText(text);
      } else {
        setSelectedText("");
      }
    }, 50);
  };

  const handleActionClick = () => {
    onActionRequest('quote', selectedText);
    setSelectedText("");
    window.getSelection()?.removeAllRanges(); 
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: -50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
      className="flex-1 min-h-0 w-full flex flex-col relative z-40 bg-(--color-bg) overflow-hidden shadow-2xl md:shadow-none"
    >
      {/* HEADER TABS MULTIPLI */}
      <div className="flex flex-col shrink-0 bg-(--color-surface) border-b border-(--color-border) z-10">
        {documents.length > 1 && (
          <div className="flex items-center gap-2 px-3 py-2 overflow-x-auto custom-scrollbar no-scrollbar-on-mobile">
           {documents.map((doc, index) => (
              <button
                key={doc.id ? doc.id : `fallback-doc-key-${index}`}
                onClick={() => setActiveDocId(doc.id)}
                className={`shrink-0 max-w-50 truncate px-3 py-1.5 rounded-sm text-xs font-medium transition-all border outline-none ${
                  activeDocId === doc.id
                    ? 'bg-(--color-bg) border-(--color-text) text-(--color-text)'
                    : 'bg-(--color-surface) border-(--color-border) text-(--color-muted) hover:text-(--color-text)'
                }`}
              >
                {doc.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* AREA LETTURA */}
      <div 
        ref={viewerRef}
        className="flex-1 overflow-y-auto p-4 md:p-8"
        onMouseUp={handleSelection}
        onTouchEnd={handleSelection}
        onMouseDown={() => setSelectedText("")} 
      >
        <div className="max-w-3xl mx-auto bg-(--color-surface) border border-(--color-border) shadow-sm min-h-full p-6 md:p-12 rounded-lg text-(--color-text) text-sm md:text-base leading-relaxed relative pb-40">
          
          <div className="mb-8 border-b border-(--color-border) pb-4">
             <h2 className="text-xl font-medium tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
               {activeDoc?.name || 'Documento'}
             </h2>
             <p className="text-xs text-(--color-muted) font-light mt-1">
               Seleziona il testo da analizzare per portarlo nella chat.
             </p>
          </div>
          
          {isLoading ? (
            <div className="absolute inset-0 bg-(--color-surface)/80 flex flex-col items-center justify-center pt-20">
              <Loader2 className="w-8 h-8 animate-spin text-(--color-text) mb-4" />
              <p className="text-xs font-bold uppercase tracking-widest text-(--color-muted)">Estrazione testo in corso...</p>
            </div>
          ) : (
            <div className="whitespace-pre-wrap text-left leading-relaxed space-y-4 font-light tracking-wide text-(--color-text)">
              {renderHighlightedText(docContent, activeQuotes)}
            </div>
          )}

        </div>
      </div>

      {/* PULSANTE CITAZIONE */}
      <AnimatePresence>
        {selectedText.length > 5 && !isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="absolute bottom-24 md:bottom-12 left-1/2 -translate-x-1/2 z-100 pointer-events-auto pb-[env(safe-area-inset-bottom)]"
          >
            <button 
              onClick={handleActionClick}
              onMouseDown={(e) => e.stopPropagation()} 
              onTouchStart={(e) => e.stopPropagation()}
              className="flex items-center gap-2 px-6 py-3.5 bg-(--color-text) text-(--color-surface) rounded-md shadow-lg border border-(--color-border) hover:opacity-90 active:scale-95 transition-all outline-none"
            >
              <MessageSquarePlus size={18} className="opacity-90" /> 
              <span className="font-bold text-xs uppercase tracking-widest whitespace-nowrap">Cita Testo Selezionato</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};