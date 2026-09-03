import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

// Importiamo la logica dal nostro file separato
import { forceSessionTakeover, clearLocalSession } from './hooks/sessionLogic'; 

export default function Session() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);

  const handleForceTakeover = async () => {
    setIsLoading(true);
    try {
      await forceSessionTakeover();
      navigate(-1);
    } catch (error: unknown) {
      console.error("Errore durante la forzatura:", error);

      if (error instanceof Error) {
        if (error.message === "no_user") {
          navigate('/login');
          return;
        }
        alert(error.message);
      } else {
        alert("Si è verificato un errore imprevisto. Riprova.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await clearLocalSession();
      navigate('/login');
    } catch (error) {
      console.error("Errore durante il logout:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-(--color-bg) p-4">
      <div className="relative max-w-md w-full bg-(--color-surface) border border-(--color-border) rounded-lg shadow-(--shadow-soft) p-6 sm:p-8 text-center overflow-hidden">
        
        {/* LA LINEA DI RIGORE SUPERIORE (Unico tocco di colore) */}
        <div className="absolute top-0 left-0 right-0 h-0.75 bg-(--color-primary) opacity-90 z-20" />

        {/* Icona */}
        <div className="mx-auto flex items-center justify-center h-14 w-14 rounded-md border border-(--color-border) bg-(--color-bg) mb-5 mt-1">
          <svg className="h-6 w-6 text-(--color-text) opacity-80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>

        <h1 className="text-xl sm:text-2xl font-medium text-(--color-text) tracking-tight mb-2">
          Sessione già attiva
        </h1>
        
        <p className="text-xs sm:text-sm text-(--color-muted) font-light mb-6 leading-relaxed">
          Sembra che il tuo account sia già connesso su un altro dispositivo o browser. 
          Consentiamo un solo accesso alla volta.
        </p>

        <div className="space-y-4">
          {/* Pulsante Primario */}
          <button 
            type="button"
            onClick={handleForceTakeover}
            disabled={isLoading}
            className="w-full flex justify-center items-center gap-2 py-2.5 px-4 bg-(--color-text) text-(--color-surface) text-xs font-bold uppercase tracking-widest rounded-md hover:opacity-90 transition-all shadow-xs disabled:opacity-35 disabled:cursor-not-allowed outline-none"
          >
            {isLoading && <Loader2 size={14} className="animate-spin" />}
            <span>{isLoading ? 'Attendere...' : "Forza l'accesso qui"}</span>
          </button>
          
          <p className="text-[10px] font-bold uppercase tracking-widest text-(--color-muted)">
            (Questo disconnetterà l'altro dispositivo)
          </p>

          {/* Pulsante Secondario */}
          <button 
            type="button"
            onClick={handleLogout}
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-(--color-surface) border border-(--color-border) text-(--color-text) text-xs font-bold uppercase tracking-widest rounded-md hover:border-(--color-text) transition-colors disabled:opacity-35 disabled:cursor-not-allowed outline-none shadow-xs"
          >
            Esci e torna al Login
          </button>
        </div>

        <hr className="my-6 border-(--color-border)" />

        {/* Sezione supporto */}
        <div className="text-xs text-(--color-muted) font-light">
          Non riconosci questo accesso?{' '}
          <Link 
            to="/contatti" 
            className="text-(--color-text) font-bold underline underline-offset-2 hover:opacity-80 transition-opacity"
          >
            Contatta il supporto
          </Link>
        </div>

      </div>
    </div>
  );
}