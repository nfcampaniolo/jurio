import React from "react";
import { motion, type Variants } from "framer-motion";
import { FaCheck } from "react-icons/fa";
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
      className="relative rounded-lg border border-(--color-border) bg-(--color-surface) p-6 sm:p-8 mb-8 shadow-(--shadow-soft) overflow-hidden"
      variants={scaleIn}
      initial="hidden"
      animate="show"
      transition={shouldReduceMotion ? {} : { duration: 0.3, ease: "easeOut" }}
      layout
    >
      {/* LA LINEA DI RIGORE SUPERIORE (Unico tocco di colore) */}
      <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

      <div className="relative z-10 flex flex-col md:flex-row md:items-start md:justify-between gap-6 mt-1">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted)">
              Il tuo Status
            </span>

            {isAdmin ? (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-sm bg-purple-500/10 border border-purple-500/30 text-purple-600 dark:text-purple-400 uppercase tracking-widest">
                Admin
              </span>
            ) : isTrial ? (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-sm bg-sky-500/10 border border-sky-500/30 text-sky-600 dark:text-sky-400 uppercase tracking-widest">
                In Prova
              </span>
            ) : activePlan ? (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-sm bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">
                Attivo
              </span>
            ) : (
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-sm bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 uppercase tracking-widest">
                {isNone ? "Scaduto" : "Da verificare"}
              </span>
            )}
          </div>

          <div className="text-xl sm:text-2xl font-medium text-(--color-text) tracking-tight mb-2">
            {isAdmin
              ? "Accesso Completo"
              : isNone
                ? "Nessun piano attivo"
                : isTrial
                  ? "Periodo di Prova"
                  : activePlan?.name ?? "Piano non riconosciuto"}
          </div>

          {!isAdmin && !isTrial && activePlan ? (
            <div className="text-xs text-(--color-muted) font-light">
              Rinnovo: <span className="font-semibold text-(--color-text)">{activePlan.priceLabel}</span>{" "}
              <span className="uppercase tracking-wider">({cycleLabel})</span>
            </div>
          ) : null}

          {isNone && !activePlan && (
            <p className="text-xs text-(--color-muted) font-light">
              Il tuo piano è scaduto. Scegli una delle opzioni qui sotto per riattivare i servizi.
            </p>
          )}

          {isAdmin && (
            <p className="text-xs text-(--color-muted) font-light">
              Sei un amministratore di sistema. Hai accesso illimitato a tutte le funzionalità senza restrizioni.
            </p>
          )}
          {isTrial && (
            <p className="text-xs text-(--color-muted) font-light max-w-lg leading-relaxed">
              Stai testando tutte le potenzialità della piattaforma. Al termine, i tuoi dati saranno conservati.
            </p>
          )}
        </div>

        <div className="w-full md:w-auto flex flex-col sm:flex-row items-stretch gap-3 mt-2 md:mt-0">
          {upgradePlan ? (
            <button
              type="button"
              onClick={() => openPaymentForPlan(upgradePlan.name)}
              className="px-5 py-2.5 rounded-md bg-(--color-text) text-(--color-surface) text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-xs outline-none"
            >
              Upgrade a {upgradePlan.name}
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="px-5 py-2.5 rounded-md border border-(--color-border) bg-(--color-bg) text-(--color-muted) text-xs font-bold uppercase tracking-widest opacity-50 cursor-not-allowed"
            >
              Sei al piano massimo
            </button>
          )}
        </div>
      </div>

      {isTrial && activePlan?.features?.length ? (
        <div className="mt-6 pt-6 border-t border-(--color-border)">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) mb-3">Servizi attivi nel tuo piano</h4>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {activePlan.features
              .filter((f) => f.included)
              .map((f, i) => (
                <li key={`${activePlan.id}-feat-${i}`} className="flex items-start gap-2.5 text-(--color-text) font-light">
                  <div className="p-0.5 rounded-xs bg-(--color-bg) border border-(--color-border) shrink-0 mt-0.5">
                    <FaCheck className="text-(--color-text) opacity-70 text-[9px]" />
                  </div>
                  <span className="leading-relaxed">{f.name}</span>
                </li>
              ))}
          </ul>
        </div>
      ) : null}

      {isTrial && upgradePlan?.features?.length ? (
        <div className="mt-6 pt-6 border-t border-(--color-border)">
          <h4 className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) mb-3">
            Sblocca il potenziale completo passando a {upgradePlan.name}:
          </h4>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {upgradePlan.features
              .filter((f) => f.included)
              .slice(0, 6)
              .map((f, i) => (
                <li key={`${upgradePlan.id}-trial-feat-${i}`} className="flex items-start gap-2.5 text-(--color-muted) font-light">
                  <div className="p-0.5 rounded-xs bg-(--color-bg) border border-(--color-border) shrink-0 mt-0.5">
                    <FaCheck className="text-(--color-text) opacity-50 text-[9px]" />
                  </div>
                  <span className="leading-relaxed">{f.name}</span>
                </li>
              ))}
          </ul>
        </div>
      ) : null}
    </motion.div>
  );
};