import type { User } from "firebase/auth";
import { firebaseApp } from "@/infrastructure/firebase";
import { trackEvent } from "@/infrastructure/analytics";

type FirebaseAuthModule = typeof import("firebase/auth");
let authModulePromise: Promise<FirebaseAuthModule> | null = null;

async function getFirebaseAuthModule(): Promise<FirebaseAuthModule> {
  if (!authModulePromise) {
    authModulePromise = import("firebase/auth");
  }
  return authModulePromise;
}

export async function getAuthClient() {
  console.log("[getAuthClient] Inizializzazione AuthClient...");
  const { initializeFirebaseAppCheck } = await import("@/infrastructure/appCheck");
  initializeFirebaseAppCheck();
  const { getAuth } = await getFirebaseAuthModule();
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
    const { onAuthStateChanged } = await getFirebaseAuthModule();

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
  console.log("[resetPassword] Richiesta reset password");
  if (!email) throw new Error("Inserisci un indirizzo email valido");

  const url = import.meta.env.VITE_SEND_PASSWORD_RESET_URL as string | undefined;
  if (!url) throw new Error("Endpoint di reset password non configurato");

  try {
    const { fetchWithAppCheckOnly } = await import("@/config/apiClient");
    const res = await fetchWithAppCheckOnly(url, { email: email.trim() });

    if (res.status === 429) throw new Error("rate_limited");
    if (res.status === 400) throw new Error("invalid_email");
    if (!res.ok) throw new Error(`reset_password_failed (${res.status})`);

    void trackEvent("password_reset_requested", { method: "email" });
  } catch (err) {
    console.error("[resetPassword] Errore durante la richiesta di reset:", err);
    void trackEvent("analytics_error", {
      name: "reset_password",
      reason: err instanceof Error ? err.message : "unknown_error",
    });
    throw err;
  }
}

/** Verifica il codice del link di reset e restituisce l'email dell'account. */
export async function verifyResetCode(oobCode: string): Promise<string> {
  const auth = await getAuthClient();
  const { verifyPasswordResetCode } = await getFirebaseAuthModule();
  return verifyPasswordResetCode(auth, oobCode);
}

/** Imposta la nuova password usando il codice ricevuto via email. */
export async function confirmNewPassword(oobCode: string, newPassword: string): Promise<void> {
  const auth = await getAuthClient();
  const { confirmPasswordReset } = await getFirebaseAuthModule();
  try {
    await confirmPasswordReset(auth, oobCode, newPassword);
    void trackEvent("password_reset_completed", {});
  } catch (err) {
    void trackEvent("analytics_error", {
      name: "confirm_password_reset",
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

// ============================================================================
// VERIFICA EMAIL
// ============================================================================

/**
 * True per gli account email/password che non hanno ancora confermato l'indirizzo.
 * Utenti anonimi e provider OAuth (es. Google, già verificati) sono esclusi.
 */
export function needsEmailVerification(user: User | null | undefined): boolean {
  if (!user || user.isAnonymous || user.emailVerified) return false;
  return (user.providerData ?? []).some((p) => p.providerId === "password");
}

/** Chiede al backend di inviare l'email di verifica personalizzata Jurio. */
export async function sendVerificationEmail(): Promise<{ alreadyVerified: boolean }> {
  const url = import.meta.env.VITE_SEND_VERIFICATION_EMAIL_URL as string | undefined;
  if (!url) throw new Error("Endpoint di verifica email non configurato");

  const { fetchWithSecurity } = await import("@/config/apiClient");
  const res = await fetchWithSecurity(url, {});

  if (res.status === 429) {
    throw new Error("rate_limited");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    void trackEvent("analytics_error", { name: "send_verification_email", reason: `${res.status}` });
    throw new Error(`send_verification_failed (${res.status}): ${text}`);
  }

  const data = (await res.json()) as { alreadyVerified?: boolean };
  void trackEvent("verification_email_sent", {});
  return { alreadyVerified: Boolean(data.alreadyVerified) };
}

/** Applica il codice ricevuto via email (oobCode) e marca l'indirizzo come verificato. */
export async function confirmEmailVerification(oobCode: string): Promise<void> {
  const auth = await getAuthClient();
  const { applyActionCode } = await getFirebaseAuthModule();
  try {
    await applyActionCode(auth, oobCode);
    void trackEvent("email_verified", {});
  } catch (err) {
    void trackEvent("analytics_error", {
      name: "email_verification",
      reason: err instanceof Error ? err.message : "unknown_error",
    });
    throw err;
  }
}

/**
 * Ricarica l'utente corrente da Firebase e rinnova l'ID token, così il claim
 * email_verified arriva aggiornato anche alle Cloud Functions.
 */
export async function reloadCurrentUser(): Promise<User | null> {
  const auth = await getAuthClient();
  const user = auth.currentUser;
  if (!user) return null;
  await user.reload();
  await user.getIdToken(true);
  return auth.currentUser;
}
