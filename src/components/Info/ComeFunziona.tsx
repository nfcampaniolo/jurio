import React from 'react';
import { FiSearch, FiUpload, FiFileText } from 'react-icons/fi';
import { motion, useReducedMotion } from 'framer-motion';

const steps = [
  {
    key: 'database',
    title: 'Fonti ufficiali già analizzate',
    desc: 'Accedi alla giurisprudenza delle Corti Supreme — Cassazione Civile, Cassazione Penale, Consiglio di Stato e Corte Costituzionale — già massimizzata e indicizzata per una ricerca semantica efficace.',
    Icon: FiSearch,
  },
  {
    key: 'upload',
    title: 'Base dati personale e riservata',
    desc: 'Carica atti e fascicoli in un ambiente privato, separato e sicuro. I tuoi documenti restano interrogabili insieme alla giurisprudenza, senza dispersione del contenuto.',
    Icon: FiUpload,
  },
  {
    key: 'generation',
    title: 'Agente AI per ricerca e sintesi',
    desc: 'L’Agente AI collega fatti, precedenti e norme, mette in evidenza la ratio decidendi e aiuta a individuare rapidamente i punti davvero rilevanti.',
    Icon: FiFileText,
  },
];

export const ComeFunziona: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      aria-labelledby="come-funziona-heading"
      className="py-10 bg-(--color-bg)"
    >
      <div className="mx-auto flex flex-col items-center px-6 max-w-7xl">
        
        {/* HEADER SEZIONE */}
        <div className="text-center max-w-3xl mb-16">
          <motion.h2
            id="come-funziona-heading"
            initial={shouldReduceMotion ? false : { opacity: 0, y: -20 }}
            whileInView={shouldReduceMotion ? {} : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={shouldReduceMotion ? {} : { duration: 0.6 }}
            className="text-3xl md:text-4xl text-(--color-text) tracking-tight mb-6"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Come funziona Jurio
          </motion.h2>

          <motion.p
            className="text-lg text-(--color-muted) font-light leading-relaxed mx-auto"
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            whileInView={shouldReduceMotion ? {} : { opacity: 1 }}
            viewport={{ once: true }}
            transition={shouldReduceMotion ? {} : { duration: 0.8, delay: 0.2 }}
          >
            Jurio unisce giurisprudenza delle Corti Supreme già elaborata, una base dati personale riservata e un
            agente AI. Il risultato è una ricerca più essenziale, più sicura e più veloce.
          </motion.p>
        </div>

        {/* GRIGLIA STEPS */}
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-8 lg:gap-12 w-full">
          {steps.map(({ key, title, desc, Icon }, i) => (
            <motion.li
              key={key}
              className="flex flex-col text-left p-8 rounded-lg border border-(--color-border) bg-(--color-surface) relative group overflow-hidden"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
              whileInView={shouldReduceMotion ? {} : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={
                shouldReduceMotion
                  ? {}
                  : { duration: 0.5, delay: i * 0.15 }
              }
            >
              {/* Linea superiore di rigore: invisibile di default, compare e si ingrandisce all'hover */}
              <div className="absolute top-0 left-0 right-0 h-0 bg-(--color-primary) opacity-0 group-hover:opacity-100 group-hover:h-1 transition-all duration-200 z-10" />

              {/* Icona racchiusa in un blocco logico */}
              <span 
                className="mb-8 mt-2 inline-flex items-center justify-center w-12 h-12 rounded-md bg-(--color-border) opacity-80 text-(--color-text) transition-transform group-hover:scale-105" 
                aria-hidden="true"
              >
                <Icon className="text-xl" focusable="false" />
              </span>

              <h3
                className="text-xl mb-3 font-medium text-(--color-text) leading-snug"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {title}
              </h3>

              <p className="text-sm leading-relaxed text-(--color-muted) font-light">
                {desc}
              </p>
            </motion.li>
          ))}
        </ol>

      </div>
    </section>
  );
};