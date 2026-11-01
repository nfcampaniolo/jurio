export const GOOGLE_DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";
export const GOOGLE_TOKEN_SCRIPT = "https://accounts.google.com/gsi/client";
export const GOOGLE_PICKER_SCRIPT = "https://apis.google.com/js/api.js";
export const GOOGLE_TOKEN_SCRIPT_ID = "google-identity-services";
export const GOOGLE_PICKER_SCRIPT_ID = "google-picker-api";

// -------------------------
// Tipi Google OAuth & Picker
// -------------------------

export interface GoogleIdentityTokenResponse {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

export interface GoogleTokenClient {
  requestAccessToken: (config?: { prompt?: string }) => void;
}

export interface GoogleOAuth2Api {
  initTokenClient: (config: {
    client_id: string;
    scope: string;
    include_granted_scopes?: boolean;
    callback: (response: GoogleIdentityTokenResponse) => void;
    error_callback?: (error: { type?: string; message?: string }) => void;
  }) => GoogleTokenClient;
  hasGrantedAllScopes?: (response: GoogleIdentityTokenResponse, ...scopes: string[]) => boolean;
}

export interface GooglePickerResponse {
  action: string;
  docs?: Array<{ id: string; name: string; mimeType?: string }>;
}

interface GooglePickerView {
  setMimeTypes: (mimeTypes: string) => GooglePickerView;
}

interface GooglePickerBuilder {
  addView: (view: GooglePickerView) => GooglePickerBuilder;
  setOAuthToken: (token: string) => GooglePickerBuilder;
  setDeveloperKey: (key: string) => GooglePickerBuilder;
  setAppId: (projectNumber: string) => GooglePickerBuilder;
  setOrigin: (origin: string) => GooglePickerBuilder;
  setCallback: (callback: (data: GooglePickerResponse) => void) => GooglePickerBuilder;
  build: () => { setVisible: (visible: boolean) => void };
}

export interface GooglePickerApi {
  DocsView: new (viewId: string | number) => GooglePickerView;
  ViewId: { DOCS: string | number };
  PickerBuilder: new () => GooglePickerBuilder;
  Action: { PICKED: string; CANCEL: string };
}

export interface GoogleWindow extends Window {
  gapi?: {
    load: (
      apiName: string,
      options: { callback: () => void; onerror?: () => void; ontimeout?: () => void; timeout?: number }
    ) => void;
  };
  google?: {
    accounts?: { oauth2?: GoogleOAuth2Api };
    picker?: GooglePickerApi;
  };
}

// -------------------------
// Configurazione Google
// -------------------------

export interface GoogleConfig {
  clientId: string;
  apiKey: string;
  projectNumber: string;
}

export const getGoogleConfig = (): GoogleConfig => {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
  const apiKey = (import.meta.env.VITE_GOOGLE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY) as string | undefined;
  const projectNumber = (import.meta.env.VITE_GOOGLE_PROJECT_NUMBER || import.meta.env.VITE_GOOGLE_APP_ID) as string | undefined;

  if (!clientId) throw new Error("VITE_GOOGLE_CLIENT_ID non configurato.");
  if (!apiKey) throw new Error("VITE_GOOGLE_API_KEY non configurato.");
  if (!projectNumber || !/^\d+$/.test(projectNumber)) {
    throw new Error("VITE_GOOGLE_PROJECT_NUMBER non valido. Inserisci il numero del progetto Google Cloud.");
  }

  return { clientId, apiKey, projectNumber };
};

// -------------------------
// Caricamento script e librerie
// -------------------------

const scriptPromises = new Map<string, Promise<void>>();

export const loadScript = (src: string, id: string): Promise<void> => {
  const cached = scriptPromises.get(id);
  if (cached) return cached;

  const promise = new Promise<void>((resolve, reject) => {
    const existing = document.getElementById(id) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.loaded === "true") return resolve();
      existing.addEventListener("load", () => { existing.dataset.loaded = "true"; resolve(); }, { once: true });
      existing.addEventListener("error", () => {
        existing.remove();
        reject(new Error(`Impossibile caricare lo script Google: ${src}`));
      }, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = id;
    script.src = src;
    script.async = true;
    script.defer = true;
    script.onload = () => { script.dataset.loaded = "true"; resolve(); };
    script.onerror = () => {
      script.remove();
      reject(new Error(`Impossibile caricare lo script Google: ${src}`));
    };
    document.head.appendChild(script);
  });

  scriptPromises.set(id, promise);
  promise.catch(() => scriptPromises.delete(id));
  return promise;
};

export const loadGoogleLibraries = async (): Promise<void> => {
  await Promise.all([
    loadScript(GOOGLE_TOKEN_SCRIPT, GOOGLE_TOKEN_SCRIPT_ID),
    loadScript(GOOGLE_PICKER_SCRIPT, GOOGLE_PICKER_SCRIPT_ID),
  ]);

  const googleWindow = window as GoogleWindow;
  if (!googleWindow.gapi) throw new Error("Google API (gapi) non disponibile.");

  await new Promise<void>((resolve, reject) => {
    try {
      googleWindow.gapi!.load("picker", {
        callback: resolve,
        onerror: () => reject(new Error("Errore durante il caricamento di Google Picker.")),
        ontimeout: () => reject(new Error("Timeout durante il caricamento di Google Picker.")),
        timeout: 10000,
      });
    } catch (error) {
      reject(error);
    }
  });

  if (!googleWindow.google?.accounts?.oauth2) throw new Error("Google Identity Services non disponibile.");
  if (!googleWindow.google?.picker) throw new Error("Google Picker non disponibile.");
};