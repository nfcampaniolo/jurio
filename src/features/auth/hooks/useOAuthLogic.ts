
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/useAuth";
import { getDb } from "@/infrastructure/db";
import {
  doc,
  setDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";

const CONNECTION_ERROR =
  "Si è verificato un errore durante la connessione. Riprova più tardi.";

const MAX_CLIENT_ID_LENGTH = 256;
const MAX_STATE_LENGTH = 2048;
const AUTH_CODE_TTL_MS = 10 * 60 * 1000;

type OAuthParams = {
  clientId: string | null;
  redirectUri: string | null;
  state: string | null;
  codeChallenge: string | null;
  codeChallengeMethod: string | null;
  validatedRedirectUri: string | null;
  urlError: string | null;
};

function parseOAuthParams(search: string): OAuthParams {
  const params = new URLSearchParams(search);

  const clientId = params.get("client_id");
  const redirectUri = params.get("redirect_uri");
  const state = params.get("state");
  const codeChallenge = params.get("code_challenge");
  const codeChallengeMethod = params.get(
    "code_challenge_method"
  );

  let validatedRedirectUri: string | null = null;
  let urlError: string | null = null;

  if (!clientId) {
    urlError =
      "Richiesta non valida: manca il parametro 'client_id'.";
  } else if (!redirectUri) {
    urlError =
      "Richiesta non valida: manca il parametro 'redirect_uri'.";
  } else {
    try {
      const parsedUrl = new URL(redirectUri);

      if (
        parsedUrl.protocol !== "https:" &&
        parsedUrl.protocol !== "http:"
      ) {
        urlError = "Schema del redirect_uri non consentito.";
      } else if (parsedUrl.username || parsedUrl.password) {
        urlError =
          "L'indirizzo di reindirizzamento ('redirect_uri') fornito non è valido.";
      } else {
        validatedRedirectUri = parsedUrl.toString();
      }
    } catch {
      urlError =
        "L'indirizzo di reindirizzamento ('redirect_uri') fornito non è valido.";
    }
  }

  if (!urlError) {
    if (!codeChallenge) {
      urlError =
        "Richiesta non valida: manca il parametro 'code_challenge'.";
    } else if (codeChallengeMethod !== "S256") {
      urlError =
        "Richiesta non valida: code_challenge_method deve essere 'S256'.";
    } else if (!/^[A-Za-z0-9_-]{43}$/.test(codeChallenge)) {
      urlError =
        "Richiesta non valida: code_challenge non valido.";
    }
  }

  if (
    !urlError &&
    clientId &&
    clientId.length > MAX_CLIENT_ID_LENGTH
  ) {
    urlError = "client_id non valido.";
  }

  if (state && state.length > MAX_STATE_LENGTH) {
    urlError = "Parametro state non valido.";
  }

  return {
    clientId,
    redirectUri,
    state,
    codeChallenge,
    codeChallengeMethod,
    validatedRedirectUri,
    urlError,
  };
}

export function useOAuthLogic() {
  const { user, status: authStatus } = useAuth();

  const [isAuthorizing, setIsAuthorizing] = useState(false);
  const [asyncError, setAsyncError] = useState<string | null>(null);

  const processedRef = useRef(false);

  // Mantiene stabili i parametri finché l'URL non cambia.
  const search = window.location.search;

  const oauth = useMemo(
    () => parseOAuthParams(search),
    [search]
  );

  const {
    clientId,
    redirectUri,
    state,
    codeChallenge,
    codeChallengeMethod,
    validatedRedirectUri,
    urlError,
  } = oauth;

  const error = urlError || asyncError;

  const isLoading =
    authStatus === "loading" || isAuthorizing;

  useEffect(() => {
    if (
      authStatus !== "authenticated" ||
      !user ||
      urlError ||
      !validatedRedirectUri ||
      !clientId ||
      !redirectUri ||
      !codeChallenge ||
      codeChallengeMethod !== "S256" ||
      processedRef.current
    ) {
      return;
    }

    let isMounted = true;

    const processAuthorization = async () => {
      processedRef.current = true;
      setIsAuthorizing(true);
      setAsyncError(null);

      try {
        // Generazione di un codice casuale di 256 bit.
        const randomBytes = new Uint8Array(32);
        window.crypto.getRandomValues(randomBytes);

        const authCode = Array.from(randomBytes, (byte) =>
          byte.toString(16).padStart(2, "0")
        ).join("");

        const expiresAt = Timestamp.fromMillis(
          Date.now() + AUTH_CODE_TTL_MS
        );

        const db = await getDb();

        await setDoc(doc(db, "oauth_codes", authCode), {
          uid: user.uid,
          client_id: clientId,
          redirect_uri: redirectUri,
          code_challenge: codeChallenge,
          code_challenge_method: "S256",
          createdAt: serverTimestamp(),
          expiresAt,
        });

        if (!isMounted) {
          return;
        }

        const returnUrl = new URL(validatedRedirectUri);

        returnUrl.searchParams.set("code", authCode);

        if (state) {
          returnUrl.searchParams.set("state", state);
        }

        window.location.replace(returnUrl.toString());
      } catch (err) {
        console.error(
          "[JURIO-OAUTH] Errore durante la generazione/salvataggio del codice OAuth:",
          err
        );

        if (isMounted) {
          setAsyncError(CONNECTION_ERROR);
          setIsAuthorizing(false);

          // Consente un nuovo tentativo dopo un errore.
          processedRef.current = false;
        }
      }
    };

    void processAuthorization();

    return () => {
      isMounted = false;
    };
  }, [
    authStatus,
    user,
    urlError,
    validatedRedirectUri,
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
    state,
  ]);

  return {
    authStatus,
    isLoading,
    isAuthorizing,
    error,
  };
}