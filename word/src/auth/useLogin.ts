/* global window, document, setTimeout, clearTimeout */
import { useCallback, useEffect, useRef, useState } from "react";
import { loginWithCustomToken, loginWithEmail } from "../firebase/auth";
import {
  BrowserLoginSession,
  exchangeBrowserLogin,
  openInBrowser,
  startBrowserLogin,
} from "./browserLogin";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type BrowserLoginState =
  { phase: "idle" } | { phase: "starting" } | { phase: "waiting"; code: string; loginUrl: string };

export const BROWSER_LOGIN_MESSAGES = {
  denied: "Accesso rifiutato dal browser. Puoi riprovare quando vuoi.",
  expired: "La richiesta di accesso è scaduta. Riprova.",
} as const;

export const useLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [validationErrors, setValidationErrors] = useState({ email: "", password: "" });
  const [browserLogin, setBrowserLogin] = useState<BrowserLoginState>({ phase: "idle" });

  const session = useRef<BrowserLoginSession | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);

  const stopPolling = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    session.current = null;
  }, []);

  const validateFields = (): boolean => {
    const errors = { email: "", password: "" };

    if (!email) errors.email = "L'email è obbligatoria.";
    else if (!emailRegex.test(email)) errors.email = "Inserisci un indirizzo email valido.";

    if (!password) errors.password = "La password è obbligatoria.";
    else if (password.length < 6)
      errors.password = "La password deve contenere almeno 6 caratteri.";

    setValidationErrors(errors);
    return !errors.email && !errors.password;
  };

  async function handleLogin() {
    if (!validateFields() || loading) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      await loginWithEmail(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore durante il login");
    } finally {
      setLoading(false);
    }
  }

  // ─────────────────────────────────────────────
  // Accesso tramite jurio.it nel browser di sistema
  // ─────────────────────────────────────────────

  const finish = useCallback(
    (message?: string) => {
      stopPolling();
      setBrowserLogin({ phase: "idle" });
      if (message) setError(message);
    },
    [stopPolling]
  );

  const poll = useCallback(async () => {
    const current = session.current;
    if (!current || inFlight.current) return;
    if (Date.now() >= current.expiresAt) {
      finish(BROWSER_LOGIN_MESSAGES.expired);
      return;
    }
    inFlight.current = true;
    try {
      const result = await exchangeBrowserLogin(current);
      if (session.current !== current) return; // annullato nel frattempo
      if (result.status === "approved") {
        stopPolling();
        await loginWithCustomToken(result.token);
        setBrowserLogin({ phase: "idle" });
        return;
      }
      if (result.status === "denied") return finish(BROWSER_LOGIN_MESSAGES.denied);
      if (result.status === "expired") return finish(BROWSER_LOGIN_MESSAGES.expired);
    } catch (err) {
      // Errori di rete temporanei: si riprova al giro successivo, finché la richiesta non scade.
      if (session.current !== current) return;
      if (err instanceof Error && /non valida|non configurato/.test(err.message)) {
        return finish(err.message);
      }
    } finally {
      inFlight.current = false;
    }
    if (session.current === current) {
      timer.current = setTimeout(() => void poll(), current.intervalMs);
    }
  }, [finish, stopPolling]);

  async function handleBrowserLogin() {
    if (browserLogin.phase !== "idle") return;
    setError("");
    setBrowserLogin({ phase: "starting" });
    try {
      const started = await startBrowserLogin();
      session.current = started;
      setBrowserLogin({ phase: "waiting", code: started.code, loginUrl: started.loginUrl });
      openInBrowser(started.loginUrl);
      timer.current = setTimeout(() => void poll(), started.intervalMs);
    } catch (err) {
      finish(err instanceof Error ? err.message : "Impossibile avviare l'accesso.");
    }
  }

  function reopenBrowser() {
    if (browserLogin.phase === "waiting") openInBrowser(browserLogin.loginUrl);
  }

  function cancelBrowserLogin() {
    finish();
  }

  // Al ritorno su Word dal browser controlla subito, senza attendere il prossimo intervallo.
  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState === "visible" && session.current) {
        if (timer.current) clearTimeout(timer.current);
        void poll();
      }
    };
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [poll]);

  useEffect(() => stopPolling, [stopPolling]);

  return {
    email,
    setEmail,
    password,
    setPassword,
    loading,
    error,
    validationErrors,
    handleLogin,
    browserLogin,
    handleBrowserLogin,
    reopenBrowser,
    cancelBrowserLogin,
  };
};
