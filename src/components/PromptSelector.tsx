import React, { useEffect, useRef } from "react";
import { FilterSelect } from "@/components/FilterSelect";
import { usePromptSelector } from "@/hooks/usePromptSelector";

interface PromptSelectorProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  label?: string;
}

const AnimatedDescription: React.FC<{
  children: React.ReactNode;
  animationKey: string;
}> = ({ children, animationKey }) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const animation = ref.current.animate(
      [
        {
          opacity: 0,
          transform: "translateY(-6px)",
        },
        {
          opacity: 1,
          transform: "translateY(0)",
        },
      ],
      {
        duration: 180,
        easing: "ease-out",
        fill: "both",
      }
    );

    return () => animation.cancel();
  }, [animationKey]);

  return <div ref={ref}>{children}</div>;
};

export const PromptSelector: React.FC<PromptSelectorProps> = ({
  value,
  onChange,
  disabled = false,
  label = "Modello di Analisi",
}) => {
  const {
    savedPrompts,
    publicPrompts,
    selectedCustomPrompt,
    handleChange,
  } = usePromptSelector({
    value,
    onChange,
  });

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label
          htmlFor="prompt-selector"
          className="text-xs font-medium text-(--color-text) uppercase tracking-wider"
        >
          {label}
        </label>

        <a
          href="/profilo/prompt-builder"
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs font-light text-(--color-muted) hover:text-(--color-text) transition-colors underline underline-offset-2"
        >
          Vai ai tuoi prompt &rarr;
        </a>
      </div>

      <FilterSelect
        id="prompt-selector"
        label=""
        value={value}
        onChange={handleChange}
        disabled={disabled}
      >
        <option value="default">Analisi Standard</option>

        {publicPrompts.length > 0 && (
          <optgroup label="Modelli Pubblici">
            {publicPrompts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </optgroup>
        )}

        {savedPrompts.length > 0 && (
          <optgroup label="I Miei Prompt">
            {savedPrompts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </optgroup>
        )}

        <optgroup label="Azioni">
          <option value="create_new">Crea nuovo prompt...</option>
        </optgroup>
      </FilterSelect>

      {value === "default" && (
        <AnimatedDescription animationKey="default">
          <div className="relative text-xs text-(--color-muted) bg-(--color-surface) border border-(--color-border) rounded-md p-4 space-y-2 leading-relaxed text-left shadow-xs overflow-hidden">
            <div
              className="font-bold text-(--color-text) mt-1 tracking-tight"
              style={{ fontFamily: "var(--font-serif)" }}
            >
              Modello di default per l'estrazione giuridica:
            </div>

            <p className="m-0 font-light leading-relaxed">
              Agisce come redattore giuridico professionale italiano con{" "}
              <strong className="font-semibold text-(--color-text)">
                anonimizzazione obbligatoria
              </strong>{" "}
              delle parti. Esegue una classificazione preliminare rigorosa
              (sentenze, ordinanze, decreti, memorie, pareri, fatture, perizie,
              mail) ed estrae i campi strutturati previsti dallo schema.
            </p>

            <p className="m-0 font-light leading-relaxed">
              Genera sempre la <em>massima</em> (o massima descrittiva), la{" "}
              <em>ratio decidendi</em>, i riferimenti normativi puntuali e
              compila un campo{" "}
              <strong className="font-semibold text-(--color-text)">
                summary
              </strong>{" "}
              ad altissima densità informativa ottimizzato per
              l'indicizzazione e la ricerca semantica vettoriale.
            </p>
          </div>
        </AnimatedDescription>
      )}

      {selectedCustomPrompt && (
        <AnimatedDescription animationKey={selectedCustomPrompt.id}>
          <div className="relative text-xs text-(--color-muted) bg-(--color-surface) border border-(--color-border) rounded-md p-4 space-y-1.5 leading-relaxed shadow-xs overflow-hidden text-left">
            <div className="font-medium text-(--color-text) flex items-center justify-between mt-1">
              <span
                className="tracking-tight font-bold"
                style={{ fontFamily: "var(--font-serif)" }}
              >
                {selectedCustomPrompt.title}
              </span>

              <span className="text-[9px] font-bold uppercase tracking-widest text-(--color-text) bg-(--color-bg) border border-(--color-border) px-2 py-0.5 rounded-sm shadow-xs">
                {savedPrompts.some(
                  (p) => p.id === selectedCustomPrompt.id
                )
                  ? "Personalizzato"
                  : "Pubblico"}
              </span>
            </div>

            {selectedCustomPrompt.objective ? (
              <p className="m-0 text-(--color-muted) font-light italic leading-relaxed">
                {selectedCustomPrompt.objective}
              </p>
            ) : (
              <p className="m-0 text-(--color-muted) font-light italic">
                Nessun obiettivo o descrizione specificata per questo prompt.
              </p>
            )}
          </div>
        </AnimatedDescription>
      )}
    </div>
  );
};