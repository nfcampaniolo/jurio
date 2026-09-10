import React from "react";
import { Loader2, Terminal, Brain } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { type LogStep } from "../hooks/types";
import { LogStepItem } from "./LogStepItem";
import { TicTacToeModal } from "./TicTacToeModal";

export type { LogStep };

interface ExecutionLogModalProps {
  isOpen: boolean;
  title: string;
  steps: LogStep[];
}

export const ExecutionLogModal: React.FC<ExecutionLogModalProps> = ({
  isOpen,
  title,
  steps,
}) => {
  const [showGame, setShowGame] = React.useState(false);

  React.useEffect(() => {
    if (!isOpen) {
      setShowGame(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setShowGame(true);
    }, 8000);

    return () => window.clearTimeout(timer);
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
          {/* Backdrop con animazione fluida */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-xs"
          />

          {/* Finestra Principale con animazione di entrata/uscita (Scale & Fade) */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative z-10 flex h-120 max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-(--color-border) bg-(--color-surface) text-(--color-text) shadow-(--shadow-soft)"
          >
            <div className="absolute left-0 right-0 top-0 z-20 h-0.75 bg-(--color-primary) opacity-90" />

            {/* Header Terminale */}
            <div className="mt-1 flex items-center justify-between border-b border-(--color-border) bg-(--color-bg) px-5 py-3">
              <div className="flex items-center gap-2.5">
                <Terminal size={15} className="text-(--color-text) opacity-80" />
                <h3 className="text-xs font-bold uppercase tracking-widest text-(--color-text)">
                  {title}
                </h3>
              </div>

              <div className="flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-(--color-muted)">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-(--color-primary)" />
                Live
              </div>
            </div>

            {/* Terminal Logs Body */}
            <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto p-4 font-mono text-xs">
              {steps.map((step, idx) => (
                <LogStepItem
                  key={step.id || idx}
                  step={step}
                  index={idx}
                />
              ))}

              {steps.length === 0 && (
                <div className="flex h-full items-center justify-center text-[9px] uppercase tracking-widest text-(--color-muted)">
                  In attesa di eventi...
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-(--color-border) bg-(--color-bg) px-5 py-2.5 text-[9px] font-light text-(--color-muted)">
              <span className="flex items-center gap-1.5">
                <Loader2 size={11} className="animate-spin text-(--color-text)" />
                <span>Elaborazione IA in corso... Non chiudere la finestra.</span>
              </span>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowGame(true)}
                  className="group flex items-center gap-1.5 uppercase tracking-widest transition-colors hover:text-(--color-text) cursor-pointer"
                >
                  <Brain
                    size={11}
                    className="transition-transform group-hover:scale-110"
                  />
                  <span>Pausa cognitiva</span>
                </button>

                <span className="font-mono">{steps.length} eventi</span>
              </div>
            </div>

            {/* Overlay Gioco con transizione fluida Framer Motion */}
            <AnimatePresence>
              {showGame && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 z-30 flex items-center justify-center bg-(--color-surface)"
                >
                  <TicTacToeModal onClose={() => setShowGame(false)} />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};