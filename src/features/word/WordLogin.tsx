import { CheckCircle2, Loader2, MonitorSmartphone, ShieldX, TriangleAlert } from "lucide-react";
import { useAuth } from "@/context/useAuth";
import { useWordLogin } from "./hooks/useWordLogin";

const primaryBtn =
  "w-full flex justify-center items-center gap-2 py-3 px-4 bg-(--color-text) text-(--color-surface) text-sm font-semibold rounded-md hover:opacity-90 transition-all shadow-xs disabled:opacity-40 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-(--color-primary)";
const secondaryBtn =
  "w-full flex justify-center items-center gap-2 py-3 px-4 bg-(--color-surface) border border-(--color-border) text-(--color-text) text-sm font-semibold rounded-md hover:border-(--color-text) transition-colors disabled:opacity-40 disabled:cursor-not-allowed outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-(--color-primary)";

function Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-(--color-bg) p-4">
      <div className="relative max-w-md w-full bg-(--color-surface) border border-(--color-border) rounded-lg shadow-(--shadow-soft) p-6 sm:p-8 text-center overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90" />
        <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-md border border-(--color-border) bg-(--color-bg) mb-5 mt-1 text-(--color-text) opacity-80">
          {icon}
        </div>
        <h1 className="text-xl sm:text-2xl font-medium text-(--color-text) tracking-tight mb-2" style={{ fontFamily: "var(--font-serif)" }}>
          {title}
        </h1>
        {children}
      </div>
    </main>
  );
}

/** /word-login — l'utente autorizza il pannello Jurio in Microsoft Word ad accedere al suo account. */
export default function WordLogin() {
  const { user } = useAuth();
  const { phase, code, error, approve, deny } = useWordLogin();

  if (phase === "loading") {
    return (
      <Card icon={<Loader2 className="h-6 w-6 animate-spin" aria-hidden />} title="Verifica della richiesta">
        <p className="text-sm text-(--color-muted)" role="status">
          Un momento…
        </p>
      </Card>
    );
  }

  if (phase === "approved") {
    return (
      <Card icon={<CheckCircle2 className="h-6 w-6 text-(--color-primary)" aria-hidden />} title="Word è collegato">
        <p className="text-sm text-(--color-muted) leading-relaxed">
          Puoi chiudere questa finestra e tornare a Microsoft Word: il pannello Jurio completa l&apos;accesso da solo.
        </p>
      </Card>
    );
  }

  if (phase === "denied") {
    return (
      <Card icon={<ShieldX className="h-6 w-6" aria-hidden />} title="Accesso rifiutato">
        <p className="text-sm text-(--color-muted) leading-relaxed">
          La richiesta è stata annullata e nessun dispositivo è stato collegato al tuo account.
        </p>
      </Card>
    );
  }

  if (phase === "error") {
    return (
      <Card icon={<TriangleAlert className="h-6 w-6" aria-hidden />} title="Impossibile completare">
        <p role="alert" className="text-sm text-(--color-muted) leading-relaxed">
          {error}
        </p>
      </Card>
    );
  }

  const busy = phase === "submitting";
  return (
    <Card icon={<MonitorSmartphone className="h-6 w-6" aria-hidden />} title="Collega Microsoft Word">
      <p className="text-sm text-(--color-muted) leading-relaxed">
        Il pannello Jurio in Word chiede di accedere al tuo account
        {user?.email ? (
          <>
            {" "}
            <strong className="text-(--color-text) font-semibold">{user.email}</strong>
          </>
        ) : null}
        .
      </p>

      <div className="my-6 rounded-md border border-(--color-border) bg-(--color-bg) px-4 py-4">
        <p className="text-xs uppercase tracking-widest text-(--color-muted) mb-1">Codice di conferma</p>
        <p className="text-3xl font-semibold tracking-[0.2em] text-(--color-text) font-mono" aria-label={`Codice ${code.split("").join(" ")}`}>
          {code}
        </p>
        <p className="text-xs text-(--color-muted) mt-2">Deve coincidere con il codice mostrato nel pannello di Word.</p>
      </div>

      <div className="flex flex-col gap-3">
        <button type="button" className={primaryBtn} onClick={() => void approve()} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Autorizza Word
        </button>
        <button type="button" className={secondaryBtn} onClick={() => void deny()} disabled={busy}>
          Non sono stato io
        </button>
      </div>

      <p className="text-xs text-(--color-muted) mt-5 leading-relaxed">
        Se non hai appena avviato l&apos;accesso da Word o i codici sono diversi, non autorizzare.
      </p>
    </Card>
  );
}
