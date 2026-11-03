import { useEffect, useState, type ReactNode } from "react";
import { AuthContext } from "./AuthContext";
import { onUserStateChange } from "@/features/auth/hooks/auth";

type FirebaseUser = import("firebase/auth").User;
const STATIC_ROUTES = new Set(["/privacy", "/termini", "/gdpr"]);

const isInitialStaticRoute = () => {
  if (typeof window === "undefined") return false;
  return STATIC_ROUTES.has(window.location.pathname);
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  
  // Inizializza a unauthenticated se è una rotta statica, altrimenti loading
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated' | 'error'>(
    isInitialStaticRoute() ? 'unauthenticated' : 'loading'
  );
  const [hasConflict, setHasConflict] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Azzeramento immediato dello stato per evitare rimbalzi dal router
  const resolveConflict = () => {
    setHasConflict(false);
  };
  
  useEffect(() => {
    if (isInitialStaticRoute()) return;

    let cancelled = false;

    let unsubscribe: undefined | (() => void);
    try {
      // Allineato alla nuova firma: accetta solo 'u' e 'conflict'
      unsubscribe = onUserStateChange((u: FirebaseUser | null, conflict: boolean) => {
        if (cancelled) return;

        setUser(u);
        setHasConflict(conflict);
        setStatus(u ? 'authenticated' : 'unauthenticated');
      });
    } catch (err) {
      // Cattura eventuali errori di inizializzazione
      const nextErrorMessage = err instanceof Error ? err.message : "Errore sconosciuto";
      queueMicrotask(() => {
        if (!cancelled) {
          setStatus('error');
          setErrorMessage(nextErrorMessage);
        }
      });
    }

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);
  
  return (
    <AuthContext.Provider value={{ user, status, hasConflict, errorMessage, resolveConflict }}>
      {children}
    </AuthContext.Provider>
  );
};
