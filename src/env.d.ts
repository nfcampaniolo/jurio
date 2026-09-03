export {};
import type { RecaptchaVerifier } from "firebase/auth";

declare global {
  interface Window {
    dataLayer: Array<IArguments | Record<string, unknown>>;
    gtag: (
      command: 'consent' | 'config' | 'event' | 'js' | 'set',
      ...args: unknown[]
    ) => void;

    Cookiebot?: {
      consent?: {
        statistics: boolean;
        marketing: boolean;
        preferences: boolean;
        necessary: boolean;
      };
    };
  }
}

declare global {
  interface Window {
    FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string;
  }
}
declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier;
  }
}
declare global {
  interface Window {
    google?: {
      picker?: GooglePickerNamespace;
      accounts?: GoogleAccounts;
    };
    gapi?: GapiAPI;
  }
}