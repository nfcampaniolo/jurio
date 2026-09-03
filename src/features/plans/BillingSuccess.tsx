import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { getDb } from "@/infrastructure/db";
import { useAuth } from "@/context/useAuth";

type RegisterDoc = {
  status?: "active" | "prova" | string;
  provider?: "stripe" | "paypal" | string;
  planId?: string;
  stripeSessionId?: string;
};

type ViewState = "waiting" | "ok" | "error";

export default function BillingSuccess() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const sessionId = params.get("session_id") ?? "";
  const uid = user?.uid ?? "";

  const [state, setState] = useState<ViewState>("waiting");

  const title = useMemo(() => {
    if (state === "ok") return "Pagamento completato";
    if (state === "error") return "Verifica non riuscita";
    return "Pagamento in elaborazione…";
  }, [state]);

  useEffect(() => {
    if (!uid) return;

    let unsub: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      try {
        const db = await getDb();
        if (cancelled) return;

        const ref = doc(db, "register", uid);

        unsub = onSnapshot(
          ref,
          (snap) => {
            if (!snap.exists()) return;

            const data = snap.data() as RegisterDoc;

            const ok =
              data.status === "active" &&
              data.provider === "stripe" &&
              (!sessionId || data.stripeSessionId === sessionId);

            if (ok) {
              setState("ok");
              window.setTimeout(() => navigate("/profilo"), 1200);
            }
          },
          (err) => {
            console.error("BillingSuccess snapshot error:", err);
            setState("error");
          }
        );
      } catch (err) {
        console.error("BillingSuccess init error:", err);
        setState("error");
      }
    })();

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, [uid, sessionId, navigate]);

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-lg">
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          {/* header */}
          <div className="flex items-start gap-4 border-b border-neutral-200 px-6 py-5 dark:border-neutral-800">
            <div
              className={[
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
                state === "ok"
                  ? "bg-stone-50 text-yellow-700 dark:bg-stone-950/30 dark:text-yellow-300"
                  : state === "error"
                  ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
                  : "bg-neutral-100 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100",
              ].join(" ")}
              aria-hidden="true"
            >
              {state === "ok" ? "✓" : state === "error" ? "!" : "…"}
            </div>

            <div className="min-w-0">
              <h1 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">{title}</h1>

              {state === "waiting" && (
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  Stiamo confermando il pagamento e attivando il piano. Attendi qualche secondo.
                </p>
              )}

              {state === "ok" && (
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  Piano attivato. Reindirizzamento al profilo…
                </p>
              )}

              {state === "error" && (
                <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                  Il pagamento potrebbe essere stato ricevuto, ma l’attivazione non è ancora confermata.
                </p>
              )}
            </div>
          </div>

          {/* body */}
          <div className="px-6 py-6">
            {state === "waiting" && (
              <>
                <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-300">
                  Se chiudi questa pagina, puoi comunque verificare lo stato dal profilo.
                </div>

                <div className="mt-5">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                    <div className="h-full w-1/3 animate-pulse rounded-full bg-neutral-900 dark:bg-neutral-100" />
                  </div>
                  <div className="mt-2 text-xs text-neutral-500 dark:text-neutral-500">
                    Sessione: <span className="font-mono">{sessionId || "—"}</span>
                  </div>
                </div>

                <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => navigate("/profilo")}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 active:scale-[0.99] dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
                  >
                    Vai al profilo
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/profilo/piani")}
                    className="inline-flex w-full items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-neutral-50 active:scale-[0.99] dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900"
                  >
                    Torna ai piani
                  </button>
                </div>
              </>
            )}

            {state === "ok" && (
              <>
                <div className="rounded-xl border border-yellow-200 bg-stone-50 p-4 text-sm text-yellow-800 dark:border-yellow-900/40 dark:bg-stone-950/30 dark:text-yellow-200">
                  Attivazione completata. Tra poco verrai reindirizzato automaticamente.
                </div>

                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => navigate("/profilo")}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 active:scale-[0.99] dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
                  >
                    Vai al profilo ora
                  </button>
                </div>
              </>
            )}

            {state === "error" && (
              <>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                  Verifica non riuscita. Se hai già pagato, il webhook potrebbe essere in ritardo: riprova tra poco.
                </div>

                <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={() => navigate("/profilo")}
                    className="inline-flex w-full items-center justify-center rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 active:scale-[0.99] dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
                  >
                    Vai al profilo
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/profilo/piani")}
                    className="inline-flex w-full items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-neutral-50 active:scale-[0.99] dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900"
                  >
                    Torna ai piani
                  </button>
                </div>

                <div className="mt-4 text-xs text-neutral-500 dark:text-neutral-500">
                  Sessione: <span className="font-mono">{sessionId || "—"}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}