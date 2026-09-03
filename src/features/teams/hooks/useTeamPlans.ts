import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, query, where, getDocs } from "firebase/firestore";
import { getDb } from "@/infrastructure/db";
import { toast } from "react-hot-toast";

export const useTeamPlans = (userUid?: string, userHasTeam: boolean = false) => {
  const navigate = useNavigate();
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);
  const [selectedPlanForOwner, setSelectedPlanForOwner] = useState<string | null>(null);

  const handlePlanClick = async (planName: string, openPaymentForPlan: (planName: string) => void) => {
    if (!userUid) {
      openPaymentForPlan(planName);
      return;
    }

    try {
      const db = await getDb();
      
      // Query mirata: verifica se esiste un team in cui l'utente è tra i proprietari (owners)
      const teamsRef = collection(db, "teams");
      const q = query(teamsRef, where("owners", "array-contains", userUid));
      const querySnapshot = await getDocs(q);

      if (!querySnapshot.empty) {
        // L'utente è owner di almeno un team
        setSelectedPlanForOwner(planName);
        setIsOwnerModalOpen(true);
        return;
      }

      // Se non è owner ma ricade nel controllo generale del team
      if (userHasTeam) {
        toast.error("Fai già parte di un Team. Devi prima lasciare il tuo team attuale per acquistarne uno nuovo.", {
          duration: 4000,
          position: "top-center"
        });
        return;
      }

      openPaymentForPlan(planName);
    } catch (error) {
      console.error("Errore verifica stato team:", error);
      toast.error("Impossibile verificare lo stato del team. Riprova.");
    }
  };

  const handleConfirmOwnerPurchase = (openPaymentForPlan: (planName: string) => void) => {
    setIsOwnerModalOpen(false);
    if (selectedPlanForOwner) {
      openPaymentForPlan(selectedPlanForOwner);
    }
    setSelectedPlanForOwner(null);
  };

  const handleCancelOwnerPurchase = () => {
    setIsOwnerModalOpen(false);
    setSelectedPlanForOwner(null);
  };

  return {
    isOwnerModalOpen,
    handlePlanClick,
    handleConfirmOwnerPurchase,
    handleCancelOwnerPurchase,
    navigate
  };
};