import React from "react";
import { motion, AnimatePresence } from "framer-motion";

interface EditProfileConsentsProps {
  consents: { comms: boolean; marketing: boolean };
  handleConsentChange: (key: "comms" | "marketing") => void;
  shouldReduceMotion: boolean | null;
}

export const EditProfileConsents: React.FC<EditProfileConsentsProps> = ({
  consents,
  handleConsentChange,
  shouldReduceMotion,
}) => {
  return (
    <div className="flex flex-col gap-3.5 mt-8">
      <h2 className="text-xs font-bold uppercase tracking-widest text-(--color-muted) ml-1">Preferenze</h2>

      <div className="flex flex-col gap-3">
        {(["comms", "marketing"] as const).map((key) => {
          const checked = consents[key];
          const descriptions: Record<string, string> = {
            marketing: "Ricevere email promozionali e offerte speciali",
            comms: "Ricevere comunicazioni importanti via email",
          };
          const title = key === "marketing" ? "Marketing" : "Comunicazioni";

          return (
            <motion.label
              key={key}
              className="flex items-start gap-3.5 cursor-pointer select-none p-4 rounded-md border border-(--color-border) bg-(--color-surface) shadow-xs transition-colors"
              whileHover={shouldReduceMotion ? undefined : { x: 2 }}
              transition={{ duration: 0.15 }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => handleConsentChange(key)}
                className="sr-only"
              />

              <motion.span
                className={`w-5 h-5 flex items-center justify-center border rounded-sm transition-all duration-200 mt-0.5 shrink-0 ${
                  checked
                    ? "bg-(--color-text) border-(--color-text) text-(--color-surface)"
                    : "bg-(--color-bg) border-(--color-border)"
                }`}
                animate={shouldReduceMotion ? undefined : { scale: checked ? 1.05 : 1 }}
                transition={{ type: "spring", stiffness: 380, damping: 18 }}
                aria-hidden="true"
              >
                <AnimatePresence initial={false}>
                  {checked && (
                    <motion.svg
                      key="check"
                      className="w-3.5 h-3.5 text-(--color-surface)"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={3}
                      viewBox="0 0 24 24"
                      initial={shouldReduceMotion ? false : { opacity: 0, scale: 0.7 }}
                      animate={shouldReduceMotion ? {} : { opacity: 1, scale: 1 }}
                      exit={shouldReduceMotion ? {} : { opacity: 0, scale: 0.7 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </motion.svg>
                  )}
                </AnimatePresence>
              </motion.span>

              <div className="flex flex-col">
                <span className="text-xs font-bold uppercase tracking-wider text-(--color-text)">{title}</span>
                <span className="text-xs text-(--color-muted) font-light mt-0.5 leading-relaxed">
                  {descriptions[key]}
                </span>
              </div>
            </motion.label>
          );
        })}
      </div>
    </div>
  );
};