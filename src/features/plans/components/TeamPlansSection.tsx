import React from "react";
import type { PlanUI } from "@/features/plans/hooks/plans";
import type { CouponData } from "@/features/plans/hooks/discount";
import { getDynamicPricing } from "@/features/plans/hooks/usePlans";
import { Loader2 } from "lucide-react";
import { ConfirmModal } from "@/shared/components/ConfirmModal";
import { useTeamPlans } from "@/features/teams/hooks/useTeamPlans"; // Importa la logica sopra
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
  const userId = user?.uid;
  const {
    isOwnerModalOpen,
    handlePlanClick,
    handleConfirmOwnerPurchase,
    handleCancelOwnerPurchase,
    navigate
  } = useTeamPlans(userId, userHasTeam);

  return (
    <>
      <div 
        ref={teamsRef} 
        id="teams" 
        className="relative w-full bg-(--color-bg) border-t border-(--color-border) py-12 px-4 sm:px-6"
      >
        <div className="max-w-5xl mx-auto w-full flex flex-col items-center">
          
          <div className="text-center mb-8 space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm bg-(--color-surface) border border-(--color-border) text-(--color-text) text-[10px] font-bold uppercase tracking-widest mb-1 shadow-xs">
              Soluzioni Team & Studi Legali
            </div>
            <h3 className="text-xl sm:text-2xl md:text-3xl font-medium text-(--color-text) tracking-tight" >
              Scalabilità, risparmio e collaborazione in un unico Workspace
            </h3>
            <p className="text-xs sm:text-sm text-(--color-muted) font-light max-w-xl mx-auto leading-relaxed">
              Abbatti i costi di licenza fino al 35% e centralizza la gestione dello studio. Con i pacchetti Team hai fascicoli condivisi, fatturazione unica e gestione flessibile degli accessi.
            </p>
          </div>

          <div className="flex overflow-x-auto snap-x snap-mandatory pb-4 pt-8 w-[calc(100%+2rem)] -ml-4 px-4 sm:w-[calc(100%+3rem)] sm:-ml-6 sm:px-6 md:w-full md:ml-0 md:px-0 md:grid md:grid-cols-3 gap-5 mb-8 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden after:content-[''] after:min-w-px after:shrink-0 md:after:hidden">           
            {(() => {
              const teamPlans = plans
                .filter(p => (p.name || "").toLowerCase().includes("team") || (p.id || "").toLowerCase().includes("team"))
                .sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));

              if (teamPlans.length === 0) {
                return (
                  <div className="w-full col-span-1 md:col-span-3 text-center py-8 text-(--color-muted)">
                    <Loader2 size={20} className="animate-spin text-(--color-text) mx-auto mb-2" />
                    <span className="text-xs font-bold uppercase tracking-widest">Caricamento pacchetti studio in corso...</span>
                  </div>
                );
              }

              return teamPlans.map((plan, index) => {
                const isHighlighted = plan.highlighted || index === 1;
                const rawName = plan.name.toLowerCase();
                const displayName = rawName.includes("team") && !rawName.includes("da") 
                  ? rawName.replace(/team\s*/i, "Team da ") 
                  : rawName;

                const pricing = getDynamicPricing(plan, activeCoupon);

                return (
                  <div 
                    key={plan.id}
                    className={`relative shrink-0 w-[82vw] sm:w-70 md:w-auto snap-center flex flex-col bg-(--color-surface) rounded-lg p-6 text-center transition-all duration-200 shadow-(--shadow-soft) h-full ${
                      isHighlighted 
                        ? "border-2 border-(--color-text)" 
                        : "border border-(--color-border) hover:border-(--color-text)"
                    }`}
                  >

                    {isHighlighted && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-(--color-text) text-(--color-surface) text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-sm shadow-xs whitespace-nowrap">
                        Miglior Valore
                      </div>
                    )}
                    
                    <h4 className={`font-medium text-(--color-text) tracking-tight capitalize mb-1 ${isHighlighted ? "text-lg mt-1" : "text-lg"}`}>
                      {displayName}
                    </h4>
                    <p className="text-xs text-(--color-muted) font-light mb-5">Workspace integrato • 12 Mesi</p>
                    
                    <div className="flex flex-col items-center gap-1 mb-6 mt-auto">
                      {pricing.hasDiscount ? (
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-light line-through text-(--color-muted)">
                            {pricing.initialPriceLabel}
                          </span>
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-sm bg-(--color-bg) border border-(--color-border) text-(--color-text) uppercase tracking-wider">
                            Risparmi il {pricing.percentage}%
                          </span>
                        </div>
                      ) : (
                        <div className="h-4" /> 
                      )}
                      
                      <div className={`font-medium text-(--color-text) tracking-tight ${isHighlighted ? "text-3xl" : "text-2xl"}`}>
                        {pricing.finalPriceLabel}
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) mt-1">
                        all'anno • fattura unica con IVA
                      </span>
                    </div>

                    <div className="w-full">
                      <button
                        type="button"
                        onClick={() => handlePlanClick(plan.name, openPaymentForPlan)}
                        className={`w-full px-5 py-2.5 rounded-md text-xs font-bold uppercase tracking-widest transition-all outline-none shadow-xs ${
                          isHighlighted 
                            ? "bg-(--color-text) text-(--color-surface) hover:opacity-90" 
                            : "border border-(--color-border) bg-(--color-surface) text-(--color-text) hover:border-(--color-text)"
                        }`}
                      >
                        Attiva Workspace
                      </button>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          <div className="relative w-full bg-(--color-surface) border border-(--color-border) rounded-lg p-6 md:p-7 mb-8 shadow-(--shadow-soft) text-left overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5 pb-4 border-b border-(--color-border) mt-1">
              <h4 className="text-sm font-bold uppercase tracking-wider text-(--color-text) flex items-center gap-2">
                <span className="p-1 bg-(--color-bg) border border-(--color-border) rounded-sm">
                  <svg className="w-4 h-4 text-(--color-text) opacity-80" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5m0 0h5m0 0v-5a2 2 0 00-2-2h-2a2 2 0 00-2 2v5" />
                  </svg>
                </span>
                Vantaggi del Workspace Condiviso
              </h4>
              <span className="text-[10px] font-bold uppercase tracking-widest text-(--color-text) bg-(--color-bg) border border-(--color-border) px-2.5 py-1 rounded-sm w-fit">
                Gestione centralizzata
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col gap-1.5">
                <div className="text-xs font-bold uppercase tracking-wider text-(--color-text) flex items-center gap-1.5">
                  <span className="text-(--color-muted)">01.</span> Lavoro Simultaneo
                </div>
                <p className="text-xs text-(--color-muted) font-light leading-relaxed">
                  Lavora insieme ai colleghi sugli stessi fascicoli, documenti e bozze AI. Il gestore imposta ruoli e visibilità dal pannello dedicato.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="text-xs font-bold uppercase tracking-wider text-(--color-text) flex items-center gap-1.5">
                  <span className="text-(--color-muted)">02.</span> Voucher Flessibili (365g)
                </div>
                <p className="text-xs text-(--color-muted) font-light leading-relaxed">
                  Ogni codice riscatta 1 anno di piano Business. Puoi usarli sia per la prima attivazione di un collega che per i rinnovi.
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <div className="text-xs font-bold uppercase tracking-wider text-(--color-text) flex items-center gap-1.5">
                  <span className="text-(--color-muted)">03.</span> Nessuna Scadenza
                </div>
                <p className="text-xs text-(--color-muted) font-light leading-relaxed">
                  I voucher non scadono mai: <strong className="font-semibold text-(--color-text)">i 365 giorni decorrono solo dal momento del riscatto</strong> del singolo utente, azzerando gli sprechi.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 w-full border-t border-(--color-border) pt-6">
            <div className="text-center sm:text-left">
              <p className="text-xs font-bold uppercase tracking-wider text-(--color-text)">
                Studio strutturato o più di 7 avvocati?
              </p>
              <p className="text-xs text-(--color-muted) font-light mt-0.5">
                Richiedi una quotazione Enterprise con fatturazione personalizzata, integrazioni API e onboarding dedicato.
              </p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/contatti")}
              className="px-5 py-2.5 rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-text) text-xs font-bold uppercase tracking-widest hover:border-(--color-text) transition-colors outline-none shadow-xs shrink-0"
            >
              Parla con un consulente
            </button>
          </div>

        </div>
      </div>

      {/* Modale di conferma per l'owner */}
      <ConfirmModal
        isOpen={isOwnerModalOpen}
        title="Conferma acquisto abbonamento Team"
        message="Risulti attualmente proprietario di un gruppo attivo. Desideri procedere con l'acquisto per ottenere nuovi voucher da distribuire ai membri del tuo team?"
        confirmText="Procedi all'acquisto"
        cancelText="Annulla"
        onConfirm={() => handleConfirmOwnerPurchase(openPaymentForPlan)}
        onCancel={handleCancelOwnerPurchase}
      />
    </>
  );
};