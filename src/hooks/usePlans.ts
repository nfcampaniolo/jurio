// /services/trial/useTrialInfo.ts
import * as React from "react";
import { FirebaseError } from "firebase/app";
import { fetchRegisterDoc } from "@/services/user";
import { toStartDate, trialDaysLeft } from "./planlDomain";
import type { PlanUI } from "@/services/plans";
import type { CouponData } from "@/hooks/discount";

export function useTrialInfo(params: { isTrial: boolean; uid: string | null }): {
  trialLoading: boolean;
  trialErr: string | null;
  trialLeft: number | null;
} {
  const { isTrial, uid } = params;

  const [trialLoading, setTrialLoading] = React.useState(false);
  const [trialErr, setTrialErr] = React.useState<string | null>(null);
  const [trialLeft, setTrialLeft] = React.useState<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!isTrial || !uid) {
        setTrialLeft(null);
        setTrialErr(null);
        setTrialLoading(false);
        return;
      }

      try {
        setTrialLoading(true);
        setTrialErr(null);

        const data = await fetchRegisterDoc(uid);

        if (!data) {
          if (!cancelled) setTrialErr("Dati prova non trovati (register/{uid}).");
          return;
        }

        const startDate = toStartDate(data.start ?? null);

        if (!startDate) {
          if (!cancelled) setTrialErr("Campo start non valido in register/{uid}.");
          return;
        }

        if (!cancelled) setTrialLeft(trialDaysLeft(startDate));
      } catch (e: unknown) {
        // qui puoi uniformare la policy errori come nell’altro refactor
        if (e instanceof FirebaseError) {
          if (!cancelled) setTrialErr("Errore Firebase nel recupero della prova.");
          return;
        }
        if (!cancelled) setTrialErr(e instanceof Error ? e.message : "Errore nel recupero della prova.");
      } finally {
        if (!cancelled) setTrialLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isTrial, uid]);

  return { trialLoading, trialErr, trialLeft };
}

export const getDynamicPricing = (plan: PlanUI, coupon: CouponData | null) => {
  const basePrice = Number(plan.price);
  const initialPrice = Number(plan.initial_price);

  if (isNaN(basePrice)) {
    return {
      hasDiscount: false,
      percentage: 0,
      initialPriceLabel: "",
      finalPriceLabel: plan.priceLabel || `€ ${plan.price}`
    };
  }

  let finalPrice = basePrice;
  const referenceInitialPrice = (!isNaN(initialPrice) && initialPrice > basePrice) ? initialPrice : basePrice;

  if (coupon && coupon.percentage > 0) {
    finalPrice = basePrice - (basePrice * (coupon.percentage / 100));
  } else if (!isNaN(initialPrice) && initialPrice > basePrice) {
    finalPrice = basePrice;
  } else {
    return {
      hasDiscount: false,
      percentage: 0,
      initialPriceLabel: "",
      finalPriceLabel: plan.priceLabel || `€ ${basePrice}`
    };
  }

  const percentage = Math.round(((referenceInitialPrice - finalPrice) / referenceInitialPrice) * 100);
  const formatNum = (num: number) => num % 1 === 0 ? num.toString() : num.toFixed(2).replace('.', ',');

  return {
    hasDiscount: true,
    percentage,
    initialPriceLabel: `€ ${formatNum(referenceInitialPrice)}`,
    finalPriceLabel: `€ ${formatNum(finalPrice)}`
  };
};