"use client";
import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Input } from "@/shared/components/Input";
import { useRegisterPageLogic } from "@/features/auth/hooks/useRegisterPageLogic";
import { consentItems, roleOptions } from "@/interfaces/interfaces";
import { Loader2 } from "lucide-react";

export const Register: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();

  const {
    name,
    setName,
    surname,
    setSurname,
    isAdult,
    setIsAdult,
    consents,
    handleConsentChange,
    saveToDb,
    role,
    setRole,
    roleOther,
    setRoleOther,
    isSaving,
  } = useRegisterPageLogic();

  const roleId = "role-select";
  const roleDescId = "role-description";

  return (
    <main className="relative flex flex-col lg:flex-row items-start justify-between min-h-screen p-6 lg:p-16 gap-8 lg:gap-12 bg-(--color-bg) text-(--color-text) max-w-7xl mx-auto overflow-hidden">
      {/* Colonna sinistra */}
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, x: -30 }}
        animate={shouldReduceMotion ? {} : { opacity: 1, x: 0 }}
        transition={shouldReduceMotion ? {} : { duration: 0.4, ease: "easeOut" }}
        className="flex-1 flex flex-col gap-5 w-full"
      >
        <h1
          className="text-2xl sm:text-3xl font-medium text-center lg:text-left tracking-tight"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          Registrazione Utente
        </h1>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="reg-name"
            className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) ml-1"
          >
            Nome
          </label>
          <Input
            id="reg-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Inserisci il tuo nome"
            aria-required="true"
            className="w-full px-3.5 py-2.5 rounded-md border border-(--color-border) text-(--color-text) bg-(--color-bg) focus:border-(--color-text) outline-none text-sm font-light placeholder:text-(--color-muted) shadow-xs transition-colors"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="reg-surname"
            className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) ml-1"
          >
            Cognome
          </label>
          <Input
            id="reg-surname"
            type="text"
            value={surname}
            onChange={(e) => setSurname(e.target.value)}
            placeholder="Inserisci il tuo cognome"
            aria-required="true"
            className="w-full px-3.5 py-2.5 rounded-md border border-(--color-border) text-(--color-text) bg-(--color-bg) focus:border-(--color-text) outline-none text-sm font-light placeholder:text-(--color-muted) shadow-xs transition-colors"
          />
        </div>

        <div className="hidden lg:block mt-2 flex-1 max-h-[35vh] rounded-lg overflow-hidden border border-(--color-border) shadow-(--shadow-soft) bg-(--color-surface)">
          <video
            src="/demo2.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
            aria-label="Video dimostrativo della piattaforma"
          />
        </div>
      </motion.div>

      {/* Colonna destra (Consensi e Categoria) */}
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, x: 30 }}
        animate={shouldReduceMotion ? {} : { opacity: 1, x: 0 }}
        transition={shouldReduceMotion ? {} : { duration: 0.4, delay: 0.1, ease: "easeOut" }}
        className="flex-1 flex flex-col justify-between w-full h-full"
      >
        <div className="flex flex-col gap-5 text-sm pb-8 pt-2 lg:pt-0">
          <div className="flex flex-col gap-2">
            <label
              htmlFor={roleId}
              className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) ml-1"
            >
              Categoria professionale (opzionale)
            </label>

            <p id={roleDescId} className="text-xs text-(--color-muted) font-light ml-1 leading-relaxed">
              La selezione della categoria professionale è facoltativa; tuttavia, la sua indicazione consente di agevolare
              l’individuazione e la personalizzazione dei contenuti e dei servizi maggiormente pertinenti agli interessi e
              alle esigenze professionali dell’utente.
            </p>

            <select
              id={roleId}
              value={role}
              onChange={(e) => setRole(e.target.value)}
              aria-describedby={roleDescId}
              className="appearance-none w-full rounded-md border border-(--color-border)
                         bg-(--color-surface) px-3.5 py-2.5 pr-10 text-xs sm:text-sm font-light text-(--color-text) mt-1
                         outline-none focus:border-(--color-text)
                         shadow-xs transition-colors"
            >
              {roleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {role === "altro" && (
              <div className="flex flex-col gap-1.5 mt-2">
                <label
                  htmlFor="role-other"
                  className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) ml-1"
                >
                  Specifica la tua categoria
                </label>
                <Input
                  id="role-other"
                  type="text"
                  value={roleOther}
                  onChange={(e) => setRoleOther(e.target.value)}
                  placeholder="Specifica la tua categoria"
                  className="w-full px-3.5 py-2.5 rounded-md border border-(--color-border) text-(--color-text) bg-(--color-bg) focus:border-(--color-text) outline-none text-sm font-light placeholder:text-(--color-muted) shadow-xs transition-colors"
                />
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3 pt-2 border-t border-(--color-border)">
            {/* Spunta obbligatoria maggiore età */}
            <div className="flex items-start gap-3 p-3.5 rounded-md border border-(--color-border) bg-(--color-surface) shadow-xs">
              <input
                id="consent-age"
                type="checkbox"
                checked={isAdult}
                onChange={(e) => setIsAdult(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-(--color-border) text-(--color-text) focus:ring-0 cursor-pointer accent-(--color-text)"
                aria-required="true"
              />
              <label htmlFor="consent-age" className="cursor-pointer select-none text-xs">
                <span className="font-bold uppercase tracking-wider text-(--color-text)">
                  Dichiaro di avere più di 18 anni (obbligatorio)
                </span>
              </label>
            </div>

            {/* Consensi dinamici */}
            {consentItems.map((item) => {
              const checked = consents[item.key as keyof typeof consents];
              const checkboxId = `consent-${item.key}`;

              return (
                <div
                  key={item.key}
                  className="flex items-start gap-3 p-3.5 rounded-md border border-(--color-border) bg-(--color-surface) shadow-xs"
                >
                  <input
                    id={checkboxId}
                    type="checkbox"
                    checked={checked}
                    onChange={() => handleConsentChange(item.key as keyof typeof consents)}
                    className="mt-0.5 h-4 w-4 rounded border-(--color-border) text-(--color-text) focus:ring-0 cursor-pointer accent-(--color-text)"
                    aria-required={item.required ? "true" : "false"}
                  />

                  <label htmlFor={checkboxId} className="cursor-pointer select-none text-xs">
                    <span className="font-bold uppercase tracking-wider text-(--color-text)">
                      {item.label} {item.required ? "(obbligatorio)" : ""}
                    </span>
                    {item.link && (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 inline-flex items-center text-(--color-text) font-bold underline underline-offset-2 hover:opacity-80 transition-opacity"
                      >
                        vedi
                        <svg
                          className="w-3.5 h-3.5 ml-0.5"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2}
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </a>
                    )}
                  </label>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pulsante */}
        <button
          type="button"
          onClick={saveToDb}
          disabled={isSaving || !isAdult}
          className="w-full rounded-md bg-(--color-text) text-(--color-surface) px-4 py-3 text-xs font-bold uppercase tracking-widest disabled:opacity-35 disabled:cursor-not-allowed hover:opacity-90 transition-all shadow-xs outline-none flex items-center justify-center gap-2 mt-4"
        >
          {isSaving && <Loader2 size={14} className="animate-spin" />}
          <span>
            {isSaving ? "Salvataggio in corso..." : "Inizia la tua settimana di prova gratuita"}
          </span>
        </button>
      </motion.div>
    </main>
  );
};