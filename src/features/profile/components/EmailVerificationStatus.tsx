import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { FiCheckCircle, FiAlertCircle } from "react-icons/fi";
import { useAuth } from "@/context/useAuth";
import { sendVerificationEmail } from "@/features/auth/hooks/auth";

const RESEND_COOLDOWN_SECONDS = 60;

const linkBtn =
  "text-xs font-bold uppercase tracking-widest text-(--color-text) underline underline-offset-2 hover:opacity-80 transition-opacity disabled:opacity-35 disabled:cursor-not-allowed disabled:no-underline outline-none";

/**
 * Stato di verifica dell'email nel profilo: badge se verificata, altrimenti
 * invio del link di conferma e ricontrollo dello stato.
 */
export const EmailVerificationStatus: React.FC = () => {
  const { user, refreshUser } = useAuth();
  const [isSending, setIsSending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const isVerified = Boolean(user?.emailVerified);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  const check = useCallback(
    async (silent: boolean) => {
      if (!silent) setIsChecking(true);
      try {
        const refreshed = await refreshUser();
        if (refreshed?.emailVerified) {
          toast.success("Email verificata!");
        } else if (!silent) {
          toast.error("L'indirizzo non risulta ancora confermato. Controlla la tua casella di posta.");
        }
      } catch (err) {
        console.error("[EmailVerificationStatus] Refresh utente fallito:", err);
        if (!silent) toast.error("Impossibile verificare lo stato. Riprova.");
      } finally {
        if (!silent) setIsChecking(false);
      }
    },
    [refreshUser]
  );

  // Dopo l'invio, quando l'utente torna sulla scheda ricontrolla in automatico.
  useEffect(() => {
    if (!sent || isVerified) return;
    const onVisible = () => {
      if (document.visibilityState === "visible") void check(true);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [sent, isVerified, check]);

  if (!user?.email || user.isAnonymous) return null;

  if (isVerified) {
    return (
      <div
        data-testid="email-verified"
        className="w-full flex items-center gap-3 px-4 py-3 rounded-md border border-(--color-border) bg-(--color-surface) shadow-xs text-left"
      >
        <FiCheckCircle className="shrink-0 text-green-600 dark:text-green-400" aria-hidden="true" />
        <p className="text-xs sm:text-sm text-(--color-text) min-w-0">
          <span className="font-bold uppercase tracking-wider text-[11px] mr-2">Email verificata</span>
          <span className="font-light text-(--color-muted) break-all">{user.email}</span>
        </p>
      </div>
    );
  }

  const resend = async () => {
    if (isSending || cooldown > 0) return;
    setIsSending(true);
    try {
      const { alreadyVerified } = await sendVerificationEmail();
      if (alreadyVerified) {
        await check(true);
        return;
      }
      setSent(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
      toast.success("Ti abbiamo inviato l'email di conferma.");
    } catch (err) {
      if (err instanceof Error && err.message === "rate_limited") {
        setCooldown(RESEND_COOLDOWN_SECONDS);
        toast.error("Hai richiesto troppe email. Attendi qualche minuto e riprova.");
      } else {
        toast.error("Invio non riuscito. Riprova tra poco.");
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      data-testid="email-unverified"
      className="w-full flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3 rounded-md border border-amber-500/40 bg-amber-500/5 shadow-xs text-left"
    >
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <FiAlertCircle className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        <p className="text-xs sm:text-sm text-(--color-text) min-w-0">
          <span className="font-bold uppercase tracking-wider text-[11px] mr-2">Email non verificata</span>
          <span className="font-light text-(--color-muted) break-all">{user.email}</span>
          {sent && (
            <span className="block mt-1 font-light text-(--color-muted)">
              Apri il link che ti abbiamo inviato per confermare l'indirizzo.
            </span>
          )}
        </p>
      </div>

      <div className="flex items-center gap-4 shrink-0 pl-7 sm:pl-0">
        {sent && (
          <button type="button" onClick={() => void check(false)} disabled={isChecking} className={linkBtn}>
            {isChecking ? "Controllo..." : "Ho confermato"}
          </button>
        )}
        <button
          type="button"
          onClick={() => void resend()}
          disabled={isSending || cooldown > 0}
          className={`${linkBtn} inline-flex items-center gap-1.5`}
        >
          {isSending && <Loader2 size={12} className="animate-spin" />}
          {cooldown > 0 ? `Reinvia tra ${cooldown}s` : sent ? "Reinvia email" : "Verifica email"}
        </button>
      </div>
    </div>
  );
};
