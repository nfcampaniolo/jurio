import type { ConfirmationResult, User, ApplicationVerifier } from "firebase/auth";
import { firebaseApp } from "@/infrastructure/firebase";
import { trackEvent } from "@/infrastructure/analytics";
import { getSessionUrl } from "@/config/env";
/** Carica e ritorna l'istanza Auth senza trascinare Firestore/Storage/Functions */
export async function getAuthClient() {
  console.log("[getAuthClient] Inizializzazione AuthClient...");
  const { initializeFirebaseAppCheck } = await import("@/infrastructure/appCheck");
  initializeFirebaseAppCheck();
  const { getAuth } = await import("firebase/auth");
  return getAuth(firebaseApp);
}

async function syncSessionSecure() {
  console.log("[syncSessionSecure] Inizio sincronizzazione sessione...");

  // 🛡️ BYPASS PER SVILUPPO LOCALE
  const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  if (isLocalhost) {
    console.warn("⚠️ [syncSessionSecure] AMBIENTE LOCALE RILEVATO: Bypass della sincronizzazione server attivo.");
    localStorage.setItem("active_session_id", "bypass_locale_" + Date.now());
    return; // Esci subito con successo senza fare la fetch
  }

  const auth = await getAuthClient();
  const user = auth.currentUser;
  
  if (!user) {
    console.error("[syncSessionSecure] Fallito: Nessun utente Auth corrente trovato.");
    throw new Error("Nessun utente per sincronizzare la sessione");
  }
  console.log(`[syncSessionSecure] Utente Auth trovato: ${user.uid}`);

  try {
    // 1. Recupera JWT di Firebase Auth
    console.log("[syncSessionSecure] Richiesta idToken in corso...");
    const idToken = await user.getIdToken();
    console.log("[syncSessionSecure] idToken ottenuto con successo.");
    
    // 2. Recupera Token di AppCheck
    console.log("[syncSessionSecure] Inizializzazione AppCheck...");
    const { getToken } = await import("firebase/app-check");
    const { initializeFirebaseAppCheck } = await import("@/infrastructure/appCheck");
    
    const appCheckInstance = initializeFirebaseAppCheck();
    let appCheckToken = "";
    
    if (appCheckInstance) {
      console.log("[syncSessionSecure] Istanza AppCheck trovata, richiesta token a Google...");
      const appCheckData = await getToken(appCheckInstance, false);
      appCheckToken = appCheckData.token;
      console.log(`[syncSessionSecure] Token AppCheck ottenuto (lunghezza: ${appCheckToken.length})`);
    } else {
      console.warn("[syncSessionSecure] Nessuna istanza AppCheck configurata! Il token sarà vuoto.");
    }

    const { SYNC_USER_SESSION_ENDPOINT } = getSessionUrl();
    console.log(`[syncSessionSecure] Chiamata fetch all'endpoint: ${SYNC_USER_SESSION_ENDPOINT}`);
    
    const response = await fetch(SYNC_USER_SESSION_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
        "X-Firebase-AppCheck": appCheckToken
      },
      body: JSON.stringify({}) // Corpo vuoto
    });

    console.log(`[syncSessionSecure] Risposta ricevuta. Status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[syncSessionSecure] Errore dal server. Dettagli corpo risposta:`, errorText);
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    console.log("[syncSessionSecure] Lettura JSON della risposta...");
    const data = await response.json();
    console.log("[syncSessionSecure] Dati ricevuti:", data);
    
    localStorage.setItem("active_session_id", data.sessionId);
    console.log("[syncSessionSecure] Sessione sincronizzata con autorità server con successo.");
    
  } catch (err) {
    console.error("[syncSessionSecure] Eccezione CRITICA catturata:", err);
    throw err;
  }
}

export async function registerWithEmail(email: string, password: string) {
  console.log(`[registerWithEmail] Avvio registrazione per: ${email}`);
  const auth = await getAuthClient();
  const { createUserWithEmailAndPassword, signOut } = await import("firebase/auth");

  try {
    console.log("[registerWithEmail] Chiamata a createUserWithEmailAndPassword...");
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    console.log(`[registerWithEmail] Utente creato su Firebase con UID: ${cred.user.uid}`);

    try {
      console.log("[registerWithEmail] Tento la syncSessionSecure...");
      await syncSessionSecure();
      console.log("[registerWithEmail] Tutto completato con successo!");
    } catch (sessionErr) {
      console.error("[registerWithEmail] Fallita syncSessionSecure. Eseguo ROLLBACK (signOut). Dettaglio:", sessionErr);
      await signOut(auth);
      console.log("[registerWithEmail] Rollback (signOut) completato.");
      throw new Error("Impossibile creare la sessione sicura. Riprova.");
    }

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
  const { signInWithEmailAndPassword, signOut } = await import("firebase/auth");

  try {
    console.log("[loginWithEmail] Chiamata a signInWithEmailAndPassword...");
    const cred = await signInWithEmailAndPassword(auth, email, password);
    console.log(`[loginWithEmail] Login Firebase completato. UID: ${cred.user.uid}`);
    
    try {
      console.log("[loginWithEmail] Tento la syncSessionSecure...");
      await syncSessionSecure();
      console.log("[loginWithEmail] Sessione sicura stabilita con successo.");
    } catch (sessionErr) {
      console.error("[loginWithEmail] Errore durante la sincronizzazione della sessione. Eseguo ROLLBACK (signOut)...", sessionErr);
      await signOut(auth);
      console.log("[loginWithEmail] Rollback completato.");
      throw new Error("Errore durante l'avvio della sessione sicura.");
    }

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
  const { GoogleAuthProvider, signInWithPopup, signOut } = await import("firebase/auth");

  try {
    const provider = new GoogleAuthProvider();
    console.log("[loginWithGoogle] Apertura popup di autenticazione Google...");
    const credential = await signInWithPopup(auth, provider);
    console.log(`[loginWithGoogle] Login Google completato. UID: ${credential.user.uid}`);
    
    try {
      console.log("[loginWithGoogle] Tento la syncSessionSecure...");
      await syncSessionSecure();
      console.log("[loginWithGoogle] Sessione sicura stabilita con successo.");
    } catch (sessionErr) {
      console.error("[loginWithGoogle] Errore durante l'avvio della sessione sicura con Google. Eseguo ROLLBACK...", sessionErr);
      await signOut(auth);
      console.log("[loginWithGoogle] Rollback completato.");
      throw new Error("Errore durante l'avvio della sessione sicura con Google.");
    }
    
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
    localStorage.removeItem("active_session_id");
    console.log("[logout] Disconnessione completata, pulizia localStorage effettuata.");
    
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

// --- HELPER PER LA LOGICA DI CONFLITTO ---
// --- HELPER PER LA LOGICA DI CONFLITTO ---
function verifySessionStatus(
  snapshot: import("firebase/firestore").DocumentSnapshot,
  user: User,
  callback: (user: User | null, hasConflict: boolean) => void
) {
  // 🛡️ BYPASS PER SVILUPPO LOCALE
  const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
  if (isLocalhost) {
    console.log("[verifySessionStatus] ⚠️ Ambiente locale rilevato: bypass del controllo conflitti.");
    callback(user, false);
    return;
  }

  const data = snapshot.data();
  const dbCode = data?.currentSessionId;
  const localCode = localStorage.getItem("active_session_id");
  
  console.log(`[verifySessionStatus] Analisi in corso per UID ${user.uid}. DB Code: ${dbCode} | Local Code: ${localCode}`);
  
  if (!localCode) {
    console.log("[verifySessionStatus] Nessun localCode trovato. Nessun conflitto.");
    callback(user, false);
    return;
  }
  
  const isConflict = Boolean(dbCode && dbCode !== localCode);
  if (isConflict) {
    console.warn(`[verifySessionStatus] ⚠️ CONFLITTO RILEVATO! DB (${dbCode}) != Locale (${localCode})`);
  } else {
    console.log("[verifySessionStatus] Sessione allineata.");
  }
  
  callback(user, isConflict);
}
// --- METODO PRINCIPALE AGGIORNATO ---
export function onUserStateChange(callback: (user: User | null, hasConflict: boolean) => void) {
  console.log("[onUserStateChange] Inizializzazione listener globale Auth/Firestore...");
  let unsubAuth: undefined | (() => void);
  let unsubFirestore: undefined | (() => void);
  let cancelled = false;

  (async () => {
    const auth = await getAuthClient();
    const { onAuthStateChanged } = await import("firebase/auth");
    const { getDb } = await import("@/infrastructure/db");
    const { doc, onSnapshot } = await import("firebase/firestore");
    
    if (cancelled) {
      console.log("[onUserStateChange] Setup annullato prima del completamento.");
      return;
    }
    const db = await getDb();
    
    unsubAuth = onAuthStateChanged(auth, (user) => {
      console.log(`[onUserStateChange] onAuthStateChanged triggerato. Utente: ${user ? user.uid : "Nessuno (null)"}`);
      unsubFirestore?.(); // Pulisci ascolti precedenti
      
      if (user) {
        console.log(`[onUserStateChange] Attacco onSnapshot su documento users/${user.uid}`);
        unsubFirestore = onSnapshot(doc(db, "users", user.uid), (snapshot) => {
          console.log("[onUserStateChange] Snapshot Firestore ricevuto per l'utente.");
          verifySessionStatus(snapshot, user, callback);
        });
      } else {
        console.log("[onUserStateChange] Nessun utente loggato, chiamo callback(null, false).");
        callback(null, false);
      }
    });
  })();

  return () => {
    console.log("[onUserStateChange] Pulizia listener (unsubscribing)...");
    cancelled = true;
    unsubAuth?.();
    unsubFirestore?.();
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

export async function setupRecaptcha(containerId: string) {
  console.log(`[setupRecaptcha] Inizializzazione RecaptchaVerifier sul container: ${containerId}`);
  const auth = await getAuthClient();
  const { RecaptchaVerifier } = await import("firebase/auth");

  if (!window.recaptchaVerifier) {
    console.log("[setupRecaptcha] Nessuna istanza precedente trovata. Creazione nuova istanza...");
    window.recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
      size: 'invisible',
      callback: () => {
        console.log("[setupRecaptcha] reCAPTCHA risolto con successo dall'utente.");
      }
    });
  } else {
    console.log("[setupRecaptcha] Istanza RecaptchaVerifier già esistente.");
  }
  return window.recaptchaVerifier;
}

export async function sendPhoneVerification(
  phoneNumber: string, 
  appVerifier: ApplicationVerifier
): Promise<ConfirmationResult> {
  console.log(`[sendPhoneVerification] Avvio verifica per il numero: ${phoneNumber}`);
  
  // Andiamo a prendere l'utente VERO direttamente da Firebase
  const auth = await getAuthClient();
  const currentUser = auth.currentUser;

  if (!currentUser) {
    console.error("[sendPhoneVerification] ERRORE CRITICO: auth.currentUser è null. L'utente si è scollegato o la sessione è persa.");
    throw new Error("Utente non autenticato");
  }

  console.log(`[sendPhoneVerification] Utente trovato: ${currentUser.uid}. Procedo con l'invio dell'SMS...`);
  const { linkWithPhoneNumber } = await import("firebase/auth");

  try {
    const confirmationResult = await linkWithPhoneNumber(currentUser, phoneNumber, appVerifier);
    console.log("[sendPhoneVerification] SMS inviato con successo al nodo di Google.");
    return confirmationResult;
  } catch (err: unknown) {
    console.error("[sendPhoneVerification] Errore durante l'invio dell'SMS:", err);
    void trackEvent("analytics_error", {
      name: "phone_verification_requested",
      reason: err instanceof Error ? err.message : "unknown_error",
    });
    throw err;
  }
}

export async function confirmPhoneVerification(confirmationResult: ConfirmationResult, otpCode: string) {
  console.log("[confirmPhoneVerification] Tento la conferma del codice OTP...");
  try {
    const result = await confirmationResult.confirm(otpCode);
    console.log("[confirmPhoneVerification] Telefono verificato e collegato con successo.");
    return result.user;
  } catch (err: unknown) {
    console.error("[confirmPhoneVerification] Errore durante la conferma del codice OTP:", err);
    void trackEvent("analytics_error", {
      name: "phone_verified",
      reason: err instanceof Error ? err.message : "unknown_error",
    });
    throw err;
  }
}