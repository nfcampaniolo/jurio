import React, { useEffect, useState, useMemo } from "react";
import { FaCheck, FaInfoCircle } from "react-icons/fa";
import { Tooltip } from "react-tooltip";
import { ButtonCTA, ButtonSecondCTA } from "@/shared/components/ButtonCTA";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/useAuth";
import { fetchPlansFromDb, getPreloadedPlans, type PlanUI }from "@/features/plans/hooks/plans";

type BillingCycle = "monthly" | "yearly";

const getDiscountInfo = (plan: PlanUI) => {
  const price = Number(plan.price);
  const initial = Number(plan.initial_price);
  
  if (!isNaN(price) && !isNaN(initial) && initial > price) {
    return {
      hasDiscount: true,
      percentage: Math.round(((initial - price) / initial) * 100),
      initialPriceLabel: `€ ${initial.toFixed(2).replace('.', ',')}`
    };
  }
  return { hasDiscount: false, percentage: 0, initialPriceLabel: "" };
};

const customEase = [0.22, 1, 0.36, 1] as const;

const Prezzi: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [plans, setPlans] = useState<PlanUI[]>(getPreloadedPlans());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [billing, setBilling] = useState<BillingCycle>("monthly");

  useEffect(() => {
    const controller = new AbortController();
    
    const loadPlans = async () => {
      try {
        setLoading(true);
        setErr(null);
        const list = await fetchPlansFromDb();
        if (!controller.signal.aborted) setPlans(list);
      } catch (e) {
        if (!controller.signal.aborted) {
          setErr(e instanceof Error ? e.message : "Errore nel caricamento dei piani");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    };

    loadPlans();
    return () => controller.abort();
  }, []);

  const filteredPlans = useMemo(() => {
    const isMonthly = billing === "monthly";
    const byId = plans.filter((p) => {
      const id = p?.id?.toLowerCase() || "";
      return isMonthly ? id.endsWith("_m") : id.endsWith("_y");
    });
    
    if (byId.length > 0) return byId;
    return plans.filter((p) => (isMonthly ? p.durationDays <= 31 : p.durationDays >= 300));
  }, [plans, billing]);

  const orderedPlans = useMemo(() => {
    const order = ["personale", "business"];
    const mainPlans = filteredPlans.filter(p => {
      const nameMatch = p?.name?.toLowerCase() || "";
      const idMatch = p?.id?.toLowerCase() || "";
      return !nameMatch.includes("team") && !idMatch.includes("team");
    });

    return [...mainPlans].sort((a, b) => {
      const aid = (a.id || a.name || "").toLowerCase();
      const bid = (b.id || b.name || "").toLowerCase();
      const aKey = order.findIndex((k) => aid.includes(k));
      const bKey = order.findIndex((k) => bid.includes(k));
      return (aKey === -1 ? 999 : aKey) - (bKey === -1 ? 999 : bKey);
    });
  }, [filteredPlans]);

  const cycleLabel = billing === "monthly" ? "al mese" : "all’anno";
  const goToPlans = () => navigate(user ? "/profilo/piani" : "/login");
  const goToTeamPlans = () => navigate(user ? "/profilo/piani#teams" : "/login");

  return (
    <section id="prezzi" aria-labelledby="prezzi-heading" className="relative py-16 md:py-24 bg-(--color-bg) overflow-hidden z-0">
      
      {/* Decorative Background Element */}
      <div 
        className="absolute -top-[10vw] -right-[15vw] w-[min(52vw,720px)] h-[min(52vw,720px)] rounded-full border border-(--color-primary)/20 pointer-events-none -z-10"
        style={{ boxShadow: '0 0 0 70px rgba(224, 163, 46, 0.045), 0 0 0 140px rgba(224, 163, 46, 0.022)' }}
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-6">
        
        {/* HEADER */}
        <motion.div 
          className="text-center max-w-3xl mb-16 mx-auto relative"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.8, ease: customEase }}
        >
          {/* Eyebrow */}
          <div className="inline-flex items-center justify-center gap-2 mb-4 text-(--color-primary) text-[0.72rem] font-[850] uppercase tracking-[0.18em]">
            <span className="w-5 h-px bg-current opacity-75"></span>
            Piani e Tariffe
            <span className="w-5 h-px bg-current opacity-75"></span>
          </div>
          
          <h2 id="prezzi-heading" className="text-4xl md:text-5xl lg:text-6xl text-(--color-text) tracking-tight mb-6" style={{ fontFamily: 'var(--font-serif)', letterSpacing: '-0.045em' }}>
            Scegli il piano <em>ideale</em>
          </h2>
          
          <p className="text-lg md:text-xl text-(--color-muted) font-light leading-relaxed mx-auto max-w-2xl">
            Il piano Essential è dedicato alla ricerca avanzata. Il piano Business sblocca l'elaborazione e la redazione automatica dei tuoi documenti.
          </p>

          {/* Toggle */}
          <div className="mt-12 flex flex-col items-center justify-center gap-4">
            <div className="relative flex items-center p-1.5 bg-(--color-surface) rounded-lg border border-(--color-border) shadow-(--shadow-soft)">
              <motion.div
                className="absolute inset-y-1.5 w-[calc(50%-6px)] bg-(--color-text) rounded-md shadow-sm"
                initial={false}
                animate={{ left: billing === "monthly" ? "6px" : "calc(50%)" }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
              <button
                onClick={() => setBilling("monthly")}
                className={`relative z-10 w-36 py-2.5 text-sm font-bold rounded-md transition-colors duration-300 ${billing === "monthly" ? "text-(--color-bg)" : "text-(--color-muted) hover:text-(--color-text)"}`}
              >
                Mensile
              </button>
              <button
                onClick={() => setBilling("yearly")}
                className={`relative z-10 w-36 py-2.5 text-sm font-bold rounded-md transition-colors duration-300 ${billing === "yearly" ? "text-(--color-bg)" : "text-(--color-muted) hover:text-(--color-text)"}`}
              >
                Annuale
              </button>
            </div>
            <div className="text-[0.7rem] text-(--color-muted) font-bold tracking-[0.14em] uppercase">
              Prezzi {cycleLabel} &middot; IVA inclusa
            </div>
          </div>
        </motion.div>

        {/* FEEDBACK STATI */}
        {loading && <div className="text-center text-sm text-(--color-muted) pb-20">Caricamento in corso...</div>}
        {!loading && err && (
          <div className="text-center text-sm text-(--color-text) border border-(--color-border) bg-(--color-surface) py-4 rounded-md mb-20 max-w-md mx-auto shadow-(--shadow-soft)">
            Errore: {err}
          </div>
        )}

        {!loading && !err && orderedPlans.length > 0 && (
          <>
            {/* DESKTOP VIEW */}
            <motion.div 
              className="hidden lg:block max-w-5xl mx-auto mb-24 relative"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.8, ease: customEase, delay: 0.1 }}
            >
              {/* Decorative accent top */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-[95%] h-6 bg-(--color-primary) rounded-t-xl opacity-20 blur-md z-0" />
              
              <div className="relative border border-(--color-border) bg-(--color-surface) rounded-(--radius) shadow-(--shadow-soft) overflow-hidden z-10 transition-shadow duration-500 hover:shadow-(--shadow-hover)">
                <div className="absolute top-0 left-0 right-0 h-1 bg-(--color-primary) opacity-90 z-20" />
                
                <table className="w-full border-collapse relative z-10 bg-(--color-surface)">
                  <thead>
                    <tr>
                      <th scope="col" className="p-10 text-left bg-(--color-surface) w-1/3 border-b border-(--color-border)">
                        <span className="text-[0.72rem] font-[850] text-(--color-muted) uppercase tracking-[0.14em]">Confronta i Servizi</span>
                      </th>
                      {orderedPlans.map((plan) => {
                        const { hasDiscount, percentage, initialPriceLabel } = getDiscountInfo(plan);
                        return (
                          <th key={plan.id} scope="col" className="relative p-10 border-l border-b border-(--color-border) bg-(--color-surface)">
                            <div className="flex flex-col items-center gap-4">
                              <div className="text-xl font-bold text-(--color-text) uppercase tracking-wide" style={{ fontFamily: 'var(--font-serif)' }}>{plan.name}</div>
                              <div className="text-center h-28 flex flex-col justify-center">
                                <AnimatePresence mode="wait">
                                  <motion.div
                                    key={billing}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 1.05 }}
                                    transition={{ duration: 0.3, ease: customEase }}
                                  >
                                    {hasDiscount && (
                                      <div className="flex items-center justify-center gap-2 mb-2">
                                        <span className="text-sm font-medium line-through text-(--color-muted)">{initialPriceLabel}</span>
                                        <span className="text-[10px] font-bold px-2 py-0.5 border border-(--color-primary) text-(--color-primary) bg-(--color-primary)/10 uppercase tracking-wide rounded-sm">
                                          Risparmi il {percentage}%
                                        </span>
                                      </div>
                                    )}
                                    <div className="text-[2.75rem] font-medium tracking-tight text-(--color-text) leading-none">
                                      {plan.priceLabel}
                                    </div>
                                  </motion.div>
                                </AnimatePresence>
                              </div>
                              <div className="w-full mt-4">
                                {plan.name.includes("Business") 
                                  ? <ButtonCTA onClick={goToPlans}>{plan.cta}</ButtonCTA>
                                  : <ButtonSecondCTA onClick={goToPlans}>{plan.cta}</ButtonSecondCTA>
                                }
                              </div>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-(--color-border)">
                    {orderedPlans[0]?.features?.map((feature, fIdx) => {
                      const tooltipId = `tooltip-${billing}-${fIdx}`;
                      return (
                        <tr key={feature.name} className="hover:bg-black/5 dark:hover:bg-white/5 transition-colors duration-300 group">
                          <th scope="row" className="text-left p-6 align-middle font-normal pl-10">
                            <div className="flex items-center gap-3">
                              <span className="text-sm font-medium text-(--color-text) group-hover:text-(--color-primary) transition-colors">{feature.name}</span>
                              <button type="button" className="outline-none" data-tooltip-id={tooltipId} aria-label={`Dettagli su: ${feature.name}`}>
                                <FaInfoCircle className="text-(--color-muted) hover:text-(--color-text) transition-colors" />
                              </button>
                            </div>
                            <Tooltip id={tooltipId} place="top" className="z-50! max-w-xs! rounded-md! border! border-(--color-border)! bg-(--color-surface)! text-(--color-text)! p-0! shadow-(--shadow-soft)!">
                              <div className="p-4 flex flex-col gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-(--color-primary) border-b border-(--color-border) pb-2">Specifiche</span>
                                <p className="text-[12px] leading-relaxed font-light mt-1">{feature.description}</p>
                              </div>
                            </Tooltip>
                          </th>
                          {orderedPlans.map((plan) => {
                            const included = plan.features?.find((f) => f.name === feature.name)?.included;
                            return (
                              <td key={plan.id} className="p-6 text-center align-middle border-l border-(--color-border)">
                                {included 
                                  ? <FaCheck className="text-(--color-primary) text-lg mx-auto" /> 
                                  : <div className="h-px w-6 mx-auto bg-(--color-border)" />
                                }
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </motion.div>

            {/* MOBILE VIEW */}
            <div className="lg:hidden flex flex-col gap-8 max-w-md mx-auto mb-24">
              <AnimatePresence mode="wait">
                {orderedPlans.map((plan, idx) => {
                  const { hasDiscount, percentage, initialPriceLabel } = getDiscountInfo(plan);
                  return (
                    <motion.div
                      key={`${plan.id}-${billing}`} 
                      className="relative flex flex-col rounded-(--radius) border border-(--color-border) bg-(--color-surface) p-8 shadow-(--shadow-soft) hover:shadow-(--shadow-hover) transition-shadow duration-500 hover:-translate-y-1"
                      initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-50px" }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.6, ease: customEase, delay: idx * 0.1 }}
                    >
                      <div className="absolute top-0 left-0 right-0 h-1 bg-(--color-primary) opacity-90 z-10" />
                      
                      <h3 className="text-2xl font-bold mb-6 text-left text-(--color-text) tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
                        {plan.name}
                      </h3>

                      <div className="mb-8 flex flex-col gap-1 items-start">
                        {hasDiscount && (
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-sm font-medium line-through text-(--color-muted)">{initialPriceLabel}</span>
                            <span className="text-[10px] font-bold px-2 py-0.5 border border-(--color-primary) text-(--color-primary) bg-(--color-primary)/10 uppercase tracking-wide rounded-sm">
                              -{percentage}%
                            </span>
                          </div>
                        )}
                        <div className="text-[2.75rem] font-medium tracking-tight text-(--color-text) leading-none">
                          {plan.priceLabel}
                        </div>
                        <div className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-(--color-muted) mt-3">
                          IVA inclusa &middot; {cycleLabel}
                        </div>
                      </div>

                      <ul className="flex flex-col space-y-4 mb-10 text-sm border-t border-(--color-border) pt-6">
                        {plan.features?.filter((f) => f.included).map((feature) => (
                          <li key={feature.name} className="flex items-start gap-3 text-(--color-text)">
                            <FaCheck className="mt-1 shrink-0 text-(--color-primary)" aria-hidden="true" />
                            <span className="font-light leading-snug">{feature.name}</span>
                          </li>
                        ))}
                      </ul>

                      <div className="mt-auto">
                        {plan.name.includes("Business") 
                          ? <ButtonCTA onClick={goToPlans}>{plan.cta}</ButtonCTA>
                          : <ButtonSecondCTA onClick={goToPlans}>{plan.cta}</ButtonSecondCTA>
                        }
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          </>
        )}

        {/* TEAM / WORKSPACE SECTION */}
        <motion.div 
          id="teams" 
          className="max-w-5xl mx-auto relative mt-16"
          initial={shouldReduceMotion ? false : { opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.8, ease: customEase }}
        >
          {/* Subtle glow behind the banner */}
          <div className="absolute inset-0 bg-(--color-primary) opacity-5 blur-3xl rounded-3xl -z-10" />

          <div className="relative border border-(--color-border) bg-(--color-surface) rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.08)] p-8 md:p-14 overflow-hidden">
            
            {/* Decorative Corner Rings (from provided CSS logic) */}
            <div 
              className="absolute pointer-events-none rounded-full border border-(--color-text)/5 -z-10" 
              style={{ width: '420px', height: '420px', right: '-160px', top: '-180px', boxShadow: '0 0 0 60px rgba(0,0,0,0.015), 0 0 0 120px rgba(0,0,0,0.01)' }} 
              aria-hidden="true"
            />

            <div className="text-left mb-14 max-w-2xl relative z-10">
              <span className="text-[0.68rem] uppercase font-[850] tracking-[0.14em] text-(--color-primary) flex items-center gap-2 mb-4">
                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                Soluzioni Team & Studi Legali
              </span>
              <h3 className="text-3xl md:text-4xl text-(--color-text) font-medium leading-[1.05] tracking-tight mt-2" style={{ fontFamily: 'var(--font-serif)', letterSpacing: '-0.035em' }}>
                Scalabilità, risparmio e collaborazione in un unico <em>Workspace</em>.
              </h3>
              <p className="text-base text-(--color-muted) font-light leading-relaxed mt-5">
                Abbatti i costi di licenza fino al 35% e centralizza la gestione dello studio. 
                Fascicoli condivisi, fatturazione unica e gestione flessibile degli accessi in un ambiente blindato.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-14 relative z-10">
              {plans
                .filter(p => p?.name?.toLowerCase().includes("team") || p?.id?.toLowerCase().includes("team"))
                .sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0))
                .map((plan) => {
                  const { hasDiscount, percentage, initialPriceLabel } = getDiscountInfo(plan);
                  const rawName = plan.name.toLowerCase();
                  const displayName = rawName.includes("team") && !rawName.includes("da") 
                    ? rawName.replace(/team\s*/i, "Team da ") 
                    : rawName;

                  return (
                    <div key={plan.id} className="group relative flex flex-col p-8 border border-(--color-border) bg-(--color-bg) rounded-(--radius) transition-all duration-400 hover:-translate-y-1 hover:shadow-(--shadow-hover) hover:border-(--color-primary)/40 overflow-hidden">
                      {/* Hover effect background accent */}
                      <div className="absolute inset-0 bg-linear-to-br from-(--color-primary)/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      
                      <div className="relative z-10 flex flex-col h-full">
                        <h4 className="font-[850] text-(--color-text) text-lg capitalize mb-1 font-serif tracking-tight">{displayName}</h4>
                        <p className="text-[0.75rem] text-(--color-muted) mb-6">Workspace integrato &middot; 12 Mesi</p>
                        
                        <div className="flex flex-col gap-1 mb-8 mt-auto">
                          {hasDiscount ? (
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-medium line-through text-(--color-muted)">{initialPriceLabel}</span>
                              <span className="text-[9px] font-bold px-1.5 py-0.5 border border-(--color-primary) text-(--color-primary) bg-(--color-primary)/10 uppercase rounded-sm">
                                -{percentage}%
                              </span>
                            </div>
                          ) : <div className="h-5" />}
                          <div className="text-3xl font-medium tracking-tight text-(--color-text)">
                            {plan.priceLabel || `€ ${plan.price}`}
                          </div>
                          <span className="text-[0.65rem] font-bold uppercase tracking-[0.14em] text-(--color-muted) mt-1">
                            Fattura unica &middot; IVA inc.
                          </span>
                        </div>

                        <ButtonSecondCTA onClick={goToTeamPlans}>Attiva Workspace</ButtonSecondCTA>
                      </div>
                    </div>
                  );
              })}
            </div>

            <div className="border-t border-(--color-border) pt-10 relative z-10">
              <h4 className="text-[0.72rem] font-[850] text-(--color-text) uppercase tracking-[0.14em] mb-8">
                Caratteristiche del Workspace
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="space-y-3 border-t border-(--color-border) pt-4 relative">
                  <div className="absolute -top-px left-0 w-8 h-px bg-(--color-primary)" />
                  <div className="text-[0.72rem] font-[850] text-(--color-primary) tracking-[0.15em]">01. SETUP IMMEDIATO</div>
                  <p className="text-[0.95rem] text-(--color-muted) line-relaxed">
                    Assegna le licenze ai collaboratori tramite invito mail. Unica fattura contabile per tutto lo studio.
                  </p>
                </div>
                <div className="space-y-3 border-t border-(--color-border) pt-4 relative">
                  <div className="absolute -top-px left-0 w-8 h-px bg-(--color-primary)" />
                  <div className="text-[0.72rem] font-[850] text-(--color-primary) tracking-[0.15em]">02. ZERO SPRECHI</div>
                  <p className="text-[0.95rem] text-(--color-muted) line-relaxed">
                    I 365 giorni decorrono dal momento dell'attivazione della singola licenza, ottimizzando l'investimento.
                  </p>
                </div>
                <div className="space-y-3 border-t border-(--color-border) pt-4 relative">
                  <div className="absolute -top-px left-0 w-8 h-px bg-(--color-primary)" />
                  <div className="text-[0.72rem] font-[850] text-(--color-primary) tracking-[0.15em]">03. CONTROLLO TOTALE</div>
                  <p className="text-[0.95rem] text-(--color-muted) line-relaxed">
                    Pannello admin per gestire permessi, condivisione fascicoli e modelli di atti in tempo reale.
                  </p>
                </div>
              </div>
            </div>

            {/* Custom CTA Box inline for Enterprise */}
            <div className="mt-14 p-8 bg-(--color-bg) border border-(--color-border) rounded-(--radius) flex flex-col sm:flex-row items-center justify-between gap-6 relative z-10 transition-shadow duration-300 hover:shadow-(--shadow-soft)">
              <div>
                <p className="text-lg font-medium text-(--color-text)" style={{ fontFamily: 'var(--font-serif)' }}>Più di 7 collaboratori?</p>
                <p className="text-sm text-(--color-muted) font-light mt-1">
                  Richiedi una quotazione Enterprise con integrazioni API e onboarding dedicato.
                </p>
              </div>
              <ButtonSecondCTA onClick={() => navigate("/contatti")}>Parla con noi</ButtonSecondCTA>
            </div>

          </div>
        </motion.div>

      </div>
    </section>
  );
};

export default Prezzi;