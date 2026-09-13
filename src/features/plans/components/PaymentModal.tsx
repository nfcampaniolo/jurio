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

  // Chiusura tramite ESC
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  // Blocco scroll del body
  useEffect(() => {
    if (!open) return;
    const body = document.body;
    const originalOverflow = body.style.overflow;
    
    body.style.overflow = "hidden";
    
    return () => { 
      body.style.overflow = originalOverflow; 
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          {/* Backdrop accessibile */}
          <motion.button
            type="button"
            className="absolute inset-0 cursor-default bg-transparent border-none outline-none"
            onMouseDown={(e) => { if (e.currentTarget === e.target) onClose(); }}
            aria-label="Chiudi modale"
          />

          {/* Pannello Modale */}
          <motion.div
            className="relative w-full max-w-xl rounded-3xl bg-(--color-surface) border border-(--color-border) shadow-[0_20px_60px_rgba(0,0,0,0.2)] max-h-[calc(100vh-2rem)] flex flex-col overflow-hidden will-change-transform"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            {/* HEADER */}
            <div className="flex items-start justify-between gap-4 border-b border-(--color-border) px-8 py-7 bg-(--color-surface)">
              <div className="min-w-0 flex-1">
                <h3 className="text-[1.5rem] font-medium text-(--color-text) tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
                  {title}
                </h3>
                
                {pricing && (
                  <div className="mt-4 flex flex-col gap-2">
                    {pricing.isDoubleDiscount && (
                      <span className="w-fit text-[0.65rem] font-extrabold px-2.5 py-1 rounded-sm bg-[rgba(224,163,46,0.1)] text-(--color-primary) border border-(--color-primary) uppercase tracking-widest">
                        Doppio Sconto Applicato
                      </span>
                    )}
                    <div className="flex items-baseline gap-3">
                      <span className="text-[0.72rem] font-[850] uppercase tracking-[0.15em] text-(--color-muted)">Totale:</span>
                      <span className="text-[2rem] font-medium text-(--color-text) tracking-[-0.03em] leading-none">
                        {pricing.finalPriceLabel}
                      </span>
                      {pricing.hasDiscount && (
                        <span className="text-[1rem] font-light line-through text-(--color-muted)">
                          {pricing.initialPriceLabel}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={onClose}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-(--color-muted) hover:text-(--color-text) hover:bg-(--color-bg) transition-colors outline-none shrink-0"
                type="button"
                aria-label="Chiudi"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>

            {/* BODY */}
            <div className="px-8 py-8 flex-1 overflow-y-auto overscroll-contain bg-(--color-surface)">
              <div className="relative rounded-2xl border border-(--color-border) bg-(--color-bg) shadow-[inset_0_2px_8px_rgba(0,0,0,0.02)] min-h-75 p-6 flex flex-col">
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

            {/* FOOTER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-(--color-border) bg-[rgba(224,163,46,0.02)] px-8 py-5">
              <div className="text-[0.75rem] text-(--color-muted) font-light">
                Transazione sicura gestita integralmente da <strong className="font-medium text-(--color-text)">Stripe</strong>.
              </div>
              <button
                onClick={onClose}
                type="button"
                className="w-full sm:w-auto px-6 py-2.5 rounded-lg border border-(--color-border) bg-transparent text-(--color-text) text-[0.85rem] font-bold outline-none hover:bg-(--color-surface) transition-colors shrink-0"
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