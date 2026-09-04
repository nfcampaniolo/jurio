import type { ConfirmationResult, User, ApplicationVerifier } from "firebase/auth";
import { firebaseApp } from "@/infrastructure/firebase";
import { trackEvent } from "@/infrastructure/analytics";
import { getSessionUrl } from "@/config/env";

/** Carica e ritorna l'istanza Auth senza trascinare Firestore/Storage/Functions */
export async function getAuthClient() {
  const { initializeFirebaseAppCheck } = await import("@/infrastructure/appCheck");
  initializeFirebaseAppCheck();
  const { getAuth } = await import("firebase/auth");
  return getAuth(firebaseApp);
}

async function syncSessionSecure() {
  const auth = await getAuthClient();
  const user = auth.currentUser;
  if (!user) throw new Error("Nessun utente per sincronizzare la sessione");

  try {
    // 1. Recupera JWT di Firebase Auth
    const idToken = await user.getIdToken();
    
    // 2. Recupera Token di AppCheck usando la tua funzione
    const { getToken } = await import("firebase/app-check");
    const { initializeFirebaseAppCheck } = await import("@/infrastructure/appCheck");
    
    const appCheckInstance = initializeFirebaseAppCheck();
    let appCheckToken = "";
    
    if (appCheckInstance) {
      const appCheckData = await getToken(appCheckInstance, false);
      appCheckToken = appCheckData.token;
    }

    const { SYNC_USER_SESSION_ENDPOINT } = getSessionUrl();
    const response = await fetch(SYNC_USER_SESSION_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
        "X-Firebase-AppCheck": appCheckToken
      },
      body: JSON.stringify({}) // Corpo vuoto
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    localStorage.setItem("active_session_id", data.sessionId);
    console.log("Sessione sincronizzata con autorità server.");
    
  } catch (err) {
    console.error("Errore critico nella sincronizzazione sessione", err);
    throw err;
  }
}

export async function registerWithEmail(email: string, password: string) {
  const auth = await getAuthClient();
  const { createUserWithEmailAndPassword, signOut } = await import("firebase/auth");

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    try {
      // Firebase logga l'utente in automatico, quindi creiamo la sessione
      await syncSessionSecure();
    } catch (sessionErr) {
      // ROLLBACK: se il server fallisce, scolleghiamo l'utente localmente
      console.error("Errore durante la sincronizzazione della sessione:", sessionErr);
      await signOut(auth);
      throw new Error("Impossibile creare la sessione sicura. Riprova.");
    }

    // Tracking (success)
    trackEvent("sign_up", { method: "email", success: true });

    return cred;
  } catch (err) {
    // Tracking (failure)
    trackEvent("sign_up", { method: "email", success: false });
    trackEvent("analytics_error", {
      name: "sign_up",
      reason: err instanceof Error ? err.message : "unknown_error",
    });
    throw err;
  }
}

export async function loginWithEmail(email: string, password: string) {
  const auth = await getAuthClient();
  const { signInWithEmailAndPassword, signOut } = await import("firebase/auth");

  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    
    try {
      // Sincronizza sessione
      await syncSessionSecure();
    } catch (sessionErr) {
      // ROLLBACK: scollega localmente se il server non risponde
      console.error("Errore durante la sincronizzazione della sessione:", sessionErr);
      await signOut(auth);
      throw new Error("Errore durante l'avvio della sessione sicura.");
    }

    // Tracking (success)
    trackEvent("login", { method: "email", success: true });
    return cred;
  } catch (err) {
    // Tracking (failure)
    trackEvent("login", { method: "email", success: false });
    trackEvent("analytics_error", {
      name: "login",
      reason: err instanceof Error ? err.message : "unknown_error",
    });
    throw err;
  }
}

export async function loginWithGoogle(): Promise<User> {
  const auth = await getAuthClient();
  const { GoogleAuthProvider, signInWithPopup, signOut } = await import("firebase/auth");

  try {
    const provider = new GoogleAuthProvider();
    const credential = await signInWithPopup(auth, provider);
    
    try {
      // LOGICA SESSIONE UNICA
      await syncSessionSecure();
    } catch (sessionErr) {
      // ROLLBACK preventivo
      console.error("Errore durante l'avvio della sessione sicura con Google:", sessionErr);
      await signOut(auth);
      throw new Error("Errore durante l'avvio della sessione sicura con Google.");
    }
    
    trackEvent("login", { method: "google", success: true });
    return credential.user;
  } catch (err) {
    trackEvent("login", { method: "google", success: false });
    trackEvent("analytics_error", {
      name: "login",
      reason: err instanceof Error ? err.message : "unknown_error",
    });
    throw err;
  }
}

export async function logout() {
  const auth = await getAuthClient();
  const { signOut } = await import("firebase/auth");
  try {
    await signOut(auth);
    // Pulizia sessione locale
    localStorage.removeItem("active_session_id");
    
    // Tracking (success)
    trackEvent("logout", {});
    return;
  } catch (err) {
    trackEvent("analytics_error", {
      name: "logout",
      reason: err instanceof Error ? err.message : "unknown_error",
    });
    throw err;
  }
}

// --- HELPER PER LA LOGICA DI CONFLITTO ---
function verifySessionStatus(
  snapshot: import("firebase/firestore").DocumentSnapshot,
  user: User,
  callback: (user: User | null, hasConflict: boolean) => void
) {
  const data = snapshot.data();
  const dbCode = data?.currentSessionId;
  const localCode = localStorage.getItem("active_session_id");
  // REGOLA 1: Se in cookie non ho salvato alcun codice
  if (!localCode) {
    callback(user, false);
    return;
  }
  // REGOLA 2 e 3: 
  const isConflict = Boolean(dbCode && dbCode !== localCode);
  callback(user, isConflict);
}

// --- METODO PRINCIPALE AGGIORNATO ---
export function onUserStateChange(callback: (user: User | null, hasConflict: boolean) => void) {
  let unsubAuth: undefined | (() => void);
  let unsubFirestore: undefined | (() => void);
  let cancelled = false;

  (async () => {
    const auth = await getAuthClient();
    const { onAuthStateChanged } = await import("firebase/auth");
    const { getDb } = await import("@/infrastructure/db");
    const { doc, onSnapshot } = await import("firebase/firestore");
    
    if (cancelled) return;
    const db = await getDb();
    
    unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubFirestore?.(); // Pulisci ascolti precedenti
      
      if (user) {
        unsubFirestore = onSnapshot(doc(db, "users", user.uid), (snapshot) => {
          // Delega la logica all'helper
          verifySessionStatus(snapshot, user, callback);
        });
      } else {
        // Nessun utente loggato
        callback(null, false);
      }
    });
  })();

  return () => {
    cancelled = true;
    unsubAuth?.();
    unsubFirestore?.();
  };
}

export async function resetPassword(email: string) {
  if (!email) throw new Error("Inserisci un indirizzo email valido");
  const auth = await getAuthClient();
  const { sendPasswordResetEmail } = await import("firebase/auth");

  try {
    const res = await sendPasswordResetEmail(auth, email);
    trackEvent("password_reset_requested", { method: "email" });
    return res;
  } catch (err) {
    trackEvent("analytics_error", {
      name: "reset_password",
      reason: err instanceof Error ? err.message : "unknown_error",
    });
    throw err;
  }
}

export async function ensureAnonAuth() {
  const auth = await getAuthClient();
  try {
    if (!auth.currentUser) {
      const { signInAnonymously } = await import("firebase/auth");
      await signInAnonymously(auth);
    }
  } catch (err) {
    trackEvent("analytics_error", {
      name: "ensure_anon_auth",
      reason: err instanceof Error ? err.message : "unknown_error",
    });
    throw err;
  }
}

/** * Inizializza il ReCaptcha invisibile. */
export async function setupRecaptcha(containerId: string) {
  const auth = await getAuthClient();
  const { RecaptchaVerifier } = await import("firebase/auth");

  if (!window.recaptchaVerifier) {
    window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA risolto
      }
    });
  }
  return window.recaptchaVerifier;
}

/** * Invia l'SMS al numero di telefono e lo collega all'utente attuale. */
export async function sendPhoneVerification(
  user: User, 
  phoneNumber: string, 
  appVerifier: ApplicationVerifier
): Promise<ConfirmationResult> {
  const { linkWithPhoneNumber } = await import("firebase/auth");

  try {
    const confirmationResult = await linkWithPhoneNumber(user, phoneNumber, appVerifier);
    return confirmationResult;
  } catch (err: unknown) {
    trackEvent("analytics_error", {
      name: "phone_verification_requested",
      reason: err instanceof Error ? err.message : "unknown_error",
    });
    throw err;
  }
}

/** * Conferma il codice OTP inserito dall'utente. */
export async function confirmPhoneVerification(confirmationResult: ConfirmationResult, otpCode: string) {
  try {
    const result = await confirmationResult.confirm(otpCode);
    return result.user;
  } catch (err: unknown) {
    trackEvent("analytics_error", {
      name: "phone_verified",
      reason: err instanceof Error ? err.message : "unknown_error",
    });
    throw err;
  }
}