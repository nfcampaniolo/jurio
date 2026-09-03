import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useProfile } from "@/features/profile/hooks/useProfile";
import { motion, useReducedMotion } from "framer-motion";
import { fetchPlansFromDb, type PlanUI } from "@/features/plans/hooks/plans";
import { FiArrowLeft } from "react-icons/fi";
import PaymentModal from "@/features/plans/components/PaymentModal";
import { DiscountCoupon } from "@/features/plans/components/DiscountCoupon"; 
import { type CouponData, fetchUserCoupon } from "@/features/plans/hooks/discount"; 
import { useTrialInfo } from "@/features/plans/hooks/usePlans";
import {
  type StatusNormalized,
  normalizeStatus,
  isTrialStatus,
  getUpgradeTarget,
  findPlanByStatus,
  findPlanByKey,
} from "@/features/plans/hooks/planlDomain";
import { PaymentHistory } from "@/features/plans/components/PaymentHistory";
import { Loader2 } from "lucide-react";

import { CurrentPlanCard } from "@/features/plans/components/CurrentPlanCard";
import { PlansGrid } from "@/features/plans/components/PlansGrid";
import { TeamPlansSection } from "@/features/plans/components/TeamPlansSection";

type BillingCycle = "monthly" | "yearly";

export const Plans: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();
  const teamsRef = useRef<HTMLDivElement>(null);

  const { user, loading: profileLoading, planId, assignedTeamId } = useProfile();

  const [plans, setPlans] = useState<PlanUI[]>([]);
  const [plansLoading, setPlansLoading] = useState<boolean>(true);
  const [plansErr, setPlansErr] = useState<string | null>(null);

  const [billing, setBilling] = useState<BillingCycle>("monthly");

  const [payOpen, setPayOpen] = useState<boolean>(false);
  const [selectedPlan, setSelectedPlan] = useState<string>("");
  const [activeCoupon, setActiveCoupon] = useState<CouponData | null>(null);

  const statusRaw: string = planId;
  const status: StatusNormalized = normalizeStatus(statusRaw);

  const isNone = status === "nessuno" || status === null;
  const isAdmin = status === "admin";
  const isTrial = isTrialStatus(status);

  const { trialLoading, trialErr, trialLeft } = useTrialInfo({ isTrial, uid: user?.uid ?? null });

  const openPaymentForPlan = useCallback((planName: string) => {
    setSelectedPlan(planName);
    setPayOpen(true);
  }, []);

  const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };
  const fadeIn = { hidden: { opacity: 0 }, show: { opacity: 1 } };
  const scaleIn = { hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1 } };

  useEffect(() => {
    let isMounted = true;
    const loadCoupon = async () => {
      if (user?.uid) {
        const couponData = await fetchUserCoupon(user.uid);
        if (isMounted && couponData) {
          setActiveCoupon(couponData);
        }
      }
    };
    loadCoupon();
    return () => { isMounted = false; };
  }, [user?.uid]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setPlansLoading(true);
        setPlansErr(null);
        const list = await fetchPlansFromDb();
        if (!cancelled) setPlans(list);
      } catch (e: unknown) {
        if (!cancelled) setPlansErr(e instanceof Error ? e.message : "Failed to load plans");
      } finally {
        if (!cancelled) setPlansLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (location.hash === "#teams" && teamsRef.current && !plansLoading) {
      setTimeout(() => {
        teamsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    }
  }, [location.hash, plansLoading]);

  const filteredPlans = useMemo(() => {
    const isMonthly = billing === "monthly";
    const byId = plans.filter((p) => {
      const id = (p.id || "").toLowerCase();
      if (isMonthly) return id.endsWith("_m");
      return id.endsWith("_y");
    });
    if (byId.length > 0) return byId;
    return plans.filter((p) => (isMonthly ? p.durationDays <= 31 : p.durationDays >= 300));
  }, [plans, billing]);

  const orderedPlans = useMemo(() => {
    const order = ["personale", "business"];
    return [...filteredPlans].sort((a, b) => {
      const aid = (a.id || a.name || "").toLowerCase();
      const bid = (b.id || b.name || "").toLowerCase();
      const aKey = order.findIndex((k) => aid.includes(k));
      const bKey = order.findIndex((k) => bid.includes(k));
      return (aKey === -1 ? 999 : aKey) - (bKey === -1 ? 999 : bKey);
    });
  }, [filteredPlans]);

  const activePlan: PlanUI | null = findPlanByStatus(orderedPlans, status);
  const upgradeTarget = getUpgradeTarget(status);
  const upgradePlan: PlanUI | null = upgradeTarget ? findPlanByKey(orderedPlans, upgradeTarget) : null;
  const cycleLabel = billing === "monthly" ? "al mese" : "all’anno";

  if (profileLoading || !user) {
    return (
      <div className="h-screen flex items-center justify-center text-(--color-muted) gap-2 bg-(--color-bg)">
        <Loader2 size={16} className="animate-spin text-(--color-text)" />
        <span className="text-xs font-bold uppercase tracking-widest">Caricamento in corso...</span>
      </div>
    );
  }

  return (
    <>
      <motion.main
        className="py-12 md:py-16 max-w-5xl mx-auto px-4 sm:px-6"
        variants={fadeIn}
        initial="hidden"
        animate="show"
        transition={shouldReduceMotion ? {} : { duration: 0.4, ease: "easeOut" }}
      >
        <motion.div
          className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          variants={fadeUp}
          initial="hidden"
          animate="show"
          transition={shouldReduceMotion ? {} : { duration: 0.3, ease: "easeOut" }}
        >
          <h1 className="text-2xl sm:text-3xl font-medium text-(--color-text) tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
            Il tuo Piano
          </h1>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="inline-flex w-fit items-center gap-2 px-4 py-2.5 rounded-md border border-(--color-border) bg-(--color-surface) hover:border-(--color-text) text-(--color-text) text-xs font-bold uppercase tracking-widest transition-colors shadow-xs outline-none"
            aria-label="Torna al profilo"
          >
            <FiArrowLeft size={15} className="opacity-70" />
            <span>Torna al profilo</span>
          </button>
        </motion.div>

        {isTrial && (
          <motion.div
            className="relative mb-8 rounded-lg border border-(--color-border) bg-(--color-surface) p-6 shadow-(--shadow-soft) overflow-hidden"
            variants={fadeUp}
            initial="hidden"
            animate="show"
            transition={shouldReduceMotion ? {} : { duration: 0.3, ease: "easeOut" }}
          >
            {/* LA LINEA DI RIGORE SUPERIORE (Unico tocco di colore) */}
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

            <div className="text-xs font-bold uppercase tracking-widest text-(--color-text) mb-2 flex items-center gap-2 mt-1">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-(--color-text) opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-(--color-text)"></span>
              </span>
              Periodo di prova attivo (7 giorni)
            </div>

            {trialLoading ? (
              <div className="text-xs text-(--color-muted) font-light">Recupero informazioni prova…</div>
            ) : trialErr ? (
              <div className="text-xs text-red-600 dark:text-red-400 font-light">{trialErr}</div>
            ) : (
              <div className="text-xs text-(--color-muted) font-light leading-relaxed">
                {trialLeft === null ? (
                  <>Impossibile determinare i giorni rimanenti.</>
                ) : trialLeft === 0 ? (
                  <span className="text-(--color-text) font-semibold">La prova è terminata.</span>
                ) : (
                  <>
                    Mancano <span className="font-bold text-(--color-text)">{trialLeft}</span>{" "}
                    {trialLeft === 1 ? "giorno" : "giorni"} alla fine della prova gratuita.
                  </>
                )}
              </div>
            )}
          </motion.div>
        )}

        {plansLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-(--color-muted) gap-2" role="status" aria-live="polite">
            <Loader2 size={16} className="animate-spin text-(--color-text)" />
            <span className="text-xs font-bold uppercase tracking-widest">Caricamento piani…</span>
          </div>
        )}

        {!plansLoading && plansErr && (
          <div className="p-4 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 rounded-md text-xs font-light mb-8" role="alert">
            Errore caricamento piani: {plansErr}
          </div>
        )}

        {!plansLoading && !plansErr && orderedPlans.length > 0 && (
          <>
            <CurrentPlanCard
              status={status}
              isAdmin={isAdmin}
              isTrial={isTrial}
              isNone={isNone}
              activePlan={activePlan}
              upgradePlan={upgradePlan}
              cycleLabel={cycleLabel}
              shouldReduceMotion={shouldReduceMotion ?? null}
              openPaymentForPlan={openPaymentForPlan}
              fadeUp={fadeUp}
              scaleIn={scaleIn}
            />

            <div className="mb-8">
              <DiscountCoupon
                activeCoupon={activeCoupon}
                onApplyCoupon={(coupon) => setActiveCoupon(coupon)}
                onRemoveCoupon={() => setActiveCoupon(null)}
              />
            </div>

            <PlansGrid
              billing={billing}
              setBilling={setBilling}
              orderedPlans={orderedPlans}
              activePlan={activePlan}
              isTrial={isTrial}
              activeCoupon={activeCoupon}
              shouldReduceMotion={shouldReduceMotion ?? null}
              cycleLabel={cycleLabel}
              openPaymentForPlan={openPaymentForPlan}
            />
          </>
        )}
      </motion.main>

     <TeamPlansSection
        plans={plans}
        activeCoupon={activeCoupon}
        openPaymentForPlan={openPaymentForPlan}
        teamsRef={teamsRef}
        userHasTeam={!!assignedTeamId} 
      />

      <div className="max-w-5xl mx-auto px-4 pb-20">
        {user?.uid && (
          <div className="mt-12">
            <PaymentHistory uid={user.uid} />
          </div>
        )}
      </div>

      <PaymentModal 
        open={payOpen} 
        onClose={() => setPayOpen(false)} 
        planName={selectedPlan} 
        basePrice={plans.find(p => p.name === selectedPlan)?.price}
        initialPrice={plans.find(p => p.name === selectedPlan)?.initial_price}
        activeCoupon={activeCoupon}
      />
    </>
  );
};

export default Plans;