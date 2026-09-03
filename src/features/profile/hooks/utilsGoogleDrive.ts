export const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const GOOGLE_TOKEN_SCRIPT = "https://accounts.google.com/gsi/client";
export const GOOGLE_PICKER_SCRIPT = "https://apis.google.com/js/api.js";
export const GOOGLE_TOKEN_SCRIPT_ID = "google-identity-services";
export const GOOGLE_PICKER_SCRIPT_ID = "google-picker-api";

export const getGoogleConfig = (): {
  clientId: string;
  apiKey: string;
  appId: string;
} => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY as string | undefined;
  const appId = import.meta.env.VITE_GOOGLE_APP_ID as string | undefined;

  if (!clientId) {
    throw new Error("VITE_GOOGLE_CLIENT_ID non configurato.");
  }
  if (!apiKey) {
    throw new Error("VITE_GOOGLE_API_KEY non configurato.");
  }
  if (!appId) {
    throw new Error("VITE_GOOGLE_APP_ID non configurato.");
  }

  return {
    clientId,
    apiKey,
    appId,
  };
};

export const loadScript = (src: string, id: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id);

    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");

    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      resolve();
    };

    script.onerror = () => {
      reject(new Error(`Impossibile caricare lo script Google: ${src}`));
    };

    document.head.appendChild(script);
  });
};

export const loadGoogleLibraries = async (): Promise<void> => {
  await loadScript(GOOGLE_TOKEN_SCRIPT, GOOGLE_TOKEN_SCRIPT_ID);
  await loadScript(GOOGLE_PICKER_SCRIPT, GOOGLE_PICKER_SCRIPT_ID);

  await new Promise<void>((resolve, reject) => {
    const gapi = window.gapi;

    if (!gapi) {
      reject(new Error("Google API (gapi) non disponibile."));
      return;
    }

    gapi.load("picker", () => {
      resolve();
    });
  });

  const googleAccounts = window.google?.accounts;

  if (!googleAccounts?.oauth2) {
    throw new Error("Google Identity Services non disponibile.");
  }

  const googlePicker = window.google?.picker;

  if (!googlePicker) {
    throw new Error("Google Picker non disponibile.");
  }
};