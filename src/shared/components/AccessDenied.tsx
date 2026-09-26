import { Link } from "react-router-dom";
import { FaLock, FaCheck, FaArrowRight } from "react-icons/fa";
import { motion, useReducedMotion } from "framer-motion";

export const AccessDenied = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.section
        role="dialog"
        aria-modal="true"
        aria-labelledby="access-gate-title"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 20, scale: 0.98 }}
        animate={shouldReduceMotion ? {} : { opacity: 1, y: 0, scale: 1 }}
        exit={shouldReduceMotion ? {} : { opacity: 0, y: 20, scale: 0.98 }}
        transition={shouldReduceMotion ? {} : { duration: 0.35, ease: "easeOut" }}
        className="relative w-full max-w-lg text-center rounded-xl border border-(--color-border) bg-(--color-surface) p-8 md:p-10 shadow-(--shadow-soft) overflow-hidden"
      >
        {/* Accento superiore */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-(--color-primary) rounded-t-xl opacity-90 z-10" />

        {/* Badge di contesto & Icona */}
        <motion.div
          initial={shouldReduceMotion ? false : { scale: 0.85, opacity: 0 }}
          animate={shouldReduceMotion ? {} : { scale: 1, opacity: 1 }}
          transition={shouldReduceMotion ? {} : { delay: 0.08, duration: 0.25 }}
          className="flex flex-col items-center gap-3 mb-6 mt-1"
        >
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-(--color-bg) border border-(--color-border)">
            <FaLock className="text-xl text-(--color-text) opacity-75" aria-hidden="true" focusable={false} />
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium tracking-wide uppercase bg-(--color-bg) border border-(--color-border) text-(--color-muted)">
            Esclusivo per Jurio
          </span>
        </motion.div>

        {/* Headline orientata al valore anziché al blocco */}
        <h1
          id="access-gate-title"
          className="text-2xl md:text-3xl font-medium text-(--color-text) mb-3 tracking-tight"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          Sblocca l’accesso con Jurio
        </h1>

        <p className="text-sm md:text-base text-(--color-muted) font-light leading-relaxed max-w-md mx-auto">
          Questa funzionalità è riservata alla community di <strong className="font-semibold text-(--color-text)">Jurio</strong>. 
          Registrati in pochi secondi: hai <span className="font-semibold text-(--color-text)">7 giorni di prova gratuita</span> senza alcun vincolo.
        </p>

        {/* Elementi di rassicurazione ad alto impatto */}
        <div className="mt-5 inline-flex flex-wrap justify-center items-center gap-4 text-xs text-(--color-muted)">
          <span className="inline-flex items-center gap-1.5">
            <FaCheck className="text-(--color-primary) text-[11px]" aria-hidden="true" />
            Nessuna carta richiesta
          </span>
          <span className="inline-flex items-center gap-1.5">
            <FaCheck className="text-(--color-primary) text-[11px]" aria-hidden="true" />
            Accesso completo per 1 settimana
          </span>
        </div>

        {/* CTA Principale + Secondaria */}
        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
          animate={shouldReduceMotion ? {} : { opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? {} : { delay: 0.15, duration: 0.25 }}
          className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link
            to="/profilo"
            className="
              inline-flex items-center justify-center gap-2 w-full sm:w-auto
              px-6 py-2.5 rounded-md
              text-sm font-medium
              bg-(--color-text) text-(--color-surface)
              hover:opacity-90 transition-opacity
              focus:outline-none
            "
          >
            Inizia la prova gratuita
            <FaArrowRight className="text-xs" aria-hidden="true" />
          </Link>

          <Link
            to="/login"
            className="
              inline-flex items-center justify-center w-full sm:w-auto
              px-5 py-2.5 rounded-md border border-(--color-border)
              text-sm font-medium text-(--color-text)
              hover:bg-(--color-bg) transition-colors
              focus:outline-none
            "
          >
            Hai già un account? Accedi
          </Link>
        </motion.div>

        {/* Link di supporto discreto */}
        <p className="mt-8 text-xs text-(--color-muted)">
          Dubbi sui piani o sull'accesso?{" "}
          <Link to="/contatti" className="underline hover:text-(--color-text) transition-colors">
            Contatta il supporto
          </Link>
        </p>
      </motion.section>
    </div>
  );
};