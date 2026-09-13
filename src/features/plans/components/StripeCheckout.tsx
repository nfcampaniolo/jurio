import React from "react";
import { toast } from "react-hot-toast";
import { getStripePublishableKey } from "@/config/env";
import { type StripeCheckoutProps, createCheckoutSessionServer, fetchPlanPrice } from "@/features/plans/hooks/stripeCheckout";
import { Loader2, AlertCircle } from "lucide-react";

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

  // --- STATO: CARICAMENTO (Altezza fissa anti-sfarfallio) ---
  if (!publishableKey || loadingPrice) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full min-h-62.5 text-(--color-muted) gap-4">
        <Loader2 size={24} className="animate-spin text-(--color-text)" />
        <span className="text-[0.72rem] font-[850] uppercase tracking-[0.15em]">Connessione a Stripe...</span>
      </div>
    ); 
  }

  // --- STATO: ERRORE ---
  if (priceErr || !amount) {
    return (
      <div className="flex flex-col items-center justify-center w-full h-full min-h-62.5 text-red-500 gap-3">
        <AlertCircle size={24} />
        <span className="text-[0.72rem] font-[850] uppercase tracking-[0.15em]">Errore Prezzo</span>
        <span className="text-[0.85rem] font-light text-center max-w-xs">{priceErr}</span>
      </div>
    );
  }

  const basePriceNum = parseFloat(amount.replace(",", "."));
  const hasCoupon = activeCoupon && activeCoupon.percentage > 0;
  const finalPriceNum = hasCoupon ? basePriceNum - (basePriceNum * (activeCoupon.percentage / 100)) : basePriceNum;
  
  const finalPriceStr = finalPriceNum.toFixed(2).replace(".", ",");
  const basePriceStr = basePriceNum.toFixed(2).replace(".", ",");

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

  // --- STATO FINALE: Rimosso motion.div per evitare conflitti visivi ---
  return (
    <div className="flex flex-col justify-between w-full h-full min-h-62.5">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-5">
          <h4 className="text-[1.25rem] font-medium text-(--color-text) tracking-[-0.02em]" style={{ fontFamily: 'var(--font-serif)' }}>
            Riepilogo Ordine
          </h4>
          {hasCoupon && (
            <span className="px-2 py-0.75 text-[0.6rem] font-extrabold bg-[rgba(224,163,46,0.1)] border border-(--color-primary) text-(--color-primary) rounded-[3px] uppercase tracking-widest">
              Coupon {activeCoupon.percentage}%
            </span>
          )}
        </div>

        <div className="flex flex-col gap-3 p-5 rounded-xl bg-(--color-surface) border border-(--color-border) shadow-[inset_0_2px_8px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between">
            <span className="text-[0.85rem] text-(--color-muted) font-light">Piano Selezionato</span>
            <span className="text-[0.75rem] font-extrabold uppercase tracking-widest text-(--color-text)">{planId}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[0.85rem] text-(--color-muted) font-light">Valuta</span>
            <span className="text-[0.75rem] font-extrabold uppercase tracking-widest text-(--color-text)">{priceCurrency}</span>
          </div>
          
          <hr className="my-2 border-t border-(--color-border)" />
          
          <div className="flex items-end justify-between">
            <span className="text-[0.85rem] text-(--color-text) font-medium">Totale da pagare</span>
            <div className="text-right">
              {hasCoupon && (
                <div className="text-[0.85rem] font-light line-through text-(--color-muted) mb-1">
                  € {basePriceStr}
                </div>
              )}
              <div className="text-[1.35rem] font-medium text-(--color-text) tracking-[-0.02em] leading-none">
                € {finalPriceStr}
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={onPay}
        disabled={submitting}
        className="w-full mt-auto rounded-lg bg-(--color-text) text-(--color-surface) px-6 py-3.5 text-[0.85rem] font-bold outline-none disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 hover:shadow-lg transition-all flex items-center justify-center gap-3"
        aria-label="Paga con Stripe"
      >
        {submitting ? (
          <>
            <Loader2 size={16} className="animate-spin" />
            <span>Reindirizzamento...</span>
          </>
        ) : (
          <span>Procedi con il Pagamento</span>
        )}
      </button>
    </div>
  );
}