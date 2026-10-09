import type { Analytics } from "firebase/analytics";
import type { FirebasePerformance } from "firebase/performance";
import { firebaseApp } from "@/infrastructure/firebase";

// --- TIPIZZAZIONE IUBENDA ---
interface IubendaPreferences {
  purposes?: Record<number, boolean>;
  // Iubenda restituisce anche id, timestamp, ecc., ma a noi interessano solo i purposes
}

interface IubendaCallbacks {
  onPreferenceExpressedOrNotNeeded?: (preference: IubendaPreferences) => void;
}

interface IubendaCSConfiguration {
  callback?: IubendaCallbacks;
}

interface IubendaCSApi {
  getPreferences: () => IubendaPreferences;
}

interface IubendaObject {
  cs?: {
    api?: IubendaCSApi;
  };
  csConfiguration?: IubendaCSConfiguration;
}

declare global {
  interface Window {
    _iub?: IubendaObject;
  }
}
// ----------------------------

let analyticsInstance: Analytics | null = null;
let perfInstance: FirebasePerformance | null = null;

async function initAnalytics() {
  if (analyticsInstance) return; 
  try {
    const { getAnalytics, isSupported } = await import("firebase/analytics");
    if (await isSupported()) {
      analyticsInstance = getAnalytics(firebaseApp);
      console.log("🔥 Firebase Analytics inizializzato");
    }
  } catch (error) {
    console.error("Errore durante l'inizializzazione di Analytics:", error);
  }
}

async function initPerformance() {
  if (perfInstance) return;
  try {
    const { getPerformance } = await import("firebase/performance");
    perfInstance = getPerformance(firebaseApp);
    console.log("⚡ Firebase Performance inizializzato");
  } catch (error) {
    console.error("Errore durante l'inizializzazione di Performance:", error);
  }
}

export async function initializeOptionalServices(): Promise<void> {
  if (typeof window === "undefined") return;

  // Suggerimento critico: valuta se mettere anche initPerformance sotto consenso
  void initPerformance(); 

  // Funzione che controlla il consenso (Purpose 4 = Statistiche)
  const checkAndInitAnalytics = (preferences?: IubendaPreferences) => {
    // Se ci vengono passate le preferenze usiamo quelle, altrimenti proviamo a leggerle dall'API
    const prefs = preferences ?? window._iub?.cs?.api?.getPreferences();
    const hasMeasurementConsent = prefs?.purposes?.[4] === true;

    if (hasMeasurementConsent) {
      void initAnalytics();
    }
  };

  // CASO 1: L'utente aveva già dato il consenso in passato e la pagina è stata ricaricata
  // Corrisponde al tuo vecchio: if (window.Cookiebot && window.Cookiebot.consent)
  if (window._iub?.cs?.api?.getPreferences) {
    checkAndInitAnalytics();
  }

  // CASO 2: L'utente non ha ancora interagito col banner (nuovo utente)
  // Inizializziamo in modo sicuro l'oggetto di configurazione se lo script di Iubenda non l'ha ancora fatto
  window._iub = window._iub ?? {};
  window._iub.csConfiguration = window._iub.csConfiguration ?? {};
  window._iub.csConfiguration.callback = window._iub.csConfiguration.callback ?? {};

  // Salviamo l'eventuale callback già presente per non sovrascrivere logiche interne di Iubenda
  const originalCallback = window._iub.csConfiguration.callback.onPreferenceExpressedOrNotNeeded;
  
  // Corrisponde al tuo vecchio: window.addEventListener("CookiebotOnAccept", checkAndInitAnalytics)
  window._iub.csConfiguration.callback.onPreferenceExpressedOrNotNeeded = function (preference: IubendaPreferences) {
    checkAndInitAnalytics(preference);
    
    if (typeof originalCallback === "function") {
      originalCallback(preference);
    }
  };
}

export function getAnalyticsInstance(): Analytics | null {
  return analyticsInstance;
}

export function getPerf(): FirebasePerformance | null {
  return perfInstance;
}