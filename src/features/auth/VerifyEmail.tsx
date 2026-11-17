import { Link, Navigate } from "react-router-dom";
import { Loader2, MailCheck, MailWarning, Mail } from "lucide-react";
import { AuthLoader } from "@/routes/AuthLoader";
import { useVerifyEmailLogic } from "./hooks/useVerifyEmailLogic";
import { needsEmailVerification } from "./hooks/auth";

const primaryBtn =
  "w-full flex justify-center items-center gap-2 py-2.5 px-4 bg-(--color-text) text-(--color-surface) text-xs font-bold uppercase tracking-widest rounded-md hover:opacity-90 transition-all shadow-xs disabled:opacity-35 disabled:cursor-not-allowed outline-none";
const secondaryBtn =
  "w-full flex justify-center items-center gap-2 py-2.5 px-4 bg-(--color-surface) border border-(--color-border) text-(--color-text) text-xs font-bold uppercase tracking-widest rounded-md hover:border-(--color-text) transition-colors disabled:opacity-35 disabled:cursor-not-allowed outline-none shadow-xs";

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-(--color-bg) p-4">
      <div className="relative max-w-md w-full bg-(--color-surface) border border-(--color-border) rounded-lg shadow-(--shadow-soft) p-6 sm:p-8 text-center overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
        <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-md border border-(--color-border) bg-(--color-bg) mb-5 mt-1 text-(--color-text) opacity-80">
          {icon}
        </div>
        <h1 className="text-xl sm:text-2xl font-medium text-(--color-text) tracking-tight mb-2">{title}</h1>
        {children}
      </div>
    </main>
  );
}

export default function VerifyEmail() {
  const {
    phase,
    user,
    status,
    hasProfile,
    cooldown,
    isSending,
    isChecking,
    resend,
    checkVerification,
    switchAccount,
  } = useVerifyEmailLogic();

  if (phase === "verifying" || status === "loading") return <AuthLoader />;

  if (phase === "verified") {
    const loggedIn = status === "authenticated" && !!user && !user.isAnonymous;
    const cta = !loggedIn
      ? { to: "/login", label: "Accedi", text: "Accedi per continuare." }
      : hasProfile
        ? { to: "/profilo", label: "Torna al profilo", text: "" }
        : { to: "/registrati", label: "Completa la registrazione", text: "Completa la registrazione per attivare la prova gratuita." };
    return (
      <Card icon={<MailCheck className="h-6 w-6" />} title="Email confermata">
        <p className="text-xs sm:text-sm text-(--color-muted) font-light mb-6 leading-relaxed">
          Il tuo indirizzo email è stato verificato. {cta.text}
        </p>
        <Link to={cta.to} replace className={primaryBtn}>
          {cta.label}
        </Link>
      </Card>
    );
  }

  const canResend = status === "authenticated" && needsEmailVerification(user);

  if (phase === "invalid") {
    return (
      <Card icon={<MailWarning className="h-6 w-6" />} title="Link non valido o scaduto">
        <p className="text-xs sm:text-sm text-(--color-muted) font-light mb-6 leading-relaxed">
          Il link di conferma non è più valido: potrebbe essere scaduto o essere già stato utilizzato.
          {canResend ? " Puoi richiederne uno nuovo." : " Accedi per richiederne uno nuovo."}
        </p>
        {canResend ? (
          <button type="button" onClick={resend} disabled={isSending || cooldown > 0} className={primaryBtn}>
            {isSending && <Loader2 size={14} className="animate-spin" />}
            <span>{cooldown > 0 ? `Invia di nuovo tra ${cooldown}s` : "Invia un nuovo link"}</span>
          </button>
        ) : (
          <Link to="/login" replace className={primaryBtn}>
            Accedi
          </Link>
        )}
      </Card>
    );
  }

  // phase === "pending": serve un account email/password ancora da verificare
  if (status !== "authenticated" || !user || user.isAnonymous) return <Navigate to="/login" replace />;
  if (!needsEmailVerification(user)) return <Navigate to="/registrati" replace />;
  if (hasProfile === null) return <AuthLoader />;
  if (hasProfile) return <Navigate to="/profilo" replace />;

  return (
    <Card icon={<Mail className="h-6 w-6" />} title="Conferma la tua email">
      <p className="text-xs sm:text-sm text-(--color-muted) font-light mb-2 leading-relaxed">
        Ti abbiamo inviato un link di conferma all'indirizzo
      </p>
      <p className="text-sm font-medium text-(--color-text) mb-4 break-all">{user.email}</p>
      <p className="text-xs sm:text-sm text-(--color-muted) font-light mb-6 leading-relaxed">
        Apri l'email e clicca su <strong>Conferma email</strong> per completare la registrazione. Se non la trovi,
        controlla la cartella spam o promozioni.
      </p>

      <div className="space-y-3">
        <button type="button" onClick={checkVerification} disabled={isChecking} className={primaryBtn}>
          {isChecking && <Loader2 size={14} className="animate-spin" />}
          <span>Ho confermato l'email</span>
        </button>
        <button type="button" onClick={resend} disabled={isSending || cooldown > 0} className={secondaryBtn}>
          {isSending && <Loader2 size={14} className="animate-spin" />}
          <span>{cooldown > 0 ? `Invia di nuovo tra ${cooldown}s` : "Invia di nuovo l'email"}</span>
        </button>
      </div>

      <hr className="my-6 border-(--color-border)" />

      <p className="text-xs text-(--color-muted) font-light">
        Indirizzo sbagliato?{" "}
        <button
          type="button"
          onClick={switchAccount}
          className="text-(--color-text) font-bold underline underline-offset-2 hover:opacity-80 transition-opacity"
        >
          Usa un altro account
        </button>
      </p>
    </Card>
  );
}
