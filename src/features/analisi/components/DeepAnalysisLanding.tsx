// src/features/deep-analysis/components/DeepAnalysisLanding.tsx
import React, { Suspense, lazy } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Compass, Landmark, Route, Scale } from "lucide-react";
import { ButtonCTA } from '@/shared/components/ButtonCTA';
import { useNavigate } from 'react-router-dom';
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
    title: "Scrutinio delle Fonti Ufficiali",
    desc: "Il sistema interroga le banche dati e gli archivi di merito e legittimità, isolando i precedenti puntuali e le massime rilevanti per la fattispecie."
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

export const DeepAnalysisLanding: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();
  const navigate = useNavigate();
    const handleClick = () => {
    navigate('/prezzi');
    };
  return (
    <section aria-labelledby="deep-analysis-heading" className="py-10 bg-(--color-bg)">
      <div className="mx-auto flex flex-col items-center px-6 max-w-7xl">
        
        {/* HEADER SEZIONE */}
        <div className="text-center max-w-4xl mb-16">
          <motion.h1
            id="deep-analysis-heading"
            initial={shouldReduceMotion ? false : { opacity: 0, y: -20 }}
            whileInView={shouldReduceMotion ? {} : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={shouldReduceMotion ? {} : { duration: 0.6 }}
            className="text-3xl md:text-4xl lg:text-5xl text-(--color-text) tracking-tight mb-6 leading-tight"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            L'<em>approfondimento giurisprudenziale</em> per i casi più complessi.
          </motion.h1>

          <motion.p
            className="text-lg text-(--color-muted) font-light leading-relaxed mx-auto max-w-3xl"
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            whileInView={shouldReduceMotion ? {} : { opacity: 1 }}
            viewport={{ once: true }}
            transition={shouldReduceMotion ? {} : { duration: 0.8, delay: 0.2 }}
          >
            Uno strumento evoluto di intelligence giuridica pensato per gli studi legali. Deep Analysis esamina il quadro normativo, confronta le diverse tesi giurisprudenziali e restituisce una visione d'insieme chiara per orientare le scelte difensive.
          </motion.p>
        </div>

        {/* GRIGLIA FASI (Stile ComeFunziona.tsx adattato a 4 colonne) */}
        <ol className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 w-full mb-16">
          {workflowSteps.map(({ key, title, desc, Icon }, i) => (
            <motion.li
              key={key}
              className="flex flex-col text-left p-8 rounded-lg border border-(--color-border) bg-(--color-surface) relative group overflow-hidden"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
              whileInView={shouldReduceMotion ? {} : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={shouldReduceMotion ? {} : { duration: 0.5, delay: i * 0.15 }}
            >
              {/* Linea superiore di rigore: hover animato */}
              <div className="absolute top-0 left-0 right-0 h-0 bg-(--color-primary) opacity-0 group-hover:opacity-100 group-hover:h-1 transition-all duration-200 z-10" />

              {/* Watermark del numero fase */}
              <div className="absolute -right-2 -top-4 text-[70px] font-bold text-(--color-muted) opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none select-none font-serif">
                {key}
              </div>

              {/* Icona */}
              <span 
                className="mb-8 mt-2 inline-flex items-center justify-center w-12 h-12 rounded-md bg-(--color-border) opacity-80 text-(--color-text) transition-transform group-hover:scale-105 relative z-10" 
                aria-hidden="true"
              >
                <Icon className="text-xl" focusable="false" />
              </span>

              <h3
                className="text-xl mb-3 font-medium text-(--color-text) leading-snug relative z-10"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {title}
              </h3>

              <p className="text-sm leading-relaxed text-(--color-muted) font-light relative z-10">
                {desc}
              </p>
            </motion.li>
          ))}
        </ol>

        {/* SEZIONE PIANI DI ACCESSO */}
        <motion.div 
          initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
          whileInView={shouldReduceMotion ? {} : { opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="w-full"
        >
            <div className="max-w-4xl mx-auto">
            <div className="grid sm:grid-cols-2 gap-4 text-left">
                
                {/* Piano Essential */}
                <div className="flex flex-col p-6 rounded-lg border border-(--color-border) bg-(--color-surface)">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-widest text-(--color-text)">
                    Essential
                    </span>
                    <span className="text-[11px] text-(--color-muted) uppercase tracking-wider">
                    Ricerca pura
                    </span>
                </div>
                <h4
                    className="text-lg font-medium text-(--color-text) mb-2"
                    style={{ fontFamily: 'var(--font-serif)' }}
                >
                    Indagine giurisprudenziale avanzata
                </h4>
                <p className="text-sm text-(--color-muted) font-light leading-relaxed">
                    Quesiti complessi, consultazione delle pronunce e mappatura analitica
                    delle tesi decisionali.
                </p>
                </div>

                {/* Piano Business */}
                <div className="flex flex-col p-6 rounded-lg border border-(--color-primary)/30 bg-(--color-surface)">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-bold uppercase tracking-widest text-(--color-text)">
                    Business
                    </span>
                    <span className="text-[11px] text-(--color-primary) uppercase tracking-wider">
                    Esame documentale
                    </span>
                </div>
                <h4
                    className="text-lg font-medium text-(--color-text) mb-2"
                    style={{ fontFamily: 'var(--font-serif)' }}
                >
                    Elaborazione atti e fascicoli
                </h4>
                <p className="text-sm text-(--color-muted) font-light leading-relaxed">
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

        {/* SEZIONE CTA Lazy Loaded */}
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.8 }}
          className="w-full mt-16"
        >
          <Suspense fallback={<div className="h-40 w-full animate-pulse bg-(--color-surface) border border-(--color-border) rounded-lg max-w-5xl mx-auto" />}>
            <CTASection />
          </Suspense>
        </motion.div>

      </div>
    </section>
  );
};