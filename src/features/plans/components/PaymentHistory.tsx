import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { fetchUserPayments, type PaymentRecord } from "@/features/plans/hooks/paymentService"; 
import { Receipt, Loader2, AlertCircle, CreditCard, ExternalLink } from "lucide-react";

interface PaymentHistoryProps {
  uid: string;
}

export const PaymentHistory: React.FC<PaymentHistoryProps> = ({ uid }) => {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!uid) return;

    let isMounted = true;

    const loadPayments = async () => {
      setLoading(true);
      setError(null);

      try {
        const data = await fetchUserPayments(uid);
        if (isMounted) setPayments(data);
      } catch (err: unknown) {
        if (isMounted) {
          const errorMessage = err instanceof Error ? err.message : "Errore nel caricamento dei pagamenti";
          setError(errorMessage);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadPayments();

    return () => {
      isMounted = false; 
    };
  }, [uid]);

  // --- STATO: CARICAMENTO ---
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-(--color-muted) gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-(--color-text)" />
        <span className="text-[0.72rem] font-[850] uppercase tracking-[0.15em]">Caricamento storico...</span>
      </div>
    );
  }

  // --- STATO: ERRORE ---
  if (error) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-4 p-5 bg-red-500/5 border border-red-500/20 rounded-xl text-red-600 dark:text-red-400 mt-8 shadow-sm"
      >
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <p className="text-[0.72rem] font-[850] uppercase tracking-[0.15em] mb-1">Errore</p>
          <p className="text-[0.95rem] font-light">Impossibile caricare lo storico: {error}</p>
        </div>
      </motion.div>
    );
  }

  // --- STATO: VUOTO ---
  if (payments.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="mt-16 p-10 sm:p-12 border border-(--color-border) bg-(--color-surface) rounded-[20px] text-center shadow-[0_4px_20px_rgba(0,0,0,0.03)] max-w-250 mx-auto"
      >
        <div className="w-14 h-14 bg-(--color-bg) border border-(--color-border) rounded-full flex items-center justify-center mx-auto mb-5 text-(--color-text)">
          <Receipt className="w-6 h-6 opacity-60" />
        </div>
        <h3 className="text-[1.5rem] font-medium text-(--color-text) mb-2 tracking-[-0.03em]" style={{ fontFamily: 'var(--font-serif)' }}>
          Nessun pagamento
        </h3>
        <p className="text-[0.95rem] text-(--color-muted) font-light">
          Non hai ancora effettuato transazioni sulla piattaforma.
        </p>
      </motion.div>
    );
  }

  // --- STATO: CON DATI ---
  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="mt-16 w-full max-w-250 mx-auto pb-16"
    >
      <div className="flex items-center gap-3 mb-6 px-1">
        <h3 className="text-[1.5rem] md:text-[1.75rem] font-medium text-(--color-text) tracking-[-0.03em] leading-none" style={{ fontFamily: 'var(--font-serif)' }}>
          Storico Pagamenti
        </h3>
      </div>
      
      <div className="bg-(--color-surface) border border-(--color-border) rounded-[20px] overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.03)]">
        
        {/* --- VERSIONE DESKTOP (Tabella) --- */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-[rgba(224,163,46,0.02)] border-b border-(--color-border)">
              <tr>
                <th className="px-6 py-5 text-[0.72rem] font-[850] text-(--color-muted) uppercase tracking-[0.15em]">Data</th>
                <th className="px-6 py-5 text-[0.72rem] font-[850] text-(--color-muted) uppercase tracking-[0.15em]">Piano</th>
                <th className="px-6 py-5 text-[0.72rem] font-[850] text-(--color-muted) uppercase tracking-[0.15em]">Importo</th>
                <th className="px-6 py-5 text-[0.72rem] font-[850] text-(--color-muted) uppercase tracking-[0.15em]">Metodo</th>
                <th className="px-6 py-5 text-[0.72rem] font-[850] text-(--color-muted) uppercase tracking-[0.15em] text-right">Transazione</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--color-border)">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-(--color-bg) transition-colors duration-200">
                  <td className="px-6 py-5 text-[0.95rem] text-(--color-text) font-light">
                    {p.completedAt.toLocaleDateString("it-IT", { 
                      day: "2-digit", month: "long", year: "numeric"
                    })}
                  </td>
                  <td className="px-6 py-5 font-medium text-[0.95rem] text-(--color-text) capitalize">
                    {p.planId || "N/A"}
                  </td>
                  <td className="px-6 py-5 text-[0.95rem] text-(--color-text)">
                    {p.paidValue.toFixed(2)} <span className="text-[0.65rem] font-extrabold uppercase text-(--color-muted) ml-1 tracking-widest">{p.paidCurrency}</span>
                  </td>
                  <td className="px-6 py-5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[0.7rem] font-[850] uppercase tracking-widest border border-(--color-border) bg-(--color-bg) text-(--color-text)">
                      <CreditCard className="w-3.5 h-3.5 opacity-60" />
                      {p.provider}
                    </span>
                  </td>
                  <td className="px-6 py-5 text-[0.85rem] text-(--color-muted) font-mono text-right truncate max-w-37.5 font-light">
                    {p.provider === "paypal" ? p.paypalCaptureId : p.customerId}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* --- VERSIONE MOBILE (Card Impilate) --- */}
        <div className="md:hidden flex flex-col divide-y divide-(--color-border)">
          {payments.map((p) => (
            <div key={p.id} className="p-6 flex flex-col gap-4 hover:bg-(--color-bg) transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[0.72rem] font-[850] text-(--color-muted) uppercase tracking-[0.15em]">
                  {p.completedAt.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.65rem] font-[850] uppercase tracking-[0.15em] border border-(--color-border) bg-(--color-bg) text-(--color-text)">
                  {p.provider}
                </span>
              </div>
              
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[0.65rem] font-extrabold uppercase tracking-[0.15em] text-(--color-muted) mb-1">Piano</div>
                  <div className="text-[1.1rem] font-medium text-(--color-text) capitalize" style={{ fontFamily: 'var(--font-serif)' }}>{p.planId || "N/A"}</div>
                </div>
                <div className="text-right">
                  <div className="text-[0.65rem] font-extrabold uppercase tracking-[0.15em] text-(--color-muted) mb-1">Importo</div>
                  <div className="text-[1.25rem] font-medium text-(--color-text) tracking-[-0.02em]">
                    {p.paidValue.toFixed(2)} <span className="text-[0.65rem] font-extrabold uppercase text-(--color-muted) ml-0.5 tracking-widest">{p.paidCurrency}</span>
                  </div>
                </div>
              </div>

              <div className="mt-2 pt-4 border-t border-(--color-border) flex items-center justify-between text-[0.85rem] text-(--color-muted) font-light">
                <span className="flex items-center gap-1.5">
                  <ExternalLink className="w-3.5 h-3.5 opacity-60" /> Transazione
                </span>
                <span className="font-mono truncate max-w-37.5">
                  {p.provider === "paypal" ? p.paypalCaptureId : p.customerId}
                </span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </motion.div>
  );
};