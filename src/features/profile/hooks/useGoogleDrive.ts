import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useAuth } from "@/context/useAuth";
import { fetchWithSecurity } from "@/config/apiClient";
import { getCloudUrl } from "@/config/env";
import {
  GOOGLE_DRIVE_SCOPE,
  getGoogleConfig,
  loadGoogleLibraries,
  type GoogleIdentityTokenResponse,
  type GooglePickerResponse,
  type GoogleTokenClient,
  type GoogleWindow,
} from "./utilsGoogleDrive";

type SelectedGoogleFile = {
  id: string;
  name: string;
  mimeType: string;
};

type TokenData = {
  accessToken: string;
  expiresAt: number;
};

type OnSelectGoogleFile = (fileId: string, name: string, mimeType: string) => void;

export const useGoogleDrive = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [librariesReady, setLibrariesReady] = useState(false);

  const tokenClientRef = useRef<GoogleTokenClient | null>(null);
  const tokenRef = useRef<TokenData | null>(null);
  const pendingSelectionRef = useRef<OnSelectGoogleFile | null>(null);
  const hasRequestedTokenRef = useRef(false);
  const openPickerWithTokenRef = useRef<((token: string, callback: OnSelectGoogleFile) => void) | null>(null);

  const DOWNLOAD_CLOUD_ENDPOINT = getCloudUrl().DOWNLOAD_CLOUD_ENDPOINT;
  const isAuthenticated = Boolean(user);

  openPickerWithTokenRef.current = (token: string, onSelectFile: OnSelectGoogleFile) => {
    try {
      const { apiKey, projectNumber } = getGoogleConfig();
      const googleWindow = window as GoogleWindow;
      const pickerApi = googleWindow.google?.picker;

      if (!pickerApi) throw new Error("Google Picker non disponibile.");

      const view = new pickerApi.DocsView(pickerApi.ViewId.DOCS);
      view.setMimeTypes([
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ].join(","));

      const picker = new pickerApi.PickerBuilder()
        .addView(view)
        .setOAuthToken(token)
        .setDeveloperKey(apiKey)
        .setAppId(projectNumber)
        .setOrigin(window.location.origin)
        .setCallback((data: GooglePickerResponse) => {
          if (data.action === pickerApi.Action.CANCEL || data.action !== pickerApi.Action.PICKED) return;

          const doc = data.docs?.[0];
          if (!doc) {
            toast.error("Nessun file selezionato.");
            return;
          }

          const selectedFile: SelectedGoogleFile = {
            id: doc.id,
            name: doc.name,
            mimeType: doc.mimeType || "application/octet-stream",
          };

          onSelectFile(selectedFile.id, selectedFile.name, selectedFile.mimeType);
        })
        .build();

      picker.setVisible(true);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Errore sconosciuto.";
      toast.error(`Google Drive: ${message}`);
    }
  };

  useEffect(() => {
    let cancelled = false;

    if (!user) {
      tokenClientRef.current = null;
      tokenRef.current = null;
      pendingSelectionRef.current = null;
      hasRequestedTokenRef.current = false;
      setGoogleToken(null);
      setLibrariesReady(false);
      return;
    }

    setLibrariesReady(false);

    const initializeGoogle = async () => {
      const { clientId } = getGoogleConfig();
      await loadGoogleLibraries();
      if (cancelled) return;

      const googleWindow = window as GoogleWindow;
      const oauth2 = googleWindow.google?.accounts?.oauth2;
      if (!oauth2) throw new Error("Google Identity Services non disponibile.");

      const tokenClient = oauth2.initTokenClient({
        client_id: clientId,
        scope: GOOGLE_DRIVE_SCOPE,
        include_granted_scopes: true,
        callback: (response: GoogleIdentityTokenResponse) => {
          if (cancelled) return;

          if (response.error) {
            pendingSelectionRef.current = null;
            toast.error(response.error_description || response.error);
            return;
          }

          if (!response.access_token) {
            pendingSelectionRef.current = null;
            toast.error("Google non ha restituito un access token.");
            return;
          }

          if (
            response.scope &&
            oauth2.hasGrantedAllScopes &&
            !oauth2.hasGrantedAllScopes(response, GOOGLE_DRIVE_SCOPE)
          ) {
            pendingSelectionRef.current = null;
            toast.error("Non hai autorizzato l'accesso ai file Google Drive.");
            return;
          }

          const accessToken = response.access_token;
          const expiresIn = Math.max(1, Number(response.expires_in || 3600));

          tokenRef.current = {
            accessToken,
            expiresAt: Date.now() + expiresIn * 1000,
          };

          setGoogleToken(accessToken);
          hasRequestedTokenRef.current = true;

          const pendingCallback = pendingSelectionRef.current;
          pendingSelectionRef.current = null;
          if (pendingCallback) {
            openPickerWithTokenRef.current?.(accessToken, pendingCallback);
          }
        },
        error_callback: (error) => {
          if (cancelled) return;
          pendingSelectionRef.current = null;
          toast.error(error.message || "Errore durante l'autorizzazione Google.");
        },
      });

      if (cancelled) return;
      tokenClientRef.current = tokenClient;
      setLibrariesReady(true);
    };

    initializeGoogle().catch((error: unknown) => {
      if (cancelled) return;
      const message = error instanceof Error ? error.message : "Errore sconosciuto.";
      toast.error(`Google Drive: ${message}`);
    });

    return () => {
      cancelled = true;
      tokenClientRef.current = null;
    };
  }, [user]);

  const openPicker = useCallback(
    (onSelectFile: OnSelectGoogleFile): void => {
      if (!user) {
        toast.error("Devi essere autenticato nell'applicazione.");
        return;
      }

      if (!librariesReady || !tokenClientRef.current) {
        toast.error("Google Drive si sta inizializzando. Riprova tra qualche secondo.");
        return;
      }

      const cachedToken = tokenRef.current;
      if (cachedToken && cachedToken.expiresAt > Date.now() + 30000) {
        openPickerWithTokenRef.current?.(cachedToken.accessToken, onSelectFile);
        return;
      }

      if (pendingSelectionRef.current) return;
      pendingSelectionRef.current = onSelectFile;

      try {
        const tokenClient = tokenClientRef.current;
        if (!tokenClient) {
          pendingSelectionRef.current = null;
          toast.error("Client OAuth Google non disponibile.");
          return;
        }

        if (hasRequestedTokenRef.current) {
          tokenClient.requestAccessToken({ prompt: "" });
        } else {
          tokenClient.requestAccessToken();
        }
      } catch (error: unknown) {
        pendingSelectionRef.current = null;
        const message = error instanceof Error ? error.message : "Errore sconosciuto.";
        toast.error(`Impossibile richiedere l'accesso a Google Drive: ${message}`);
      }
    },
    [user, librariesReady]
  );

  const downloadFile = useCallback(
    async (fileId: string, fileName: string, mimeType: string): Promise<File> => {
      if (!user) throw new Error("Utente non autenticato.");
      if (!fileId) throw new Error("ID del file Google Drive mancante.");

      const tokenData = tokenRef.current;
      if (!tokenData || tokenData.expiresAt <= Date.now() + 15000) {
        throw new Error("Token Google scaduto. Riapri Google Drive e autorizza nuovamente l'accesso.");
      }

      setLoading(true);
      try {
        const response = await fetchWithSecurity(DOWNLOAD_CLOUD_ENDPOINT, {
          provider: "google",
          providerToken: tokenData.accessToken,
          fileId,
        });

        if (!response.ok) {
          throw new Error(`Download Google Drive fallito (${response.status}).`);
        }

        const blob = await response.blob();
        return new File([blob], fileName, {
          type: mimeType || blob.type || "application/octet-stream",
        });
      } finally {
        setLoading(false);
      }
    },
    [user, DOWNLOAD_CLOUD_ENDPOINT]
  );

  return {
    isAuthenticated,
    googleToken,
    librariesReady,
    openPicker,
    downloadFile,
    loading,
  };
};
