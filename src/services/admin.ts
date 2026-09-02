import { getAdminUrl } from "@/config/env";

import { useState } from "react";

export type UploaderStatus =
  | "idle"
  | "loading"
  | "success"
  | "error";

// -----------------------------------------------------------------------------
// INTERFACCE
// -----------------------------------------------------------------------------

export interface AdminMaintenanceParams {
  newFonte?: string;
  newFonteLogo?: string;
  materia?: string;
  sezione?: string;
  organo_giudicante?: string;
}

export interface MaintenanceProgressData {
  message?: string;
  status?: string;
  step?: number;
  action?: string;
  batch?: number;
  updatedSoFar?: number;
  scannedSoFar?: number;
  totalUpdated?: number;
  totalScanned?: number;
  finalStats?: {
    fontiAggiornate?: number;
    documentiScansionati?: number;
    categorieSuperflueTrovate?: number;
  };
  error?: string;
}

// -----------------------------------------------------------------------------
// SECURITY
// -----------------------------------------------------------------------------

async function getSecureHeaders(): Promise<HeadersInit> {
  const { getSecurityTokens } = await import(
    "@/services/security"
  );

  const {
    authToken,
    appCheckToken,
  } = await getSecurityTokens();

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${authToken}`,
  };

  if (appCheckToken) {
    headers["X-Firebase-AppCheck"] = appCheckToken;
  }

  return headers;
}

// -----------------------------------------------------------------------------
// ADMIN MAINTENANCE - SSE
// -----------------------------------------------------------------------------

export async function executeAdminMaintenanceTask(
  params: AdminMaintenanceParams,
  onProgress?: (
    progressData: MaintenanceProgressData
  ) => void
): Promise<void> {
  const endpoint =
    getAdminUrl().ADMIN_MAINTENANCE_TASK_ENDPOINT;

  if (!endpoint) {
    throw new Error(
      "Endpoint manutenzione non configurato"
    );
  }

  const headers = await getSecureHeaders();

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorData = await response
      .json()
      .catch(() => ({}));

    throw new Error(
      errorData.error ||
        `Errore API: ${response.status}`
    );
  }

  if (!response.body) {
    throw new Error(
      "La risposta non contiene uno stream decodificabile."
    );
  }

  await processSseStream(
    response.body,
    onProgress
  );
}

// -----------------------------------------------------------------------------
// ADMIN MERGE CATEGORY
// -----------------------------------------------------------------------------

export async function executeAdminMergeCategoryTask(
  vecchiaCategoria: string,
  nuovaCategoria: string | null
): Promise<{
  success: boolean;
  message: string;
}> {
  const endpoint =
    getAdminUrl().ADMIN_SUBSTITUTION_TASK_ENDPOINT;

  if (!endpoint) {
    throw new Error(
      "Endpoint sostituzione tassonomia non configurato"
    );
  }

  const headers = await getSecureHeaders();

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      vecchiaCategoria,
      nuovaCategoria,
    }),
  });

  const responseData = await response.json();

  if (!response.ok) {
    throw new Error(
      responseData.error ||
        `Errore API: ${response.status}`
    );
  }

  return responseData;
}

// -----------------------------------------------------------------------------
// SSE PARSER
// -----------------------------------------------------------------------------

async function processSseStream(
  body: ReadableStream<Uint8Array>,
  onProgress?: (
    data: MaintenanceProgressData
  ) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");

  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, {
      stream: true,
    });

    const lines = buffer.split("\n");

    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) {
        continue;
      }

      const dataStr = line
        .slice(6)
        .trim();

      if (dataStr === "[DONE]") {
        return;
      }

      try {
        const parsedData =
          JSON.parse(
            dataStr
          ) as MaintenanceProgressData;

        if (parsedData.error) {
          throw new Error(
            parsedData.error
          );
        }

        onProgress?.(parsedData);
      } catch (error) {
        if (error instanceof SyntaxError) {
          console.warn(
            "Impossibile parsare chunk SSE:",
            dataStr
          );
        } else {
          throw error;
        }
      }
    }
  }
}

export function useContentUploader() {
  // Stati degli input
  const [id, setId] = useState<string>(""); // NUOVO STATO
  const [text, setText] = useState<string>("");
  const [linksText, setLinksText] = useState<string>("");
  const [images, setImages] = useState<string>("");

  const [status, setStatus] = useState<UploaderStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");

  const handleResetStatus = () => {
    if (status !== "idle") setStatus("idle");
  };

  const handleUpload = async () => {
    setStatus("loading");
    setErrorMessage("");

    try {
      // 1. Pulizia e Validazione
      const cleanId = id.trim();
      const cleanText = text.trim();
      const cleanImages = images.trim();
      const linksArray = linksText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (!cleanId) {
        throw new Error("Il campo ID è obbligatorio.");
      }
      if (!cleanText) {
        throw new Error("Il campo Testo non può essere vuoto.");
      }
      if (linksArray.length === 0) {
        throw new Error("Devi inserire almeno un Link valido.");
      }
      if (!cleanImages) {
        throw new Error("Il campo Immagine è obbligatorio.");
      }

      // 2. Chiamata API
      const endpoint =  getAdminUrl().ADMIN_CONTENT_UPLOAD_ENDPOINT;
      if (!endpoint) throw new Error("Endpoint non configurato.");

      const headers = await getSecureHeaders();
    
      const response = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          id: cleanId,
          text: cleanText,
          links: linksArray,
          images: cleanImages,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.error || `Errore API: ${response.status}`);
      }

      // 3. Successo e Reset
      setStatus("success");
      setTimeout(() => {
        setStatus("idle");
        setId(""); // RESET ID
        setText("");
        setLinksText("");
        setImages("");
      }, 3000);

    } catch (error: unknown) {
      console.error(error);
      setErrorMessage(
        error instanceof Error ? error.message : "Errore sconosciuto."
      );
      setStatus("error");
    }
  };

  return {
    id,
    text,
    linksText,
    images,
    status,
    errorMessage,
    setId: (val: string) => { setId(val); handleResetStatus(); },
    setText: (val: string) => { setText(val); handleResetStatus(); },
    setLinksText: (val: string) => { setLinksText(val); handleResetStatus(); },
    setImages: (val: string) => { setImages(val); handleResetStatus(); },
    handleUpload,
  };
}