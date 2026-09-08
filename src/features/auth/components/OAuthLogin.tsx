import React from 'react';
import { AuthLayout } from './AuthLayout';
import { AuthForm } from '@/features/auth/components/AuthForm';
import { GoogleButton } from './GoogleButton';
import { useOAuthLogic } from '../hooks/useOAuthLogic';

export const OAuthLogin: React.FC = () => {
  const { authStatus, isLoading, isAuthorizing, error } = useOAuthLogic();

  // ==========================================================================
  // LOGICA DI RENDER
  // ==========================================================================

  // Caso 1: Errore fatale
  if (error || authStatus === 'error') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center p-8 bg-white rounded-xl shadow-lg max-w-md">
          <h2 className="text-xl font-bold text-red-600 mb-2">Errore</h2>
          <p className="text-gray-600">{error || "Si è verificato un errore di autenticazione."}</p>
        </div>
      </div>
    );
  }

  // Caso 2: Caricamento generico o Autorizzazione in corso
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50">
        <div className="text-center flex flex-col items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
          <h2 className="text-lg font-semibold">
            {isAuthorizing ? 'Autorizzazione in corso...' : 'Verifica in corso...'}
          </h2>
        </div>
      </div>
    );
  }

  // Caso 3: L'utente non è loggato. Mostriamo il form di login usando il nostro Layout
  // CORREZIONE QUI: usiamo authStatus invece di user
  if (authStatus === 'unauthenticated') {
    return (
      <AuthLayout 
        title="Collega l'Assistente IA" 
        subtitle="Accedi per autorizzare l'Intelligenza Artificiale ad utilizzare la ricerca giuridica."
      >
        <div className="flex flex-col gap-6">
          <AuthForm initialMode="login" />
          
          <div className="relative flex items-center py-2">
            <div className="grow border-t border-gray-200"></div>
            <span className="shrink-0 mx-4 text-xs text-gray-400 uppercase tracking-wider">
              oppure
            </span>
            <div className="grow border-t border-gray-200"></div>
          </div>

          <GoogleButton />
        </div>
      </AuthLayout>
    );
  }

  // Caso 4: L'utente è loggato (authStatus === 'authenticated') e l'hook sta per fare il redirect 
  // Mostriamo lo spinner così l'utente sa che sta succedendo qualcosa
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center flex flex-col items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mb-4"></div>
        <h2 className="text-lg font-semibold">Autorizzazione in corso...</h2>
      </div>
    </div>
  );
};