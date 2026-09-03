import { useMemo, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import StripeCheckout from "@/features/plans/components/StripeCheckout";

type PlanId = "personale" | "business" | "personale_m" | "business_m" | "team3" | "team5" | "team7";

type Props = {
  open: boolean;
  onClose: () => void;
  planName: string;
  basePrice?: number | string;
  initialPrice?: number | string;
  activeCoupon?: { code: string; percentage: number } | null;
};

function toPlanId(planName: string): PlanId {
  switch (planName.toLowerCase()) {
    case "essential annuale": return "personale";
    case "business annuale": return "business";
    case "essential mensile": return "personale_m";
    case "business mensile": return "business_m";
    case "team 3": return "team3";
    case "team 5": return "team5";
    case "team 7": return "team7";
    default: return "personale";
  }
}

function parsePrice(val?: string | number): number {
  if (val === undefined || val === null || val === "") return NaN;
  if (typeof val === "number") return val;
  return parseFloat(val.replace(",", "."));
}

const getModalPricing = (baseVal?: string | number, initialVal?: string | number, coupon?: { percentage: number } | null) => {
  const base = parsePrice(baseVal);
  if (isNaN(base)) return null;

  const initial = parsePrice(initialVal);
  let finalPrice = base;
  
  const hasNativeDiscount = !isNaN(initial) && initial > base;
  const hasCouponDiscount = coupon !== null && coupon !== undefined && coupon.percentage > 0;
  
  const isDoubleDiscount = hasNativeDiscount && hasCouponDiscount;
  const referenceInitialPrice = hasNativeDiscount ? initial : base;

  if (hasCouponDiscount) {
    finalPrice = base - (base * (coupon.percentage / 100));
  } else if (hasNativeDiscount) {
    finalPrice = base;
  }

  const formatNum = (num: number) => num % 1 === 0 ? num.toString() : num.toFixed(2).replace('.', ',');

  return {
    isDoubleDiscount,
    hasDiscount: hasNativeDiscount || hasCouponDiscount,
    initialPriceLabel: `€ ${formatNum(referenceInitialPrice)}`,
    finalPriceLabel: `€ ${formatNum(finalPrice)}`
  };
};

export default function PaymentModal({ 
  open, 
  onClose, 
  planName, 
  basePrice, 
  initialPrice, 
  activeCoupon 
}: Props) {
  const title = useMemo(() => `Pagamento – Piano ${planName}`, [planName]);
  const planId = useMemo(() => toPlanId(planName), [planName]);
  
  const pricing = useMemo(() => getModalPricing(basePrice, initialPrice, activeCoupon), [basePrice, initialPrice, activeCoupon]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.button
            type="button"
            className="absolute inset-0 cursor-default bg-transparent"
            onMouseDown={(e) => { if (e.currentTarget === e.target) onClose(); }}
            aria-label="Chiudi modale"
          />

          <motion.div
            className="relative w-full max-w-xl rounded-lg bg-(--color-surface) border border-(--color-border) shadow-(--shadow-soft) max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 18, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 520, damping: 38, mass: 0.9 }}
          >
            {/* LA LINEA DI RIGORE SUPERIORE (Unico tocco di colore) */}
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

            <div className="flex items-start justify-between gap-4 border-b border-(--color-border) bg-(--color-bg) px-6 py-5 mt-1">
              <div className="min-w-0 flex-1">
                <h3 className="text-base md:text-lg font-medium text-(--color-text) tracking-tight">
                  {title}
                </h3>
                
                {pricing && (
                  <div className="mt-3 flex flex-col gap-1.5">
                    {pricing.isDoubleDiscount && (
                      <span className="w-fit text-[10px] font-bold px-2 py-0.5 rounded-sm bg-red-500/10 text-red-600 dark:text-red-400 uppercase tracking-widest border border-red-500/30">
                        Doppio Sconto Attivo
                      </span>
                    )}
                    <div className="flex items-baseline gap-3 mt-1">
                      <span className="text-xs font-bold uppercase tracking-widest text-(--color-muted)">Totale:</span>
                      <span className="text-xl font-semibold text-(--color-text)">
                        {pricing.finalPriceLabel}
                      </span>
                      {pricing.hasDiscount && (
                        <span className="text-sm font-light line-through text-(--color-muted)">
                          {pricing.initialPriceLabel}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md text-(--color-muted) hover:text-(--color-text) hover:bg-(--color-surface) transition-colors outline-none"
                type="button"
                aria-label="Chiudi"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-6 flex-1 min-h-0 overflow-y-auto overscroll-contain bg-(--color-surface)">
              <div className="rounded-md border border-(--color-border) bg-(--color-bg) p-5 shadow-xs">
                <StripeCheckout
                  planId={planId}
                  activeCoupon={activeCoupon}
                  onSuccess={(details) => {
                    console.log("Stripe session created", details);
                    onClose();
                  }}
                  onError={(err) => console.error("Stripe error", err)}
                />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-(--color-border) bg-(--color-bg) px-6 py-4">
              <div className="text-xs text-(--color-muted) font-light">Transazione sicura gestita da Stripe.</div>
              <button
                onClick={onClose}
                type="button"
                className="rounded-md bg-(--color-surface) border border-(--color-border) px-4 py-2 text-xs font-bold uppercase tracking-widest text-(--color-muted) hover:text-(--color-text) transition-colors outline-none"
              >
                Annulla
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}