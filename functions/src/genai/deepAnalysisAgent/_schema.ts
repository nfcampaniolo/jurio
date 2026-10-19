import { z } from 'genkit';

export const ConceptMapNodeSchema = z.object({
  id: z.string(),
  kind: z.enum([
    "quesito",
    "provvedimento",
    "dottrina",
    "web",
    "documento",
    "norma",
    "tesi",
  ]),
  source: z.enum([
    "internal",
    "doctrine",
    "web",
    "document",
    "reference",
    "system",
  ]),
  sourceId: z.string().nullable(),
  label: z.string(),
  url: z.string().nullable().optional(),
  resolved: z.boolean().default(true),
  used: z.boolean().default(true),
  metadata: z.record(z.any()).optional(),
});

export const ConceptMapEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  type: z.enum([
    "rilevante_per",
    "cita",
    "richiama_norma",
    "supporta",
    "contrasta",
    "correlato",
  ]),
});

export const ConceptMapSchema = z.object({
  version: z.literal(1),
  quesito: z.string(),
  rootId: z.string(),
  nodes: z.array(ConceptMapNodeSchema).max(200),
  edges: z.array(ConceptMapEdgeSchema).max(500),
  sourceIds: z.array(z.string()).max(200),
  stats: z.object({
    provvedimenti: z.number(),
    dottrina: z.number(),
    web: z.number(),
    documenti: z.number(),
    norme: z.number(),
    tesi: z.number(),
    relazioni: z.number(),
  }),
});

export const PrecedenteMinimaleSchema = z.object({
  id: z.string().min(1).describe("TASSATIVO: Se fonte='web', inserisci l'URL completo. Se fonte='interna', inserisci ESCLUSIVAMENTE l'ID univoco del documento Firestore (es. hash alfanumerico dell'ID), MAI il numero della sentenza o la data."),
  fonte: z.enum(["interna", "web"]),
  gradoPertinenza: z.number().min(0).max(100),
  escluso: z.boolean().optional(),
  nuova: z.boolean().optional(),
});

export const OrientamentoSchema = z.object({
  titoloTesi: z.string().describe("Sintesi chiara dell'orientamento giuridico."),
  argomentazioneLogica: z.string().describe("Motivazione e ratio alla base di questo orientamento."),
  fonti: z.array(PrecedenteMinimaleSchema).describe("Sentenze e documenti che supportano specificamente QUESTA tesi.")
});

export const ResearchOutputSchema = z.object({
  inquadramento: z.object({
    qualificazioneGiuridica: z.string().describe("Qualificazione tecnica e sintetica."),
    fattispecieEstratta: z.string().describe("Sintesi dei fatti rilevanti."),
    normeRiferimento: z.array(z.string()).describe("Norme e articoli pertinenti."),
  }),
  mappaDialettica: z.object({
    orientamentoFavorevole: OrientamentoSchema.nullable().describe("La tesi che supporta la richiesta/posizione dell'utente."),
    orientamentoContrario: OrientamentoSchema.nullable().describe("La tesi avversa, orientamento minoritario ostile o rischi."),
    puntiAperti: z.array(z.string()).describe("Questioni irrisolte, vuoti normativi o oscillazioni non composte."),
  }),
  mappaConcettuale: ConceptMapSchema,
});

export const ResearchOutputWithConceptMapSchema = ResearchOutputSchema.extend({
  mappaConcettuale: ConceptMapSchema,
});

export const ResearchMappingSchema = ResearchOutputSchema.pick({
  inquadramento: true,
  mappaDialettica: true,
});

export const DeepAnalysisConfigSchema = z.object({
  confidenceLevel: z.number().min(0).max(100).default(80),
  sourceWeb: z.boolean().default(true),
  sourceInternalDB: z.boolean().default(true),
  sourceDoctrine: z.boolean().default(true),
  webLimit: z.number().int().min(1).max(10).default(5),
});

export const InquadramentoSchema = z
  .object({
    qualificazioneGiuridica: z.string().default(""),
    fattispecieEstratta: z.string().default(""),
    normeRiferimento: z.array(z.string()).default([]),
  })
  .passthrough();

const FonteDialetticaSchema = z
  .object({
    id: z.string(),
    fonte: z.enum(["web", "interna"]),
    gradoPertinenza: z.number(),
    escluso: z.boolean().optional(),
    nuova: z.boolean().optional(),
  })
  .passthrough();

export const MappaDialetticaSchema = z
  .object({
    orientamentoFavorevole: z
      .object({
        titoloTesi: z.string(),
        argomentazioneLogica: z.string(),
        fonti: z.array(FonteDialetticaSchema),
      })
      .nullable(),
    orientamentoContrario: z
      .object({
        titoloTesi: z.string(),
        argomentazioneLogica: z.string(),
        fonti: z.array(FonteDialetticaSchema),
      })
      .nullable(),
    puntiAperti: z.array(z.string()),
  })
  .passthrough();

export type ResearchSource = {
  nodeId: string;
  sourceId: string;
  source: "internal" | "doctrine" | "web" | "document";
  kind: "provvedimento" | "dottrina" | "web" | "documento";
  label: string;
  url: string | null;
  metadata: Record<string, any>;
  normeCitate: string[];
  precedentiCitati: Array<{
    numero: string;
    anno: number | null;
    sezione?: string;
  }>;
};

export const ReportSintesiSchema = z.object({
  titoloReport: z.string().describe("Un titolo formale e riassuntivo per il parere strategico."),
  executiveSummary: z.string().describe("Sintesi operativa in 2-3 frasi dell'esito dell'indagine. Qual è la risposta al quesito?"),
  contestoENorme: z.string().describe("Breve riassunto della fattispecie e delle norme di riferimento (Inquadramento)."),
  argomentazioniAzione: z.array(z.string()).describe("I punti di forza e le tesi a favore. DEVI citare l'ID delle fonti a supporto."),
  rischiEEccezioni: z.array(z.string()).describe("Le debolezze, i rischi e le tesi contrarie. DEVI citare l'ID delle fonti ostili."),
  conclusioniStrategiche: z.string().describe("Il suggerimento operativo finale. Come deve muoversi l'utente alla luce dei punti aperti?")
});
