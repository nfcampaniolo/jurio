import React, { useState } from "react"; // Rimosso useEffect
import { motion, AnimatePresence } from "framer-motion";
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
  const [inputValue, setInputValue] = useState("");

  // 1. Nuovo handler per annullare e pulire lo stato
  const handleCancel = () => {
    setInputValue(""); // Resetta l'input
    onCancel();        // Richiama la funzione passata dal padre
  };

  // 2. Nuovo handler per confermare e pulire lo stato
  const handleConfirm = () => {
    setInputValue("");
    onConfirm();
  };

  const isConfirmDisabled = confirmationPhrase 
    ? inputValue !== confirmationPhrase 
    : false;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={handleCancel} // Sostituito onCancel con handleCancel
        >
          <motion.div
            className="relative w-full max-w-md overflow-hidden rounded-lg bg-(--color-surface) border border-(--color-border) p-6 text-left shadow-(--shadow-soft) flex flex-col sm:flex-row gap-5"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-red-500/10 border border-red-500/20 sm:mx-0 sm:h-10 sm:w-10">
              <FaExclamationTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            </div>

            <div className="flex-1 text-center sm:text-left mt-1">
              <h2 className="text-base font-medium text-(--color-text) tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
                {title}
              </h2>
              <p className="mt-2 text-xs md:text-sm text-(--color-muted) font-light leading-relaxed">
                {message}
              </p>

              {onExport && (
                <div className="mt-4 rounded-md border border-(--color-border) bg-(--color-bg) p-3">
                  <p className="text-xs text-(--color-text) mb-2">
                    Prima di eliminare l'account, ti consigliamo di salvare una copia delle tue informazioni.
                  </p>
                  <button
                    type="button"
                    onClick={onExport}
                    className="flex w-full items-center justify-center gap-2 rounded bg-(--color-surface) border border-(--color-border) px-3 py-1.5 text-xs font-medium text-(--color-text) hover:bg-(--color-border) transition-colors outline-none"
                  >
                    <FaDownload className="h-3 w-3" />
                    {exportText}
                  </button>
                </div>
              )}

              {confirmationPhrase && (
                <div className="mt-5 text-left">
                  <label htmlFor="confirm-input" className="block text-xs text-(--color-muted) mb-1.5">
                    Per confermare, copia e incolla: <br />
                    <span className="font-bold text-red-600 dark:text-red-400 select-all bg-red-500/10 px-1 py-0.5 rounded inline-block mt-1">
                      {confirmationPhrase}
                    </span>
                  </label>
                  <input
                    id="confirm-input"
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder={confirmationPhrase}
                    className="w-full rounded-md border border-(--color-border) bg-(--color-bg) px-3 py-2 text-sm text-(--color-text) outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                  />
                </div>
              )}

              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={handleCancel} // Sostituito onCancel con handleCancel
                  className="inline-flex w-full justify-center rounded-md border border-(--color-border) bg-(--color-surface) px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-(--color-muted) hover:text-(--color-text) hover:bg-(--color-bg) transition-colors sm:w-auto outline-none"
                >
                  {cancelText}
                </button>
                <button
                  type="button"
                  onClick={handleConfirm} // Sostituito onConfirm con handleConfirm
                  disabled={isConfirmDisabled}
                  className="inline-flex w-full justify-center rounded-md bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white transition-colors sm:w-auto outline-none shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
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