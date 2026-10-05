import {
  initializeAppCheck,
  ReCaptchaEnterpriseProvider,
  type AppCheck,
} from 'firebase/app-check';

import { firebaseApp } from '@/infrastructure/firebase';

let appCheckInstance: AppCheck | undefined;

export function initializeFirebaseAppCheck(): AppCheck | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  if (appCheckInstance) {
    return appCheckInstance;
  }

  const recaptchaKey =
    import.meta.env.VITE_RECAPTCHA_SITE_KEY;

  if (!recaptchaKey) {
    console.warn(
      '⚠️ VITE_RECAPTCHA_SITE_KEY mancante: App Check ignorato.'
    );
    return undefined;
  }

  // Blocco Debug per l'ambiente locale
  if (import.meta.env.DEV) {
    const debugToken =
      import.meta.env.VITE_APPCHECK_DEBUG_TOKEN;

    if (!debugToken) {
      console.warn(
        '⚠️ VITE_APPCHECK_DEBUG_TOKEN mancante.'
      );
    } else {
      Object.defineProperty(
        window,
        'FIREBASE_APPCHECK_DEBUG_TOKEN',
        {
          value: debugToken,
          writable: true,
          configurable: true,
          enumerable: true,
        }
      );

      console.info(
        '🛡️ App Check DEBUG token configurato:',
        debugToken
      );
    }
  }

  appCheckInstance = initializeAppCheck(
    firebaseApp,
    {
      provider: new ReCaptchaEnterpriseProvider(
        recaptchaKey
      ),
      isTokenAutoRefreshEnabled: true,
    }
  );

  console.info('🛡️ Firebase App Check (Enterprise) inizializzato.');

  return appCheckInstance;
}