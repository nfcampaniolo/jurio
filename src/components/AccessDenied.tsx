import { Link } from "react-router-dom";
import { FaLock, FaEnvelope } from "react-icons/fa";
import { motion, useReducedMotion } from "framer-motion";

export const AccessDenied = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    // Overlay del modal: copre tutto lo schermo, posizionato sopra gli altri elementi (z-50)
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.section
        role="region"
        aria-labelledby="access-denied-title"
        initial={shouldReduceMotion ? false : { opacity: 0, y: 24, scale: 0.98 }}
        animate={shouldReduceMotion ? {} : { opacity: 1, y: 0, scale: 1 }}
        exit={shouldReduceMotion ? {} : { opacity: 0, y: 24, scale: 0.98 }}
        transition={shouldReduceMotion ? {} : { duration: 0.4, ease: "easeOut" }}
        className="relative w-full max-w-xl text-center rounded-lg border border-(--color-border) bg-(--color-surface) p-8 md:p-10 shadow-(--shadow-soft) overflow-hidden"
      >
        {/* LA LINEA DI RIGORE SUPERIORE (Unico tocco di colore) */}
        <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) rounded-t-lg opacity-90 z-10" />

        <motion.div
          initial={shouldReduceMotion ? false : { scale: 0.8, opacity: 0 }}
          animate={shouldReduceMotion ? {} : { scale: 1, opacity: 1 }}
          transition={shouldReduceMotion ? {} : { delay: 0.1, duration: 0.3 }}
          className="flex justify-center mb-6 mt-2"
          aria-hidden="true"
        >
          {/* Icona racchiusa in un blocco geometrico neutro */}
          <div className="flex items-center justify-center w-14 h-14 rounded-md bg-(--color-bg) border border-(--color-border)">
            <FaLock className="text-2xl text-(--color-text) opacity-80" aria-hidden="true" focusable={false} />
          </div>
        </motion.div>

        <h1
          id="access-denied-title"
          className="text-2xl md:text-3xl font-medium text-(--color-text) mb-3 tracking-tight"
          style={{ fontFamily: 'var(--font-serif)' }}
        >
          Accesso non disponibile
        </h1>

        <p className="text-base md:text-lg text-(--color-muted) font-light leading-relaxed max-w-md mx-auto">
          Al momento non hai accesso a questa tipologia di servizio.
          <br className="hidden md:block" />
          Rivedi i tuoi piani e scegli quello più adatto alle tue esigenze.
        </p>

        <motion.div
          initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
          animate={shouldReduceMotion ? {} : { opacity: 1, y: 0 }}
          transition={shouldReduceMotion ? {} : { delay: 0.15, duration: 0.3 }}
          className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <Link
            to="/profilo/piani"
            className="
              inline-flex items-center justify-center w-full sm:w-auto
              px-6 py-2.5 rounded-md
              text-sm font-medium
              bg-(--color-text) text-(--color-surface) hover:opacity-80 transition-opacity
              focus:outline-none
            "
            aria-label="Vai alla pagina dei piani disponibili"
          >
            Vedi piani
          </Link>

          <Link
            to="/contatti"
            className="
              inline-flex items-center justify-center gap-2 w-full sm:w-auto
              px-6 py-2.5 rounded-md border border-(--color-border)
              text-sm font-medium text-(--color-text)
              hover:bg-(--color-bg) transition-colors
              focus:outline-none
            "
            aria-label="Vai alla pagina contatti"
          >
            <FaEnvelope className="text-sm opacity-80" aria-hidden="true" focusable={false} />
            Contattaci
          </Link>
        </motion.div>

        {/* Micro-copy istituzionale per il disclaimer */}
        <p className="mt-8 text-[10px] uppercase tracking-[0.15em] font-medium text-(--color-muted) opacity-80">
          Se pensi si tratti di un errore, scrivici e ti aiuteremo subito.
        </p>
      </motion.section>
    </div>
  );
};