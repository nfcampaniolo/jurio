import React from 'react';
import { ThumbsUp, ThumbsDown, X, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useFeedback } from '@/shared/hooks/useFeedback'; // Adegua il path d'importazione

interface FeedbackComponentProps {
  sourceIds: string | string[];
}

export const FeedbackComponent: React.FC<FeedbackComponentProps> = ({ sourceIds }) => {
  const {
    vote,
    loading,
    isModalOpen,
    notes,
    setNotes,
    submitFeedback,
    openModal,
    closeModal
  } = useFeedback(sourceIds);

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => submitFeedback(true)}
          disabled={loading || vote !== null} // <-- Aggiornato qui
          className={`p-2 rounded-md transition-colors outline-none flex items-center justify-center
            ${vote === 'up' 
              ? 'text-green-600 bg-green-50/10 dark:text-green-400' 
              : 'text-(--color-muted) hover:text-(--color-text) hover:bg-(--color-surface) cursor-pointer'
            }
            ${(loading || (vote !== null && vote !== 'up')) ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          title="Positivo"
          aria-label="Valuta positivamente"
        >
          {loading && vote === null ? (
            <Loader2 size={16} className="animate-spin opacity-80" />
          ) : (
            <ThumbsUp size={16} className={vote === 'up' ? "fill-current" : "opacity-80"} />
          )}
        </button>
        
        <button
          type="button"
          onClick={openModal}
          disabled={loading || vote !== null} // <-- Aggiornato qui
          className={`p-2 rounded-md transition-colors outline-none flex items-center justify-center
            ${vote === 'down' 
              ? 'text-red-600 bg-red-50/10 dark:text-red-400' 
              : 'text-(--color-muted) hover:text-(--color-text) hover:bg-(--color-surface) cursor-pointer'
            }
            ${(loading || (vote !== null && vote !== 'down')) ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          title="Negativo"
          aria-label="Valuta negativamente"
        >
          <ThumbsDown size={16} className={vote === 'down' ? "fill-current" : "opacity-80"} />
        </button>
      </div>

      {/* Modal Feedback Negativo */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={closeModal}
              className="absolute inset-0 bg-black/40 backdrop-blur-xs"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative bg-(--color-surface) rounded-lg border border-(--color-border) shadow-(--shadow-soft) w-full max-w-md overflow-hidden z-10 text-(--color-text)"
            >
              <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

              <div className="flex justify-between items-center p-5 border-b border-(--color-border) bg-(--color-bg) mt-1">
                <h3 className="text-base sm:text-lg font-medium tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
                  Cosa non ha funzionato?
                </h3>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={loading} // <-- Aggiornato qui
                  className="p-1 rounded-sm text-(--color-muted) hover:text-(--color-text) transition-colors outline-none cursor-pointer disabled:opacity-50"
                  aria-label="Chiudi"
                >
                  <X size={18} />
                </button>
              </div>
              
              <div className="p-5">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={loading} // <-- Aggiornato qui
                  placeholder="Aggiungi dei dettagli (opzionale)..."
                  className="w-full min-h-30 p-3 text-xs sm:text-sm font-light bg-(--color-bg) text-(--color-text) rounded-md border border-(--color-border) outline-none focus:border-(--color-text) shadow-xs transition-colors resize-y placeholder:text-(--color-muted) disabled:opacity-70"
                />
              </div>
              
              <div className="p-4 bg-(--color-bg) flex justify-end gap-2.5 border-t border-(--color-border)">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={loading} // <-- Aggiornato qui
                  className="px-4 py-2 bg-(--color-surface) border border-(--color-border) text-(--color-text) rounded-md text-xs font-bold uppercase tracking-widest hover:border-(--color-text) transition-colors shadow-xs outline-none cursor-pointer disabled:opacity-50"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={() => submitFeedback(false, notes)}
                  disabled={loading} // <-- Aggiornato qui
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-(--color-text) text-(--color-surface) rounded-md text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity shadow-xs outline-none cursor-pointer min-w-35 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? ( // <-- Aggiornato qui
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Invio...
                    </>
                  ) : (
                    "Invia Feedback"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};