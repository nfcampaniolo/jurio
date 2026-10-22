import type { Analytics } from "firebase/analytics";
import type { FirebasePerformance } from "firebase/performance";
import { firebaseApp } from "@/infrastructure/firebase";

interface IubendaPreferences {
  purposes?: Record<number, boolean>;
}

interface IubendaCallbacks {
  onPreferenceExpressedOrNotNeeded?: (
    preference: IubendaPreferences
  ) => void;
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

let analyticsInstance: Analytics | null = null;
let performanceInstance: FirebasePerformance | null = null;
let measurementConsent = false;
let consentRevision = 0;
let analyticsInitRevision: number | null = null;
let performanceInitRevision: number | null = null;
let analyticsInitPromise: Promise<void> | null = null;
let performanceInitPromise: Promise<void> | null = null;
let analyticsCollectionSetter:
  | typeof import("firebase/analytics").setAnalyticsCollectionEnabled
  | null = null;
let registeredCallback: IubendaCallbacks | null = null;

async function initAnalytics(): Promise<void> {
  if (!measurementConsent || analyticsInstance) return;

  if (analyticsInitPromise) {
    await analyticsInitPromise;
    if (
      measurementConsent &&
      !analyticsInstance &&
      analyticsInitRevision !== consentRevision
    ) {
      await initAnalytics();
    }
    return;
  }

  if (analyticsInitRevision === consentRevision) return;

  const requestedRevision = consentRevision;
  analyticsInitRevision = requestedRevision;
  const initialization = (async () => {
    try {
      const {
        getAnalytics,
        isSupported,
        setAnalyticsCollectionEnabled,
      } = await import("firebase/analytics");

      analyticsCollectionSetter = setAnalyticsCollectionEnabled;

      if (
        !measurementConsent ||
        consentRevision !== requestedRevision ||
        !(await isSupported()) ||
        !measurementConsent ||
        consentRevision !== requestedRevision
      ) {
        return;
      }

      analyticsInstance = getAnalytics(firebaseApp);
      setAnalyticsCollectionEnabled(analyticsInstance, true);
      console.log("🔥 Firebase Analytics inizializzato");
    } catch (error) {
      console.error(
        "Errore durante l'inizializzazione di Analytics:",
        error
      );
    }
  })();

  analyticsInitPromise = initialization;
  try {
    await initialization;
  } finally {
    if (analyticsInitPromise === initialization) {
      analyticsInitPromise = null;
    }
  }

  if (
    measurementConsent &&
    !analyticsInstance &&
    consentRevision !== requestedRevision
  ) {
    await initAnalytics();
  }
}

async function initPerformance(): Promise<void> {
  if (!measurementConsent || performanceInstance) return;

  if (performanceInitPromise) {
    await performanceInitPromise;
    if (
      measurementConsent &&
      !performanceInstance &&
      performanceInitRevision !== consentRevision
    ) {
      await initPerformance();
    }
    return;
  }

  if (performanceInitRevision === consentRevision) return;

  const requestedRevision = consentRevision;
  performanceInitRevision = requestedRevision;
  const initialization = (async () => {
    try {
      const { getPerformance } = await import("firebase/performance");

      if (
        !measurementConsent ||
        consentRevision !== requestedRevision
      ) {
        return;
      }

      performanceInstance = getPerformance(firebaseApp);
      performanceInstance.instrumentationEnabled = true;
      performanceInstance.dataCollectionEnabled = true;
      console.log("⚡ Firebase Performance inizializzato");
    } catch (error) {
      console.error(
        "Errore durante l'inizializzazione di Performance:",
        error
      );
    }
  })();

  performanceInitPromise = initialization;
  try {
    await initialization;
  } finally {
    if (performanceInitPromise === initialization) {
      performanceInitPromise = null;
    }
  }

  if (
    measurementConsent &&
    !performanceInstance &&
    consentRevision !== requestedRevision
  ) {
    await initPerformance();
  }
}

async function applyMeasurementPreferences(
  preferences?: IubendaPreferences
): Promise<void> {
  const hasMeasurementConsent = preferences?.purposes?.[4] === true;

  if (measurementConsent !== hasMeasurementConsent) {
    measurementConsent = hasMeasurementConsent;
    consentRevision += 1;
    analyticsInitRevision = null;
    performanceInitRevision = null;
  }

  if (!measurementConsent) {
    if (analyticsInstance && analyticsCollectionSetter) {
      analyticsCollectionSetter(analyticsInstance, false);
    }
    if (performanceInstance) {
      performanceInstance.instrumentationEnabled = false;
      performanceInstance.dataCollectionEnabled = false;
    }
    return;
  }

  await Promise.all([initAnalytics(), initPerformance()]);
}

function registerConsentCallback(callbacks: IubendaCallbacks): void {
  if (registeredCallback === callbacks) return;

  const originalCallback =
    callbacks.onPreferenceExpressedOrNotNeeded;

  callbacks.onPreferenceExpressedOrNotNeeded = (preferences) => {
    const currentPreferences =
      preferences ?? window._iub?.cs?.api?.getPreferences();
    void applyMeasurementPreferences(currentPreferences);
    originalCallback?.(preferences);
  };

  registeredCallback = callbacks;
}

export async function initializeOptionalServices(): Promise<void> {
  if (typeof window === "undefined") return;

  window._iub = window._iub ?? {};
  window._iub.csConfiguration =
    window._iub.csConfiguration ?? {};
  window._iub.csConfiguration.callback =
    window._iub.csConfiguration.callback ?? {};

  registerConsentCallback(
    window._iub.csConfiguration.callback
  );

  const preferences = window._iub.cs?.api?.getPreferences();
  await applyMeasurementPreferences(preferences);
}

export function getAnalyticsInstance(): Analytics | null {
  return measurementConsent ? analyticsInstance : null;
}

export function getPerf(): FirebasePerformance | null {
  return measurementConsent ? performanceInstance : null;
}
