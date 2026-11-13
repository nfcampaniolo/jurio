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
    "@/infrastructure/security"
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
// ADMIN REPORT DOWNLOAD
// -----------------------------------------------------------------------------

export type AdminReportType = "usage" | "conversations" | "deep_analysis";

export const ADMIN_REPORT_OPTIONS: ReadonlyArray<{
  type: AdminReportType;
  label: string;
  description: string;
}> = [
  { type: "usage", label: "Utilizzi", description: "Utilizzi aggregati per servizio" },
  { type: "conversations", label: "Chat e fascicoli", description: "Conversazioni del mese per utente" },
  { type: "deep_analysis", label: "Deep Analysis", description: "Sessioni di analisi approfondita" },
];

const REPORT_FILE = /^(\d{4}_\d{2})\.json$/;

/**
 * Scarica l'ultimo report mensile disponibile per la tipologia indicata (reports/{tipo}/monthly/{YYYY_MM}.json).
 * Accesso garantito dalle regole di Storage (solo admin). Si usa getBlob e non getDownloadURL:
 * quest'ultimo genera un link con token che resterebbe accessibile a chiunque lo possieda.
 * Richiede la configurazione CORS del bucket (cors.json nella root del progetto).
 */
export async function downloadLatestAdminReport(type: AdminReportType): Promise<string> {
  try {
    return await fetchAndSaveLatestReport(type);
  } catch (error) {
    if ((error as { code?: string })?.code === "storage/unauthorized") {
      throw new Error("Accesso ai report riservato agli amministratori.");
    }
    throw error;
  }
}

async function fetchAndSaveLatestReport(type: AdminReportType): Promise<string> {
  const { getStorageClient } = await import("@/infrastructure/storageClient");
  const { ref, list, getBlob } = await import("firebase/storage");
  const storage = await getStorageClient();

  const folder = `reports/${type}/monthly`;
  const months: string[] = [];
  let pageToken: string | undefined;
  do {
    const page = await list(ref(storage, folder), { maxResults: 1000, pageToken });
    months.push(...page.items.map((item) => item.name).filter((name) => REPORT_FILE.test(name)));
    pageToken = page.nextPageToken;
  } while (pageToken);

  const latest = months.sort().at(-1);
  if (!latest) {
    throw new Error("Nessun report disponibile per questa tipologia.");
  }

  const blob = await getBlob(ref(storage, `${folder}/${latest}`));
  const fileName = `jurio_report_${type}_${latest}`;

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Revoca differita: alcuni browser annullano il download se l'URL viene revocato subito
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return fileName;
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