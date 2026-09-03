import React from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import type { AttachedDocument } from "@/interfaces/interfaces";

interface DocumentModalsProps {
  isRenameOpen: boolean;
  isDeleteOpen: boolean;
  isDeleting: boolean;
  itemToRename: AttachedDocument | null;
  itemToDelete: AttachedDocument | null;
  newName: string;
  setNewName: (name: string) => void;
  closeRenameModal: () => void;
  closeDeleteModal: () => void;
  handleRenameSubmit: (e: React.FormEvent) => Promise<void>;
  handleDeleteConfirm: () => Promise<void>;
}

export const DocumentModals: React.FC<DocumentModalsProps> = ({
  isRenameOpen,
  isDeleteOpen,
  isDeleting,
  itemToRename,
  itemToDelete,
  newName,
  setNewName,
  closeRenameModal,
  closeDeleteModal,
  handleRenameSubmit,
  handleDeleteConfirm,
}) => {
  if (!isRenameOpen && !isDeleteOpen) return null;

  return (
    <motion.div
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={() => {
        if (isDeleting) return;
        if (isRenameOpen) closeRenameModal();
        if (isDeleteOpen) closeDeleteModal();
      }}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-lg bg-(--color-surface) border border-(--color-border) shadow-(--shadow-soft) overflow-hidden"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", stiffness: 320, damping: 28 }}
      >
        {/* LA LINEA DI RIGORE SUPERIORE (Unico tocco di colore) */}
        <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

        {isRenameOpen && (
          <>
            <div className="px-6 py-4 border-b border-(--color-border) bg-(--color-bg)">
              <h2 className="text-base font-medium text-(--color-text)" style={{ fontFamily: 'var(--font-serif)' }}>
                Rinomina documento
              </h2>
            </div>
            <form onSubmit={handleRenameSubmit} className="p-6 flex flex-col gap-5">
              <div>
                <label htmlFor="rename-input" className="block mb-2 text-xs font-bold uppercase tracking-widest text-(--color-muted)">
                  Nuovo nome
                </label>
                <input
                  id="rename-input"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-md border border-(--color-border) bg-(--color-bg) text-(--color-text) focus:outline-none focus:border-(--color-text) transition-colors text-sm font-light"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeRenameModal}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-md bg-(--color-bg) text-(--color-muted) hover:text-(--color-text) border border-(--color-border) transition-colors outline-none"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={!newName.trim() || newName.trim() === itemToRename?.name}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-md bg-(--color-text) text-(--color-surface) hover:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed outline-none shadow-sm"
                >
                  Salva modifiche
                </button>
              </div>
            </form>
          </>
        )}

        {isDeleteOpen && (
          <>
            <div className="px-6 py-4 border-b border-(--color-border) bg-(--color-bg)">
              <h2 className="text-base font-medium text-(--color-text)" style={{ fontFamily: 'var(--font-serif)' }}>
                Elimina documento
              </h2>
            </div>
            <div className="p-6 flex flex-col gap-6">
              <div className="space-y-2">
                <p className="text-sm text-(--color-muted) font-light">Sei sicuro di voler eliminare:</p>
                <p className="font-semibold text-(--color-text) truncate text-base">{itemToDelete?.name}</p>
                <p className="text-xs text-(--color-muted) opacity-70 italic pt-1">Questa operazione non può essere annullata.</p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={closeDeleteModal}
                  disabled={isDeleting}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-md bg-(--color-bg) text-(--color-muted) hover:text-(--color-text) border border-(--color-border) transition-colors disabled:opacity-50 outline-none"
                >
                  Annulla
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={isDeleting}
                  className="px-4 py-2 text-xs font-bold uppercase tracking-widest rounded-md bg-(--color-text) text-(--color-surface) hover:opacity-80 transition-opacity disabled:opacity-50 flex items-center gap-2 outline-none shadow-sm"
                >
                  {isDeleting && <Loader2 size={14} className="animate-spin" />}
                  Elimina
                </button>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </motion.div>
  );
};