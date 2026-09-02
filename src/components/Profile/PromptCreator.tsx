import React, { useEffect, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  FaPlus,
  FaTrash,
  FaMagic,
  FaCheckCircle,
  FaInfoCircle,
  FaSlidersH,
  FaDatabase,
  FaArrowLeft,
  FaSearch,
  FaFileAlt,
} from "react-icons/fa";
import { Loader2 } from "lucide-react";
import { type PromptBuilderForm } from "@/interfaces/interfaces";
import { usePromptGenerator } from "@/hooks/usePromptGenerator";
import { AccessDenied } from "@/components/AccessDenied";

interface PromptCreatorProps {
  onBack: () => void;
  template?: PromptBuilderForm;
}

export const PromptCreator: React.FC<PromptCreatorProps> = ({
  onBack,
  template,
}) => {
  const shouldReduceMotion = useReducedMotion();

  const {
    generatedPrompt,
    isGenerating,
    generatePrompt,
    isAccessDenied,
  } = usePromptGenerator();

  const [activeHint, setActiveHint] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<PromptBuilderForm>({
    defaultValues: template || {
      title: "",
      objective: "",
      notes: "",
      fields: [
        {
          name: "",
          type: "string",
          description: "",
          isRequired: true,
        },
      ],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "fields",
  });

  const watchFields = watch("fields");

  useEffect(() => {
    if (!window.location.hash.includes("crea")) {
      window.history.pushState({ view: "crea" }, "", "#crea");
    }

    const handlePopState = () => {
      onBack();
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [onBack]);

  useEffect(() => {
    if (generatedPrompt && !isGenerating) {
      const timer = setTimeout(() => {
        onBack();
      }, 1800);

      return () => clearTimeout(timer);
    }
  }, [generatedPrompt, isGenerating, onBack]);

  const onSubmit = async (data: PromptBuilderForm) => {
    if (isGenerating || generatedPrompt) return;
    await generatePrompt(data);
  };

  return (
    <div className="w-full max-w-6xl mx-auto">
      <AnimatePresence>
        {isAccessDenied && <AccessDenied />}
      </AnimatePresence>

      {/* HEADER */}
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 pb-8">
        <div className="max-w-3xl">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 mb-5 text-sm text-(--color-muted) hover:text-(--color-text) transition-colors cursor-pointer"
          >
            <FaArrowLeft className="w-3 h-3" />
            Torna all'archivio
          </button>

          <div className="flex items-center gap-2 mb-3">
            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-semibold bg-(--color-bg) border border-(--color-border) text-(--color-muted)">
              NUOVO MODELLO
            </span>
          </div>

          <h1
            className="text-3xl sm:text-4xl font-medium tracking-tight text-(--color-text)"
            style={{ fontFamily: "var(--font-serif)" }}
          >
            Crea un modello di analisi
          </h1>

          <p className="mt-3 text-sm sm:text-base text-(--color-muted) leading-relaxed max-w-2xl">
            Decidi cosa deve cercare l'AI nei tuoi documenti.
            Una volta creato, potrai riutilizzare lo stesso modello su
            tutti i fascicoli che vuoi.
          </p>
        </div>
      </div>

      {/* SIMPLE 3-STEP GUIDE */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-6">
        <div className="flex items-start gap-3 p-4 bg-(--color-surface) border border-(--color-border) rounded-xl">
          <div className="w-8 h-8 shrink-0 rounded-lg bg-(--color-bg) border border-(--color-border) flex items-center justify-center">
            <FaSlidersH className="w-3.5 h-3.5 text-(--color-text)" />
          </div>

          <div>
            <p className="text-sm font-medium text-(--color-text)">
              1. Dai un nome al modello
            </p>
            <p className="mt-1 text-xs text-(--color-muted) leading-relaxed">
              Definisci a cosa serve e su quali documenti utilizzarlo.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 bg-(--color-surface) border border-(--color-border) rounded-xl">
          <div className="w-8 h-8 shrink-0 rounded-lg bg-(--color-bg) border border-(--color-border) flex items-center justify-center">
            <FaSearch className="w-3.5 h-3.5 text-(--color-text)" />
          </div>

          <div>
            <p className="text-sm font-medium text-(--color-text)">
              2. Scegli cosa cercare
            </p>
            <p className="mt-1 text-xs text-(--color-muted) leading-relaxed">
              Aggiungi i dati che vuoi trovare automaticamente.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 p-4 bg-(--color-surface) border border-(--color-border) rounded-xl">
          <div className="w-8 h-8 shrink-0 rounded-lg bg-(--color-bg) border border-(--color-border) flex items-center justify-center">
            <FaFileAlt className="w-3.5 h-3.5 text-(--color-text)" />
          </div>

          <div>
            <p className="text-sm font-medium text-(--color-text)">
              3. Lascia che l'AI lo usi
            </p>
            <p className="mt-1 text-xs text-(--color-muted) leading-relaxed">
              Il modello sarà pronto per essere applicato ai tuoi documenti.
            </p>
          </div>
        </div>
      </div>

      {/* MAIN CARD */}
      <div className="relative bg-(--color-surface) border border-(--color-border) rounded-2xl shadow-(--shadow-soft) overflow-hidden">
        <div className="h-1 bg-(--color-primary)" />

        {/* GENERATION OVERLAY */}
        <AnimatePresence>
          {(isGenerating || generatedPrompt) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-50 bg-(--color-surface)/95 backdrop-blur-sm flex items-center justify-center p-6"
            >
              {isGenerating ? (
                <div className="text-center max-w-sm">
                  <div className="w-12 h-12 rounded-full bg-(--color-bg) border border-(--color-border) flex items-center justify-center mx-auto">
                    <Loader2
                      size={22}
                      className="animate-spin text-(--color-text)"
                    />
                  </div>

                  <h3
                    className="mt-5 text-xl font-medium text-(--color-text)"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    Stiamo creando il modello
                  </h3>

                  <p className="mt-2 text-sm text-(--color-muted) leading-relaxed">
                    L'AI sta trasformando le tue indicazioni in un modello
                    pronto per l'analisi automatica.
                  </p>
                </div>
              ) : (
                <motion.div
                  initial={shouldReduceMotion ? {} : { scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.25 }}
                  className="text-center max-w-sm"
                >
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto text-emerald-600 dark:text-emerald-400">
                    <FaCheckCircle size={22} />
                  </div>

                  <h3
                    className="mt-5 text-xl font-medium text-(--color-text)"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    Modello creato
                  </h3>

                  <p className="mt-2 text-sm text-(--color-muted)">
                    È stato salvato nell'archivio ed è pronto per essere
                    utilizzato.
                  </p>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <form
          onSubmit={handleSubmit(onSubmit)}
          className="p-5 sm:p-8 lg:p-10"
        >
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* LEFT */}
            <div className="lg:col-span-5">
              <div className="mb-7">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-(--color-muted)">
                  Inizia da qui
                </p>

                <h2
                  className="mt-1.5 text-2xl font-medium text-(--color-text)"
                  style={{ fontFamily: "var(--font-serif)" }}
                >
                  Definisci il modello
                </h2>

                <p className="mt-2 text-sm text-(--color-muted) leading-relaxed">
                  Bastano poche indicazioni per spiegare all'AI
                  cosa analizzare e come comportarsi.
                </p>
              </div>

              <div className="space-y-6">
                {/* TITLE */}
                <div className="space-y-2">
                  <div>
                    <label className="text-sm font-medium text-(--color-text)">
                      Nome del modello
                    </label>

                    <p className="mt-1 text-xs text-(--color-muted)">
                      Scegli un nome facile da riconoscere nell'archivio.
                    </p>
                  </div>

                  <input
                    {...register("title", {
                      required: "Inserisci un nome per il modello",
                    })}
                    placeholder="Es. Analisi contratti di locazione"
                    className="w-full px-3.5 py-3 rounded-xl border border-(--color-border) bg-(--color-bg) text-sm text-(--color-text) outline-none focus:border-(--color-text) focus:ring-1 focus:ring-(--color-text) transition-all placeholder:text-(--color-muted)/50"
                  />

                  {errors.title && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {errors.title.message}
                    </p>
                  )}
                </div>

                {/* OBJECTIVE */}
                <div className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <label className="text-sm font-medium text-(--color-text)">
                        Cosa vuoi analizzare?
                      </label>

                      <p className="mt-1 text-xs text-(--color-muted)">
                        Spiega all'AI quale risultato vuoi ottenere.
                      </p>
                    </div>

                    <button
                      type="button"
                      onMouseEnter={() => setActiveHint("objective")}
                      onMouseLeave={() => setActiveHint(null)}
                      className="shrink-0 mt-0.5 text-(--color-muted) hover:text-(--color-text) transition-colors cursor-help"
                      title="Suggerimento"
                    >
                      <FaInfoCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {activeHint === "objective" && (
                    <div className="p-3 rounded-lg bg-(--color-bg) border border-(--color-border) text-xs text-(--color-muted) leading-relaxed">
                      Esempio: "Analizza il contratto e individua durata,
                      canone, responsabilità e condizioni di recesso."
                    </div>
                  )}

                  <textarea
                    {...register("objective", {
                      required: "Descrivi cosa deve analizzare l'AI",
                    })}
                    placeholder="Es. Individua durata, canone, responsabilità e condizioni di recesso..."
                    className="w-full h-32 p-3.5 rounded-xl border border-(--color-border) bg-(--color-bg) text-sm text-(--color-text) resize-none outline-none focus:border-(--color-text) focus:ring-1 focus:ring-(--color-text) transition-all placeholder:text-(--color-muted)/50 leading-relaxed"
                  />

                  {errors.objective && (
                    <p className="text-xs text-red-600 dark:text-red-400">
                      {errors.objective.message}
                    </p>
                  )}
                </div>

                {/* NOTES */}
                <div className="space-y-2">
                  <div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-(--color-text)">
                        Regole aggiuntive
                      </label>

                      <span className="text-[11px] text-(--color-muted)">
                        Facoltativo
                      </span>
                    </div>

                    <p className="mt-1 text-xs text-(--color-muted)">
                      Aggiungi regole su formato, precisione o dati mancanti.
                    </p>
                  </div>

                  <textarea
                    {...register("notes")}
                    placeholder="Es. Usa GG/MM/AAAA. Se il dato non è presente, lascia il campo vuoto."
                    className="w-full h-28 p-3.5 rounded-xl border border-(--color-border) bg-(--color-bg) text-sm text-(--color-text) resize-none outline-none focus:border-(--color-text) focus:ring-1 focus:ring-(--color-text) transition-all placeholder:text-(--color-muted)/50 leading-relaxed"
                  />
                </div>
              </div>
            </div>

            {/* RIGHT */}
            <div className="lg:col-span-7">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-(--color-muted)">
                    Dati da trovare
                  </p>

                  <h2
                    className="mt-1.5 text-2xl font-medium text-(--color-text)"
                    style={{ fontFamily: "var(--font-serif)" }}
                  >
                    Cosa deve trovare l'AI
                  </h2>

                  <p className="mt-2 text-sm text-(--color-muted) leading-relaxed">
                    Aggiungi un campo per ogni informazione che vuoi estrarre
                    dai documenti.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    append({
                      name: "",
                      type: "string",
                      description: "",
                      isRequired: false,
                    })
                  }
                  className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 rounded-xl border border-(--color-border) bg-(--color-bg) text-sm font-medium text-(--color-text) hover:border-(--color-text) transition-all cursor-pointer shrink-0"
                >
                  <FaPlus className="w-3 h-3" />
                  Aggiungi campo
                </button>
              </div>

              <div className="space-y-3 max-h-162.5 overflow-y-auto pr-1">
                {fields.map((field, index) => (
                  <motion.div
                    key={field.id}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="p-4 sm:p-5 rounded-xl border border-(--color-border) bg-(--color-bg)"
                  >
                    <div className="flex items-center justify-between gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <span className="flex items-center justify-center w-6 h-6 rounded-md bg-(--color-surface) border border-(--color-border) text-[10px] font-semibold text-(--color-muted)">
                          {index + 1}
                        </span>

                        <span className="text-sm font-medium text-(--color-text)">
                          Informazione da estrarre
                        </span>
                      </div>

                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => remove(index)}
                          className="inline-flex items-center gap-1.5 text-xs text-(--color-muted) hover:text-red-600 dark:hover:text-red-400 transition-colors cursor-pointer"
                        >
                          <FaTrash className="w-2.5 h-2.5" />
                          Rimuovi
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
                      {/* FIELD NAME */}
                      <div className="sm:col-span-7 space-y-2">
                        <div>
                          <label className="text-xs font-medium text-(--color-text)">
                            Nome del dato
                          </label>

                          <p className="mt-0.5 text-[11px] text-(--color-muted)">
                            La chiave che userai nel risultato.
                          </p>
                        </div>

                        <input
                          {...register(`fields.${index}.name` as const, {
                            required: true,
                          })}
                          placeholder="Es. canone_annuo"
                          className="w-full px-3 py-2.5 rounded-lg border border-(--color-border) bg-(--color-surface) text-sm font-mono text-(--color-text) outline-none focus:border-(--color-text) focus:ring-1 focus:ring-(--color-text) transition-all placeholder:text-(--color-muted)/50"
                        />
                      </div>

                      {/* TYPE */}
                      <div className="sm:col-span-5 space-y-2">
                        <div>
                          <label className="text-xs font-medium text-(--color-text)">
                            Tipo di risultato
                          </label>

                          <p className="mt-0.5 text-[11px] text-(--color-muted)">
                            Come vuoi ricevere il dato.
                          </p>
                        </div>

                        <select
                          {...register(`fields.${index}.type` as const)}
                          className="w-full px-3 py-2.5 rounded-lg border border-(--color-border) bg-(--color-surface) text-sm text-(--color-text) outline-none focus:border-(--color-text) focus:ring-1 focus:ring-(--color-text) cursor-pointer"
                        >
                          <option value="string">Testo</option>
                          <option value="number">Numero / Importo</option>
                          <option value="boolean">Sì / No</option>
                          <option value="array">Elenco</option>
                          <option value="enum">Scelta predefinita</option>
                        </select>
                      </div>

                      {/* ENUM */}
                      {watchFields[index]?.type === "enum" && (
                        <div className="sm:col-span-12 space-y-2">
                          <div>
                            <label className="text-xs font-medium text-(--color-text)">
                              Valori possibili
                            </label>

                            <p className="mt-0.5 text-[11px] text-(--color-muted)">
                              Inserisci le opzioni separate da virgola.
                            </p>
                          </div>

                          <input
                            {...register(
                              `fields.${index}.enumValues` as const,
                              {
                                required:
                                  "Definisci almeno due valori",
                              }
                            )}
                            placeholder="Es. Confermato, Sospeso, Risolto"
                            className="w-full px-3 py-2.5 rounded-lg border border-(--color-border) bg-(--color-surface) text-sm text-(--color-text) outline-none focus:border-(--color-text) focus:ring-1 focus:ring-(--color-text) transition-all placeholder:text-(--color-muted)/50"
                          />
                        </div>
                      )}

                      {/* DESCRIPTION */}
                      <div className="sm:col-span-12 space-y-2">
                        <div>
                          <label className="text-xs font-medium text-(--color-text)">
                            Come deve trovarlo?
                          </label>

                          <p className="mt-0.5 text-[11px] text-(--color-muted)">
                            Descrivi in modo semplice cosa deve cercare
                            nel documento.
                          </p>
                        </div>

                        <input
                          {...register(
                            `fields.${index}.description` as const,
                            {
                              required: true,
                            }
                          )}
                          placeholder="Es. Individua la clausola che indica il tribunale competente"
                          className="w-full px-3 py-2.5 rounded-lg border border-(--color-border) bg-(--color-surface) text-sm text-(--color-text) outline-none focus:border-(--color-text) focus:ring-1 focus:ring-(--color-text) transition-all placeholder:text-(--color-muted)/50"
                        />
                      </div>

                      {/* REQUIRED */}
                      <div className="sm:col-span-12">
                        <label
                          htmlFor={`req-${index}`}
                          className="inline-flex items-center gap-2 cursor-pointer select-none"
                        >
                          <input
                            type="checkbox"
                            id={`req-${index}`}
                            {...register(
                              `fields.${index}.isRequired` as const
                            )}
                            className="w-4 h-4 rounded border-(--color-border) accent-(--color-text) cursor-pointer"
                          />

                          <span className="text-xs text-(--color-text)">
                            Questo dato è importante
                          </span>

                          <span className="text-[11px] text-(--color-muted)">
                            L'AI segnalerà se non riesce a trovarlo.
                          </span>
                        </label>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div className="mt-10 pt-6 border-t border-(--color-border) flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 shrink-0 rounded-lg bg-(--color-bg) border border-(--color-border) flex items-center justify-center">
                <FaDatabase className="w-3.5 h-3.5 text-(--color-muted)" />
              </div>

              <div>
                <p className="text-sm font-medium text-(--color-text)">
                  Il modello verrà salvato nell'archivio
                </p>

                <p className="mt-0.5 text-xs text-(--color-muted)">
                  Potrai riutilizzarlo su nuovi documenti senza ricrearlo.
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={isGenerating || !!generatedPrompt}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl bg-(--color-text) text-(--color-surface) text-sm font-medium hover:opacity-90 transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FaMagic className="w-3.5 h-3.5" />
              Crea il modello
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
