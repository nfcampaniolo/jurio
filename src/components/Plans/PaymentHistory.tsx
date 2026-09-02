import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { fetchUserPayments, type PaymentRecord } from "@/services/paymentService"; 
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
      <div className="flex flex-col items-center justify-center py-12 text-(--color-muted)">
        <Loader2 className="w-8 h-8 animate-spin mb-3 text-(--color-text)" />
        <span className="text-xs font-bold uppercase tracking-widest">Caricamento storico pagamenti...</span>
      </div>
    );
  }

  // --- STATO: ERRORE ---
  if (error) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-600 dark:text-red-400 mt-8"
      >
        <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
        <p className="text-xs font-bold uppercase tracking-wider">Impossibile caricare lo storico: {error}</p>
      </motion.div>
    );
  }

  // --- STATO: VUOTO ---
  if (payments.length === 0) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="mt-12 p-8 border border-(--color-border) bg-(--color-surface) rounded-lg text-center shadow-(--shadow-soft)"
      >
        <div className="w-12 h-12 bg-(--color-bg) border border-(--color-border) rounded-md flex items-center justify-center mx-auto mb-4 text-(--color-text)">
          <Receipt className="w-6 h-6 opacity-70" />
        </div>
        <h3 className="text-base font-medium text-(--color-text) mb-1 tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
          Nessun pagamento
        </h3>
        <p className="text-xs text-(--color-muted) font-light">
          Non hai ancora effettuato transazioni sulla piattaforma.
        </p>
      </motion.div>
    );
  }

  // --- STATO: CON DATI ---
  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="mt-16 w-full max-w-5xl mx-auto"
    >
     <div className="flex items-center gap-3 mb-6 px-1">
      <div className="p-2 bg-(--color-surface) border border-(--color-border) rounded-md text-(--color-text) flex items-center justify-center">
        <Receipt className="w-5 h-5 opacity-80" />
      </div>
      <h3 className="text-xl md:text-2xl font-medium text-(--color-text) tracking-tight leading-none" style={{ fontFamily: 'var(--font-serif)' }}>
        Storico Pagamenti
      </h3>
    </div>
      <div className="relative bg-(--color-surface) border border-(--color-border) rounded-lg overflow-hidden shadow-(--shadow-soft)">
        {/* LA LINEA DI RIGORE SUPERIORE (Unico tocco di colore) */}
        <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

        {/* --- VERSIONE DESKTOP (Tabella) --- */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-(--color-bg) border-b border-(--color-border)">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold text-(--color-muted) uppercase tracking-widest">Data</th>
                <th className="px-6 py-4 text-[10px] font-bold text-(--color-muted) uppercase tracking-widest">Piano</th>
                <th className="px-6 py-4 text-[10px] font-bold text-(--color-muted) uppercase tracking-widest">Importo</th>
                <th className="px-6 py-4 text-[10px] font-bold text-(--color-muted) uppercase tracking-widest">Metodo</th>
                <th className="px-6 py-4 text-[10px] font-bold text-(--color-muted) uppercase tracking-widest text-right">Transazione</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-(--color-border)">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-(--color-bg) transition-colors">
                  <td className="px-6 py-4 text-xs text-(--color-muted) font-light">
                    {p.completedAt.toLocaleDateString("it-IT", { 
                      day: "2-digit", month: "long", year: "numeric"
                    })}
                  </td>
                  <td className="px-6 py-4 font-medium text-xs text-(--color-text) capitalize">
                    {p.planId || "N/A"}
                  </td>
                  <td className="px-6 py-4 font-semibold text-xs text-(--color-text)">
                    {p.paidValue.toFixed(2)} <span className="text-[9px] font-bold uppercase text-(--color-muted) ml-0.5">{p.paidCurrency}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-sm text-[10px] font-bold uppercase tracking-wider border border-(--color-border) bg-(--color-bg) text-(--color-text)">
                      <CreditCard className="w-3 h-3 opacity-70" />
                      {p.provider}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-(--color-muted) font-mono text-right truncate max-w-37.5 font-light">
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
            <div key={p.id} className="p-5 flex flex-col gap-3 hover:bg-(--color-bg) transition-colors">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-(--color-muted) uppercase tracking-widest">
                  {p.completedAt.toLocaleDateString("it-IT", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider border border-(--color-border) bg-(--color-bg) text-(--color-text)">
                  {p.provider}
                </span>
              </div>
              
              <div className="flex items-end justify-between">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) mb-0.5">Piano</div>
                  <div className="text-sm font-medium text-(--color-text) capitalize" style={{ fontFamily: 'var(--font-serif)' }}>{p.planId || "N/A"}</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) mb-0.5">Importo</div>
                  <div className="text-base font-semibold text-(--color-text)">
                    {p.paidValue.toFixed(2)} <span className="text-[10px] font-bold uppercase text-(--color-muted)">{p.paidCurrency}</span>
                  </div>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-(--color-border) flex items-center justify-between text-[11px] text-(--color-muted) font-light">
                <span className="flex items-center gap-1">
                  <ExternalLink className="w-3 h-3 opacity-70" /> Transazione
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