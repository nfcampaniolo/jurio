import { useState, useCallback, useMemo } from "react";
import { useAuth } from "@/context/useAuth";
import { toast } from "react-hot-toast";
import { fetchWithSecurity } from "@/config/apiClient";
import { getFeedback } from "@/config/env";

const FEEDBACK_ENDPOINT = getFeedback();

export const useFeedback = (sourceIds: string | string[]) => {
  const { user } = useAuth();
  
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [notes, setNotes] = useState<string>("");
  const [vote, setVote] = useState<'up' | 'down' | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  // Memorizziamo l'array degli ID per evitare render inutili
  const idsList = useMemo(() => {
    return Array.isArray(sourceIds) ? sourceIds : [sourceIds];
  }, [sourceIds]);

  const submitFeedback = useCallback(async (isUp: boolean, optionalNotes?: string) => {
    if (!user) {
      toast.error("Devi essere autenticato per inviare un feedback.");
      return;
    }

    if (loading || vote !== null) return;
    
    setLoading(true);
    try {
      if (!FEEDBACK_ENDPOINT) {
        throw new Error("Servizio non disponibile");
      }
      
      const response = await fetchWithSecurity(FEEDBACK_ENDPOINT, {
        isThumbsUp: isUp,
        ids: idsList,
        notes: optionalNotes || "",
      });

      if (!response.ok) {
        throw new Error("Impossibile salvare il feedback al momento.");
      }

      // Successo
      setVote(isUp ? 'up' : 'down');
      toast.success(isUp ? "Grazie per il feedback positivo!" : "Segnalazione inviata con successo.");

      // Chiudiamo il modal e puliamo le note se era un pollice giù
      if (!isUp) {
        setIsModalOpen(false);
        setNotes("");
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Errore sconosciuto durante l'invio del feedback.";
      console.error(message, err);
      toast.error("Errore durante l'invio. Riprova più tardi.");
    } finally {
      setLoading(false);
    }
  }, [user, loading, vote, idsList]);

  const openModal = useCallback(() => setIsModalOpen(true), []);
  
  const closeModal = useCallback(() => {
    if (!loading) setIsModalOpen(false);
  }, [loading]);

  return {
    vote,
    loading,
    isModalOpen,
    notes,
    setNotes,
    submitFeedback,
    openModal,
    closeModal
  };
};