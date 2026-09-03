import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center bg-(--color-surface) text-(--color-text) overflow-hidden">
      {/* LA LINEA DI RIGORE SUPERIORE (Unico tocco di colore) */}
      <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

      <h1 className="text-6xl sm:text-7xl font-medium tracking-tight">404</h1>

      <p className="mt-3 text-base sm:text-lg font-medium text-(--color-text) tracking-tight">
        Pagina non trovata
      </p>

      <p className="mt-2 max-w-md text-xs sm:text-sm text-(--color-muted) font-light leading-relaxed">
        L’indirizzo che hai inserito non esiste oppure è stato spostato.
      </p>

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/chat")}
          className="rounded-md bg-(--color-text) text-(--color-surface) px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all outline-none shadow-xs"
        >
          Torna alla home
        </button>

        <button
          type="button"
          onClick={() => navigate(-1)}
          className="rounded-md border border-(--color-border) bg-(--color-surface) text-(--color-text) px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:border-(--color-text) transition-colors outline-none shadow-xs"
        >
          Torna indietro
        </button>

        <button
          type="button"
          onClick={() => navigate("/ricerca")}
          className="px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-(--color-muted) hover:text-(--color-text) transition-colors underline underline-offset-2 outline-none"
        >
          Vai alla ricerca
        </button>
      </div>
    </div>
  );
}