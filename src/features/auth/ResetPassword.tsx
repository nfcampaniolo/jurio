import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, KeyRound, ShieldCheck, ShieldAlert } from "lucide-react";
import { HiOutlineEye, HiOutlineEyeOff } from "react-icons/hi";
import { Input } from "@/shared/components/Input";
import { AuthLoader } from "@/routes/AuthLoader";
import { SEO } from "@/shared/components/SEO";
import { useResetPasswordLogic } from "./hooks/useResetPasswordLogic";
import { PASSWORD_REQUIREMENTS } from "./passwordRules";

const primaryBtn =
  "w-full flex justify-center items-center gap-2 py-2.5 px-4 bg-(--color-text) text-(--color-surface) text-xs font-bold uppercase tracking-widest rounded-md hover:opacity-90 transition-all shadow-xs disabled:opacity-35 disabled:cursor-not-allowed outline-none";

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-(--color-bg) p-4">
      <SEO title="Reimposta password" description="Reimposta la password del tuo account Jurio." path="/reimposta-password" noIndex />
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

export default function ResetPassword() {
  const {
    phase,
    email,
    password,
    setPassword,
    confirm,
    setConfirm,
    failures,
    mismatch,
    canSubmit,
    submitting,
    error,
    submit,
  } = useResetPasswordLogic();
  const [showPassword, setShowPassword] = useState(false);

  if (phase === "checking") return <AuthLoader />;

  if (phase === "done") {
    return (
      <Card icon={<ShieldCheck className="h-6 w-6" />} title="Password aggiornata">
        <p className="text-xs sm:text-sm text-(--color-muted) font-light mb-6 leading-relaxed">
          La tua password è stata reimpostata. Ora puoi accedere con la nuova password.
        </p>
        <Link to="/login" replace className={primaryBtn}>
          Accedi
        </Link>
      </Card>
    );
  }

  if (phase === "invalid") {
    return (
      <Card icon={<ShieldAlert className="h-6 w-6" />} title="Link non valido o scaduto">
        <p className="text-xs sm:text-sm text-(--color-muted) font-light mb-6 leading-relaxed">
          Il link per reimpostare la password non è più valido: potrebbe essere scaduto o essere già stato usato.
          Richiedine uno nuovo dalla pagina di accesso con "Password dimenticata".
        </p>
        <Link to="/login" replace className={primaryBtn}>
          Vai all'accesso
        </Link>
      </Card>
    );
  }

  const passwordType = showPassword ? "text" : "password";

  return (
    <Card icon={<KeyRound className="h-6 w-6" />} title="Scegli una nuova password">
      <p className="text-xs sm:text-sm text-(--color-muted) font-light mb-6 leading-relaxed">
        Stai reimpostando la password per <span className="font-medium text-(--color-text) break-all">{email}</span>
      </p>

      <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-4 text-left">
        <div className="relative">
          <label htmlFor="reset-password" className="sr-only">Nuova password</label>
          <Input
            id="reset-password"
            type={passwordType}
            placeholder="Nuova password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-(--color-muted) hover:text-(--color-text)"
            aria-label={showPassword ? "Nascondi password" : "Mostra password"}
          >
            {showPassword ? <HiOutlineEyeOff size={18} /> : <HiOutlineEye size={18} />}
          </button>
        </div>

        <div>
          <label htmlFor="reset-password-confirm" className="sr-only">Conferma nuova password</label>
          <Input
            id="reset-password-confirm"
            type={passwordType}
            placeholder="Conferma nuova password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          {mismatch && <p className="mt-1.5 ml-1 text-xs text-red-600 dark:text-red-400">Le password non coincidono.</p>}
        </div>

        <ul className="flex flex-col gap-1 ml-1" aria-label="Requisiti password">
          {PASSWORD_REQUIREMENTS.map(({ message }) => {
            const ok = password.length > 0 && !failures.includes(message);
            return (
              <li key={message} className={`text-xs font-light ${ok ? "text-green-600 dark:text-green-400" : "text-(--color-muted)"}`}>
                {ok ? "✓" : "•"} {message}
              </li>
            );
          })}
        </ul>

        {error && <p role="alert" className="text-xs text-red-600 dark:text-red-400">{error}</p>}

        <button type="submit" disabled={!canSubmit} className={`${primaryBtn} mt-2`}>
          {submitting && <Loader2 size={14} className="animate-spin" />}
          <span>{submitting ? "Salvataggio..." : "Salva nuova password"}</span>
        </button>
      </form>
    </Card>
  );
}
