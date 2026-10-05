import React from "react";

/**
 * Componente di caricamento per i route guards.
 * Garantisce un feedback visivo elegante e accessibile durante 
 * la validazione dei token di sessione prima del render dell'app.
 */
export const AuthLoader: React.FC = () => {
  return (
    <main
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="flex items-center justify-center min-h-dvh bg-(--color-bg) p-6"
    >
      <div className="flex flex-col items-center gap-6">
        {/* Spinner SVG ottimizzato e allineato al tema istituzionale */}
        <svg 
          className="animate-spin h-10 w-10 text-(--color-primary)" 
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          viewBox="0 0 24 24"
        >
          <circle 
            className="opacity-25" 
            cx="12" 
            cy="12" 
            r="10" 
            stroke="var(--color-border)" 
            strokeWidth="4"
          />
          <path 
            className="opacity-75" 
            fill="currentColor" 
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
        
        <span className="text-sm font-semibold text-(--color-muted) tracking-[0.2em] uppercase">
          Jurio
        </span>
      </div>
    </main>
  );
};

export default AuthLoader;