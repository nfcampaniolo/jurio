import { useEffect, useState } from 'react';
// Importa il tuo useAuth
import { useAuth } from '@/context/useAuth';
import { getDb } from '@/infrastructure/db';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';

export function useOAuthLogic() {
  // Ora estraiamo sia 'user' che il tuo specifico 'status'
  const { user, status: authStatus } = useAuth();
  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [asyncError, setAsyncError] = useState<string | null>(null);
  // 1. Leggiamo i parametri dall'URL in modo sincrono
  const searchParams = new URLSearchParams(window.location.search);
  const redirectUri = searchParams.get("redirect_uri");
  const state = searchParams.get("state");
  // 2. Errore immediato se manca il redirect_uri
  const urlError = !redirectUri 
    ? "Richiesta non valida: manca redirect_uri. Riprova dal client esterno." 
    : null;
  // L'errore finale da mostrare è quello dell'URL o quello del DB
  const error = urlError || asyncError;
  // Usa la stringa letterale 'loading' del tuo status per capire se Firebase sta ancora decidendo
  const isLoading = authStatus === 'loading' || isAuthorizing;
  useEffect(() => {
    // Ci fermiamo se Firebase sta caricando, se non siamo autenticati, se c'è un errore o manca l'URI
    // authStatus === 'authenticated' garantisce che 'user' non sia null in questo branch
    if (authStatus !== 'authenticated' || !user || urlError || !redirectUri) {
        return;
    }

    let isMounted = true;
    const processAuthorization = async () => {
      setIsAuthorizing(true);
      try {
        // Generazione del codice random
        const array = new Uint8Array(16);
        window.crypto.getRandomValues(array);
        const authCode = Array.from(array)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");

        // Salvataggio su Firestore
        const db = await getDb();
        await setDoc(doc(db, "oauth_codes", authCode), {
          uid: user.uid,
          createdAt: serverTimestamp(),
        });

        // Redirect
        const returnUrl = new URL(redirectUri);
        returnUrl.searchParams.append("code", authCode);
        if (state) returnUrl.searchParams.append("state", state);

        window.location.href = returnUrl.toString();
      } catch (err) {
        console.error("Errore salvataggio codice OAuth:", err);
        if (isMounted) {
          setAsyncError("Errore durante il collegamento. Riprova.");
          setIsAuthorizing(false);
        }
      }
    };
    processAuthorization();
    return () => {
      isMounted = false;
    };
  }, [user, authStatus, urlError, redirectUri, state]);

  return {
    authStatus,
    isLoading,
    isAuthorizing,
    error
  };
}