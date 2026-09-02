// File: src/context/AuthProvider.tsx

import { useEffect, useState, type ReactNode } from "react";
import { AuthContext } from "./AuthContext";

type FirebaseUser = import("firebase/auth").User;
const STATIC_ROUTES = new Set(["/privacy", "/termini", "/gdpr"]);

const isInitialStaticRoute = () => {
  if (typeof window === "undefined") return false;
  return STATIC_ROUTES.has(window.location.pathname);
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(!isInitialStaticRoute()); 
  const [hasConflict, setHasConflict] = useState(false);

  useEffect(() => {
    if (isInitialStaticRoute()) return;

    let unsubscribe: undefined | (() => void);
    let cancelled = false;

    (async () => {
      const mod = await import("@/services/auth");
    
      unsubscribe = mod.onUserStateChange((u: FirebaseUser | null, conflict: boolean) => {
        if (cancelled) return;
        setUser(u);
        setHasConflict(conflict);
        setLoading(false);
      });
    })().catch(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, []);
  
  return (
    <AuthContext.Provider value={{ user, loading, hasConflict }}>
      {children}
    </AuthContext.Provider>
  );
};