import { useNavigate } from "react-router-dom";

export default function BillingCancel() {
  const navigate = useNavigate();

  return (
    <div className="min-h-[calc(100vh-4rem)] w-full px-4 py-10 sm:py-14">
      <div className="mx-auto max-w-lg">
        <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm dark:border-neutral-800 dark:bg-neutral-950">
          {/* header */}
          <div className="flex items-start gap-4 border-b border-neutral-200 px-6 py-5 dark:border-neutral-800">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-neutral-100 text-neutral-900 dark:bg-neutral-900 dark:text-neutral-100">
              ✕
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-neutral-900 dark:text-neutral-100">
                Pagamento annullato
              </h1>
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
                Nessun addebito è stato effettuato. Puoi riprovare in qualsiasi momento.
              </p>
            </div>
          </div>

          {/* body */}
          <div className="px-6 py-6">
            <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-700 dark:border-neutral-800 dark:bg-neutral-900/40 dark:text-neutral-300">
              Se hai annullato per un errore o un dubbio, puoi tornare ai piani e completare il pagamento più tardi.
            </div>

            {/* actions */}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => navigate("/profilo/piani")}
                className="inline-flex w-full items-center justify-center rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-neutral-800 active:scale-[0.99] disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
              >
                Riprova
              </button>

              <button
                type="button"
                onClick={() => navigate("/profilo")}
                className="inline-flex w-full items-center justify-center rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 shadow-sm hover:bg-neutral-50 active:scale-[0.99] dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-100 dark:hover:bg-neutral-900"
              >
                Torna alla home
              </button>
            </div>

            <div className="mt-4 text-xs text-neutral-500 dark:text-neutral-500">
              Hai bisogno di aiuto? Contatta il supporto dalla sezione <span className="font-medium">Contatti</span>.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}