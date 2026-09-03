import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaCheck } from "react-icons/fa";
import type { PlanUI } from "@/features/plans/hooks/plans";
import type { CouponData } from "@/features/plans/hooks/discount";
import { getDynamicPricing } from "@/features/plans/hooks/usePlans";

type BillingCycle = "monthly" | "yearly";

interface PlansGridProps {
  billing: BillingCycle;
  setBilling: (val: BillingCycle) => void;
  orderedPlans: PlanUI[];
  activePlan: PlanUI | null;
  isTrial: boolean;
  activeCoupon: CouponData | null;
  shouldReduceMotion: boolean | null;
  cycleLabel: string;
  openPaymentForPlan: (planName: string) => void;
}

export const PlansGrid: React.FC<PlansGridProps> = ({
  billing,
  setBilling,
  orderedPlans,
  activePlan,
  isTrial,
  activeCoupon,
  shouldReduceMotion,
  cycleLabel,
  openPaymentForPlan,
}) => {
  const BillingSwitch = (
    <div className="mt-10 flex flex-col items-center justify-center gap-2.5">
      <div className="relative flex items-center p-1 bg-(--color-bg) rounded-md border border-(--color-border) shadow-xs">
        <motion.div
          className="absolute inset-y-1 w-[calc(50%-4px)] bg-(--color-surface) rounded-sm shadow-xs border border-(--color-border)"
          initial={false}
          animate={{ 
            left: billing === "monthly" ? "4px" : "calc(50% + 0px)" 
          }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
        <button
          type="button"
          onClick={() => setBilling("monthly")}
          className={`relative z-10 w-32 py-2 text-xs font-bold uppercase tracking-widest rounded-sm transition-colors duration-200 outline-none ${
            billing === "monthly" ? "text-(--color-text)" : "text-(--color-muted) hover:text-(--color-text)"
          }`}
        >
          Mensile
        </button>
        <button
          type="button"
          onClick={() => setBilling("yearly")}
          className={`relative z-10 w-32 py-2 text-xs font-bold uppercase tracking-widest rounded-sm flex items-center justify-center gap-1.5 transition-colors duration-200 outline-none ${
            billing === "yearly" ? "text-(--color-text)" : "text-(--color-muted) hover:text-(--color-text)"
          }`}
        >
          Annuale
          <span className="absolute -top-3 -right-2 px-2 py-0.5 text-[9px] font-bold text-(--color-surface) bg-(--color-text) rounded-sm shadow-xs border border-(--color-border) z-20 uppercase tracking-widest">
            -17%
          </span>
        </button>
      </div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted)">Prezzi {cycleLabel} • IVA inclusa</div>
    </div>
  );

  return (
    <>
      <div className="text-center mb-8">
        <h2 className="text-2xl sm:text-3xl font-medium text-(--color-text) tracking-tight mb-3">
          Scegli il piano giusto per te
        </h2>
        <p className="text-xs sm:text-sm text-(--color-muted) font-light max-w-2xl mx-auto leading-relaxed">
          Il piano Essential è ottimizzato per la ricerca mirata, mentre le soluzioni superiori integrano redazione automatica e analisi documentale profonda.
        </p>
      </div>

      {BillingSwitch}

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={billing}
          className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 15 }}
          animate={shouldReduceMotion ? {} : { opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? {} : { opacity: 0, y: -15 }}
          transition={shouldReduceMotion ? {} : { duration: 0.25, ease: "easeOut" }}
          layout
        >
          {orderedPlans.map((plan) => {
            const planName = plan.name.trim().toLowerCase();
            const isActive =
              (!isTrial && !!activePlan && (plan.id === activePlan.id || plan.name === activePlan.name)) ||
              (isTrial && planName.includes("personale"));

            const badge =
            !isTrial && !!activePlan && (plan.id === activePlan.id || plan.name === activePlan.name)
                ? { text: "Attuale", className: "bg-emerald-500 border border-emerald-500/30 text-emerald-100" }
                : (isTrial || !!activePlan) && planName.includes("personale")
                ? { text: "Attuale", className: "bg-emerald-500 border border-emerald-500/30 text-emerald-100" }
                : plan.highlighted
                    ? { text: "Più scelto", className: "bg-(--color-bg) border border-(--color-border) text-(--color-text)" }
                    : null;

            const pricing = getDynamicPricing(plan, activeCoupon);

            return (
              <motion.div
                key={plan.id}
                layout="position"
                className={`relative flex flex-col rounded-lg border p-6 sm:p-8 bg-(--color-surface) transition-all duration-200 shadow-(--shadow-soft) ${
                  plan.highlighted || isActive
                    ? "border-(--color-text)"
                    : "border-(--color-border) hover:border-(--color-text)"
                }`}
              >

                {badge && (
                  <div className={`absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-sm shadow-xs whitespace-nowrap ${badge.className}`}>
                    {badge.text}
                  </div>
                )}

                <div className="text-center mb-6 mt-1">
                  <h3 className="text-lg sm:text-xl font-medium text-(--color-text) tracking-tight mb-3">
                    {plan.name}
                  </h3>
                  
                  <div className="flex flex-col items-center justify-center min-h-18">
                    {pricing.hasDiscount && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-light line-through text-(--color-muted)">
                          {pricing.initialPriceLabel}
                        </span>
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-sm bg-(--color-bg) border border-(--color-border) text-(--color-text) uppercase tracking-wider">
                          -{pricing.percentage}%
                        </span>
                      </div>
                    )}
                    <div className="text-3xl font-medium text-(--color-text) tracking-tight">
                      {pricing.finalPriceLabel}
                    </div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-(--color-muted) mt-1.5">
                      IVA inclusa • {cycleLabel}
                    </div>
                  </div>
                </div>

                <ul className="flex-1 flex flex-col gap-3 text-xs mb-8 border-t border-(--color-border) pt-6">
                  {plan.features
                    ?.filter((f) => f.included)
                    .map((feature, i) => (
                      <li key={`${plan.id}-feat-${i}`} className="flex items-start gap-2.5 text-(--color-text) font-light">
                        <div className="p-0.5 rounded-xs bg-(--color-bg) border border-(--color-border) shrink-0 mt-0.5">
                          <FaCheck className="text-(--color-text) opacity-70 text-[9px]" />
                        </div>
                        <span className="leading-relaxed">{feature.name}</span>
                      </li>
                    ))}
                </ul>

                <div className="mt-auto">
                  {!isTrial && !!activePlan && (plan.id === activePlan.id || plan.name === activePlan.name) ? (
                    <button
                      type="button"
                      className="w-full px-5 py-2.5 rounded-md border border-(--color-border) bg-(--color-bg) text-(--color-muted) text-[10px] font-bold uppercase tracking-widest opacity-50 cursor-not-allowed"
                      disabled
                    >
                      Il tuo piano attuale
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => openPaymentForPlan(plan.name)}
                      className="w-full px-5 py-2.5 rounded-md bg-(--color-text) text-(--color-surface) text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-xs outline-none"
                    >
                      {isTrial && planName.includes("personale") 
                        ? "Attiva Piano Personale" 
                        : planName.includes("business") 
                        ? "Passa al piano Business" 
                        : "Ottieni"}
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </>
  );
};