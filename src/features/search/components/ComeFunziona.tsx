import React from "react";
import { Search, FileText, Book } from "lucide-react";
import { motion, type Variants, useReducedMotion } from "framer-motion";

const steps = [
  {
    key: "database",
    title: "Tutta la giurisprudenza che conta",
    desc: "Ricerca la sintesi dei provvedimenti di Cassazione Civile, Cassazione Penale, Consiglio di Stato e Corte Costituzionale, per trovare i precedenti più pertinenti rispetto alla questione giuridica analizzata.",
    Icon: Book,
  },
  {
    key: "analysis",
    title: "Comprende il contenuto delle decisioni",
    desc: "Ogni provvedimento è stato analizzato nei suoi elementi giuridici essenziali, dalla ratio decidendi ai principi di diritto, fino ai fatti e alle motivazioni, per individuare ciò che è réellement rilevante per la ricerca.",
    Icon: FileText,
  },
  {
    key: "retrieval",
    title: "Trova i precedenti più pertinenti",
    desc: "La ricerca non si limita alle parole utilizzate nel quesito: individua anche decisioni che affrontano la stessa questione giuridica con formulazioni differenti, restituendo i precedenti più rilevanti e vicini al caso.",
    Icon: Search,
  },
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

export const ComeFunziona: React.FC = () => {
  const reduceMotion = useReducedMotion();

  return (
    <section
      aria-labelledby="come-funziona-heading"
      className="relative flex h-full w-full flex-col justify-between overflow-y-auto scroll-smooth bg-(--color-bg) py-10"
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
        <div className="flex w-full max-w-5xl flex-col items-center">
          
          {/* HEADER SEZIONE */}
          <motion.div
            variants={blockVariants}
            className="mb-14 w-full max-w-4xl text-center"
          >
            <h1
              id="come-funziona-heading"
              className="mb-5 text-3xl leading-tight tracking-tight text-(--color-text) md:text-4xl lg:text-5xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Come funziona la <em>ricerca giurisprudenziale</em> su Jurio.
            </h1>

            <p className="mx-auto max-w-2xl text-lg font-light leading-relaxed text-(--color-muted)">
              Jurio unisce la giurisprudenza delle Corti Supreme già elaborata, una base dati personale riservata e un
              agente AI. Il risultato è un'esperienza di ricerca più essenziale, più sicura e più veloce.
            </p>
          </motion.div>

          {/* GRIGLIA CARDS */}
          <motion.ol
            variants={gridVariants}
            className="mb-12 grid w-full max-w-4xl grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8"
          >
            {steps.map(({ key, title, desc, Icon }, i) => (
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
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  0{i + 1}
                </div>

                {/* Icona */}
                <span className="relative z-10 mb-8 mt-2 inline-flex h-12 w-12 items-center justify-center rounded-md border border-(--color-border) bg-(--color-bg) text-(--color-text) opacity-80 transition-transform group-hover:scale-105">
                  <Icon size={20} />
                </span>

                {/* Titolo */}
                <h3
                  className="relative z-10 mb-3 text-xl font-medium leading-snug text-(--color-text)"
                  style={{ fontFamily: "var(--font-serif)" }}
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

        </div>
      </motion.div>
    </section>
  );
};

export default ComeFunziona;