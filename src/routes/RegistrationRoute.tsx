import { type ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/useAuth";
import { userExists } from "@/shared/services/user";
import { AuthLoader } from "./AuthLoader";
import { ErrorScreen } from "../shared/components/ErrorScreen";

export const RegistrationRoute = ({ children }: { children: ReactNode }) => {
  const { user, status, errorMessage } = useAuth();
  
  // Tracciamo lo stato del profilo in modo esplicito per gestire gli errori della Promise
  const [profileState, setProfileState] = useState<'loading' | 'exists' | 'missing' | 'error'>('loading');

  useEffect(() => {
    // Se non siamo autenticati o siamo in errore globale, non fare nulla
    if (status !== 'authenticated' || !user) return;
    
    let isMounted = true;
    
    userExists(user.uid)
      .then(exists => {
        if (isMounted) setProfileState(exists ? 'exists' : 'missing');
      })
      .catch((err) => {
        console.error("Impossibile contattare Firestore per verificare l'esistenza:", err);
        // Evitiamo che un errore di rete venga trattato come "profilo inesistente"
        if (isMounted) setProfileState('error'); 
      });

    return () => {
      isMounted = false;
    };
  }, [user, status]);

  // 1. Errore globale di Firebase o Auth
  if (status === 'error') {
    return <ErrorScreen message="Errore di connessione (Auth)." details={errorMessage} />;
  }

  // 2. Auth sta ancora caricando
  if (status === 'loading') return <AuthLoader />;

  // 3. Utente ospite puro (Guest): Via libera al form
  if (status === 'unauthenticated') return <>{children}</>;

  // --- Da qui in poi l'utente è loggato su Firebase Auth ---

  // 4. Errore specifico durante la fetch del profilo da Firestore
  if (profileState === 'error') {
    return <ErrorScreen message="Errore di rete. Impossibile verificare il tuo profilo. Riprova più tardi." />;
  }

  // 5. Verifica in corso su Firestore
  if (profileState === 'loading') return <AuthLoader />;

  // 6. Registrazione su Firestore completata in precedenza
  if (profileState === 'exists') return <Navigate to="/profilo" replace />;

  // 7. Utente in Auth ma manca il record su Firestore: Via libera al form
  return <>{children}</>;
};