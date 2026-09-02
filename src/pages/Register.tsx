"use client";
import React from "react";
import { motion, useReducedMotion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/Input";
import { useRegisterPageLogic } from "@/hooks/useRegisterPageLogic";
import { Link } from "react-router-dom";
import { consentItems, roleOptions } from "@/interfaces/interfaces";
import { Loader2 } from "lucide-react";

export const Register: React.FC = () => {
  const shouldReduceMotion = useReducedMotion();

  const {
    name, setName,
    surname, setSurname,
    phoneNumber, handlePhoneChange,
    otpCode, setOtpCode,
    isOtpSent, isPhoneVerified,
    isSendingOtp, isVerifyingOtp,
    sendOtp, verifyOtp,
    consents, handleConsentChange,
    saveToDb,
    role, setRole,
    roleOther, setRoleOther,
    isSaving,
    countdown
  } = useRegisterPageLogic();

  const roleId = "role-select";
  const roleDescId = "role-description";

  return (
    <main className="relative flex flex-col lg:flex-row items-start justify-between min-h-screen p-6 lg:p-16 gap-8 lg:gap-12 bg-(--color-bg) text-(--color-text) max-w-7xl mx-auto overflow-hidden">
      
      <div id="recaptcha-container"></div>

      {/* Colonna sinistra */}
      <motion.div
        initial={shouldReduceMotion ? false : { opacity: 0, x: -30 }}
        animate={shouldReduceMotion ? {} : { opacity: 1, x: 0 }}
        transition={shouldReduceMotion ? {} : { duration: 0.4, ease: "easeOut" }}
        className="flex-1 flex flex-col gap-5 w-full"
      >
        <h1 className="text-2xl sm:text-3xl font-medium text-center lg:text-left tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
          Registrazione Utente
        </h1>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="reg-name" className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) ml-1">
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
          <label htmlFor="reg-surname" className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) ml-1">
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

        {/* Blocco Numero di Telefono Inline */}
        <div className="flex flex-col gap-3 bg-(--color-surface) p-5 rounded-lg border border-(--color-border) shadow-(--shadow-soft) transition-all">
          <label htmlFor="reg-phone" className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) flex justify-between items-center ml-1">
            <span>Numero di Telefono</span>
            {isPhoneVerified && (
              <motion.span 
                initial={{ opacity: 0, scale: 0.8 }} 
                animate={{ opacity: 1, scale: 1 }} 
                className="text-[9px] font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-sm"
              >
                ✓ Verificato
              </motion.span>
            )}
          </label>
          
          <div className="flex gap-2 items-center">
            <span className="flex items-center justify-center px-4 py-2.5 bg-(--color-bg) text-(--color-text) text-xs font-bold rounded-md border border-(--color-border) shadow-xs">
              +39
            </span>
            <div className="flex-1">
              <Input
                id="reg-phone"
                type="tel"
                value={phoneNumber}
                onChange={(e) => handlePhoneChange(e.target.value)}
                placeholder="333 1234567"
                disabled={isPhoneVerified || isSendingOtp}
                aria-required="true"
                className="w-full px-3.5 py-2.5 rounded-md border border-(--color-border) text-(--color-text) bg-(--color-bg) focus:border-(--color-text) outline-none text-sm font-light placeholder:text-(--color-muted) shadow-xs transition-colors"
              />
            </div>
          </div>

          {/* Pulsante Invia OTP */}
          {!isPhoneVerified && !isOtpSent && phoneNumber.length >= 9 && (
            <button
              type="button"
              onClick={sendOtp}
              disabled={isSendingOtp || countdown > 0}
              className="mt-1 self-start px-4 py-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-(--color-surface) bg-(--color-text) hover:opacity-90 rounded-md shadow-xs transition-all disabled:opacity-35 outline-none"
            >
              {isSendingOtp && <Loader2 size={14} className="animate-spin" />}
              <span>{isSendingOtp ? "Invio in corso..." : "Verifica numero"}</span>
            </button>
          )}

          {/* Sezione inserimento OTP animata */}
          <AnimatePresence>
            {!isPhoneVerified && isOtpSent && (
              <motion.div 
                initial={{ opacity: 0, height: 0, y: -10 }} 
                animate={{ opacity: 1, height: "auto", y: 0 }} 
                exit={{ opacity: 0, height: 0, overflow: "hidden" }}
                className="flex flex-col gap-2.5 mt-2 p-4 bg-(--color-bg) border border-(--color-border) rounded-md shadow-xs"
              >
                <label htmlFor="reg-otp" className="text-[10px] font-bold uppercase tracking-widest text-(--color-text)">
                  Inserisci il codice di 6 cifre ricevuto via SMS
                </label>
                <div className="flex gap-2">
                  <Input
                    id="reg-otp"
                    type="text"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="Es. 123456"
                    disabled={isVerifyingOtp}
                    className="w-full px-3.5 py-2.5 rounded-md border border-(--color-border) text-(--color-text) bg-(--color-surface) focus:border-(--color-text) outline-none text-sm font-light placeholder:text-(--color-muted) shadow-xs transition-colors"
                  />
                  <button
                    type="button"
                    onClick={verifyOtp}
                    disabled={isVerifyingOtp || otpCode.length < 6}
                    className="px-4 py-2.5 flex items-center justify-center min-w-28 text-xs font-bold uppercase tracking-widest text-(--color-surface) bg-(--color-text) rounded-md hover:opacity-90 disabled:opacity-35 transition-all shadow-xs outline-none"
                  >
                    {isVerifyingOtp ? <Loader2 size={14} className="animate-spin" /> : "Conferma"}
                  </button>
                </div>
                
                {/* Nuova sezione "Reinvia Codice" */}
                <div className="flex justify-between items-center mt-1.5 pt-2 border-t border-(--color-border)">
                  <span className="text-xs text-(--color-muted) font-light">
                    Non hai ricevuto il codice?
                  </span>
                  <button
                    type="button"
                    disabled={countdown > 0 || isSendingOtp}
                    className="text-xs font-bold uppercase tracking-widest text-(--color-text) transition-all hover:opacity-80 disabled:opacity-35 outline-none"
                    onClick={sendOtp}
                  >
                    {isSendingOtp ? "Invio..." : countdown > 0 ? `Invia di nuovo tra ${countdown}s` : "Invia di nuovo"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Informativa Privacy GDPR */}
          <p className="text-[11px] leading-relaxed text-(--color-muted) font-light mt-1 flex items-start gap-2">
            <svg 
              className="w-4 h-4 text-(--color-muted) shrink-0 mt-0.5" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth={2} 
              viewBox="0 0 24 24" 
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>
              Il tuo numero di telefono sarà trattato esclusivamente per garantire la sicurezza dell'account e prevenirne la duplicazione. Non verrà in alcun caso ceduto a terzi né utilizzato per finalità commerciali o di marketing (Reg. UE 2016/679 - GDPR).
            </span>
          </p>
        </div>

        <div className="hidden lg:block mt-2 flex-1 max-h-[30vh] rounded-lg overflow-hidden border border-(--color-border) shadow-(--shadow-soft) bg-(--color-surface)">
          <video
            src="/demo4.mp4"
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
            <label htmlFor={roleId} className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) ml-1">
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
                <label htmlFor="role-other" className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted) ml-1">
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
            {consentItems.map((item) => {
              const checked = consents[item.key as keyof typeof consents];
              const checkboxId = `consent-${item.key}`;

              return (
                <div key={item.key} className="flex items-start gap-3 p-3.5 rounded-md border border-(--color-border) bg-(--color-surface) shadow-xs">
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
                      <Link
                        to={item.link}
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
                      </Link>
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
          disabled={isSaving || !isPhoneVerified}
          className="w-full rounded-md bg-(--color-text) text-(--color-surface) px-4 py-3 text-xs font-bold uppercase tracking-widest disabled:opacity-35 disabled:cursor-not-allowed hover:opacity-90 transition-all shadow-xs outline-none flex items-center justify-center gap-2 mt-4"
        >
          {isSaving && <Loader2 size={14} className="animate-spin" />}
          <span>
            {isSaving 
              ? "Salvataggio in corso..." 
              : !isPhoneVerified 
                ? "Verifica il numero per iniziare" 
                : "Inizia la tua settimana di prova gratuita"}
          </span>
        </button>
      </motion.div>
    </main>
  );
};