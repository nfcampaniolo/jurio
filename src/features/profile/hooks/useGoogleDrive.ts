import { useRef, useState } from "react";
import { toast } from "react-hot-toast";
import { useAuth } from "@/context/useAuth";
import { fetchWithSecurity } from "@/config/apiClient";
import { getCloudUrl } from "@/config/env";

import {
  GOOGLE_DRIVE_SCOPE,
  GOOGLE_TOKEN_SCRIPT,
  GOOGLE_TOKEN_SCRIPT_ID,
} from "./utilsGoogleDrive";
import { getGoogleConfig, loadScript, loadGoogleLibraries } from "./utilsGoogleDrive";
import type { GoogleIdentityTokenResponse, GooglePickerResponse } from "@/interfaces/interfaces";

export const useGoogleDrive = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [googleToken, setGoogleToken] = useState<string | null>(null);

  const googleTokenRef = useRef<string | null>(null);
  const DOWNLOAD_CLOUD_ENDPOINT = getCloudUrl().DOWNLOAD_CLOUD_ENDPOINT;
  const isAuthenticated = Boolean(user);

  const getGoogleAccessToken = async (): Promise<string | null> => {
    const { clientId } = getGoogleConfig();
    await loadScript(GOOGLE_TOKEN_SCRIPT, GOOGLE_TOKEN_SCRIPT_ID);

    const googleAccounts = window.google?.accounts;
    if (!googleAccounts?.oauth2) {
      throw new Error("Google Identity Services non disponibile.");
    }

    return new Promise((resolve, reject) => {
      try {
        const tokenClient = googleAccounts.oauth2.initTokenClient({
          client_id: clientId,
          scope: GOOGLE_DRIVE_SCOPE,

          callback: (response: GoogleIdentityTokenResponse) => {
            if (response.error) {
              reject(new Error(response.error_description || response.error));
              return;
            }

            if (!response.access_token) {
              reject(new Error("Google non ha restituito un access token."));
              return;
            }

            googleTokenRef.current = response.access_token;
            setGoogleToken(response.access_token);
            resolve(response.access_token);
          },
        });

        tokenClient.requestAccessToken({
          prompt: googleTokenRef.current ? "" : "consent",
        });
      } catch (error) {
        reject(error);
      }
    });
  };

  const openPicker = async (
    onSelectFile: (fileId: string, name: string, mimeType: string) => void
  ): Promise<void> => {
    try {
      if (!user) {
        toast.error("Devi essere autenticato nell'applicazione.");
        return;
      }

      const { apiKey, appId } = getGoogleConfig();
      await loadGoogleLibraries();

      let token = googleTokenRef.current;
      if (!token) {
        token = await getGoogleAccessToken();
        if (!token) return;
      }

      const googlePicker = window.google?.picker;
      if (!googlePicker) {
        throw new Error("Google Picker non disponibile.");
      }

      const view = new googlePicker.DocsView(googlePicker.ViewId.DOCS);
      view.setMimeTypes(
        [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ].join(",")
      );

      const picker = new googlePicker.PickerBuilder()
        .addView(view)
        .setOAuthToken(token)
        .setDeveloperKey(apiKey)
        .setAppId(appId)
        .setCallback((data: GooglePickerResponse) => {
          if (data.action === googlePicker.Action.CANCEL) {
            return;
          }

          if (data.action !== googlePicker.Action.PICKED) {
            return;
          }

          const doc = data.docs?.[0];
          if (!doc) {
            toast.error("Nessun file selezionato.");
            return;
          }

          console.log("Google Drive file selezionato:", {
            id: doc.id,
            name: doc.name,
            mimeType: doc.mimeType,
          });

          onSelectFile(doc.id, doc.name, doc.mimeType);
        })
        .build();

      picker.setVisible(true);
    } catch (error: unknown) {
      console.error("Errore Google Drive / Picker:", error);
      const message = error instanceof Error ? error.message : "Errore sconosciuto.";
      toast.error(`Google Drive: ${message}`);
    }
  };

  const downloadFile = async (
    fileId: string,
    fileName: string,
    mimeType: string
  ): Promise<File> => {
    if (!user) {
      throw new Error("Utente non autenticato.");
    }

    const token = googleTokenRef.current;
    if (!token) {
      throw new Error("Token Google Drive non disponibile.");
    }

    setLoading(true);

    try {
      const response = await fetchWithSecurity(DOWNLOAD_CLOUD_ENDPOINT, {
        provider: "google",
        providerToken: token,
        fileId,
      });

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        console.error("Google Drive download error:", {
          status: response.status,
          body,
          fileId,
          fileName,
          mimeType,
        });

        throw new Error(`Download Google Drive fallito (${response.status}).`);
      }

      const blob = await response.blob();

      return new File([blob], fileName, {
        type: mimeType || blob.type || "application/octet-stream",
      });
    } finally {
      setLoading(false);
    }
  };

  return {
    isAuthenticated,
    googleToken,
    openPicker,
    downloadFile,
    loading,
  };
};