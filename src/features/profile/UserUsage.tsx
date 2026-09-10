"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/useAuth"; 
import { motion, useReducedMotion } from "framer-motion";
import { 
  FiArrowLeft, 
  FiSearch, 
  FiFileText, 
  FiEdit3, 
  FiMessageSquare, 
  FiClock, 
  FiChevronDown,
  FiTarget,
  FiInfo
} from "react-icons/fi";
import { Loader2 } from "lucide-react";
import { 
  useUsageData, 
  formatMonthLabel,
  formatTimeHero,
  formatTimeCompact
} from "@/features/profile/hooks/useUsageData"; 
import { SEO } from "@/shared/components/SEO";

const customEase = [0.22, 1, 0.36, 1] as const;

interface ProgressMetricCardProps {
  title: string;
  icon: React.ElementType;
  used: number;
  limit: number;
  timeSavedLabel: string;
  showLimit: boolean; 
}

const ProgressMetricCard = ({ title, icon: Icon, used, limit, timeSavedLabel, showLimit }: ProgressMetricCardProps) => {
  const percentage = Math.min((used / Math.max(limit, 1)) * 100, 100);
  const remaining = Math.max(limit - used, 0);
  const isNearLimit = percentage >= 85;
  const isExhausted = percentage >= 100;

  return (
    <div className="group relative p-6 rounded-2xl border border-(--color-border) bg-(--color-surface)/40 backdrop-blur-md hover:bg-(--color-surface)/80 hover:border-(--color-primary)/30 transition-all duration-300 flex flex-col justify-between">
      <div>
        <div className="flex justify-between items-start mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-(--color-primary)/10 text-(--color-primary) flex items-center justify-center">
              <Icon size={16} />
            </div>
            <span className="text-xs font-semibold text-(--color-text) uppercase tracking-wider">{title}</span>
          </div>

          {timeSavedLabel !== "0m" && (
            <span className="inline-flex items-center gap-1 text-[0.7rem] font-medium text-(--color-primary) bg-(--color-primary)/10 px-2 py-0.5 rounded-full">
              <FiClock size={11} />
              +{timeSavedLabel}
            </span>
          )}
        </div>

        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl md:text-4xl font-medium tracking-tight text-(--color-text)" style={{ fontFamily: 'var(--font-serif)' }}>
            {used}
          </span>
          {showLimit && (
            <span className="text-xs text-(--color-muted) font-normal">
              / {limit} <span className="opacity-70">utilizzati</span>
            </span>
          )}
        </div>
      </div>

      {showLimit && (
        <div className="mt-4 pt-3 border-t border-(--color-border)/50">
          <div className="flex justify-between text-[0.7rem] text-(--color-muted) mb-1.5">
            <span>{isExhausted ? "Limite raggiunto" : `${remaining} disponibili`}</span>
            <span className="font-mono">{Math.round(percentage)}%</span>
          </div>
          <div 
            className="h-1.5 w-full bg-(--color-border)/60 rounded-full overflow-hidden"
            role="progressbar"
            aria-valuenow={used}
            aria-valuemin={0}
            aria-valuemax={limit}
            aria-label={`Utilizzo ${title}`}
          >
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 0.9, ease: customEase, delay: 0.1 }}
              className={`h-full rounded-full transition-colors ${
                isExhausted ? 'bg-red-500' : isNearLimit ? 'bg-amber-500' : 'bg-(--color-primary)'
              }`}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default function UserUsage() {
  const shouldReduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const { usageList, limits, loading, error } = useUsageData(user?.uid);
  
  const [userSelectedMonthId, setUserSelectedMonthId] = useState<string | null>(null);
  const activeMonthId = userSelectedMonthId || (usageList.length > 0 ? usageList[0].mese : null);
  
  const currentMonthData = usageList.find(u => u.mese === activeMonthId) || usageList[0];
  const isDataReady = !loading && !error;
  const heroTime = currentMonthData ? formatTimeHero(currentMonthData.totalTimeSavedMinutes) : { value: "0", unit: "min" };

  return (
    <section className="relative py-10 md:py-16 bg-(--color-bg) min-h-screen text-(--color-text)">
      <SEO
        title="Monitoraggio Utilizzi e Statistiche"
        description="Monitora i tuoi consumi, le sessioni di ricerca giurisprudenziale, le analisi documentali e il tempo di lavoro risparmiato su Jurio."
        path="/profilo/utilizzi"
        noIndex
      />

      <div className="max-w-7xl mx-auto px-6">
      
        {/* NAV & CONTROLLI */}
        <header className="flex justify-between items-center mb-12">
          {isDataReady && usageList.length > 0 && (
            <div className="relative">
              <select
                value={activeMonthId || ""}
                onChange={(e) => setUserSelectedMonthId(e.target.value)}
                className="appearance-none bg-(--color-surface)/60 backdrop-blur-md border border-(--color-border) text-(--color-text) text-xs font-medium py-2 pl-3.5 pr-9 rounded-xl outline-none cursor-pointer hover:border-(--color-primary)/50 transition-colors"
                aria-label="Seleziona Mese"
              >
                {usageList.map((usage) => (
                  <option key={usage.mese} value={usage.mese}>
                    {formatMonthLabel(usage.mese)} {usage.isCurrentMonth ? "• Attuale" : ""}
                  </option>
                ))}
              </select>
              <FiChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-(--color-muted)" />
            </div>
          )}
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex w-fit items-center gap-2 px-4 py-2.5 rounded-md border border-(--color-border) bg-(--color-surface) hover:border-(--color-text) text-(--color-text) text-xs font-bold uppercase tracking-widest transition-colors shadow-xs outline-none cursor-pointer"
            aria-label="Torna al profilo"
          >
            <FiArrowLeft size={15} className="opacity-70" />
            <span>Torna al profilo</span>
          </button>
        </header>

        {loading && (
          <div className="flex flex-col justify-center items-center h-64 gap-3">
            <Loader2 size={24} className="animate-spin text-(--color-primary)" />
            <span className="text-xs font-semibold uppercase tracking-wider text-(--color-muted)">Sincronizzazione registri...</span>
          </div>
        )}

        {!loading && error && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl text-center">
            {error}
          </div>
        )}

        {isDataReady && currentMonthData && (
          <>
            {/* HERO STATS */}
            <motion.div 
              className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end border-b border-(--color-border) pb-10 mb-10"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: customEase }}
            >
              <div className="md:col-span-2 space-y-3">
                <div className="inline-flex items-center gap-2 text-(--color-primary) text-xs font-semibold uppercase tracking-wider">
                  <span className="w-1.5 h-1.5 rounded-full bg-(--color-primary) animate-pulse" />
                  Performance {currentMonthData.isCurrentMonth ? "in corso" : "storica"}
                </div>
                <h1 className="text-3xl md:text-5xl tracking-tight leading-tight" style={{ fontFamily: 'var(--font-serif)' }}>
                  Tempo <em className="text-(--color-primary) not-italic">Risparmiato.</em>
                </h1>
                <p className="text-sm text-(--color-muted) font-light max-w-md leading-relaxed">
                  Impatto operativo generato dalle automazioni AI sui flussi di lavoro di studio per il periodo selezionato.
                </p>
              </div>

              <div className="bg-(--color-surface)/30 border border-(--color-border) rounded-2xl p-5 md:text-right flex md:flex-col justify-between items-center md:items-end">
                <span className="text-xs font-medium uppercase tracking-wider text-(--color-muted)">
                  Risparmio netto stimato
                </span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-5xl md:text-6xl font-medium tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
                    {heroTime.value}
                  </span>
                  <span className="text-base text-(--color-muted)">{heroTime.unit}</span>
                </div>
              </div>
            </motion.div>

            {/* GRIGLIA METRICHE */}
            <motion.div 
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: customEase, delay: 0.1 }}
            >
              <ProgressMetricCard 
                title="Ricerche" 
                icon={FiSearch} 
                used={currentMonthData.ricerca.count} 
                limit={limits.research} 
                timeSavedLabel={formatTimeCompact(currentMonthData.ricerca.timeSavedMinutes)}
                showLimit={currentMonthData.isCurrentMonth} 
              />
              <ProgressMetricCard 
                title="Analisi Doc" 
                icon={FiFileText} 
                used={currentMonthData.analisi.count} 
                limit={limits.analysis} 
                timeSavedLabel={formatTimeCompact(currentMonthData.analisi.timeSavedMinutes)}
                showLimit={currentMonthData.isCurrentMonth} 
              />
              <ProgressMetricCard 
                title="Approfondimenti" 
                icon={FiTarget} 
                used={currentMonthData.deepAnalysis.count} 
                limit={limits.deep_analysis} 
                timeSavedLabel={formatTimeCompact(currentMonthData.deepAnalysis.timeSavedMinutes)}
                showLimit={currentMonthData.isCurrentMonth} 
              />
              <ProgressMetricCard 
                title="Redazione" 
                icon={FiEdit3} 
                used={currentMonthData.sintesi.count} 
                limit={limits.synthesis} 
                timeSavedLabel={formatTimeCompact(currentMonthData.sintesi.timeSavedMinutes)}
                showLimit={currentMonthData.isCurrentMonth} 
              />
            </motion.div>

            {/* BARRA INFORMATIVA AGENT & FOOTER METODOLOGIA */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-xl bg-(--color-surface)/30 border border-(--color-border) text-xs text-(--color-muted)">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-(--color-surface) border border-(--color-border) flex items-center justify-center text-(--color-text)">
                  <FiMessageSquare size={14} />
                </div>
                <div>
                  <span className="font-medium text-(--color-text)">{currentMonthData.interazioniCount} interazioni</span>
                  <span className="mx-1.5">•</span>
                  <span>Scambi liberi con Legal Agent</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-[0.7rem] border-t sm:border-t-0 pt-2 sm:pt-0 border-(--color-border)/50">
                <FiInfo size={12} className="shrink-0 text-(--color-primary)" />
                <span>Base calcolo: Deep (60m), Analisi (30m), Ricerca (10m), Redazione (15m).</span>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  );
}