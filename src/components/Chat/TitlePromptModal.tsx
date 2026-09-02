import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface TitlePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (title: string) => void;
  initialTitle: string;
}

export const TitlePromptModal: React.FC<TitlePromptModalProps> = ({ isOpen, onClose, onConfirm, initialTitle }) => {
  const [val, setVal] = useState(initialTitle);
  
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop con sfocatura */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />
          
          {/* Box Modale */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="relative bg-(--color-surface) p-6 rounded-lg w-full max-w-sm border border-(--color-border) shadow-(--shadow-soft) pointer-events-auto overflow-hidden">
              {/* LA LINEA DI RIGORE SUPERIORE (Unico tocco di colore) */}
              <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

              <h3 className="text-xs font-bold text-(--color-text) uppercase tracking-widest mb-5">
                Definisci il titolo
              </h3>
              
              <input 
                autoFocus
                placeholder="Es: Pratica Rossi vs Bianchi"
                className="w-full px-3.5 py-2.5 mb-6 bg-(--color-bg) border border-(--color-border) rounded-md text-sm text-(--color-text) font-light placeholder:text-(--color-muted) outline-none focus:border-(--color-text) transition-colors"
                value={val}
                onChange={(e) => setVal(e.target.value)}
              />
              
              <div className="flex gap-2 justify-end">
                <button 
                  onClick={onClose} 
                  type="button"
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-(--color-muted) hover:text-(--color-text) transition-colors outline-none"
                >
                  Annulla
                </button>
                <button 
                  onClick={() => onConfirm(val)} 
                  type="button"
                  className="px-5 py-2 bg-(--color-text) text-(--color-surface) rounded-md text-xs font-bold uppercase tracking-widest hover:opacity-90 active:scale-95 transition-all shadow-xs outline-none"
                >
                  Conferma
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};