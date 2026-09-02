import { type ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/useAuth";
import { userExists } from "@/services/user";
import { AuthLoader } from "./AuthLoader";

export const RegistrationRoute = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useAuth();
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);

  useEffect(() => {
    // Se Firebase sta caricando o se l'utente non esiste, non facciamo nulla.
    // L'effetto serve SOLO per interrogare Firestore se c'è un utente Auth.
    if (loading || !user) return;
    
    let isMounted = true;
    
    userExists(user.uid)
      .then(exists => {
        if (isMounted) setHasProfile(exists);
      })
      .catch(() => {
        if (isMounted) setHasProfile(false);
      });

    // Cleanup function per evitare memory leaks se il componente viene smontato
    return () => {
      isMounted = false;
    };
  }, [user, loading]);

  // 1. Firebase sta ancora inizializzando la sessione
  if (loading) return <AuthLoader />;

  // 2. È un ospite puro (non c'è user in Firebase): via libera immediato al form
  if (!user) return <>{children}</>;

  // 3. È loggato in Firebase, ma stiamo ancora aspettando la risposta da Firestore
  if (hasProfile === null) return <AuthLoader />;

  // 4. È loggato in Firebase e ha già completato il setup su Firestore
  if (hasProfile) return <Navigate to="/profilo" replace />;

  // 5. È loggato in Firebase ma la registrazione su Firestore non è completata
  return <>{children}</>;
};