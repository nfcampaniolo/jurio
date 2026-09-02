import React from "react";
import type { DocumentoGiurisprudenziale } from "@/interfaces/interfaces";

interface DocumentRenameModalProps {
  isOpen: boolean;
  itemToRename: DocumentoGiurisprudenziale | null;
  newName: string;
  setNewName: (name: string) => void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
}

export const DocumentRenameModal: React.FC<DocumentRenameModalProps> = ({
  isOpen,
  itemToRename,
  newName,
  setNewName,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-xl bg-white dark:bg-neutral-900 shadow-xl">
        <div className="border-b border-neutral-200 dark:border-neutral-800 px-6 py-4">
          <h2 className="text-lg font-semibold">Rinomina documento</h2>
        </div>

        <form onSubmit={onSubmit} className="p-4 flex flex-col gap-4">
          <div>
            <label htmlFor="rename-input" className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Nuovo nome
            </label>
            <input
              id="rename-input"
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
              className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500 dark:bg-neutral-800 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-2 mt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 bg-neutral-100 dark:bg-neutral-800 rounded-lg hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={!newName.trim() || newName.trim() === itemToRename?.nome_file}
              className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Salva modifiche
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};