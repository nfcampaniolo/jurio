import React from 'react';
import { Search, FileText, Book } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

const steps = [
  {
    key: 'database',
    title: 'Tutta la giurisprudenza che conta',
    desc: 'Ricerca nei provvedimenti di Cassazione Civile, Cassazione Penale, Consiglio di Stato e Corte Costituzionale, per trovare i precedenti più pertinenti rispetto alla questione giuridica analizzata.',
    Icon: Book,
  },

  {
    key: 'analysis',
    title: 'Comprende il contenuto delle decisioni',
    desc: 'Ogni provvedimento è stato analizzato nei suoi elementi giuridici essenziali, dalla ratio decidendi ai principi di diritto, fino ai fatti e alle motivazioni, per individuare ciò che è realmente rilevante per la ricerca.',
    Icon: FileText,
  },

  {
    key: 'retrieval',
    title: 'Trova i precedenti più pertinenti',
    desc: 'La ricerca non si limita alle parole utilizzate nel quesito: individua anche decisioni che affrontano la stessa questione giuridica con formulazioni differenti, restituendo i precedenti più rilevanti e vicini al caso.',
    Icon: Search,
  },
];

export const ComeFunziona: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      aria-labelledby="come-funziona-heading"
      className="py-10 bg-(--color-bg) flex flex-col items-center font-sans"
    >
      <div className="mx-auto flex flex-col items-center px-6 max-w-6xl w-full">
        
        {/* HEADER SEZIONE */}
        <div className="text-center max-w-4xl mb-16 space-y-6">
          <motion.h1
            id="come-funziona-heading"
            initial={shouldReduceMotion ? false : { opacity: 0, y: -20 }}
            whileInView={shouldReduceMotion ? {} : { opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={shouldReduceMotion ? {} : { duration: 0.6 }}
            className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-medium text-(--color-text) tracking-tight leading-tight"
            style={{ fontFamily: 'var(--font-serif)' }}
          >
            Come funziona la <em>ricerca giurisprudenziale</em> su Jurio.
          </motion.h1>

          <motion.p
            className="text-xs sm:text-sm md:text-base text-(--color-muted) font-light max-w-3xl mx-auto leading-relaxed"
            initial={shouldReduceMotion ? false : { opacity: 0 }}
            whileInView={shouldReduceMotion ? {} : { opacity: 1 }}
            viewport={{ once: true }}
            transition={shouldReduceMotion ? {} : { duration: 0.8, delay: 0.2 }}
          >
            Jurio unisce la giurisprudenza delle Corti Supreme già elaborata, una base dati personale riservata e un
            agente AI. Il risultato è un'esperienza di ricerca più essenziale, più sicura e più veloce.
          </motion.p>
        </div>

        {/* GRIGLIA STEPS (3 Colonne) */}
        <ol className="grid grid-cols-1 md:grid-cols-3 gap-4 lg:gap-6 w-full pb-12">
          {steps.map(({ key, title, desc, Icon }, i) => (
            <motion.li
              key={key}
              className="relative bg-(--color-surface) border border-(--color-border) p-6 rounded-lg shadow-xs overflow-hidden group transition-colors duration-300 text-left"
              initial={shouldReduceMotion ? false : { opacity: 0, y: 20 }}
              whileInView={shouldReduceMotion ? {} : { opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={
                shouldReduceMotion
                  ? {}
                  : { duration: 0.5, delay: i * 0.15 }
              }
            >
              {/* Linea superiore di stile fissa */}
              <div className="absolute top-0 left-0 right-0 h-0 bg-(--color-primary) opacity-0 group-hover:opacity-100 group-hover:h-1 transition-all duration-200 z-10" />


              {/* Watermark del numero fase animato in hover */}
              <div className="absolute -right-2 -top-4 text-[70px] font-bold text-(--color-muted) opacity-5 group-hover:opacity-10 transition-opacity pointer-events-none select-none" style={{ fontFamily: 'var(--font-serif)' }}>
                0{i + 1}
              </div>

              {/* Icona racchiusa nel blocco logico */}
              <div className="bg-(--color-bg) w-10 h-10 rounded-sm border border-(--color-border) flex items-center justify-center mb-5 relative z-10 shadow-xs">
                <Icon size={18} className="text-(--color-text)" />
              </div>

              {/* Titolo */}
              <h3
                className="text-xs sm:text-sm font-medium text-(--color-text) mb-2.5 relative z-10 tracking-tight"
                style={{ fontFamily: 'var(--font-serif)' }}
              >
                {title}
              </h3>

              {/* Descrizione */}
              <p className="text-[11px] sm:text-xs text-(--color-muted) leading-relaxed font-light relative z-10">
                {desc}
              </p>
            </motion.li>
          ))}
        </ol>

      </div>
    </section>
  );
};