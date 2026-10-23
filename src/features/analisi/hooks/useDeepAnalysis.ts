// src/features/analisi/hooks/useDeepAnalysis.ts

import { useState, useEffect } from "react";
import { collection, doc, onSnapshot, query, where, orderBy, updateDoc, addDoc, serverTimestamp, deleteDoc } from "firebase/firestore";
import { getDb } from "@/infrastructure/db";
import { useAuth } from "@/context/useAuth";
import { fetchWithSecurity } from "@/config/apiClient";
import { toast } from "react-hot-toast";
import type { DeepAnalysisSession, DeepAnalysisConfig, MappaDialettica, PrecedenteReperito } from "./types";
import type { AttachedDocument } from "@/interfaces/interfacesDocument";
import { Timestamp } from "firebase/firestore";

const EP_URL = import.meta.env.VITE_DEEP_ANALYSIS_URL;

export function useDeepAnalysisSession(activeSessionId: string | null) {
  const { user } = useAuth();
  
  const [sessionsList, setSessionsList] = useState<DeepAnalysisSession[]>([]);
  const [activeSession, setActiveSession] = useState<DeepAnalysisSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAccessDenied, setIsAccessDenied] = useState(false);

  // 1. Fetch Lista Sessioni (Sidebar)
  useEffect(() => {
    if (!user) return;

    let unsub: (() => void) | undefined;
    let isMounted = true;

    const setupListener = async () => {
      try {
        const db = await getDb();
        if (!isMounted) return;

        const q = query(
          collection(db, "deep_analysis_sessions"),
          where("user", "==", user.uid),
          orderBy("updatedAt", "desc")
        );

        unsub = onSnapshot(
          q,
          (snap) => {
            const list = snap.docs.map(
              (d) =>
                ({
                  id: d.id,
                  ...d.data({ serverTimestamps: "estimate" }),
                } as DeepAnalysisSession)
            );

            setSessionsList(list);
            setLoading(false);
          },
          (error) => {
            console.error("Errore snapshot sessioni:", error);
            if (error.code === "permission-denied") {
              setIsAccessDenied(true);
            }
            setLoading(false);
          }
        );

        if (!isMounted && unsub) {
          unsub();
        }
      } catch (error) {
        if (isMounted) {
          console.error("Errore inizializzazione db:", error);
          setLoading(false);
        }
      }
    };

    void setupListener();

    return () => {
      isMounted = false;
      if (unsub) {
        unsub();
      }
    };
  }, [user]);

  // 2. Fetch Sessione Attiva (Workspace)
  useEffect(() => {
    if (!activeSessionId) {
      setActiveSession(null);
      return;
    }

    let unsub: (() => void) | undefined;
    let isMounted = true;

    const setupListener = async () => {
      const db = await getDb();
      if (!isMounted) return;

      unsub = onSnapshot(
        doc(db, "deep_analysis_sessions", activeSessionId), 
        (docSnap) => {
          if (docSnap.exists()) {
            setActiveSession({ 
              id: docSnap.id, 
              ...docSnap.data({ serverTimestamps: "estimate" }) 
            } as DeepAnalysisSession);
          } else {
            setActiveSession(null);
          }
        },
        (error) => {
          if (error.code === "permission-denied") {
            setIsAccessDenied(true);
          }
        }
      );
    };

    void setupListener();

    return () => {
      isMounted = false;
      if (unsub) unsub();
    };
  }, [activeSessionId]);

  // --- AZIONI LOCALI FIRESTORE ---

  const updateTitle = async (newTitle: string) => {
    if (!activeSessionId) return;
    const db = await getDb();
    await updateDoc(doc(db, "deep_analysis_sessions", activeSessionId), { 
      title: newTitle, 
      updatedAt: serverTimestamp() 
    });
  };

  const toggleEsclusionePrecedente = async (precedenteId: string, escluso: boolean) => {
    if (!activeSession || !activeSession.mappaDialettica) return;
    
    const mappa: MappaDialettica = JSON.parse(JSON.stringify(activeSession.mappaDialettica));
    
    if (mappa.orientamentoFavorevole?.fonti) {
      mappa.orientamentoFavorevole.fonti = mappa.orientamentoFavorevole.fonti.map((p: PrecedenteReperito) => 
        p.id === precedenteId ? { ...p, escluso } : p
      );
    }
    
    if (mappa.orientamentoContrario?.fonti) {
      mappa.orientamentoContrario.fonti = mappa.orientamentoContrario.fonti.map((p: PrecedenteReperito) => 
        p.id === precedenteId ? { ...p, escluso } : p
      );
    }

    const db = await getDb();
    await updateDoc(doc(db, "deep_analysis_sessions", activeSession.id), { 
      mappaDialettica: mappa 
    });
  };

  // --- AZIONI API BACKEND ---
  type FirestoreValue = 
    | string 
    | number 
    | boolean 
    | null 
    | Date 
    | Timestamp 
    | { [key: string]: FirestoreValue } 
    | FirestoreValue[];

  const sanitizeForFirestore = <T>(obj: T): FirestoreValue => {
    if (obj === undefined) return null;
    if (obj === null || (typeof obj !== "object" && typeof obj !== "function")) {
      return obj as unknown as FirestoreValue;
    }
    if (obj instanceof Date || obj instanceof Timestamp) {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => sanitizeForFirestore(item));
    }
    const sanitized: Record<string, FirestoreValue> = {};
    const recordObj = obj as Record<string, unknown>;
    for (const key of Object.keys(recordObj)) {
      const value = recordObj[key];
      if (value !== undefined) {
        sanitized[key] = sanitizeForFirestore(value);
      }
    }
    return sanitized;
  };

  const checkUnauthorized = (res: Response, errorDetail: string) => {
    if (res.status === 401 || res.status === 403 || errorDetail.includes("unauthorized") || errorDetail.includes("forbidden") || errorDetail.includes("access_denied")) {
      setIsAccessDenied(true);
      return true;
    }
    return false;
  };

  const avviaRicercaPrecedenti = async (
    prompt: string, 
    config: DeepAnalysisConfig, 
    docs: AttachedDocument[],
    onSessionCreated: (id: string) => void
  ) => {
    if (!user) return;
    setIsProcessing(true);
    try {
      let sessionId = activeSessionId;
      const db = await getDb();
      
      if (!sessionId) {
        const payloadPulito = sanitizeForFirestore({
          user: user.uid,
          title: prompt.substring(0, 30) + "...", 
          status: "draft",
          promptOriginale: prompt, 
          configurazione: config, 
          documentiAllegati: docs as AttachedDocument[],
          createdAt: serverTimestamp(), 
          updatedAt: serverTimestamp()
        });

        const newDoc = await addDoc(collection(db, "deep_analysis_sessions"), payloadPulito as Record<string, unknown>);
        sessionId = newDoc.id;
        onSessionCreated(sessionId);
      }

      const res = await fetchWithSecurity(EP_URL, {
        action: "start_research",
        sessionId, 
        prompt, 
        config, 
        docs
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorDetail = errorData?.details || errorData?.error || "";
        
        if (checkUnauthorized(res, errorDetail)) {
          throw new Error("ACCESS_DENIED");
        }
        if (res.status === 429 || errorDetail.includes("quota_exceeded")) {
          throw new Error("QUOTA_EXCEEDED");
        }
        throw new Error(errorDetail || "Errore durante l'indagine.");
      }

      toast.success("Analisi avviata. Puoi chiudere la pagina: riceverai una notifica quando sarà pronta.", { duration: 6000 });
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        console.log("Ricerca iniziale interrotta dall'utente.");
      } else if (error.message === "ACCESS_DENIED") {
        // Già gestito da isAccessDenied
      } else if (error.message === "QUOTA_EXCEEDED" || error.message.includes("quota_exceeded")) {
        toast.error("Hai raggiunto il limite giornaliero per questa funzione. Riprova domani o aggiorna il tuo piano.", { duration: 5000 });
      } else {
        console.error(err);
        toast.error("Errore nel server. Si prega di riprovare in seguito.");
      }
      throw err; 
    } finally {
      setIsProcessing(false);
    }
  };

  const avviaIntegrazioneRicerca = async (
    direttivaHitl: string
  ) => {
    if (!activeSessionId || !user) return null;
    setIsProcessing(true);
    try {
      const res = await fetchWithSecurity(EP_URL, {
        action: "refine_research",
        sessionId: activeSessionId,
        direttivaHitl
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorDetail = errorData?.details || errorData?.error || "";

        if (checkUnauthorized(res, errorDetail)) {
          throw new Error("ACCESS_DENIED");
        }
        if (res.status === 429 || errorDetail.includes("quota_exceeded")) {
          throw new Error("QUOTA_EXCEEDED");
        }
        throw new Error(errorDetail || "Errore durante l'approfondimento.");
      }

      const data = await res.json();
      toast.success("Approfondimento avviato. Ti avviseremo quando la mappa sarà aggiornata.", { duration: 6000 });
      return data;
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'AbortError' || error.message?.includes('aborted')) {
        console.log("Approfondimento interrotto dall'utente.");
      } else if (error.message === "ACCESS_DENIED") {
        // Gestito
      } else if (error.message === "QUOTA_EXCEEDED" || error.message.includes("quota_exceeded")) {
        toast.error("Hai raggiunto il limite giornaliero per questa funzione. Riprova domani o aggiorna il tuo piano.", { duration: 5000 });
      } else {
        console.error(err);
        toast.error("Errore nel server. Impossibile approfondire la ricerca.");
      }
      throw err;
    } finally {
      setIsProcessing(false);
    }
  };

  const avviaGenerazioneSintesi = async () => {
    if (!activeSessionId || !activeSession) return;
    setIsProcessing(true);
    try {
      const res = await fetchWithSecurity(EP_URL, {
        action: "generate_synthesis",
        sessionId: activeSessionId
      });
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorDetail = errorData?.details || errorData?.error || "";

        if (checkUnauthorized(res, errorDetail)) {
          throw new Error("ACCESS_DENIED");
        }
        if (res.status === 429 || errorDetail.includes("quota_exceeded")) {
          throw new Error("QUOTA_EXCEEDED");
        }
        if (res.status === 503 || errorDetail.includes("AI_TEMPORARILY_UNAVAILABLE")) {
          throw new Error("AI_TEMPORARILY_UNAVAILABLE");
        }
        throw new Error(errorDetail || "Errore durante la generazione della sintesi.");
      }

      toast.success("Generazione della sintesi avviata. Riceverai una notifica quando sarà pronta.", { duration: 6000 });
    } catch (err: unknown) {
      const error = err as Error;
      if (error.message === "ACCESS_DENIED") {
        // Gestito
      } else if (error.message === "QUOTA_EXCEEDED" || error.message.includes("quota_exceeded")) {
        toast.error("Hai raggiunto il limite giornaliero per questa funzione. Riprova domani o aggiorna il tuo piano.", { duration: 5000 });
      } else if (error.message === "AI_TEMPORARILY_UNAVAILABLE") {
        toast.error("Il servizio IA è temporaneamente sovraccarico. L'analisi è salvata: puoi riprovare a generare la sintesi tra poco.", { duration: 7000 });
      } else {
        console.error(err);
        toast.error("Errore nel server. Si prega di riprovare in seguito.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    sessionsList, 
    activeSession, 
    loading, 
    isProcessing: isProcessing || activeSession?.job?.status === "queued" || activeSession?.job?.status === "processing",
    updateTitle, 
    toggleEsclusionePrecedente, 
    avviaRicercaPrecedenti,
    avviaIntegrazioneRicerca,
    avviaGenerazioneSintesi,
    isCompleted: activeSession?.status === "completed",
    isAccessDenied,
    setIsAccessDenied
  };
}

export const eliminaSessione = async (sessionId: string): Promise<void> => {
  if (!sessionId) return;
  const db = await getDb();
  const docRef = doc(db, "deep_analysis_sessions", sessionId);
  await deleteDoc(docRef);
};