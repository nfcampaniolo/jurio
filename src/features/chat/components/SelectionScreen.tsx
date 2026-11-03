import { motion, type Variants, useReducedMotion } from "framer-motion";
import {
  Scale,
  MessageSquare,
  FolderPlus,
  FolderOpen,
  Loader2,
  ChevronRight,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Footer } from "@/shared/components/Footer";

interface SelectionScreenProps {
  startTempChat: () => void;
  startFascicoloSetup: () => void;
  isLoadingData: boolean;
}

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

// La griglia orchestra l'ingresso sequenziale delle due card.
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

export const SelectionScreen = ({
  startTempChat,
  startFascicoloSetup,
  isLoadingData,
}: SelectionScreenProps) => {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  return (
    <section
      aria-labelledby="selection-screen-heading"
      className="relative flex h-full w-full flex-col justify-between overflow-y-auto scroll-smooth bg-(--color-bg)"
    >
      {/* Sfondo */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 overflow-hidden"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.6, ease: "easeOut" }}
      >
        <div className="absolute -top-20 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-(--color-primary)/10 blur-3xl" />
      </motion.div>

      {/* Contenitore principale: orchestra l'ingresso dei blocchi */}
      <motion.div
        variants={containerVariants}
        initial={reduceMotion ? "visible" : "hidden"}
        animate="visible"
        className="z-10 my-auto flex w-full flex-col items-center px-6 py-10 md:py-16"
      >
        <div className="flex w-full max-w-5xl flex-col items-center">
          {/* BLOCCO 1: HEADER */}
          <motion.div
            variants={blockVariants}
            className="mb-14 w-full max-w-4xl text-center"
          >
            <div className="mb-6 flex justify-center">
              <span className="inline-flex h-14 w-14 items-center justify-center rounded-lg border border-(--color-border) bg-(--color-surface) text-(--color-text)">
                <Scale size={26} className="opacity-80" />
              </span>
            </div>

            <h1
              id="selection-screen-heading"
              className="mb-5 text-3xl leading-tight tracking-tight text-(--color-text) md:text-4xl lg:text-5xl"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Il tuo <em>Consulente Legale</em>
            </h1>

            <p className="mx-auto max-w-2xl text-lg font-light leading-relaxed text-(--color-muted)">
              Ricerca giurisprudenziale avanzata e analisi dei tuoi documenti,
              in un unico spazio di lavoro.
            </p>
          </motion.div>

          {/* BLOCCO 2: GRIGLIA OPZIONI */}
          <motion.div
            variants={gridVariants}
            className="mb-12 grid w-full max-w-4xl grid-cols-1 gap-6 md:grid-cols-2 lg:gap-8"
          >
            {/* Card 1 */}
            <motion.button
              variants={cardVariants}
              whileHover={reduceMotion ? undefined : { y: -3 }}
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
              onClick={startTempChat}
              className="group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border border-(--color-border) bg-(--color-surface) p-8 text-left shadow-sm transition-colors duration-300 hover:border-(--color-primary)/40"
            >
              <div className="absolute left-0 right-0 top-0 z-10 h-0 bg-(--color-primary) opacity-0 transition-all duration-200 group-hover:h-1 group-hover:opacity-100" />

              <span className="relative z-10 mb-8 mt-2 inline-flex h-12 w-12 items-center justify-center rounded-md bg-(--color-border) text-(--color-text) opacity-80 transition-transform group-hover:scale-105">
                <MessageSquare size={20} />
              </span>

              <h3
                className="relative z-10 mb-3 text-xl font-medium leading-snug text-(--color-text)"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                Chat Temporanea
              </h3>

              <p className="relative z-10 text-sm font-light leading-relaxed text-(--color-muted)">
                Per avviare un'elaborazione rapida e rispondere in modo rapido a
                un quesito legale.
              </p>
            </motion.button>

            {/* Card 2 */}
            <motion.button
              variants={cardVariants}
              whileHover={reduceMotion ? undefined : { y: -3 }}
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
              onClick={startFascicoloSetup}
              className="group relative flex cursor-pointer flex-col overflow-hidden rounded-lg border border-(--color-border) bg-(--color-surface) p-8 text-left shadow-sm transition-colors duration-300 hover:border-(--color-primary)/40"
            >
              <div className="absolute left-0 right-0 top-0 z-10 h-0 bg-(--color-primary) opacity-0 transition-all duration-200 group-hover:h-1 group-hover:opacity-100" />

              <span className="relative z-10 mb-8 mt-2 inline-flex h-12 w-12 items-center justify-center rounded-md bg-(--color-border) text-(--color-text) opacity-80 transition-transform group-hover:scale-105">
                <FolderPlus size={20} />
              </span>

              <h3
                className="relative z-10 mb-3 text-xl font-medium leading-snug text-(--color-text)"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                Nuovo Fascicolo
              </h3>

              <p className="relative z-10 text-sm font-light leading-relaxed text-(--color-muted)">
                Organizza i tuoi documenti e crea una memoria persistente per
                analisi complesse.
              </p>
            </motion.button>
          </motion.div>

          {/* BLOCCO 3: ARCHIVIO */}
          <motion.div
            variants={blockVariants}
            className="flex w-full justify-center"
          >
            <motion.button
              whileHover={reduceMotion ? undefined : { x: 4 }}
              whileTap={reduceMotion ? undefined : { scale: 0.98 }}
              onClick={() => void navigate("/storico")}
              className="group flex cursor-pointer items-center gap-3 px-6 py-4 text-(--color-text) outline-none transition-opacity hover:opacity-85"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-md border border-(--color-border) bg-(--color-surface) transition-colors">
                {isLoadingData ? (
                  <Loader2
                    size={14}
                    className="animate-spin text-(--color-primary)"
                  />
                ) : (
                  <FolderOpen
                    size={14}
                    className="text-(--color-muted) transition-colors group-hover:text-(--color-text)"
                  />
                )}
              </div>
              <span className="text-[11px] font-bold uppercase tracking-widest">
                Sfoglia Archivio Fascicoli
              </span>
              <ChevronRight
                size={16}
                className="text-(--color-muted) opacity-50 transition-all group-hover:translate-x-1 group-hover:opacity-100"
              />
            </motion.button>
          </motion.div>
        </div>
      </motion.div>

      {/* BLOCCO 4: FOOTER */}
      <motion.div
        variants={blockVariants}
        initial={reduceMotion ? "visible" : "hidden"}
        animate="visible"
        className="z-10 w-full shrink-0"
      >
        <Footer />
      </motion.div>
    </section>
  );
};

export default SelectionScreen;
