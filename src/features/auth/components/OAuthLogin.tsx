import React from 'react';
import { AuthLayout } from './AuthLayout';
import { AuthForm } from '@/features/auth/components/AuthForm';
import { GoogleButton } from './GoogleButton';
import { useOAuthLogic } from '../hooks/useOAuthLogic';

export const OAuthLogin: React.FC = () => {
  const { authStatus, isLoading, isAuthorizing, error } = useOAuthLogic();

  // ==========================================================================
  // GESTIONE STATI DI ERRORE
  // ==========================================================================
  if (error || authStatus === 'error') {
    return (
      <main className="flex items-center justify-center min-h-screen bg-(--color-bg) p-6">
        <div 
          role="alert" 
          aria-live="assertive"
          className="text-center p-10 bg-(--color-surface) rounded-2xl shadow-(--shadow-soft) border border-(--color-border) max-w-lg w-full transition-all"
        >
          {/* Icona di avviso istituzionale */}
          <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-full border border-(--color-border) bg-(--color-bg) mb-6">
            <svg className="h-6 w-6 text-red-600 dark:text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          
          <h1 className="text-2xl font-bold text-(--color-text) mb-3 font-serif">
            Autenticazione Interrotta
          </h1>
          <p className="text-(--color-muted) text-base leading-relaxed mb-8">
            {error || "Si è verificato un errore anomalo durante la verifica delle credenziali. Ti invitiamo a riprovare o a contattare l'assistenza tecnica."}
          </p>
          
          <button 
            onClick={() => window.location.reload()} 
            className="w-full sm:w-auto px-8 py-3 bg-(--color-primary) hover:bg-(--color-primary-hover) text-white font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-(--color-primary)"
          >
            Ricarica la pagina
          </button>
        </div>
      </main>
    );
  }

  // ==========================================================================
  // GESTIONE STATI DI TRANSIZIONE (Caricamento Iniziale / Redirect in corso)
  // ==========================================================================
  if (isLoading || (authStatus === 'authenticated' && isAuthorizing)) {
    return (
      <main 
        aria-live="polite" 
        aria-busy="true"
        className="flex items-center justify-center min-h-screen bg-(--color-bg) p-6"
      >
        <div className="flex flex-col items-center gap-6">
          {/* Spinner SVG ottimizzato e brandizzato */}
          <svg 
            className="animate-spin h-10 w-10 text-(--color-primary)" 
            xmlns="http://www.w3.org/2000/svg" 
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="var(--color-border)" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <h2 className="text-lg font-medium text-(--color-text) tracking-wide">
            {isAuthorizing ? 'Elaborazione delle credenziali...' : 'Connessione al sistema...'}
          </h2>
        </div>
      </main>
    );
  }

  // ==========================================================================
  // FLUSSO PRINCIPALE: AUTENTICAZIONE RICHIESTA
  // ==========================================================================
  if (authStatus === 'unauthenticated') {
    return (
      <AuthLayout 
        title="Accesso alla Piattaforma" 
        subtitle="Autenticati per abilitare le funzionalità avanzate dell'assistente IA per la ricerca giurisprudenziale."
      >
        <div className="flex flex-col gap-8">
          <AuthForm initialMode="login" />
          
          <div className="relative flex items-center">
            <div className="grow border-t border-(--color-border)"></div>
            <span className="shrink-0 mx-4 text-xs text-(--color-muted) uppercase tracking-[0.2em] font-semibold">
              Autenticazione tramite provider
            </span>
            <div className="grow border-t border-(--color-border)"></div>
          </div>

          <GoogleButton />
        </div>
      </AuthLayout>
    );
  }
  return null;
};