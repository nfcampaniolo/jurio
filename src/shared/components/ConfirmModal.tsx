import React, { useState, useEffect } from "react"; 
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { FaExclamationTriangle, FaDownload } from "react-icons/fa";

interface ConfirmModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  confirmationPhrase?: string;
  onExport?: () => void;
  exportText?: string;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title = "Conferma Azione",
  message,
  onConfirm,
  onCancel,
  confirmText = "Conferma",
  cancelText = "Annulla",
  confirmationPhrase,
  onExport,
  exportText = "Esporta i miei dati",
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [inputValue, setInputValue] = useState("");
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  // Deriving state per resettare l'input
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setInputValue("");
    }
  }

  // Previene lo scroll all'apertura.
  // NOTA: il ripristino ("unset") lo facciamo nell'evento onExitComplete 
  // di AnimatePresence per evitare fastidiosi salti grafici della scrollbar.
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    }
    return () => {
      // Pulizia di sicurezza nel caso il componente venga distrutto bruscamente
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onCancel();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onCancel]);

  const isConfirmDisabled = confirmationPhrase 
    ? inputValue !== confirmationPhrase 
    : false;

  return (
    <AnimatePresence 
      onExitComplete={() => {
        // Ripristina lo scroll solo quando l'animazione di uscita è *completata*
        if (!isOpen) {
          document.body.style.overflow = "unset";
        }
      }}
    >
      {isOpen && (
        <motion.div
          key="confirm-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 0.2, ease: "easeOut" } }}
          exit={{ opacity: 0, transition: { duration: 0.15, ease: "easeIn" } }} // Uscita rapida in easeIn
          className="fixed inset-0 z-100 flex items-center justify-center p-4 sm:p-6 bg-black/50 backdrop-blur-sm"
          onClick={onCancel}
        >
          <motion.div
            key="confirm-modal"
            onClick={(e) => e.stopPropagation()}
            initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 10 }}
            animate={shouldReduceMotion 
              ? { opacity: 1, transition: { duration: 0.2 } } 
              : { opacity: 1, scale: 1, y: 0, transition: { duration: 0.2, ease: "easeOut" } }
            }
            exit={shouldReduceMotion 
              ? { opacity: 0, transition: { duration: 0.15 } } 
              : { opacity: 0, scale: 0.95, y: 10, transition: { duration: 0.15, ease: "easeIn" } } // Eliminato l'effetto "molla"
            }
            className="relative w-full max-w-md overflow-hidden rounded-2xl bg-(--color-surface) border border-(--color-border) p-6 sm:p-8 text-left shadow-2xl flex flex-col sm:flex-row gap-5 cursor-default"
          >
            <div className="mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 sm:mx-0 sm:h-12 sm:w-12">
              <FaExclamationTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>

            <div className="flex-1 text-center sm:text-left mt-1">
              <h2 className="text-lg font-medium text-(--color-text) tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
                {title}
              </h2>
              <p className="mt-2 text-sm text-(--color-muted) leading-relaxed">
                {message}
              </p>

              {onExport && (
                <div className="mt-5 rounded-xl border border-(--color-border) bg-(--color-bg) p-4">
                  <p className="text-xs text-(--color-text) mb-3 text-left">
                    Prima di procedere, ti consigliamo di salvare una copia di sicurezza delle tue informazioni.
                  </p>
                  <button
                    type="button"
                    onClick={onExport}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-(--color-surface) border border-(--color-border) px-3 py-2.5 text-xs font-bold uppercase tracking-widest text-(--color-text) hover:border-(--color-text) transition-colors outline-none cursor-pointer"
                  >
                    <FaDownload className="h-3 w-3" />
                    {exportText}
                  </button>
                </div>
              )}

              {confirmationPhrase && (
                <div className="mt-5 text-left bg-(--color-bg) border border-(--color-border) p-4 rounded-xl">
                  <label htmlFor="confirm-input" className="block text-xs text-(--color-muted) mb-2">
                    Per confermare, ricopia il seguente testo:<br />
                    <span className="font-bold text-red-600 dark:text-red-400 select-all bg-red-500/10 px-1.5 py-0.5 rounded inline-block mt-1.5">
                      {confirmationPhrase}
                    </span>
                  </label>
                  <input
                    id="confirm-input"
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={confirmationPhrase}
                    className="w-full rounded-lg border border-(--color-border) bg-(--color-surface) px-3 py-2.5 text-sm font-mono text-(--color-text) outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                  />
                </div>
              )}

              <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={onCancel}
                  className="inline-flex w-full justify-center rounded-xl border border-transparent bg-transparent hover:bg-(--color-bg) hover:border-(--color-border) px-4 py-2.5 text-sm font-medium text-(--color-text) transition-all sm:w-auto outline-none cursor-pointer"
                >
                  {cancelText}
                </button>
                <button
                  type="button"
                  onClick={onConfirm}
                  disabled={isConfirmDisabled}
                  className="inline-flex w-full justify-center rounded-xl bg-red-600 hover:bg-red-700 px-4 py-2.5 text-sm font-medium text-white transition-all sm:w-auto outline-none shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {confirmText}
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};