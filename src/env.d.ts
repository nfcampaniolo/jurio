export {};
import type { RecaptchaVerifier } from "firebase/auth";

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