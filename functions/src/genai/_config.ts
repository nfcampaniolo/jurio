import { genkit } from "genkit";
import { vertexAI } from "@genkit-ai/google-genai";

// ─────────────────────────────────────────────
// GENKIT INIT (Vertex AI Enterprise - Conforme UE)
// ─────────────────────────────────────────────

export const ai = genkit({
  plugins: [
    vertexAI({
      projectId: process.env.GCLOUD_PROJECT,
      location: "eu",
    }),
  ],
  // Generation-level config can override this default for complex tasks.
  model: vertexAI.model("gemini-3.5-flash", {
    thinkingConfig: { thinkingLevel: "LOW" },
  }),
});

// ─────────────────────────────────────────────
// TYPES & INTERFACES
// ─────────────────────────────────────────────

export type RagSourceType = "sentence" | "document" | "doctrine" | "distinguish" | "manual";
export type WebFocusType = "institutional" | "editorial" | "all";

// ─────────────────────────────────────────────
// CONFIGURATION (CFG)
// ─────────────────────────────────────────────

export const CFG = {
  // 1. Distanze RAG (Thresholds per Cosine Distance)
  ragDistance: {
    sentence: 0.65,
    doctrine: 0.68,
    document: 0.60,
    distinguish: 0.62,
    manual: 0.60,
    fallbackMax: 0.75,
  } as Record<RagSourceType | "fallbackMax", number>,

  // 2. Limiti di Fetching e Batching
  limits: {
    vectorFetchLimit: 30,
    maxDbLimit: 5,
    maxDistinguishLimit: 3,
    maxManualLimit: 2,
    semanticSafeLimit: 5,
    chunkParentLimit: 5,
    excludeIdsLimit: 10,
    maxDocsPerInQuery: 30,
    historyWindow: 6,
    maxSources: 10,
  },

  // 3. Troncamento e Limiti Caratteri
  maxChars: {
    field: 3000,
    chunk: 3000,
    web: 1200,
  },

  // 4. Scoring e Modello Embedding
  embedding: {
    model: "text-embedding-3-small",
    dimensions: 1536,
    zeroMatchPenalty: 1.5,
    matchBonus: 0.75,
    sentenceMultiplier: 0.85,
  },

  // 5. Rate Limiting / Quota Ricerca
  researchQuota: {
    perMinute: 20,
    perDay: 200,
  },

  // 6. Domini Web Whitelisted
  domains: {
    institutional: [
      "normattiva.it",
      "gazzettaufficiale.it",
      "cortecostituzionale.it",
      "giustizia.it",
      "cortedicassazione.it",
      "giustizia-amministrativa.it",
    ],
    practices: [
      "agenziaentrate.gov.it",
      "inps.it",
      "inail.it",
      "anticorruzione.it",
      "garanteprivacy.it",
      "bancaditalia.it",
      "lavoro.gov.it",
      "funzionepubblica.gov.it",
      "rgs.mef.gov.it",
    ],
    editorial: [
      "altalex.com",
      "diritto.it",
      "ilcaso.it",
      "sistemapenale.it",
    ],
  },

} as const;

// ─────────────────────────────────────────────
// COMPUTED / DERIVED CONFIG HELPERS
// ─────────────────────────────────────────────

/**
 * Calcola il limite massimo di documenti da recuperare dal Vector Search.
 */
export const MAX_VECTOR_FETCH = Math.max(CFG.limits.vectorFetchLimit, 10);

/**
 * Mappatura rapida e retrocompatibile per le soglie di distanza RAG.
 */
export const RAG_DISTANCE = CFG.ragDistance;

/**
 * Restituisce i domini target per la ricerca web in base al focus richiesto.
 */
export function getWebDomains(focus: WebFocusType): string[] {
  switch (focus) {
    case "institutional":
      return [...CFG.domains.institutional];
    case "editorial":
      return [...CFG.domains.editorial];
    case "all":
    default:
      return [
        ...CFG.domains.institutional,
        ...CFG.domains.practices,
        ...CFG.domains.editorial,
      ];
  }
}