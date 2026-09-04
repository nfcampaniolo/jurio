import { type ReactNode } from "react";
import { AlertCircle, RotateCw } from "lucide-react";

interface ErrorScreenProps {
  message?: string;
  details?: string | null;
  onRetry?: () => void;
  icon?: ReactNode;
}

export const ErrorScreen = ({
  message = "Si è verificato un errore imprevisto.",
  details,
  onRetry,
  icon,
}: ErrorScreenProps) => {
  // Se non viene passata una funzione custom, il default è ricaricare la pagina
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-(--color-bg) text-(--color-text) text-center">
      <div className="relative max-w-md w-full bg-(--color-surface) rounded-lg border border-(--color-border) shadow-(--shadow-soft) p-6 sm:p-8 flex flex-col items-center overflow-hidden">
        {/* LA LINEA DI RIGORE SUPERIORE (Unico tocco di colore) */}
        <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />
        
        {/* Icona */}
        <div className="w-12 h-12 rounded-md border border-(--color-border) bg-(--color-bg) text-(--color-text) flex items-center justify-center mb-5 mt-1 shadow-xs">
          {icon ? (
            icon
          ) : (
            <AlertCircle size={22} className="opacity-80" />
          )}
        </div>

        {/* Titolo Principale */}
        <h2 className="text-lg sm:text-xl font-medium tracking-tight mb-2" style={{ fontFamily: 'var(--font-serif)' }}>
          Ops, qualcosa è andato storto
        </h2>

        {/* Messaggio User-Friendly */}
        <p className="text-xs sm:text-sm text-(--color-muted) font-light leading-relaxed mb-6">
          {message}
        </p>

        {/* Dettagli Tecnici */}
        {details && (
          <div className="w-full bg-(--color-bg) text-(--color-muted) text-xs text-left p-3 rounded-md mb-6 overflow-auto border border-(--color-border) shadow-xs">
            <span className="font-bold uppercase tracking-wider block mb-1 text-[10px] text-(--color-text)">Dettagli errore:</span>
            <code className="wrap-break-word font-mono text-[11px] font-light">{details}</code>
          </div>
        )}

        {/* Bottone di Retry */}
        <button
          type="button"
          onClick={handleRetry}
          className="w-full bg-(--color-text) text-(--color-surface) hover:opacity-90 font-bold py-2.5 px-4 rounded-md text-xs uppercase tracking-widest transition-all duration-200 outline-none cursor-pointer shadow-xs flex items-center justify-center gap-2"
        >
          <RotateCw size={14} className="opacity-80" />
          <span>Riprova</span>
        </button>

      </div>
    </div>
  );
};