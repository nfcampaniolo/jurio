import React from "react";
import { motion, type Variants } from "framer-motion";
import type { PlanUI } from "@/features/plans/hooks/plans";
import type { StatusNormalized } from "@/features/plans/hooks/planlDomain";

interface CurrentPlanCardProps {
  status: StatusNormalized;
  isAdmin: boolean;
  isTrial: boolean;
  isNone: boolean;
  activePlan: PlanUI | null;
  upgradePlan: PlanUI | null;
  cycleLabel: string;
  shouldReduceMotion: boolean | null;
  openPaymentForPlan: (planName: string) => void;
  fadeUp: Variants;
  scaleIn: Variants;
}

export const CurrentPlanCard: React.FC<CurrentPlanCardProps> = ({
  isAdmin,
  isTrial,
  isNone,
  activePlan,
  upgradePlan,
  cycleLabel,
  shouldReduceMotion,
  openPaymentForPlan,
  scaleIn,
}) => {
  return (
    <motion.div
      className="relative rounded-[20px] border border-(--color-border) bg-(--color-surface) p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-[0_4px_20px_rgba(0,0,0,0.03)] overflow-hidden"
      variants={scaleIn}
      initial="hidden"
      animate="show"
      transition={shouldReduceMotion ? {} : { duration: 0.4, ease: "easeOut" }}
      /* RIMOSSA LA PROP "layout" CHE CAUSAVA LAG */
    >
      <div className="flex-1 z-10">
        <div className="text-(--color-primary) text-[0.72rem] font-[850] uppercase tracking-[0.15em] mb-2">
          Stato Attuale
        </div>
        
        <div className="flex items-center gap-4 mb-2">
          <h2 className="text-3xl font-medium text-(--color-text) tracking-[-0.03em]" style={{ fontFamily: 'var(--font-serif)' }}>
            {isAdmin ? "Accesso Completo" : isNone ? "Nessun piano attivo" : isTrial ? "Periodo di Prova" : activePlan?.name ?? "Non riconosciuto"}
          </h2>
          {isAdmin ? (
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-md border border-purple-500/30 text-purple-600 bg-purple-500/10 uppercase tracking-widest">Admin</span>
          ) : isTrial ? (
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-md border border-sky-500/30 text-sky-600 bg-sky-500/10 uppercase tracking-widest">In Prova</span>
          ) : activePlan ? (
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-md border border-emerald-500/30 text-emerald-600 bg-emerald-500/10 uppercase tracking-widest">Attivo</span>
          ) : (
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-md border border-red-500/30 text-red-600 bg-red-500/10 uppercase tracking-widest">{isNone ? "Scaduto" : "Verifica"}</span>
          )}
        </div>

        {!isAdmin && !isTrial && activePlan ? (
          <p className="text-[0.95rem] text-(--color-muted) font-light">
            Rinnovo: <strong className="font-medium text-(--color-text)">{activePlan.priceLabel}</strong> /{cycleLabel === 'al mese' ? 'mese' : 'anno'}
          </p>
        ) : (
          <p className="text-[0.95rem] text-(--color-muted) font-light">
            {isTrial ? "Esplora tutte le potenzialità della piattaforma senza limitazioni." : isNone ? "Scegli un piano per iniziare ad operare." : "Accesso illimitato alle funzionalità del sistema."}
          </p>
        )}
      </div>

      <div className="shrink-0 z-10 w-full md:w-auto">
        {upgradePlan ? (
          <button
            type="button"
            onClick={() => openPaymentForPlan(upgradePlan.name)}
            className="w-full md:w-auto px-8 py-3.5 rounded-lg bg-(--color-text) text-(--color-surface) text-[0.85rem] font-bold outline-none shadow-md hover:-translate-y-1 hover:shadow-lg transition-all duration-300"
          >
            Esegui l'Upgrade
          </button>
        ) : !isAdmin && !isNone && (
          <div className="px-6 py-3 bg-(--color-bg) rounded-lg border border-(--color-border) text-(--color-muted) text-[0.85rem] font-medium text-center">
            Piano Massimo Raggiunto
          </div>
        )}
      </div>
    </motion.div>
  );
};