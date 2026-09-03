// src/hooks/useOneDrive.ts
import { useState, useCallback, useEffect } from "react";
import { PublicClientApplication } from "@azure/msal-browser";
import { useAuth } from "@/context/useAuth";
import { toast } from "react-hot-toast";
import { fetchWithSecurity } from "@/config/apiClient"; 

// Devi registrare un'app su Azure (Entra ID) e inserire qui il Client ID
const MSAL_CONFIG = {
  auth: {
    clientId: "INSERISCI_IL_TUO_MICROSOFT_CLIENT_ID_QUI", 
    authority: "https://login.microsoftonline.com/common", 
  }
};
const msalInstance = new PublicClientApplication(MSAL_CONFIG);

export interface OneDriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webUrl?: string;
}

export const useOneDrive = () => {
  const { user } = useAuth();
  const [files, setFiles] = useState<OneDriveFile[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Memorizziamo il token OAuth di Microsoft Graph
  const [microsoftToken, setMicrosoftToken] = useState<string | null>(null);

  // Inizializza MSAL al primo mount (richiesto da msal-browser v3)
  useEffect(() => {
    msalInstance.initialize().catch(console.error);
  }, []);

  const isAuthenticated = !!user && !!microsoftToken;

  const authenticate = async () => {
    try {
      const loginResponse = await msalInstance.loginPopup({
        scopes: ["Files.Read", "Sites.Read.All"]
      });
      
      if (!loginResponse.accessToken) {
        throw new Error("Impossibile ottenere il token di accesso Microsoft.");
      }

      setMicrosoftToken(loginResponse.accessToken);
      toast.success("OneDrive connesso con successo!");
      
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Errore durante l'autenticazione Microsoft.";
      setError(message);
      toast.error(message);
    }
  };

  useEffect(() => {
    if (microsoftToken) {
      fetchFiles();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [microsoftToken]);

  const fetchFiles = useCallback(async () => {
    if (!user || !microsoftToken) return;
    
    setLoading(true);
    setError(null);
    try {
      // Usiamo il tuo endpoint listCloudFiles, ma con provider "microsoft"
      const response = await fetchWithSecurity("/api/listCloudFiles", {
        provider: "microsoft",
        providerToken: microsoftToken
      });

      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Il server ha risposto in modo anomalo.");
      }

      if (!response.ok) throw new Error("Impossibile recuperare i file da OneDrive.");

      const data = await response.json();
      setFiles(data.files || []);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Errore sconosciuto";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [user, microsoftToken]);

  const downloadFile = async (fileId: string, fileName: string, mimeType: string): Promise<File> => {
    if (!user || !microsoftToken) {
      throw new Error("Devi autenticarti prima di poter scaricare un file.");
    }

    const response = await fetchWithSecurity("/api/downloadCloudFile", {
      provider: "microsoft",
      providerToken: microsoftToken,
      fileId: fileId
    });

    if (!response.ok) {
      throw new Error("Impossibile scaricare il file dal cloud.");
    }

    const blob = await response.blob();
    return new File([blob], fileName, { type: mimeType || blob.type || "application/pdf" });
  };

  return {
    isAuthenticated,
    authenticate,
    files,
    loading,
    error,
    fetchFiles,
    downloadFile
  };
};