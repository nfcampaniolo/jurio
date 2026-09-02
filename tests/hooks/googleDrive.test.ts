import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

declare global {
  interface Window {
    gapi?: {
      load: (api: string, callback: () => void) => void;
    };
  }
}

/* ---------- subject under test ---------- */
import {
  GOOGLE_DRIVE_SCOPE,
  GOOGLE_TOKEN_SCRIPT,
  GOOGLE_PICKER_SCRIPT,
  GOOGLE_TOKEN_SCRIPT_ID,
  GOOGLE_PICKER_SCRIPT_ID,
  getGoogleConfig,
  loadScript,
  loadGoogleLibraries,
} from "@/hooks/utilsGoogleDrive"; // <-- adegua il path di import se necessario

describe("Google Drive Config & Loader Suite", () => {
  const originalGapi = window.gapi;
  const originalGoogle = window.google;

  beforeEach(() => {
    document.head.innerHTML = "";
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    window.gapi = originalGapi;
    window.google = originalGoogle;
  });

  describe("Costanti", () => {
    test("espone i valori corretti per endpoint, script e identificatori", () => {
      expect(GOOGLE_DRIVE_SCOPE).toBe("https://www.googleapis.com/auth/drive.file");
      expect(GOOGLE_TOKEN_SCRIPT).toBe("https://accounts.google.com/gsi/client");
      expect(GOOGLE_PICKER_SCRIPT).toBe("https://apis.google.com/js/api.js");
      expect(GOOGLE_TOKEN_SCRIPT_ID).toBe("google-identity-services");
      expect(GOOGLE_PICKER_SCRIPT_ID).toBe("google-picker-api");
    });
  });

  describe("Configurazione Environment (getGoogleConfig)", () => {
    test("restituisce le configurazioni se tutte le variabili d'ambiente sono valorizzate", () => {
      vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "mock-client-id.apps.googleusercontent.com");
      vi.stubEnv("VITE_FIREBASE_API_KEY", "mock-firebase-api-key-123");
      vi.stubEnv("VITE_GOOGLE_APP_ID", "mock-app-id-789");

      const config = getGoogleConfig();

      expect(config).toEqual({
        clientId: "mock-client-id.apps.googleusercontent.com",
        apiKey: "mock-firebase-api-key-123",
        appId: "mock-app-id-789",
      });
    });

    test("solleva errore se VITE_GOOGLE_CLIENT_ID non è configurato", () => {
      vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "");
      vi.stubEnv("VITE_FIREBASE_API_KEY", "mock-api-key");
      vi.stubEnv("VITE_GOOGLE_APP_ID", "mock-app-id");

      expect(() => getGoogleConfig()).toThrow("VITE_GOOGLE_CLIENT_ID non configurato.");
    });

    test("solleva errore se VITE_FIREBASE_API_KEY non è configurato", () => {
      vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "mock-client-id");
      vi.stubEnv("VITE_FIREBASE_API_KEY", "");
      vi.stubEnv("VITE_GOOGLE_APP_ID", "mock-app-id");

      expect(() => getGoogleConfig()).toThrow("VITE_GOOGLE_API_KEY non configurato.");
    });

    test("solleva errore se VITE_GOOGLE_APP_ID non è configurato", () => {
      vi.stubEnv("VITE_GOOGLE_CLIENT_ID", "mock-client-id");
      vi.stubEnv("VITE_FIREBASE_API_KEY", "mock-api-key");
      vi.stubEnv("VITE_GOOGLE_APP_ID", "");

      expect(() => getGoogleConfig()).toThrow("VITE_GOOGLE_APP_ID non configurato.");
    });
  });

  describe("Iniezione Script Dinamici (loadScript)", () => {
    test("risolve immediatamente se lo script con l'id specificato esiste già nel DOM", async () => {
      const existingScript = document.createElement("script");
      existingScript.id = "script-gia-presente";
      document.head.appendChild(existingScript);

      const appendSpy = vi.spyOn(document.head, "appendChild");

      await expect(
        loadScript("https://example.com/already.js", "script-gia-presente")
      ).resolves.toBeUndefined();

      expect(appendSpy).not.toHaveBeenCalled();
    });

    test("crea l'elemento script con attributi corretti e risolve quando si attiva l'evento onload", async () => {
      const loadPromise = loadScript("https://example.com/test-script.js", "nuovo-script");

      const scriptElement = document.getElementById("nuovo-script") as HTMLScriptElement;
      expect(scriptElement).not.toBeNull();
      expect(scriptElement.src).toBe("https://example.com/test-script.js");
      expect(scriptElement.async).toBe(true);
      expect(scriptElement.defer).toBe(true);

      scriptElement.onload!(new Event("load"));

      await expect(loadPromise).resolves.toBeUndefined();
    });

    test("rigetta con messaggio di errore dedicato quando si attiva l'evento onerror", async () => {
      const loadPromise = loadScript("https://example.com/broken-script.js", "script-errore");

      const scriptElement = document.getElementById("script-errore") as HTMLScriptElement;
      expect(scriptElement).not.toBeNull();

      scriptElement.onerror!(new Event("error") as unknown as string);

      await expect(loadPromise).rejects.toThrow(
        "Impossibile caricare lo script Google: https://example.com/broken-script.js"
      );
    });
  });

  describe("Inizializzazione Librerie Google (loadGoogleLibraries)", () => {
    const setupPreloadedScripts = () => {
      const tokenScript = document.createElement("script");
      tokenScript.id = GOOGLE_TOKEN_SCRIPT_ID;
      document.head.appendChild(tokenScript);

      const pickerScript = document.createElement("script");
      pickerScript.id = GOOGLE_PICKER_SCRIPT_ID;
      document.head.appendChild(pickerScript);
    };

    test("solleva errore se window.gapi non è disponibile dopo il caricamento degli script", async () => {
      setupPreloadedScripts();
      delete window.gapi;

      await expect(loadGoogleLibraries()).rejects.toThrow("Google API (gapi) non disponibile.");
    });

    test("solleva errore se window.google.accounts.oauth2 non è disponibile", async () => {
      setupPreloadedScripts();

      window.gapi = {
        load: vi.fn((_api: string, callback: () => void) => callback()),
      };
      window.google = {} as typeof window.google;

      await expect(loadGoogleLibraries()).rejects.toThrow(
        "Google Identity Services non disponibile."
      );
    });

    test("solleva errore se window.google.picker non è disponibile", async () => {
      setupPreloadedScripts();

      window.gapi = {
        load: vi.fn((_api: string, callback: () => void) => callback()),
      };
      window.google = {
        accounts: {
          oauth2: { initTokenClient: vi.fn() },
        },
      } as typeof window.google;

      await expect(loadGoogleLibraries()).rejects.toThrow("Google Picker non disponibile.");
    });

    test("completa con successo se gapi e i namespace google sono pronti", async () => {
      setupPreloadedScripts();

      const mockGapiLoad = vi.fn((api: string, callback: () => void) => {
        if (api === "picker") callback();
      });

      window.gapi = {
        load: mockGapiLoad,
      };
      window.google = {
        accounts: {
          oauth2: { initTokenClient: vi.fn() },
        },
        picker: {
          PickerBuilder: vi.fn(),
        },
      } as typeof window.google;

      await expect(loadGoogleLibraries()).resolves.toBeUndefined();
      expect(mockGapiLoad).toHaveBeenCalledWith("picker", expect.any(Function));
    });
  });
});