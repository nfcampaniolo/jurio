import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FaCheckCircle, FaTimes, FaSpinner } from "react-icons/fa";
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

  const verifyCoupon = async (code: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchApplyCoupon(code.toUpperCase());
      onApplyCoupon({ 
        code: response.code, 
        percentage: response.percentage, 
        durationLabel: response.durationLabel || "Coupon attivato"
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante la verifica.");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim().length >= 5) verifyCoupon(inputValue.trim());
  };

  return (
    <div className="w-full my-4">
      <AnimatePresence mode="wait">
        {!activeCoupon ? (
          <motion.form
            key="form"
            initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98 }}
            onSubmit={handleSubmit}
            className="relative"
          >
            <div className="flex items-center w-full bg-(--color-surface) border border-(--color-border) rounded-xl p-1.5 shadow-[inset_0_2px_8px_rgba(0,0,0,0.02)] focus-within:border-(--color-primary) focus-within:ring-1 focus-within:ring-(--color-primary)/20 transition-all">
              <input
                type="text"
                placeholder="Hai un codice promozionale?"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value.toUpperCase().slice(0, 12))}
                disabled={loading}
                className="flex-1 bg-transparent border-none px-4 py-2 text-sm uppercase placeholder:normal-case placeholder:text-(--color-muted) text-(--color-text) font-medium focus:outline-none"
              />
              <button
                type="submit"
                disabled={inputValue.length < 5 || loading}
                className="px-6 py-2 bg-(--color-bg) text-(--color-text) border border-(--color-border) hover:bg-(--color-text) hover:text-(--color-surface) text-xs font-bold uppercase tracking-widest rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center min-w-28 outline-none"
              >
                {loading ? <FaSpinner className="animate-spin" size={14} /> : "Applica"}
              </button>
            </div>
            {error && <p className="absolute -bottom-6 left-2 text-[11px] text-red-500 font-medium">{error}</p>}
          </motion.form>
        ) : (
          <motion.div
            key="active"
            initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, y: -5 }}
            className="flex items-center justify-between w-full bg-[rgba(224,163,46,0.05)] border border-(--color-primary) rounded-xl p-3 pl-4"
          >
            <div className="flex items-center gap-3">
              <FaCheckCircle size={16} className="text-(--color-primary)" />
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 text-sm">
                <span className="font-mono font-bold text-(--color-text) tracking-widest">{activeCoupon.code}</span>
                <span className="hidden sm:block text-(--color-border)">|</span>
                <span className="text-(--color-text) font-medium">-{activeCoupon.percentage}% applicato</span>
              </div>
            </div>
            <button type="button" onClick={() => { setInputValue(""); onRemoveCoupon(); }} className="p-2 text-(--color-muted) hover:text-(--color-text) transition-colors outline-none">
              <FaTimes size={14} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};