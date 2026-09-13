import React from "react";
import { motion, AnimatePresence } from "framer-motion";
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

const getIconSvg = (included: boolean) => {
  if (included) {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    );
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-border)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
      <line x1="18" y1="6" x2="6" y2="18"></line>
      <line x1="6" y1="6" x2="18" y2="18"></line>
    </svg>
  );
};

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
  return (
    <div className="mt-4">
      {/* iOS Style Toggle */}
      <div className="flex flex-col items-center gap-3 mb-12">
        <div className="relative inline-flex bg-(--color-surface) border border-(--color-border) rounded-xl p-1.5 shadow-[inset_0_2px_8px_rgba(0,0,0,0.04)]">
          <motion.div
            className="absolute top-1.5 bottom-1.5 w-35 bg-(--color-text) rounded-lg shadow-[0_4px_12px_rgba(0,0,0,0.1)] z-0"
            initial={false}
            animate={{ left: billing === "monthly" ? "6px" : "146px" }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
          <button
            type="button"
            onClick={() => setBilling("monthly")}
            className={`relative z-10 w-35 py-3 text-[0.95rem] font-bold outline-none transition-colors duration-300 ${billing === "monthly" ? "text-(--color-bg)" : "text-(--color-muted)"}`}
          >
            Mensile
          </button>
          <button
            type="button"
            onClick={() => setBilling("yearly")}
            className={`relative z-10 w-35 py-3 text-[0.95rem] font-bold outline-none transition-colors duration-300 ${billing === "yearly" ? "text-(--color-bg)" : "text-(--color-muted)"}`}
          >
            Annuale
          </button>
        </div>
        <div className="text-[0.65rem] text-(--color-muted) font-extrabold tracking-[0.15em] uppercase">
          IVA inclusa
        </div>
      </div>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={billing}
          className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-250 mx-auto"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 15 }}
          animate={shouldReduceMotion ? {} : { opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? {} : { opacity: 0, y: -15 }}
          transition={{ duration: 0.3 }}
        >
          {orderedPlans.map((plan) => {
            const planName = plan.name.trim().toLowerCase();
            const isActive = (!isTrial && activePlan?.id === plan.id) || (isTrial && planName.includes("personale"));
            const pricing = getDynamicPricing(plan, activeCoupon);
            const isHighlighted = plan.highlighted || isActive;

            return (
              <motion.div
                key={plan.id}
                className={`relative flex flex-col p-10 rounded-[20px] bg-(--color-surface) border transition-all duration-400 ease-[cubic-bezier(0.22,1,0.36,1)] shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(0,0,0,0.08)] overflow-hidden ${
                  isHighlighted ? "border-(--color-primary)" : "border-(--color-border)"
                }`}
              >
                {isHighlighted && (
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-(--color-primary)" />
                )}

                <h3 className="text-[2rem] text-(--color-text) mb-8" style={{ fontFamily: 'var(--font-serif)' }}>{plan.name}</h3>
                
                <div className="mb-8">
                  <div className="flex items-center gap-3 h-6 mb-2">
                    {pricing.hasDiscount && (
                      <>
                        <span className="line-through text-(--color-muted) text-base font-medium">{pricing.initialPriceLabel}</span>
                        <span className="text-[0.65rem] font-extrabold px-2 py-0.75 border border-(--color-primary) text-(--color-primary) bg-[rgba(224,163,46,0.1)] rounded-md uppercase tracking-[0.05em]">
                          Risparmi il {pricing.percentage}%
                        </span>
                      </>
                    )}
                  </div>
                  <div className="text-[3.5rem] font-medium leading-none text-(--color-text) tracking-[-0.03em]">
                    {pricing.finalPriceLabel}
                  </div>
                  <div className="text-[0.8rem] font-bold text-(--color-muted) uppercase tracking-widest mt-2">
                    IVA Inclusa &middot; {cycleLabel}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (isActive && !isTrial) return;
                    openPaymentForPlan(plan.name);
                  }}
                  disabled={isActive && !isTrial}
                  className={`w-full py-3.5 rounded-lg text-[0.95rem] font-bold transition-colors outline-none text-center block ${
                    isActive && !isTrial
                      ? "bg-(--color-bg) border border-(--color-border) text-(--color-muted) cursor-not-allowed"
                      : isHighlighted
                      ? "bg-(--color-text) text-(--color-surface)"
                      : "bg-transparent border border-(--color-border) text-(--color-text) hover:bg-(--color-bg)"
                  }`}
                >
                  {isActive && !isTrial ? "Piano Attuale" : "Seleziona"}
                </button>

                <hr className="border-none border-t border-(--color-border) my-10" />

                <ul className="flex-1 flex flex-col gap-6 p-0 m-0 list-none">
                  {plan.features?.map((f, i) => (
                    <li key={i} className={`flex items-start gap-4 ${f.included ? "" : "opacity-50"}`}>
                      {getIconSvg(f.included)}
                      <div className="flex flex-col gap-1">
                        <span className="text-[0.95rem] font-semibold text-(--color-text) leading-tight">{f.name}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </motion.div>
            );
          })}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};