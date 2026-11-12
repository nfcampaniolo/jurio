import { useEffect, useId, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Info, Lightbulb, Scale } from "lucide-react";

interface SearchAssistBarProps {
  searchNormativa: boolean;
  setSearchNormativa: (val: boolean) => void;
  disabled?: boolean;
}

interface HoverInfoProps {
  /** Contenuto del pulsante che apre il pannello. */
  trigger: ReactNode;
  /** Etichetta accessibile del pulsante. */
  label: string;
  align?: "left" | "right";
  children: ReactNode;
}

/**
 * Pannello informativo: si apre al passaggio del mouse o con il focus da tastiera,
 * e al tocco su dispositivi mobili. Resta aperto mentre il cursore è sul pannello,
 * così i link al suo interno restano cliccabili.
 */
function HoverInfo({ trigger, label, align = "left", children }: HoverInfoProps) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const reduceMotion = useReducedMotion();

  const cancelClose = () => {
    if (closeTimer.current !== null) {
      window.clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const show = () => { cancelClose(); setOpen(true); };
  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = window.setTimeout(() => setOpen(false), 150);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const onPointer = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  useEffect(() => cancelClose, []);

  return (
    <div
      ref={containerRef}
      className="relative inline-flex"
      onMouseEnter={show}
      onMouseLeave={scheduleClose}
      onFocus={show}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) scheduleClose();
      }}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex items-center gap-1.5 rounded-md text-(--color-muted) hover:text-(--color-text) transition-colors outline-none cursor-pointer focus-visible:ring-2 focus-visible:ring-(--color-primary)/40"
      >
        {trigger}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={panelId}
            role="tooltip"
            initial={reduceMotion ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={`absolute top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-lg border border-(--color-border) bg-(--color-surface) p-4 text-left shadow-md
              ${align === "right" ? "right-0" : "left-0"}`}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function SearchAssistBar({ searchNormativa, setSearchNormativa, disabled = false }: SearchAssistBarProps) {
  const switchId = useId();

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-1">
      {/* Interruttore: ricerca per riferimento normativo */}
      <div className="flex items-center gap-2.5">
        <button
          id={switchId}
          type="button"
          role="switch"
          aria-checked={searchNormativa}
          aria-label="Cerca anche per riferimento normativo"
          disabled={disabled}
          onClick={() => setSearchNormativa(!searchNormativa)}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-200 outline-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 focus-visible:ring-2 focus-visible:ring-(--color-primary)/40 focus-visible:ring-offset-2
            ${searchNormativa ? "bg-(--color-primary) border-(--color-primary)" : "bg-(--color-bg) border-(--color-border)"}`}
        >
          <span
            aria-hidden="true"
            className={`inline-block h-3.5 w-3.5 rounded-full shadow-xs transition-transform duration-200 ease-out
              ${searchNormativa ? "translate-x-[18px] bg-white" : "translate-x-[2px] bg-(--color-muted)/70"}`}
          />
        </button>

        <label
          htmlFor={switchId}
          className={`flex items-center gap-1.5 text-xs select-none cursor-pointer ${searchNormativa ? "text-(--color-text) font-medium" : "text-(--color-muted)"}`}
        >
          <Scale size={13} aria-hidden="true" className="opacity-70" />
          Riferimenti normativi
        </label>

        <HoverInfo
          label="Informazioni sulla ricerca per riferimento normativo"
          trigger={<Info size={14} aria-hidden="true" />}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) mb-1.5">
            Ricerca per riferimento normativo
          </p>
          <p className="text-xs leading-relaxed text-(--color-text) font-light">
            Quando l'opzione è attiva, Jurio individua i riferimenti normativi presenti nel testo della ricerca
            (ad esempio <em>art. 2051 c.c.</em>) e mostra, in una sezione dedicata, i provvedimenti che li richiamano.
          </p>
          <p className="mt-2 text-xs leading-relaxed text-(--color-muted) font-light">
            Indica articolo e fonte nel modo più preciso possibile. Se non viene riconosciuto alcun riferimento,
            la sezione non produce risultati.
          </p>
        </HoverInfo>
      </div>

      {/* Guida alla formulazione della ricerca */}
      <HoverInfo
        align="right"
        label="Come formulare una ricerca efficace"
        trigger={
          <span className="text-xs inline-flex items-center gap-1.5">
            <Lightbulb size={13} aria-hidden="true" className="opacity-80" />
            Come scrivere la ricerca
          </span>
        }
      >
        <p className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) mb-1.5">
          Come formulare una ricerca efficace
        </p>
        <p className="text-xs leading-relaxed text-(--color-text) font-light">
          La ricerca è semantica: confronta il significato del testo con le massime in archivio.
          I risultati migliori si ottengono descrivendo, in forma discorsiva:
        </p>
        <ol className="mt-2 space-y-1 text-xs leading-relaxed text-(--color-text) font-light list-decimal pl-4">
          <li><strong className="font-medium">Fattispecie</strong>: i fatti essenziali del caso.</li>
          <li><strong className="font-medium">Massima</strong>: il principio di diritto che si intende verificare.</li>
          <li><strong className="font-medium">Normativa</strong>: gli articoli di legge pertinenti.</li>
          <li><strong className="font-medium">Precedenti</strong>: eventuali pronunce già note sul tema.</li>
        </ol>
        <p className="mt-2.5 text-xs leading-relaxed text-(--color-muted) font-light italic">
          Es. «Caduta di un pedone su una buca non segnalata del marciapiede comunale; responsabilità del custode
          ex art. 2051 c.c. e rilevanza del caso fortuito; Cass. civ. n. 2480/2018».
        </p>
        <div className="mt-3 border-t border-(--color-border) pt-3">
          <p className="text-xs leading-relaxed text-(--color-muted) font-light">
            Evita di inserire istruzioni o vincoli (ad esempio «escludi…» o «cerca solo…»): la ricerca non li
            interpreta come comandi. Per richieste articolate utilizza{" "}
            <Link to="/analisi" className="font-medium text-(--color-text) underline underline-offset-2 hover:text-(--color-primary)">
              Approfondimento Giurisprudenziale
            </Link>{" "}
            oppure il{" "}
            <Link to="/chat" className="font-medium text-(--color-text) underline underline-offset-2 hover:text-(--color-primary)">
              Consulente Legale
            </Link>.
          </p>
        </div>
      </HoverInfo>
    </div>
  );
}
