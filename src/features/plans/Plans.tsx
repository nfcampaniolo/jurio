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
import { CurrentPlanCard } from "@/features/plans/components/CurrentPlanCard";
import { PlansGrid } from "@/features/plans/components/PlansGrid";
import { TeamPlansSection } from "@/features/plans/components/TeamPlansSection";
import { SEO } from "@/shared/components/SEO";
import { Loader2 } from "lucide-react";

type BillingCycle = "monthly" | "yearly";

// Costanti estratte per evitare la ricreazione dell'oggetto a ogni render (evita micro-lag)
const fadeUp = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0 } };
const fadeIn = { hidden: { opacity: 0 }, show: { opacity: 1 } };
const scaleIn = { hidden: { opacity: 0, scale: 0.98 }, show: { opacity: 1, scale: 1 } };

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

  // Stabile per evitare ricalcoli
  const openPaymentForPlan = useCallback((planName: string) => {
    setSelectedPlan(planName);
    setPayOpen(true);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadCoupon = async () => {
      if (user?.uid) {
        const couponData = await fetchUserCoupon(user.uid);
        if (isMounted && couponData) setActiveCoupon(couponData);
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

  // CALCOLI
  const filteredPlans = useMemo(() => {
    const isMonthly = billing === "monthly";
    const byId = plans.filter((p) => {
      const id = (p.id || "").toLowerCase();
      return isMonthly ? id.endsWith("_m") : id.endsWith("_y");
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

  // Cache dei dati del piano selezionato per il modale
  const selectedPlanData = useMemo(() => 
    plans.find(p => p.name === selectedPlan), 
  [plans, selectedPlan]);

  // ========================================================
  // OTTIMIZZAZIONE PERFORMANCE: Blocchi UI Memoizzati
  // Prevengono il ricalcolo di Framer Motion quando si apre il modale
  // ========================================================
  const memoizedMainContent = useMemo(() => {
    if (plansLoading || plansErr || orderedPlans.length === 0) return null;
    
    return (
      <div className="space-y-16">
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

        <div className="max-w-xl mx-auto">
          <DiscountCoupon
            activeCoupon={activeCoupon}
            onApplyCoupon={setActiveCoupon}
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
      </div>
    );
  }, [
    plansLoading, plansErr, orderedPlans, status, isAdmin, isTrial, 
    isNone, activePlan, upgradePlan, cycleLabel, shouldReduceMotion, 
    activeCoupon, billing, openPaymentForPlan
  ]);

  const memoizedTeamSection = useMemo(() => (
    <TeamPlansSection
      plans={plans}
      activeCoupon={activeCoupon}
      openPaymentForPlan={openPaymentForPlan}
      teamsRef={teamsRef}
      userHasTeam={!!assignedTeamId} 
    />
  ), [plans, activeCoupon, openPaymentForPlan, assignedTeamId]);

  const memoizedPaymentHistory = useMemo(() => {
    if (!user?.uid) return null;
    return <PaymentHistory uid={user.uid} />;
  }, [user?.uid]);

  // ========================================================

  const seoComponent = (
    <SEO
      title="Piani e Abbonamenti"
      description="Gestisci il tuo abbonamento a Jurio, visualizza lo stato del piano attivo, le licenze di studio e lo storico fatture."
      path="/profilo/piani"
      noIndex
    />
  );

  if (profileLoading || !user) {
    return (
      <>
        {seoComponent}
        <div className="h-screen flex items-center justify-center text-(--color-muted) gap-2 bg-(--color-bg)">
          <Loader2 size={16} className="animate-spin text-(--color-text)" />
          <span className="text-xs font-bold uppercase tracking-widest">Caricamento...</span>
        </div>
      </>
    );
  }

  return (
    <>
      {seoComponent}
      
      <main className="relative z-10 pb-20">
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-screen h-125 bg-[radial-gradient(circle_at_top,rgba(224,163,46,0.08)_0%,transparent_60%)] -z-10 pointer-events-none" />

        <motion.div
          className="pt-12 md:pt-16 max-w-5xl mx-auto px-4 sm:px-6"
          variants={fadeIn}
          initial="hidden"
          animate="show"
          transition={shouldReduceMotion ? {} : { duration: 0.4, ease: "easeOut" }}
        >
          {/* HEADER INALTERATO */}
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
              className="inline-flex w-fit items-center gap-2 px-4 py-2.5 rounded-md border border-(--color-border) bg-(--color-surface) hover:border-(--color-text) text-(--color-text) text-xs font-bold uppercase tracking-widest transition-colors shadow-xs outline-none cursor-pointer"
              aria-label="Torna al profilo"
            >
              <FiArrowLeft size={15} className="opacity-70" />
              <span>Torna al profilo</span>
            </button>
          </motion.div>

          {isTrial && (
            <motion.div
              className="mb-10 flex items-center justify-between bg-(--color-surface) border-l-4 border-l-[rgba(224,163,46,1)] border-y border-r border-(--color-border) rounded-r-xl px-5 py-4 shadow-[0_4px_20px_rgba(0,0,0,0.03)]"
              variants={fadeUp}
            >
              <div className="flex items-center gap-3">
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[rgba(224,163,46,0.8)] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[rgba(224,163,46,1)]"></span>
                </span>
                <span className="font-semibold text-(--color-text) text-sm tracking-tight">Periodo di prova attivo</span>
              </div>
              <div className="text-xs text-(--color-muted) font-light">
                {!trialLoading && !trialErr && trialLeft !== null && trialLeft > 0 
                  ? `${trialLeft} ${trialLeft === 1 ? "giorno rimanente" : "giorni rimanenti"}`
                  : trialLeft === 0 ? "Prova terminata" : ""}
              </div>
            </motion.div>
          )}

          {plansLoading && (
            <div className="flex items-center justify-center py-12 text-(--color-muted) gap-2">
              <Loader2 size={16} className="animate-spin text-(--color-text)" />
              <span className="text-xs font-bold uppercase tracking-widest">Caricamento piani...</span>
            </div>
          )}

          {!plansLoading && plansErr && (
            <div className="px-5 py-4 bg-red-500/10 text-red-600 dark:text-red-400 rounded-xl text-sm mb-10 border border-red-500/20">
              Errore: {plansErr}
            </div>
          )}

          {/* Renderizzato tramite cache ottimizzata */}
          {memoizedMainContent}
          
        </motion.div>

        {/* Renderizzato tramite cache ottimizzata */}
        {memoizedTeamSection}

        <div className="max-w-5xl mx-auto px-4 mt-8">
          {memoizedPaymentHistory}
        </div>
      </main>

      <PaymentModal 
        open={payOpen} 
        onClose={() => setPayOpen(false)} 
        planName={selectedPlan} 
        basePrice={selectedPlanData?.price}
        initialPrice={selectedPlanData?.initial_price}
        activeCoupon={activeCoupon}
      />
    </>
  );
};

export default Plans;