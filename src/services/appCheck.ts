import {
  initializeAppCheck,
  ReCaptchaV3Provider,
  type AppCheck,
} from 'firebase/app-check';

import { firebaseApp } from '@/services/firebase';

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
      provider: new ReCaptchaV3Provider(
        recaptchaKey
      ),
      isTokenAutoRefreshEnabled: true,
    }
  );

  console.info('🛡️ Firebase App Check inizializzato.');

  return appCheckInstance;
}