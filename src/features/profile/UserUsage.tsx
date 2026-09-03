"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/useAuth"; 
import { motion, type Variants } from "framer-motion";
import { FiArrowLeft, FiSearch, FiFileText, FiEdit3, FiMessageSquare, FiClock, FiStar } from "react-icons/fi";
import { Loader2 } from "lucide-react";

import { type UsageDoc, formatMonth, calculateTimeSaved } from "@/features/profile/hooks/usageUtils"; 

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } }
};

const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

export default function UserUsage() {
  const router = useNavigate();
  const { user } = useAuth();
  const uid = user?.uid; 

  const [usageList, setUsageList] = useState<UsageDoc[]>([]);
  const [selectedMonthId, setSelectedMonthId] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchUsage() {
      if (!uid) return;
      setLoading(true);
      setError(null);

      try {
        // Dynamic import: carichiamo Firestore e getDb on-demand
        const [firestoreModule, dbModule] = await Promise.all([
          import("firebase/firestore"),
          import("@/infrastructure/db")
        ]);

        const { collection, getDocs, query, orderBy } = firestoreModule;
        const { getDb } = dbModule;

        const db = await getDb();
        const usageRef = collection(db, "register", uid, "usage");
        
        // Ordiniamo per ID documento decrescente (es. "2026_08", "2026_07", ...)
        const q = query(usageRef, orderBy("__name__", "desc"));
        const snapshot = await getDocs(q);

        const data: UsageDoc[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<UsageDoc, "id">),
        }));

        setUsageList(data);
        if (data.length > 0) {
          setSelectedMonthId(data[0].id); // Seleziona il mese più recente di default
        }
      } catch (err) {
        console.error("Errore nel recupero degli usage:", err);
        setError("Si è verificato un errore nel caricamento dei dati di utilizzo.");
      } finally {
        setLoading(false);
      }
    }

    fetchUsage();
  }, [uid]);

  if (!uid || loading) {
    return (
      <div className="flex justify-center items-center h-64 text-(--color-muted) gap-2 bg-(--color-bg)">
        <Loader2 size={18} className="animate-spin text-(--color-text)" />
        <span className="text-xs font-bold uppercase tracking-widest">Caricamento statistiche...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-500/10 text-red-600 dark:text-red-400 rounded-md border border-red-500/20 text-xs font-light max-w-6xl mx-auto mt-6">
        {error}
      </div>
    );
  }

  if (usageList.length === 0) {
    return (
    <motion.div 
      initial="hidden" 
      animate="show" 
      variants={staggerContainer} 
      className="space-y-8 max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 bg-(--color-bg) text-(--color-text) min-h-screen"
    >
          <motion.div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2" variants={fadeUp}>
        <div>
          <motion.h1 className="text-2xl sm:text-3xl font-medium tracking-tight" style={{ fontFamily: 'var(--font-serif)' }} variants={fadeUp}>
            I tuoi utilizzi
          </motion.h1>
          <motion.p className="mt-1.5 text-xs sm:text-sm text-(--color-muted) font-light leading-relaxed" variants={fadeUp}>
            Monitora il tempo risparmiato e le attività delegate a Jurio.
          </motion.p>
        </div>
        
        <motion.div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto" variants={fadeUp}>
          <div className="flex items-center gap-2 bg-(--color-surface) px-3 py-2 rounded-md border border-(--color-border) shadow-xs">
            <label htmlFor="month-selector" className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted)">
              Periodo:
            </label>
            <select
              id="month-selector"
              value={selectedMonthId || ""}
              onChange={(e) => setSelectedMonthId(e.target.value)}
              className="border-none bg-transparent text-(--color-text) font-medium text-xs sm:text-sm focus:ring-0 cursor-pointer p-0 pr-4 outline-none"
            >
              {usageList.map((usage) => (
                <option key={usage.id} value={usage.id} className="bg-(--color-surface) text-(--color-text)">
                  {formatMonth(usage.id)}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => router(-1)}
            className="inline-flex w-fit items-center gap-2 px-4 py-2.5 rounded-md border border-(--color-border) bg-(--color-surface) hover:border-(--color-text) text-(--color-text) text-xs font-bold uppercase tracking-widest transition-colors shadow-xs outline-none cursor-pointer"
            aria-label="Torna al profilo"
          >
            <FiArrowLeft size={15} className="opacity-70" />
            <span>Torna al profilo</span>
          </button>
        </motion.div>
      </motion.div>
      <motion.div 
        initial="hidden" 
        animate="show" 
        variants={fadeUp} 
        className="p-12 text-center bg-(--color-surface) rounded-lg border border-(--color-border) shadow-(--shadow-soft) mt-6 max-w-6xl mx-auto"
      >
        <h3 className="text-base sm:text-lg font-medium text-(--color-text) mb-1.5" style={{ fontFamily: 'var(--font-serif)' }}>
          Nessuna statistica disponibile
        </h3>
        <p className="text-xs sm:text-sm text-(--color-muted) font-light">
          Attualmente non ci sono dati di utilizzo registrati per il tuo profilo.
        </p>
      </motion.div>
      </motion.div>

    );
  }

  const currentUsage = usageList.find(u => u.id === selectedMonthId) || usageList[0];

  const ricercheCount = (currentUsage.research_agent || 0) + (currentUsage.research || 0);
  const analisiCount = (currentUsage.review_agent || 0) + (currentUsage.reasoning || 0) + (currentUsage.speech_to_text || 0);
  const sintesiCount = (currentUsage.drafting_agent || 0);
  const interazioniCount = currentUsage.legal_agent || 0;
  const hasPrompting = (currentUsage.prompting || 0) > 0;
  
  const totalTimeSaved = calculateTimeSaved(currentUsage);

  return (
    <motion.div 
      initial="hidden" 
      animate="show" 
      variants={staggerContainer} 
      className="space-y-8 max-w-6xl mx-auto p-4 sm:p-6 lg:p-8 bg-(--color-bg) text-(--color-text) min-h-screen"
    >
      {/* Header & Selettore Mese */}
      <motion.div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2" variants={fadeUp}>
        <div>
          <motion.h1 className="text-2xl sm:text-3xl font-medium tracking-tight" style={{ fontFamily: 'var(--font-serif)' }} variants={fadeUp}>
            I tuoi utilizzi
          </motion.h1>
          <motion.p className="mt-1.5 text-xs sm:text-sm text-(--color-muted) font-light leading-relaxed" variants={fadeUp}>
            Monitora il tempo risparmiato e le attività delegate a Jurio.
          </motion.p>
        </div>
        
        <motion.div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto" variants={fadeUp}>
          <div className="flex items-center gap-2 bg-(--color-surface) px-3 py-2 rounded-md border border-(--color-border) shadow-xs">
            <label htmlFor="month-selector" className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted)">
              Periodo:
            </label>
            <select
              id="month-selector"
              value={selectedMonthId || ""}
              onChange={(e) => setSelectedMonthId(e.target.value)}
              className="border-none bg-transparent text-(--color-text) font-medium text-xs sm:text-sm focus:ring-0 cursor-pointer p-0 pr-4 outline-none"
            >
              {usageList.map((usage) => (
                <option key={usage.id} value={usage.id} className="bg-(--color-surface) text-(--color-text)">
                  {formatMonth(usage.id)}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => router(-1)}
            className="inline-flex w-fit items-center gap-2 px-4 py-2.5 rounded-md border border-(--color-border) bg-(--color-surface) hover:border-(--color-text) text-(--color-text) text-xs font-bold uppercase tracking-widest transition-colors shadow-xs outline-none cursor-pointer"
            aria-label="Torna al profilo"
          >
            <FiArrowLeft size={15} className="opacity-70" />
            <span>Torna al profilo</span>
          </button>
        </motion.div>
      </motion.div>

      {/* Grid Metriche Principali */}
      <motion.div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" variants={staggerContainer}>
        
        {/* Tempo Risparmiato */}
        <motion.div variants={fadeUp} className="relative bg-(--color-surface) rounded-lg p-6 border border-(--color-border) shadow-(--shadow-soft) overflow-hidden flex flex-col justify-between min-h-32.5">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-25" />
          <div className="flex justify-between items-start mt-1">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted)">Tempo Risparmiato</h3>
            <span className="p-1.5 rounded-md border border-(--color-border) bg-(--color-bg) text-(--color-text)">
              <FiClock size={16} className="opacity-80" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-4">
            <span className="text-3xl sm:text-4xl font-medium tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>{totalTimeSaved}</span>
            <span className="text-xs uppercase tracking-wider text-(--color-muted) font-bold">minuti</span>
          </div>
        </motion.div>

        {/* Ricerche */}
        <motion.div variants={fadeUp} className="relative bg-(--color-surface) rounded-lg p-6 border border-(--color-border) shadow-(--shadow-soft) overflow-hidden flex flex-col justify-between min-h-32.5">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
          <div className="flex justify-between items-start mt-1">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted)">Ricerche</h3>
            <span className="p-1.5 rounded-md border border-(--color-border) bg-(--color-bg) text-(--color-text)">
              <FiSearch size={16} className="opacity-80" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-4">
            <span className="text-3xl sm:text-4xl font-medium tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>{ricercheCount}</span>
            <span className="text-xs uppercase tracking-wider text-(--color-muted) font-bold">sessioni</span>
          </div>
        </motion.div>

        {/* Analisi Documentale */}
        <motion.div variants={fadeUp} className="relative bg-(--color-surface) rounded-lg p-6 border border-(--color-border) shadow-(--shadow-soft) overflow-hidden flex flex-col justify-between min-h-32.5">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
          <div className="flex justify-between items-start mt-1">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted)">Analisi Doc.</h3>
            <span className="p-1.5 rounded-md border border-(--color-border) bg-(--color-bg) text-(--color-text)">
              <FiFileText size={16} className="opacity-80" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-4">
            <span className="text-3xl sm:text-4xl font-medium tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>{analisiCount}</span>
            <span className="text-xs uppercase tracking-wider text-(--color-muted) font-bold">documenti</span>
          </div>
        </motion.div>

        {/* Sintesi */}
        <motion.div variants={fadeUp} className="relative bg-(--color-surface) rounded-lg p-6 border border-(--color-border) shadow-(--shadow-soft) overflow-hidden flex flex-col justify-between min-h-32.5">
          <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
          <div className="flex justify-between items-start mt-1">
            <h3 className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted)">Sintesi</h3>
            <span className="p-1.5 rounded-md border border-(--color-border) bg-(--color-bg) text-(--color-text)">
              <FiEdit3 size={16} className="opacity-80" />
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-4">
            <span className="text-3xl sm:text-4xl font-medium tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>{sintesiCount}</span>
            <span className="text-xs uppercase tracking-wider text-(--color-muted) font-bold">bozze</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Dettagli Interazioni & Prompting */}
      <motion.div variants={fadeUp} className="relative bg-(--color-surface) rounded-lg border border-(--color-border) shadow-(--shadow-soft) overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

        <div className="px-6 py-4 border-b border-(--color-border) bg-(--color-bg) mt-1">
          <h3 className="text-base sm:text-lg font-medium text-(--color-text) tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
            Dettaglio interazioni del mese
          </h3>
        </div>
        
        <div className="p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-md border border-(--color-border) bg-(--color-bg) flex items-center justify-center text-(--color-text) shrink-0 shadow-xs">
                <FiMessageSquare size={18} className="opacity-80" />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted)">Conversazioni con Legal Agent</p>
                <p className="text-xl sm:text-2xl font-medium text-(--color-text) mt-0.5 tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>{interazioniCount}</p>
              </div>
            </div>

            {hasPrompting && (
              <div className="w-full md:w-auto bg-(--color-bg) border border-(--color-border) rounded-md p-4 flex items-start gap-3 shadow-xs">
                <span className="p-1.5 rounded-sm border border-(--color-border) bg-(--color-surface) text-(--color-text) shrink-0">
                  <FiStar size={16} className="opacity-80" />
                </span>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-(--color-text)">Prompting Libero Attivo</h4>
                  <p className="text-xs text-(--color-muted) font-light mt-0.5 leading-relaxed">
                    Hai utilizzato le funzionalità di prompting avanzato per richieste personalizzate fuori dagli schemi standard.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}