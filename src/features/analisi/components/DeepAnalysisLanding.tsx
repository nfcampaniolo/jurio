import React, { Suspense, lazy } from "react";
import { motion, type Variants, useReducedMotion } from "framer-motion";
import { Compass, Landmark, Route, Scale } from "lucide-react";
import { ButtonCTA } from '@/shared/components/ButtonCTA';
import { Footer } from "@/shared/components/Footer";
const CTASection = lazy(() => import('@/features/search/components/CTASection'));

const workflowSteps = [
  {
    key: "01",
    Icon: Compass,
    title: "Inquadramento della Questione",
    desc: "Definisci i quesiti di diritto. Imposta il perimetro d'indagine e fornisci i parametri necessari a indirizzare con rigore l'attività di studio."
  },
  {
    key: "02",
    Icon: Landmark,
    title: "Scrutinio delle Fonti Autorevoli",
    desc: "Il sistema interroga le banche dati isolando i precedenti puntuali e le massime rilevanti per la fattispecie. Integra con ricerche web da fonti autorevoli."
  },
  {
    key: "03",
    Icon: Route,
    title: "Approfondimento Dinamico",
    desc: "L'analisi si sviluppa lungo percorsi progressivi. I primi esiti vengono verificati e approfonditi per non trascurare alcun risvolto sostanziale o processuale."
  },
  {
    key: "04",
    Icon: Scale,
    title: "Sintesi Strategica",
    desc: "I risultati convergono in un quadro organico e ponderato. Ricevi una mappa chiara delle correnti interpretative, ideale per la stesura dei tuoi atti difensivi."
  }
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.08,
    },
  },
};

const blockVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const gridVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.45,
      ease: [0.22, 1, 0.36, 1],
      when: "beforeChildren",
      staggerChildren: 0.12,
      delayChildren: 0.08,
    },
  },
};

const cardVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

export const DeepAnalysisLanding: React.FC = () => {
  const reduceMotion = useReducedMotion();
  const handleClick = () => {
    window.location.href = '/prezzi';
  };

  return (
    <section
      aria-labelledby="deep-analysis-heading"
      className="relative flex h-full w-full flex-col justify-between overflow-y-auto scroll-smooth bg-(--color-bg)"
    >
      {/* Sfondo sfocato circolare al centro */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.6, ease: "easeOut" }}
      >
        <div className="absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-(--color-primary)/10 blur-3xl" />
      </motion.div>

      {/* Contenitore principale */}
      <motion.div
        variants={containerVariants}
        initial={reduceMotion ? "visible" : "hidden"}
        animate="visible"
        className="z-10 my-auto flex w-full flex-col items-center px-6 py-10 md:py-16"
      >
        <div className="flex w-full max-w-7xl flex-col items-center">
          
          {/* HEADER SEZIONE */}
          <motion.div
            variants={blockVariants}
            className="mb-14 w-full max-w-4xl text-center"
          >
            <h1
              id="deep-analysis-heading"
              className="mb-6 text-3xl leading-tight tracking-tight text-(--color-text) md:text-4xl lg:text-5xl"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              L'<em>approfondimento giurisprudenziale</em> per i casi più complessi.
            </h1>

            <p className="mx-auto max-w-3xl text-lg font-light leading-relaxed text-(--color-muted)">
              Uno strumento evoluto di intelligence giuridica pensato per gli studi legali. Deep Analysis esamina il quadro normativo, confronta le diverse tesi giurisprudenziali e restituisce una visione d'insieme chiara per orientare le scelte difensive.
            </p>
          </motion.div>

          {/* GRIGLIA FASI (4 Colonne) */}
          <motion.ol
            variants={gridVariants}
            className="mb-16 grid w-full grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4 lg:gap-8"
          >
            {workflowSteps.map(({ key, title, desc, Icon }) => (
              <motion.li
                key={key}
                variants={cardVariants}
                whileHover={reduceMotion ? undefined : { y: -3 }}
                className="group relative flex flex-col overflow-hidden rounded-lg border border-(--color-border) bg-(--color-surface) p-8 text-left shadow-sm transition-colors duration-300 hover:border-(--color-primary)/40"
              >
                {/* Linea superiore di accento in hover */}
                <div className="absolute left-0 right-0 top-0 z-10 h-0 bg-(--color-primary) opacity-0 transition-all duration-200 group-hover:h-1 group-hover:opacity-100" />

                {/* Watermark del numero fase */}
                <div
                  className="pointer-events-none absolute -right-2 -top-4 select-none text-[70px] font-bold text-(--color-muted) opacity-5 transition-opacity group-hover:opacity-10"
                  style={{ fontFamily: 'var(--font-serif)' }}
                >
                  {key}
                </div>

                {/* Icona */}
                <span
                  className="relative z-10 mb-8 mt-2 inline-flex h-12 w-12 items-center justify-center rounded-md border border-(--color-border) bg-(--color-bg) text-(--color-text) opacity-80 transition-transform group-hover:scale-105"
                  aria-hidden="true"
                >
                  <Icon size={20} focusable="false" />
                </span>

                {/* Titolo */}
                <h3
                  className="relative z-10 mb-3 text-xl font-medium leading-snug text-(--color-text)"
                  style={{ fontFamily: 'var(--font-serif)' }}
                >
                  {title}
                </h3>

                {/* Descrizione */}
                <p className="relative z-10 text-sm font-light leading-relaxed text-(--color-muted)">
                  {desc}
                </p>
              </motion.li>
            ))}
          </motion.ol>

          {/* SEZIONE PIANI DI ACCESSO */}
          <motion.div variants={blockVariants} className="w-full">
            <div className="mx-auto max-w-4xl">
              <div className="grid gap-4 sm:grid-cols-2 text-left">
                
                {/* Piano Essential */}
                <div className="flex flex-col rounded-lg border border-(--color-border) bg-(--color-surface) p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest text-(--color-text)">
                      Essential
                    </span>
                    <span className="text-[11px] uppercase tracking-wider text-(--color-muted)">
                      Ricerca pura
                    </span>
                  </div>
                  <h4
                    className="mb-2 text-lg font-medium text-(--color-text)"
                    style={{ fontFamily: 'var(--font-serif)' }}
                  >
                    Indagine giurisprudenziale avanzata
                  </h4>
                  <p className="text-sm font-light leading-relaxed text-(--color-muted)">
                    Quesiti complessi, consultazione delle pronunce e mappatura analitica
                    delle tesi decisionali.
                  </p>
                </div>

                {/* Piano Business */}
                <div className="flex flex-col rounded-lg border border-(--color-primary)/30 bg-(--color-surface) p-6 shadow-sm">
                  <div className="mb-4 flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-widest text-(--color-text)">
                      Business
                    </span>
                    <span className="text-[11px] uppercase tracking-wider text-(--color-primary)">
                      Esame documentale
                    </span>
                  </div>
                  <h4
                    className="mb-2 text-lg font-medium text-(--color-text)"
                    style={{ fontFamily: 'var(--font-serif)' }}
                  >
                    Elaborazione atti e fascicoli
                  </h4>
                  <p className="text-sm font-light leading-relaxed text-(--color-muted)">
                    Tutto l'Essential, con analisi integrata di memorie, contratti, perizie
                    e fascicoli di studio.
                  </p>
                </div>
                
              </div>

              {/* CTA unica */}
              <div className="pricing-cta mt-6 text-center">
                <ButtonCTA
                  onClick={handleClick}
                  aria-label="Attiva l'analisi assistita su un documento esterno"
                >
                  Visualizza i piani
                </ButtonCTA>
              </div>
            </div>
          </motion.div>

        </div>
      </motion.div>

      {/* SEZIONE CTA Lazy Loaded & Footer */}
      <motion.div variants={blockVariants} className="z-10 w-full shrink-0 mt-16">
        <Suspense fallback={<div className="h-40 w-full animate-pulse rounded-lg border border-(--color-border) bg-(--color-surface) mx-auto" />}>
          <CTASection />
          <Footer />
        </Suspense>
      </motion.div>
    </section>
  );
};

export default DeepAnalysisLanding;