import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaTicketAlt, FaCheckCircle, FaTimes, FaSpinner, FaPercent } from "react-icons/fa";
import { fetchApplyCoupon, type CouponData } from "@/features/plans/hooks/discount"; 

interface DiscountCouponProps {
  activeCoupon: CouponData | null;
  onApplyCoupon: (coupon: CouponData) => void;
  onRemoveCoupon: () => void;
}

export const DiscountCoupon: React.FC<DiscountCouponProps> = ({
  activeCoupon,
  onApplyCoupon,
  onRemoveCoupon,
}) => {
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Chiama la Cloud Function reale per applicare e validare il coupon
  const verifyCoupon = async (code: string) => {
    setLoading(true);
    setError(null);

    try {
      const normalizedCode = code.toUpperCase();
      const response = await fetchApplyCoupon(normalizedCode);
      // Se il backend risponde con successo, aggiorniamo lo stato tramite la prop
      onApplyCoupon({ 
        code: response.code, 
        percentage: response.percentage, 
        durationLabel: response.durationLabel || "Coupon attivato"
      });

    } catch (err) {
      // Cattura l'errore lanciato dal backend (es. "Utente non trovato", "Coupon scaduto")
      const errorMessage = err instanceof Error 
        ? err.message 
        : "Errore durante la verifica del codice.";
        
      setError(errorMessage);
      console.error("Errore durante la verifica del coupon:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim().length >= 5) {
      verifyCoupon(inputValue.trim());
    }
  };

  return (
    <div className="w-full max-w-md mx-auto mb-8">
      <AnimatePresence mode="wait">
        {/* LA LOGICA È QUI: se non c'è activeCoupon mostra l'input, altrimenti mostra il ticket */}
        {!activeCoupon ? (
          <motion.form
            key="input-form"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            onSubmit={handleSubmit}
            className="flex flex-col gap-2"
          >
            <label 
              htmlFor="coupon" 
              className="text-sm font-medium text-(--color-text) ml-1"
            >
              Hai un codice promozionale?
            </label>
            
            <div className="relative flex items-center w-full">
              <div className="absolute left-4 text-(--color-muted) pointer-events-none">
                <FaTicketAlt size={16} />
              </div>
              
              <input
                id="coupon"
                type="text"
                placeholder="Es. SCONTO20"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value.toUpperCase().slice(0, 12))}
                disabled={loading}
                className="w-full pl-11 pr-25 py-3.5 bg-(--color-surface) border border-(--color-border) rounded-lg focus:outline-none focus:border-(--color-text) transition-all uppercase placeholder:normal-case placeholder:text-(--color-muted) text-(--color-text) font-medium"
              />
              
              <button
                type="submit"
                disabled={inputValue.length < 5 || loading}
                className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-(--color-text) hover:opacity-80 text-(--color-surface) text-sm font-semibold rounded-md disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center min-w-[5.3rem] outline-none"
              >
                {loading ? <FaSpinner className="animate-spin" size={16} /> : "Applica"}
              </button>
            </div>

            <AnimatePresence>
              {error && (
                <motion.span 
                  initial={{ opacity: 0, height: 0 }} 
                  animate={{ opacity: 1, height: "auto" }} 
                  exit={{ opacity: 0, height: 0 }}
                  className="text-xs text-red-600 dark:text-red-400 font-medium ml-2 mt-1"
                >
                  {error}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.form>
        ) : (
          <motion.div
            key="dashboard-cruscotto"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, y: -10 }}
            className="relative overflow-hidden rounded-lg border border-(--color-border) bg-(--color-surface) p-4 sm:p-5 flex items-center justify-between shadow-(--shadow-soft)"
          >
            {/* LA LINEA DI RIGORE SUPERIORE (Unico tocco di colore) */}
            <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-10" />

            <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-(--color-bg) rounded-full border-r border-(--color-border)" />
            <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 bg-(--color-bg) rounded-full border-l border-(--color-border)" />

            <div className="flex items-center gap-4 pl-4 mt-1">
              <div className="hidden sm:flex shrink-0 w-10 h-10 items-center justify-center bg-(--color-bg) rounded-md text-(--color-text) border border-(--color-border)">
                <FaPercent size={16} className="opacity-80" />
              </div>
              
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-mono text-lg font-bold tracking-widest text-(--color-text) uppercase">
                    {activeCoupon.code}
                  </h4>
                  <span className="flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-sm border border-(--color-border) text-(--color-text) uppercase tracking-wide">
                    <FaCheckCircle size={10} className="opacity-80" /> Attivo
                  </span>
                </div>
                <p className="text-xs text-(--color-muted) font-light">
                  Hai ottenuto il <strong className="text-(--color-text) font-semibold">{activeCoupon.percentage}% di sconto</strong>
                  <span className="mx-1.5 opacity-50">&bull;</span>
                  {activeCoupon.durationLabel}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setInputValue("");
                onRemoveCoupon(); 
              }}
              className="pr-2 p-2 rounded-md text-(--color-muted) hover:text-(--color-text) hover:bg-(--color-bg) transition-all group z-10 outline-none mt-1"
              aria-label="Rimuovi coupon"
              title="Rimuovi coupon"
            >
              <FaTimes size={16} className="transition-transform group-hover:rotate-90" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};