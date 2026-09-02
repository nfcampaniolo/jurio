import React from "react";
import { toast } from "react-hot-toast";
import { getStripePublishableKey } from "@/config/env";
import { type StripeCheckoutProps, createCheckoutSessionServer, fetchPlanPrice } from "@/hooks/stripeCheckout";
import { Loader2 } from "lucide-react";

type ExtendedStripeProps = StripeCheckoutProps & {
  activeCoupon?: { code: string; percentage: number } | null;
};

export default function StripeCheckout({
  planId,
  currency = "EUR",
  activeCoupon,
  onSuccess,
  onError,
}: ExtendedStripeProps) {
  
  const publishableKey = getStripePublishableKey();
  const [amount, setAmount] = React.useState<string | null>(null);
  const [priceCurrency, setPriceCurrency] = React.useState(currency);
  const [loadingPrice, setLoadingPrice] = React.useState<boolean>(true);
  const [priceErr, setPriceErr] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState<boolean>(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingPrice(true);
        setPriceErr(null);
        const p = await fetchPlanPrice(planId);
        if (cancelled) return;
        setAmount(p.amount);
        setPriceCurrency(p.currency);
      } catch (e) {
        if (cancelled) return;
        const msg = e instanceof Error ? e.message : "Failed to load price";
        setPriceErr(msg);
        setAmount(null);
      } finally {
        if (!cancelled) setLoadingPrice(false);
      }
    })();
    return () => { cancelled = true; };
  }, [planId]);

  if (!publishableKey || loadingPrice || priceErr || !amount) {
    return (
      <div className="flex items-center justify-center py-6 text-(--color-muted) gap-2">
        <Loader2 size={16} className="animate-spin text-(--color-text)" />
        <span className="text-xs font-bold uppercase tracking-widest">Caricamento Stripe...</span>
      </div>
    ); 
  }

  // --- CALCOLO SCONTO UI FRONTEND ---
  const basePriceNum = parseFloat(amount.replace(",", "."));
  const hasCoupon = activeCoupon && activeCoupon.percentage > 0;
  const finalPriceNum = hasCoupon ? basePriceNum - (basePriceNum * (activeCoupon.percentage / 100)) : basePriceNum;
  
  const finalPriceStr = finalPriceNum.toFixed(2).replace(".", ",");
  const basePriceStr = basePriceNum.toFixed(2).replace(".", ",");
  // ----------------------------------

  const onPay = async () => {
    try {
      setSubmitting(true);
      
      const { url, sessionId } = await createCheckoutSessionServer({
        planId,
        source: "in_app",
        couponCode: activeCoupon?.code,
      });

      toast.success("Reindirizzamento al pagamento...");
      onSuccess?.({ sessionId, url });
      window.location.assign(url);
    } catch (err) {
      console.error(err);
      toast.error("Errore durante il pagamento");
      onError?.(err);
      setSubmitting(false);
    }
  };

  return (
    <div className="relative rounded-md border border-(--color-border) bg-(--color-surface) p-5 shadow-xs overflow-hidden">
      {/* LA LINEA DI RIGORE SUPERIORE (Unico tocco di colore) */}
      <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-(--color-text) flex items-center gap-2.5 tracking-tight">
            Stripe
            {hasCoupon && (
              <span className="px-2 py-0.5 text-[9px] font-bold bg-(--color-bg) border border-(--color-border) text-(--color-text) rounded-sm uppercase tracking-widest">
                Coupon {activeCoupon.percentage}%
              </span>
            )}
          </div>
          <div className="mt-1.5 text-xs text-(--color-muted) font-light flex flex-wrap items-center gap-1.5">
            <span>Piano:</span> 
            <span className="font-semibold text-(--color-text) uppercase tracking-wider text-[10px] px-2 py-0.5 rounded-sm bg-(--color-bg) border border-(--color-border)">
              {planId}
            </span>
            <span className="mx-1 opacity-50">&bull;</span>
            
            <span>Totale:</span>
            {hasCoupon ? (
               <>
                 <span className="ml-1 text-sm font-semibold text-(--color-text)">
                   € {finalPriceStr}
                 </span>
                 <span className="ml-2 text-xs font-light line-through text-(--color-muted)">
                   € {basePriceStr}
                 </span>
               </>
            ) : (
               <span className="ml-1 font-semibold text-(--color-text)">€ {basePriceStr}</span>
            )}
            <span className="ml-1 uppercase text-[10px] opacity-80">({priceCurrency})</span>
          </div>
        </div>
      </div>

      <button
        onClick={onPay}
        disabled={submitting}
        className="w-full rounded-md bg-(--color-text) text-(--color-surface) px-4 py-3 text-xs font-bold uppercase tracking-widest disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-all outline-none shadow-xs flex items-center justify-center gap-2"
        aria-label="Paga con Stripe"
      >
        {submitting && <Loader2 size={14} className="animate-spin" />}
        <span>{submitting ? "Reindirizzamento..." : "Paga con Stripe"}</span>
      </button>
    </div>
  );
}