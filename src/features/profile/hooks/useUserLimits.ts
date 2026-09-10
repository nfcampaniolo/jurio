import { useEffect, useState } from "react";
import { getFirestore, doc, getDoc } from "firebase/firestore";

// Definisce rigorosamente la struttura dei limiti
export interface PlanLimits {
  research: number;
  analysis: number;
  synthesis: number;
  deep_analysis: number;
}

// Sostituisce Record<string, any> con Record<string, PlanLimits>
const PLAN_LIMITS: Record<string, PlanLimits> = {
  personale: { research: 100, analysis: 0, synthesis: 20, deep_analysis: 30 },
  personale_m: { research: 100, analysis: 0, synthesis: 20, deep_analysis: 30 },
  business: { research: 100, analysis: 200, synthesis: 100, deep_analysis: 30 },
  business_m: { research: 100, analysis: 200, synthesis: 100, deep_analysis: 30 },
  admin: { research: 100, analysis: 200, synthesis: 9999, deep_analysis: 30 },
  default: { research: 100, analysis: 0, synthesis: 5, deep_analysis: 30 } // Fallback
};

export function useUserLimits(uid: string | undefined) {
  // Stati tipizzati
  const [limits, setLimits] = useState<PlanLimits>(PLAN_LIMITS.default);
  const [planName, setPlanName] = useState<string>("default");
  const [loadingLimits, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchUserPlan() {
      if (!uid) {
        setLoading(false); // Interrompe il caricamento se non c'è l'utente
        return;
      }
      
      try {
        const db = getFirestore();
        const userSnap = await getDoc(doc(db, "register", uid));
        
        if (userSnap.exists()) {
          // Tipizziamo i dati in arrivo da Firestore come unknown e facciamo un type check
          const data = userSnap.data() as Record<string, unknown>;
          const planId = typeof data.planId === "string" ? data.planId : "default";
          
          setPlanName(planId);
          setLimits(PLAN_LIMITS[planId] || PLAN_LIMITS.default);
        }
      } catch (error) {
        console.error("Errore nel recupero del piano utente:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchUserPlan();
  }, [uid]);

  return { limits, planName, loadingLimits };
}