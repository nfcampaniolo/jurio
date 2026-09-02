import React from "react";
import { motion } from "framer-motion";
import { FiFileText, FiX } from "react-icons/fi";

interface ExtractedTextModalProps {
  showText: boolean;
  setShowText: (show: boolean) => void;
  extractedText: string | null;
  setExtractedText: (text: string) => void;
  loading: boolean;
}

export const ExtractedTextModal: React.FC<ExtractedTextModalProps> = ({
  showText,
  setShowText,
  extractedText,
  setExtractedText,
  loading,
}) => {
  if (!showText) return null;

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowText(false)} className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm" />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ duration: 0.2 }} className="fixed left-1/2 top-1/2 z-50 w-full max-w-4xl -translate-x-1/2 -translate-y-1/2 p-4">
        <div className="relative flex flex-col w-full max-h-[85vh] overflow-hidden rounded-lg bg-(--color-surface) shadow-(--shadow-soft) border border-(--color-border)">
          {/* LA LINEA DI RIGORE SUPERIORE (Unico tocco di colore) */}
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

          <div className="flex items-center justify-between border-b border-(--color-border) bg-(--color-bg) px-6 py-4 mt-1">
            <div className="flex items-center gap-2.5">
              <FiFileText className="text-(--color-text) opacity-70" size={18} />
              <h3 className="text-sm font-medium text-(--color-text) tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>Testo Estratto</h3>
            </div>
            <button onClick={() => setShowText(false)} className="rounded-md p-1.5 text-(--color-muted) hover:text-(--color-text) hover:bg-(--color-surface) transition-colors outline-none" aria-label="Chiudi modale">
              <FiX size={18} />
            </button>
          </div>
          <div className="flex-1 overflow-auto p-6 bg-(--color-surface)">
            <textarea
              value={extractedText || ""}
              onChange={(e) => setExtractedText(e.target.value)}
              className="w-full h-[50vh] min-h-75 resize-none rounded-md border border-(--color-border) bg-(--color-bg) p-4 text-sm text-(--color-text) font-light outline-none leading-relaxed focus:border-(--color-text) transition-colors"
              disabled={loading}
              spellCheck={false}
            />
          </div>
          <div className="flex justify-end gap-2 border-t border-(--color-border) bg-(--color-bg) px-6 py-4">
            <button onClick={() => setShowText(false)} type="button" className="rounded-md px-4 py-2 text-xs font-bold uppercase tracking-widest text-(--color-muted) hover:text-(--color-text) transition-colors outline-none">Chiudi</button>
            <button onClick={() => setShowText(false)} type="button" className="rounded-md bg-(--color-text) text-(--color-surface) px-4 py-2 text-xs font-bold uppercase tracking-widest hover:opacity-90 shadow-xs transition-opacity outline-none">Salva e continua</button>
          </div>
        </div>
      </motion.div>
    </>
  );
};