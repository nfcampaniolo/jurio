import { memo, useState } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface RenameModalProps {
  isOpen: boolean;
  item: { id: string; name: string; type: "fascicolo" | "chat" } | null;
  onClose: () => void;
  onSubmit: (name: string) => void | Promise<void>;
}

export const RenameModal = memo(
  ({ isOpen, item, onClose, onSubmit }: RenameModalProps) => (
    <AnimatePresence>
      {isOpen && (
        <RenameModalContent
          key="rename-modal-overlay"
          item={item}
          onClose={onClose}
          onSubmit={onSubmit}
        />
      )}
    </AnimatePresence>
  ),
);

type ContentProps = Omit<RenameModalProps, "isOpen">;

const RenameModalContent = ({ item, onClose, onSubmit }: ContentProps) => {
  // Montato a ogni apertura: stato locale inizializzato dal nome, digitare non ridisegna la pagina.
  const [name, setName] = useState(item?.name ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    void onSubmit(name);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <motion.div
        key="rename-modal-content"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 12 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        style={{ willChange: "transform, opacity" }}
        onClick={(e) => e.stopPropagation()}
        className="relative bg-(--color-surface) border border-(--color-border) rounded-lg shadow-(--shadow-soft) w-full max-w-md overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

        <div className="flex justify-between items-center px-6 py-4 border-b border-(--color-border) bg-(--color-bg) mt-1">
          <h3
            className="text-base font-medium text-(--color-text) tracking-tight"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Rinomina {item?.type === "fascicolo" ? "Fascicolo" : "Chat"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-(--color-muted) bg-(--color-surface) border border-(--color-border) hover:text-(--color-text) transition-colors outline-none"
            aria-label="Chiudi modale"
          >
            <X size={16} />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 flex flex-col gap-4 bg-(--color-surface)"
        >
          <div>
            <label
              htmlFor="rename-input"
              className="block text-[10px] font-bold uppercase tracking-widest text-(--color-muted) mb-1.5 ml-1"
            >
              Nuovo nome
            </label>
            <input
              id="rename-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full px-3.5 py-2.5 bg-(--color-bg) border border-(--color-border) rounded-md text-sm text-(--color-text) font-light outline-none focus:border-(--color-text) transition-colors shadow-xs"
            />
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-(--color-muted) hover:text-(--color-text) transition-colors outline-none"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={!name.trim() || name.trim() === item?.name}
              className="px-5 py-2 text-xs font-bold uppercase tracking-widest text-(--color-surface) bg-(--color-text) rounded-md hover:opacity-90 disabled:opacity-35 disabled:cursor-not-allowed transition-opacity shadow-xs outline-none"
            >
              Salva modifiche
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  );
};

RenameModal.displayName = "RenameModal";
