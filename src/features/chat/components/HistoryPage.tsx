import { useState } from "react";
import { useNavigate } from "react-router-dom";
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