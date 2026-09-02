import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import { createContact } from "@/services/contact";
// RIMOSSO: import { Loader2 } from "lucide-react";

export type FormState = {
  name: string;
  email: string;
  subject: string;
  message: string;
  consent: boolean;
  website: string; // honeypot
};

export type StatusState =
  | { state: "idle" }
  | { state: "submitting" }
  | { state: "success"; id: string }
  | { state: "error"; message: string };

export type FieldKey = "name" | "email" | "subject" | "message" | "consent";

const initialState: FormState = {
  name: "", email: "", subject: "", message: "", consent: false, website: ""
};

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cx(
        "w-full px-3.5 py-2.5 rounded-md border border-(--color-border) bg-(--color-bg) text-sm text-(--color-text) font-light placeholder:text-(--color-muted) outline-none focus:border-(--color-text) transition-colors",
        props.className
      )}
    />
  );
}

const SuccessIcon = () => (
  <svg className="w-8 h-8 text-(--color-text) opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <motion.path
      initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, ease: "easeInOut", delay: 0.2 }}
      strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

// NUOVO: Spinner SVG ultraleggero
const SpinnerIcon = () => (
  <svg className="animate-spin h-3.5 w-3.5 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export const SupportForm: React.FC = () => {
  const [form, setForm] = useState<FormState>(initialState);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [status, setStatus] = useState<StatusState>({ state: "idle" });

  const errors = useMemo<Partial<Record<FieldKey, string>>>(() => {
    const e: Partial<Record<FieldKey, string>> = {};
    if (!form.name.trim()) e.name = "Nome richiesto";
    if (!form.email.trim() || !isValidEmail(form.email)) e.email = "Email non valida";
    if (!form.subject.trim()) e.subject = "Oggetto richiesto";
    if (form.message.trim().length < 10) e.message = "Descrivi meglio il problema (min. 10 caratteri)";
    if (!form.consent) e.consent = "Necessario per gestire il ticket";
    return e;
  }, [form]);

  const hasErrors = useMemo(() => Object.keys(errors).length > 0, [errors]);
  const disabled = status.state === "submitting";

  const onChange = <K extends keyof FormState>(key: K) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = e.target.type === "checkbox" ? (e.target as HTMLInputElement).checked : e.target.value;
      setForm((prev) => ({ ...prev, [key]: value as FormState[K] }));
      if (status.state === "success") setStatus({ state: "idle" });
    };

  const onBlur = (key: FieldKey) => () => setTouched((t) => ({ ...t, [key]: true }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (disabled) return;
    
    if (form.website.trim().length > 0) {
      const msg = "Azione non consentita.";
      setStatus({ state: "error", message: msg });
      toast.error(msg);
      return;
    }

    setTouched({ name: true, email: true, subject: true, message: true, consent: true });
    
    if (hasErrors) {
      const msg = "Controlla i campi evidenziati.";
      setStatus({ state: "error", message: msg });
      toast.error(msg);
      return;
    }

    setStatus({ state: "submitting" });

    try {
      const userAgent = typeof window !== "undefined" ? window.navigator.userAgent : "Unknown";
      const id = await createContact({ 
        ...form, 
        page: "/contatti",
        userAgent 
      });
      
      setStatus({ state: "success", id });
      toast.success("Ticket creato con successo!");
      setForm(initialState);
      setTouched({});
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : "Errore nell'invio.";
      setStatus({ state: "error", message: errorMessage });
      toast.error(errorMessage);
      console.error(err);
    }
  }

  const show = (key: FieldKey) => Boolean(touched[key] && errors[key]);
  const labelCls = "text-[10px] font-bold uppercase tracking-widest text-(--color-muted) mb-1.5 block ml-1";
  const errorTextCls = "mt-1.5 text-xs font-light text-red-600 dark:text-red-400 ml-1";

  return (
    <section className="lg:col-span-7 space-y-8">
      <div className="relative p-6 sm:p-8 bg-(--color-surface) border border-(--color-border) rounded-lg shadow-(--shadow-soft) overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

        <div className="mt-1 mb-8">
          <h1 className="text-2xl sm:text-3xl font-medium text-(--color-text) tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>
            Supporto <span className="opacity-90">Jurio</span>
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-(--color-muted) font-light leading-relaxed">
            Il nostro team è pronto ad aiutarti. Invia una richiesta dettagliata o interagisci con il nostro assistente AI per una soluzione immediata.
          </p>
        </div>

        <div aria-live="polite" className="min-h-10 mb-6">
          <AnimatePresence mode="wait">
            {status.state === "error" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-4 bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 rounded-md text-xs font-light" role="alert">
                {status.message}
              </motion.div>
            )}
            {status.state === "success" && (
              <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="flex gap-4 p-5 border border-(--color-border) bg-(--color-bg) rounded-md shadow-xs items-center" role="status">
                <SuccessIcon />
                <div>
                  <p className="text-sm font-medium text-(--color-text) tracking-tight" style={{ fontFamily: 'var(--font-serif)' }}>Ticket inviato.</p>
                  <p className="text-xs text-(--color-muted) font-light mt-0.5">Controlla la tua email per la conferma. ID: <span className="font-mono text-(--color-text) font-semibold">{status.id}</span></p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <form onSubmit={onSubmit} className="space-y-5">
          <input 
            type="text" 
            name="bot_field" 
            autoComplete="off"
            tabIndex={-1}
            className="hidden" 
            aria-hidden="true" 
            value={form.website} 
            onChange={onChange("website")} 
          />

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label className={labelCls} htmlFor="name">Nome Completo</label>
              <Input
                id="name" name="name" type="text" placeholder="Mario Rossi"
                value={form.name} onChange={onChange("name")} onBlur={onBlur("name")} disabled={disabled}
                className={show("name") ? "border-red-500/50" : ""}
                aria-invalid={show("name")}
              />
              {show("name") && <p className={errorTextCls}>{errors.name}</p>}
            </div>
            <div>
              <label className={labelCls} htmlFor="email">Email Account</label>
              <Input
                id="email" name="email" type="email" placeholder="mario@esempio.it"
                value={form.email} onChange={onChange("email")} onBlur={onBlur("email")} disabled={disabled}
                className={show("email") ? "border-red-500/50" : ""}
                aria-invalid={show("email")}
              />
              {show("email") && <p className={errorTextCls}>{errors.email}</p>}
            </div>
          </div>

          <div>
            <label className={labelCls} htmlFor="subject">Oggetto della richiesta</label>
            <Input
              id="subject" name="subject" type="text" placeholder="Es. Problema accesso, Bug report..."
              value={form.subject} onChange={onChange("subject")} onBlur={onBlur("subject")} disabled={disabled}
              className={show("subject") ? "border-red-500/50" : ""}
              aria-invalid={show("subject")}
            />
            {show("subject") && <p className={errorTextCls}>{errors.subject}</p>}
          </div>

          <div>
            <label className={labelCls} htmlFor="message">Descrizione del problema</label>
            <textarea
              id="message" name="message" rows={5}
              placeholder="Fornisci quanti più dettagli possibili..."
              value={form.message} onChange={onChange("message")} onBlur={onBlur("message")} disabled={disabled}
              className={cx(
                "w-full px-3.5 py-2.5 rounded-md border border-(--color-border) bg-(--color-bg) text-sm text-(--color-text) font-light placeholder:text-(--color-muted) outline-none focus:border-(--color-text) transition-colors resize-y min-h-36",
                show("message") ? "border-red-500/50" : ""
              )}
              aria-invalid={show("message")}
            />
            {show("message") && <p className={errorTextCls}>{errors.message}</p>}
          </div>

          <div className={cx("flex items-start gap-3.5 p-4 rounded-md transition-all border", show("consent") ? "bg-red-500/10 border-red-500/30" : "bg-(--color-bg) border-(--color-border)")}>
            <input
              id="consent" name="consent" type="checkbox" checked={form.consent} onChange={onChange("consent")}
              className="mt-0.5 h-4 w-4 rounded border-(--color-border) text-(--color-text) focus:ring-0 cursor-pointer accent-(--color-text)"
              aria-invalid={show("consent")}
            />
            <div className="text-xs">
              <label htmlFor="consent" className="font-bold uppercase tracking-wider text-(--color-text) cursor-pointer">Privacy Policy</label>
              <p className="text-(--color-muted) font-light mt-0.5 leading-relaxed">Acconsento al trattamento dei dati per la gestione del ticket.</p>
              {show("consent") && <p className={errorTextCls}>{errors.consent}</p>}
            </div>
          </div>

          <button
            type="submit"
            disabled={disabled}
            className="w-full rounded-md bg-(--color-text) text-(--color-surface) px-4 py-3 text-xs font-bold uppercase tracking-widest disabled:opacity-35 disabled:cursor-not-allowed hover:opacity-90 transition-all outline-none shadow-xs flex items-center justify-center gap-2 mt-2"
          >
            {disabled && <SpinnerIcon />}
            <span>{disabled ? "Invio in corso..." : "Apri Ticket di Supporto"}</span>
          </button>
        </form>
      </div>
    </section>
  );
};