import type { Analytics } from "firebase/analytics";
import type { FirebasePerformance } from "firebase/performance";
import { firebaseApp } from "@/infrastructure/firebase"; // Il tuo file dove fai initializeApp()

let analyticsInstance: Analytics | null = null;
let perfInstance: FirebasePerformance | null = null;

async function initAnalytics() {
  if (analyticsInstance) return; // Evita inizializzazioni multiple
  
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

  // Performance di solito non usa cookie traccianti per PII, ma verifica la tua policy.
  // Lo inizializziamo subito per non perdere i parametri di First Contentful Paint.
  initPerformance(); 

  // Logica di controllo Consenso per Analytics
  const checkAndInitAnalytics = () => {
    if (window.Cookiebot?.consent?.statistics) {
      initAnalytics();
    }
  };

  // 1. Caso in cui Cookiebot ha già caricato le preferenze salvate
  if (window.Cookiebot && window.Cookiebot.consent) {
    checkAndInitAnalytics();
  } else {
    // 2. Caso in cui l'utente deve ancora interagire con il banner
    window.addEventListener("CookiebotOnAccept", checkAndInitAnalytics);
  }
}

export function getAnalyticsInstance(): Analytics | null {
  return analyticsInstance;
}

export function getPerf(): FirebasePerformance | null {
  return perfInstance;
}