import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { PastFascicoli } from "./PastFascicoli";
import { Header } from "@/shared/components/Header";
import { Helmet } from "@dr.pogodin/react-helmet";
import { useLegalChat } from "@/features/chat/hooks/useLegalChat";
import { Loader2 } from "lucide-react";
import { RenameModal } from "./RenameModal";
import type { PastChat, PastFascicolo } from "@/interfaces/interfaces";
import { getAuth } from "firebase/auth";
import { ConfirmModal } from "@/shared/components/ConfirmModal"; 
import { toast } from "react-hot-toast";

const ArchiveLoadingSkeleton = () => (
  <motion.div
    key="archive-loading"
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.28, ease: "easeOut" }}
    className="w-full max-w-5xl mx-auto px-6 py-10"
  >
    <div className="flex items-center gap-3 mb-7">
      <Loader2 size={24} className="animate-spin text-(--color-text)" />
      <span className="text-xs font-bold uppercase tracking-widest text-(--color-muted)">Caricamento archivio in corso...</span>
    </div>
    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 animate-pulse" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={`archive-skeleton-${index}`} className="rounded-lg border border-(--color-border) bg-(--color-surface) p-6 shadow-(--shadow-soft)">
          <div className="flex items-center justify-between mb-5">
            <div className="h-10 w-10 rounded-md bg-(--color-border) opacity-60" />
            <div className="h-4 w-4 rounded bg-(--color-border) opacity-50" />
          </div>
          <div className="h-4 w-3/4 rounded bg-(--color-border) opacity-60 mb-3" />
          <div className="h-3 w-1/2 rounded bg-(--color-border) opacity-45" />
        </div>
      ))}
    </div>
  </motion.div>
);

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

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<DeleteTarget>(null);

  const handleSelectFascicolo = (fascicolo: PastFascicolo) => void navigate(`/fascicolo/${fascicolo.id}`);
  const handleSelectChat = (chat: PastChat) => void navigate(`/chat/${chat.id}`);
  const handleBack = () => void navigate(-1);

// --- GESTIONE ELIMINAZIONE ---
  const openDeleteModal = (id: string, type: "fascicolo" | "chat") => {
    if (type === "fascicolo") {
      const target = pastFascicoli.find(f => f.id === id);
      // Controllo di sicurezza: se esiste ma non sei il proprietario, blocca.
      if (target && target.user !== currentUserId) {
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
      if (target && target.user !== currentUserId) {
        toast.error("Non hai i permessi necessari. Solo il proprietario può rinominare questo fascicolo.");
        return;
      }
    }

    setItemToRename({ id, name: currentName, type });
    setIsRenameModalOpen(true);
  };

  const closeRenameModal = () => {
    setIsRenameModalOpen(false);
  };

  const handleRenameSubmit = async (name: string) => {
    if (!itemToRename || !name.trim()) return;
    closeRenameModal();

    if (itemToRename.type === "fascicolo" && renameFascicolo) {
      await renameFascicolo(itemToRename.id, name.trim());
    } else if (itemToRename.type === "chat" && renameChat) {
      await renameChat(itemToRename.id, name.trim());
    }
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
        
        <main id="main-content" tabIndex={-1} className="flex-1 relative flex flex-col">
          <AnimatePresence mode="wait" initial={false}>
            {isLoadingData ? (
              <ArchiveLoadingSkeleton />
            ) : (
              <motion.div
                key="archive-content"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24, ease: "easeOut" }}
                className="w-full h-full"
              >
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
              </motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      <RenameModal
        isOpen={isRenameModalOpen}
        item={itemToRename}
        onClose={closeRenameModal}
        onSubmit={handleRenameSubmit}
      />

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
