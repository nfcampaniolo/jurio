import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { PastFascicoli } from "./PastFascicoli";
import { Header } from "@/shared/components/Header";
import { Helmet } from "@dr.pogodin/react-helmet";
import { useLegalChat } from "@/features/chat/hooks/useLegalChat";
import { Loader2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { PastChat, PastFascicolo } from "@/interfaces/interfaces";
import { getAuth } from "firebase/auth";
import { ConfirmModal } from "@/shared/components/ConfirmModal"; 
import { toast } from "react-hot-toast";

type RenameTarget = {
  id: string;
  name: string;
  type: "fascicolo" | "chat";
} | null;

type DeleteTarget = {
  id: string;
  type: "fascicolo" | "chat";
} | null;

export const HistoryPage = () => {
  const navigate = useNavigate();
  const auth = getAuth();
  const currentUserId = auth.currentUser?.uid;
  const { 
    pastFascicoli, 
    pastChats, 
    isLoadingData, 
    deleteFascicolo, 
    deleteChat,
    renameFascicolo,
    renameChat
  } = useLegalChat();

  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [itemToRename, setItemToRename] = useState<RenameTarget>(null);
  const [newName, setNewName] = useState("");

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<DeleteTarget>(null);

  const handleSelectFascicolo = (fascicolo: PastFascicolo) => navigate(`/fascicolo/${fascicolo.id}`);
  const handleSelectChat = (chat: PastChat) => navigate(`/chat/${chat.id}`);
  const handleBack = () => navigate(-1);

// --- GESTIONE ELIMINAZIONE ---
  const openDeleteModal = (id: string, type: "fascicolo" | "chat") => {
    if (type === "fascicolo") {
      const target = pastFascicoli.find(f => f.id === id);
      // Controllo di sicurezza: se esiste ma non sei il proprietario, blocca.
      if (target && target.ownerId !== currentUserId) {
        toast.error("Non hai i permessi necessari. Solo il proprietario può eliminare questo fascicolo.");
        return;
      }
    }
    
    setItemToDelete({ id, type });
    setIsDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;

    if (itemToDelete.type === "fascicolo" && deleteFascicolo) {
      await deleteFascicolo(itemToDelete.id);
    } else if (itemToDelete.type === "chat" && deleteChat) {
      await deleteChat(itemToDelete.id);
    }

    closeDeleteModal();
  };

  // --- GESTIONE RINOMINA ---
  const openRenameModal = (id: string, currentName: string, type: "fascicolo" | "chat") => {
    if (type === "fascicolo") {
      const target = pastFascicoli.find(f => f.id === id);
      // Controllo di sicurezza: se esiste ma non sei il proprietario, blocca.
      if (target && target.ownerId !== currentUserId) {
        toast.error("Non hai i permessi necessari. Solo il proprietario può rinominare questo fascicolo.");
        return;
      }
    }

    setItemToRename({ id, name: currentName, type });
    setNewName(currentName);
    setIsRenameModalOpen(true);
  };

  const closeRenameModal = () => {
    setIsRenameModalOpen(false);
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemToRename || !newName.trim()) return;

    if (itemToRename.type === "fascicolo" && renameFascicolo) {
      await renameFascicolo(itemToRename.id, newName.trim());
    } else if (itemToRename.type === "chat" && renameChat) {
      await renameChat(itemToRename.id, newName.trim());
    }

    closeRenameModal();
  };

  const deleteMessage = itemToDelete?.type === "fascicolo" 
    ? "Sei sicuro di voler eliminare definitivamente questo fascicolo? Tutti i documenti e le analisi ad esso associati andranno persi."
    : itemToDelete?.type === "chat"
      ? "Sei sicuro di voler eliminare definitivamente questa chat? L'azione è irreversibile."
      : "";

  return (
    <>
      <Helmet>
        <title>Archivio Fascicoli - LegalChat</title>
      </Helmet>

      <div className="flex flex-col min-h-dvh w-full bg-(--color-surface) font-sans">
        <Header />
        
        <main className="flex-1 relative flex flex-col">
          {isLoadingData ? (
             <div className="flex flex-col items-center justify-center w-full h-[50vh] text-(--color-muted) gap-3">
               <Loader2 size={32} className="animate-spin text-(--color-text)" />
               <span className="text-xs font-bold uppercase tracking-widest">Caricamento archivio in corso...</span>
             </div>
          ) : (
            <div className="w-full h-full animate-in fade-in duration-300">
              <PastFascicoli 
                fascicoli={pastFascicoli} 
                chats={pastChats}
                onSelectFascicolo={handleSelectFascicolo} 
                onSelectChat={handleSelectChat} 
                onDeleteFascicolo={(id) => openDeleteModal(id, "fascicolo")}
                onDeleteChat={(id) => openDeleteModal(id, "chat")}
                onRenameFascicolo={(id, currentName) => openRenameModal(id, currentName, "fascicolo")}
                onRenameChat={(id, currentName) => openRenameModal(id, currentName, "chat")}
                onBack={handleBack} 
              />
            </div>
          )}
        </main>
      </div>

      {/* --- MODALE DI RINOMINA --- */}
      <AnimatePresence>
        {isRenameModalOpen && (
          <motion.div
            key="rename-modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          >
            <motion.div
              key="rename-modal-content"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative bg-(--color-surface) border border-(--color-border) rounded-lg shadow-(--shadow-soft) w-full max-w-md overflow-hidden"
            >
              {/* LA LINEA DI RIGORE SUPERIORE (Unico tocco di colore) */}
              <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

              <div className="flex justify-between items-center px-6 py-4 border-b border-(--color-border) bg-(--color-bg) mt-1">
                <h3 className="text-base font-medium text-(--color-text) tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
                  Rinomina {itemToRename?.type === "fascicolo" ? "Fascicolo" : "Chat"}
                </h3>
                <button 
                  type="button"
                  onClick={closeRenameModal}
                  className="p-1.5 rounded-md text-(--color-muted) bg-(--color-surface) border border-(--color-border) hover:text-(--color-text) transition-colors outline-none"
                  aria-label="Chiudi modale"
                >
                  <X size={16} />
                </button>
              </div>
              
              <form onSubmit={handleRenameSubmit} className="p-6 flex flex-col gap-4 bg-(--color-surface)">
                <div>
                  <label htmlFor="rename-input" className="block text-[10px] font-bold uppercase tracking-widest text-(--color-muted) mb-1.5 ml-1">
                    Nuovo nome
                  </label>
                  <input
                    id="rename-input"
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    autoFocus
                    className="w-full px-3.5 py-2.5 bg-(--color-bg) border border-(--color-border) rounded-md text-sm text-(--color-text) font-light outline-none focus:border-(--color-text) transition-colors shadow-xs"
                  />
                </div>
                
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={closeRenameModal}
                    className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-(--color-muted) hover:text-(--color-text) transition-colors outline-none"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    disabled={!newName.trim() || newName.trim() === itemToRename?.name}
                    className="px-5 py-2 text-xs font-bold uppercase tracking-widest text-(--color-surface) bg-(--color-text) rounded-md hover:opacity-90 disabled:opacity-35 disabled:cursor-not-allowed transition-all shadow-xs outline-none"
                  >
                    Salva modifiche
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- COMPONENTE MODALE ELIMINAZIONE --- */}
      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Conferma eliminazione"
        message={deleteMessage}
        confirmText="Elimina"
        cancelText="Annulla"
        onConfirm={confirmDelete}
        onCancel={closeDeleteModal}
      />
    </>
  );
};

export default HistoryPage;