import React from "react";
import type { PlanUI } from "@/features/plans/hooks/plans";
import type { CouponData } from "@/features/plans/hooks/discount";
import { getDynamicPricing } from "@/features/plans/hooks/usePlans";
import { ConfirmModal } from "@/shared/components/ConfirmModal";
import { useTeamPlans } from "@/features/teams/hooks/useTeamPlans"; 
import { useAuth } from "@/context/useAuth";

interface TeamPlansSectionProps {
  plans: PlanUI[];
  activeCoupon: CouponData | null;
  openPaymentForPlan: (planName: string) => void;
  teamsRef: React.RefObject<HTMLDivElement | null>;
  userHasTeam?: boolean;
}

export const TeamPlansSection: React.FC<TeamPlansSectionProps> = ({
  plans,
  activeCoupon,
  openPaymentForPlan,
  teamsRef,
  userHasTeam = false,
}) => {
  const { user } = useAuth();
  
  const { 
    isOwnerModalOpen, 
    handlePlanClick, 
    handleConfirmOwnerPurchase, 
    handleCancelOwnerPurchase 
  } = useTeamPlans(user?.uid, userHasTeam);

  const teamPlans = plans
    .filter(p => p.id?.toLowerCase().includes("team") || p.name?.toLowerCase().includes("team"))
    .sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));

  if (teamPlans.length === 0) return null;

  return (
    <>
      <section ref={teamsRef} id="teams" className="py-16">
        <div className="max-w-275 mx-auto px-4 sm:px-6">
          <div className="relative p-10 sm:p-16 rounded-3xl bg-(--color-surface) border border-(--color-border) shadow-[0_20px_60px_rgba(0,0,0,0.05)] overflow-hidden z-10">
            
            {/* Elementi decorativi background */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,rgba(224,163,46,0.03)_0%,transparent_50%)] -z-10 pointer-events-none" />
            <div className="absolute -top-25 -right-25 w-105 h-105 rounded-full border border-(--color-text) opacity-5 shadow-[0_0_0_60px_rgba(0,0,0,0.015)] pointer-events-none -z-10" />

            <div className="max-w-162.5 mb-12 text-left">
              <div className="text-(--color-primary) mb-4 text-[0.68rem] font-bold uppercase tracking-widest">
                Soluzioni Team & Studi Legali
              </div>
              <h2 className="text-[clamp(2rem,3.5vw,2.75rem)] tracking-[-0.035em] mb-5 leading-[1.05] text-(--color-text)" style={{ fontFamily: 'var(--font-serif)' }}>
                Scalabilità, risparmio e collaborazione in un unico <em>Workspace</em>.
              </h2>
              <p className="text-(--color-muted) font-light text-[1.05rem] leading-[1.6]">
                Abbatti i costi di licenza e centralizza la gestione dello studio. Fascicoli condivisi, fatturazione unica e gestione flessibile degli accessi in un ambiente blindato.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">           
              {teamPlans.map((plan) => {
                const pricing = getDynamicPricing(plan, activeCoupon);
                const displayName = plan.name.replace(/team\s*/i, "Team ");

                return (
                  <div key={plan.id} className="relative flex flex-col bg-(--color-bg) border border-(--color-border) rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1 hover:border-[rgba(224,163,46,0.4)] hover:shadow-[0_10px_30px_rgba(0,0,0,0.06)] overflow-hidden group">
                    <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(224,163,46,0.05),transparent)] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                    
                    <h4 className="text-[1.25rem] font-[850] text-(--color-text) mb-1" style={{ fontFamily: 'var(--font-serif)' }}>{displayName}</h4>
                    <p className="text-[0.75rem] text-(--color-muted) mb-6">Workspace integrato &middot; 12 Mesi</p>
                    
                    <div className="flex flex-col mt-auto mb-8">
                      {pricing.hasDiscount ? (
                        <div className="flex items-center gap-2 mb-1 h-4.5">
                          <span className="text-[0.85rem] line-through text-(--color-muted)">{pricing.initialPriceLabel}</span>
                          <span className="text-[0.6rem] font-extrabold px-1.5 py-0.5 border border-(--color-primary) text-(--color-primary) bg-[rgba(224,163,46,0.1)] rounded-[3px]">-{pricing.percentage}%</span>
                        </div>
                      ) : (
                        <div className="h-4.5 mb-1" />
                      )}
                      <div className="text-[2.5rem] font-medium leading-none text-(--color-text) tracking-[-0.03em]">{pricing.finalPriceLabel}</div>
                      <div className="text-[0.65rem] font-extrabold text-(--color-muted) uppercase tracking-[0.14em] mt-1.5">
                        Fattura unica &middot; IVA inc.
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handlePlanClick(plan.name, openPaymentForPlan)}
                      className="w-full py-3 rounded-lg border border-(--color-border) bg-transparent text-(--color-text) text-[0.85rem] font-bold text-center outline-none hover:bg-(--color-surface)"
                    >
                      {plan.cta || "Ottieni"}
                    </button>
                  </div>
                );
              })}
            </div>

            <h4 className="text-[0.72rem] font-[850] text-(--color-text) uppercase tracking-[0.14em] mb-6 mt-6">
              Caratteristiche del Workspace
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 border-t border-(--color-border) pt-10 text-left">
              <div className="relative border-t border-(--color-border) pt-4">
                <div className="absolute -top-px left-0 w-8 h-px bg-(--color-primary)" />
                <div className="text-[0.72rem] font-[850] text-(--color-primary) tracking-[0.15em] mb-2">01. SETUP IMMEDIATO</div>
                <p className="text-[0.95rem] text-(--color-muted) leading-normal font-light">Assegna le licenze ai collaboratori tramite invito mail. Unica fattura contabile per tutto lo studio.</p>
              </div>
              <div className="relative border-t border-(--color-border) pt-4">
                <div className="absolute -top-px left-0 w-8 h-px bg-(--color-primary)" />
                <div className="text-[0.72rem] font-[850] text-(--color-primary) tracking-[0.15em] mb-2">02. ZERO SPRECHI</div>
                <p className="text-[0.95rem] text-(--color-muted) leading-normal font-light">I 365 giorni decorrono dal momento dell'attivazione della singola licenza, ottimizzando l'investimento.</p>
              </div>
              <div className="relative border-t border-(--color-border) pt-4">
                <div className="absolute -top-px left-0 w-8 h-px bg-(--color-primary)" />
                <div className="text-[0.72rem] font-[850] text-(--color-primary) tracking-[0.15em] mb-2">03. CONTROLLO TOTALE</div>
                <p className="text-[0.95rem] text-(--color-muted) leading-normal font-light">Pannello admin per gestire permessi, condivisione fascicoli e modelli di atti in tempo reale.</p>
              </div>
            </div>

            {/* Enterprise Box */}
            <div className="mt-14 p-8 bg-(--color-bg) border border-(--color-border) rounded-2xl flex flex-col sm:flex-row gap-6 items-center justify-between transition-shadow duration-300 hover:shadow-[0_10px_30px_rgba(0,0,0,0.04)] text-left">
              <div>
                <p className="text-[1.1rem] font-medium text-(--color-text) mb-1" style={{ fontFamily: 'var(--font-serif)' }}>Più di 7 collaboratori?</p>
                <p className="text-[0.85rem] text-(--color-muted) font-light">Richiedi una quotazione Enterprise con integrazioni API e onboarding dedicato.</p>
              </div>
              <a href="/contatti" className="px-6 py-3 shrink-0 rounded-lg border border-(--color-border) bg-transparent text-(--color-text) text-[0.85rem] font-bold outline-none hover:bg-(--color-surface)">
                Parla con noi
              </a>
            </div>

          </div>
        </div>
      </section>

      <ConfirmModal
        isOpen={isOwnerModalOpen}
        title="Acquisto Abbonamento Team"
        message="Risulti proprietario di un gruppo. Vuoi procedere all'acquisto di nuovi voucher da distribuire?"
        confirmText="Procedi"
        cancelText="Annulla"
        onConfirm={() => handleConfirmOwnerPurchase(openPaymentForPlan)}
        onCancel={handleCancelOwnerPurchase}
      />
    </>
  );
};