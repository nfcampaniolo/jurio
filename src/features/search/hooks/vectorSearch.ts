import { ensureAnonAuth } from "@/features/auth/hooks/auth";
import type {
  SearchFilter,
  DocumentoGiurisprudenza,
} from "@/interfaces/interfaces";
import { getVectorSearchUrl } from "@/config/env";

// -----------------------------------------------------------------------------
// INTERFACCE
// -----------------------------------------------------------------------------

export interface SentenceMatch extends DocumentoGiurisprudenza {
  id: string;

  highlighted_massima?: string;
  highlighted_fattispecie?: string;
  highlighted_preview?: string;

  _distance: number;
  _rankingDistance: number;
  _matchCount: number;
  _source: string;

  [key: string]: unknown;
}

export interface WebFallbackData {
  sintesi: string;
  queryAlternativa?: string;
}

interface VectorSearchRequest {
  query: string;
  limit: number;
  filters: SearchFilter[];
}

interface VectorSearchResponse {
  ids: string[];
  allMatches: SentenceMatch[];
  topMatches: SentenceMatch[];
  status: string;
  webFallback?: WebFallbackData | null;
  metadata?: {
    total: number;
    keywords: string[];
    threshold: number;
    bestDistance: number | null;
  };
}

const VECTOR_SEARCH_ENDPOINT =
  getVectorSearchUrl();

// -----------------------------------------------------------------------------
// RICERCA PRINCIPALE
// -----------------------------------------------------------------------------

export async function vectorSearch(
  queryText: string,
  filters?: SearchFilter[],
  numberPages?: number
): Promise<{
  ids: string[];
  allMatches: SentenceMatch[];
  topMatches: SentenceMatch[];
  keywords: string[];
  status: string;
  bestDistance: number | null;
  webFallback?: WebFallbackData | null;
}> {
  console.log(
    `[VectorSearch] Inizio ricerca ibrida. Query: "${queryText}"`,
    {
      filters,
      limit: numberPages,
    }
  );

  await ensureAnonAuth();

  const response = await executeVectorSearch(
    queryText,
    filters,
    numberPages
  );

  console.log(
    `[VectorSearch] Ricerca completata. Status: ${response.status}`
  );

  if (response.status === "GEMINI_FALLBACK") {
    console.warn(
      `[VectorSearch] Attivato Fallback Web! La migliore distanza DB era: ${response.metadata?.bestDistance}`
    );
  }

  return {
    ids: response.ids || [],
    allMatches: response.allMatches || [],
    topMatches: response.topMatches || [],
    keywords: response.metadata?.keywords || [],
    status: response.status,
    bestDistance:
      response.metadata?.bestDistance ?? null,
    webFallback: response.webFallback,
  };
}

// -----------------------------------------------------------------------------
// ESECUZIONE PRIVATA
// -----------------------------------------------------------------------------

async function executeVectorSearch(
  queryText: string,
  filters?: SearchFilter[],
  numberPages?: number
): Promise<VectorSearchResponse> {
  try {
    if (!VECTOR_SEARCH_ENDPOINT) {
      console.error(
        "[VectorSearch] VECTOR_SEARCH_ENDPOINT mancante nelle variabili d'ambiente."
      );

      throw new Error(
        "VECTOR_SEARCH_ENDPOINT non configurato."
      );
    }

    // -------------------------------------------------------------------------
    // Auth + App Check
    // -------------------------------------------------------------------------

    const { getSecurityTokens } = await import(
      "@/infrastructure/security"
    );

    const {
      authToken,
      appCheckToken,
    } = await getSecurityTokens();

    // -------------------------------------------------------------------------
    // Payload
    // -------------------------------------------------------------------------

    const requestBody: VectorSearchRequest = {
      query: queryText,
      limit: numberPages || 20,
      filters: filters || [],
    };

    // -------------------------------------------------------------------------
    // Headers
    // -------------------------------------------------------------------------

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${authToken}`,
    };

    if (appCheckToken) {
      headers["X-Firebase-AppCheck"] =
        appCheckToken;
    }

    // -------------------------------------------------------------------------
    // Request
    // -------------------------------------------------------------------------

    const response = await fetch(
      VECTOR_SEARCH_ENDPOINT,
      {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      console.error(
        `[VectorSearch] Errore API backend. Status: ${response.status} - ${response.statusText}`
      );

      throw new Error(
        `Errore API: ${response.status}`
      );
    }

    return (
      await response.json()
    ) as VectorSearchResponse;
  } catch (error) {
    console.error(
      "[VectorSearch] Errore fatale in executeVectorSearch:",
      error
    );

    throw error;
  }
}