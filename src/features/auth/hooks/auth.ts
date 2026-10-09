import type { User } from "firebase/auth";
import { firebaseApp } from "@/infrastructure/firebase";
import { trackEvent } from "@/infrastructure/analytics";


export async function getAuthClient() {
  console.log("[getAuthClient] Inizializzazione AuthClient...");
  const { initializeFirebaseAppCheck } = await import("@/infrastructure/appCheck");
  initializeFirebaseAppCheck();
  const { getAuth } = await import("firebase/auth");
  return getAuth(firebaseApp);
}

export async function registerWithEmail(email: string, password: string) {
  console.log(`[registerWithEmail] Avvio registrazione per: ${email}`);
  const auth = await getAuthClient();
  const { createUserWithEmailAndPassword } = await import("firebase/auth");

  try {
    console.log("[registerWithEmail] Chiamata a createUserWithEmailAndPassword...");
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    console.log(`[registerWithEmail] Utente creato su Firebase con UID: ${cred.user.uid}`);

    void trackEvent("sign_up", { method: "email", success: true });
    return cred;
  } catch (err) {
    console.error("[registerWithEmail] Eccezione finale blocco registrazione:", err);
    void trackEvent("sign_up", { method: "email", success: false });
    void trackEvent("analytics_error", {
      name: "sign_up",
      reason: err instanceof Error ? err.message : "unknown_error",
    });
    throw err;
  }
}

export async function loginWithEmail(email: string, password: string) {
  console.log(`[loginWithEmail] Avvio login per: ${email}`);
  const auth = await getAuthClient();
  const { signInWithEmailAndPassword } = await import("firebase/auth");

  try {
    console.log("[loginWithEmail] Chiamata a signInWithEmailAndPassword...");
    const cred = await signInWithEmailAndPassword(auth, email, password);
    console.log(`[loginWithEmail] Login Firebase completato. UID: ${cred.user.uid}`);

    void trackEvent("login", { method: "email", success: true });
    return cred;
  } catch (err) {
    console.error("[loginWithEmail] Eccezione finale blocco login:", err);
    void trackEvent("login", { method: "email", success: false });
    void trackEvent("analytics_error", {
      name: "login",
      reason: err instanceof Error ? err.message : "unknown_error",
    });
    throw err;
  }
}

export async function loginWithGoogle(): Promise<User> {
  console.log("[loginWithGoogle] Avvio login con Google...");
  const auth = await getAuthClient();
  const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");

  try {
    const provider = new GoogleAuthProvider();
    console.log("[loginWithGoogle] Apertura popup di autenticazione Google...");
    const credential = await signInWithPopup(auth, provider);
    console.log(`[loginWithGoogle] Login Google completato. UID: ${credential.user.uid}`);

    void trackEvent("login", { method: "google", success: true });
    return credential.user;
  } catch (err) {
    console.error("[loginWithGoogle] Eccezione finale blocco login Google:", err);
    void trackEvent("login", { method: "google", success: false });
    void trackEvent("analytics_error", {
      name: "login",
      reason: err instanceof Error ? err.message : "unknown_error",
    });
    throw err;
  }
}

export async function logout() {
  console.log("[logout] Richiesta disconnessione avviata...");
  const auth = await getAuthClient();
  const { signOut } = await import("firebase/auth");
  try {
    await signOut(auth);
    console.log("[logout] Disconnessione completata.");

    void trackEvent("logout", {});
    return;
  } catch (err) {
    console.error("[logout] Errore durante la disconnessione:", err);
    void trackEvent("analytics_error", {
      name: "logout",
      reason: err instanceof Error ? err.message : "unknown_error",
    });
    throw err;
  }
}

export function onUserStateChange(callback: (user: User | null, hasConflict: boolean) => void) {
  console.log("[onUserStateChange] Inizializzazione listener globale Auth...");
  let unsubAuth: undefined | (() => void);
  let cancelled = false;

  void (async () => {
    const auth = await getAuthClient();
    const { onAuthStateChanged } = await import("firebase/auth");

    if (cancelled) {
      console.log("[onUserStateChange] Setup annullato prima del completamento.");
      return;
    }

    unsubAuth = onAuthStateChanged(auth, (user) => {
      console.log(`[onUserStateChange] onAuthStateChanged triggerato. Utente: ${user ? user.uid : "Nessuno (null)"}`);
      callback(user, false);
    });
  })();

  return () => {
    console.log("[onUserStateChange] Pulizia listener (unsubscribing)...");
    cancelled = true;
    unsubAuth?.();
  };
}

export async function resetPassword(email: string) {
  console.log(`[resetPassword] Richiesta reset per: ${email}`);
  if (!email) throw new Error("Inserisci un indirizzo email valido");
  const auth = await getAuthClient();
  const { sendPasswordResetEmail } = await import("firebase/auth");

  try {
    const res = await sendPasswordResetEmail(auth, email);
    console.log("[resetPassword] Email di reset inviata con successo.");
    void trackEvent("password_reset_requested", { method: "email" });
    return res;
  } catch (err) {
    console.error("[resetPassword] Errore durante l'invio dell'email di reset:", err);
    void trackEvent("analytics_error", {
      name: "reset_password",
      reason: err instanceof Error ? err.message : "unknown_error",
    });
    throw err;
  }
}

export async function ensureAnonAuth() {
  console.log("[ensureAnonAuth] Controllo autenticazione anonima...");
  const auth = await getAuthClient();
  try {
    if (!auth.currentUser) {
      console.log("[ensureAnonAuth] Nessun utente trovato. Avvio login anonimo...");
      const { signInAnonymously } = await import("firebase/auth");
      await signInAnonymously(auth);
      console.log("[ensureAnonAuth] Login anonimo completato.");
    } else {
      console.log("[ensureAnonAuth] Utente già autenticato. Nessuna azione necessaria.");
    }
  } catch (err) {
    console.error("[ensureAnonAuth] Errore durante l'autenticazione anonima:", err);
    void trackEvent("analytics_error", {
      name: "ensure_anon_auth",
      reason: err instanceof Error ? err.message : "unknown_error",
    });
    throw err;
  }
}