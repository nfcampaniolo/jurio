import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai'

// ─────────────────────────────────────────────
// GENKIT INIT
// ─────────────────────────────────────────────

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.5-flash', 
});

// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────

export const CFG = {
  MAX_ALLOWED_DISTANCE: 0.75,
  ZERO_MATCH_PENALTY: 1.5,
  MATCH_BONUS: 0.75,
  SENTENCE_MULTIPLIER: 0.85,

  MAX_FIELD_CHARS: 3000,
  MAX_CHUNK_CHARS: 2000,
  MAX_WEB_CHARS: 1200,

  VECTOR_FETCH_LIMIT: 75,
  SEMANTIC_SAFE_LIMIT: 5,
  CHUNK_PARENT_LIMIT: 5,
  EXCLUDE_IDS_LIMIT: 10,
  HISTORY_WINDOW: 10,
  MAX_SOURCES: 10,

  EMBEDDING_MODEL: "text-embedding-3-small",
  EMBEDDING_DIMS: 1536,

  DOMAINS_ISTITUZIONALE: [
    "normattiva.it", "gazzettaufficiale.it", "cortecostituzionale.it", "giustizia.it",
  ],
  DOMAINS_EDITORIALE: [
    "altalex.com", "diritto.it", "ilcaso.it", "sistemapenale.it",
  ],
  DOMAINS_PRASSI: [
    "agenziaentrate.gov.it", "inps.it", "inail.it", "anticorruzione.it",
    "garanteprivacy.it", "bancaditalia.it", "lavoro.gov.it", 
    "funzionepubblica.gov.it", "rgs.mef.gov.it", "giustizia-amministrativa.it"
  ],
} as const;

// ─────────────────────────────────────────────
// SCHEMAS
// ─────────────────────────────────────────────

//CHAT

export const ChatMessageSchema = z.object({
  role: z.enum(["user", "model", "system"]),
  content: z.string(),
});

//RESEARCH

export const GeminiFallbackInputSchema = z.object({
  query: z.string(),
});

export const GeminiFallbackOutputSchema = z.object({
  sintesi: z.string().describe("Sintesi strutturata (max 3 paragrafi) sull'argomento giuridico."),
  queryAlternativa: z.string().describe("Nuova frase di ricerca semantica ottimizzata con termini tecnici."),
}).nullable();

//METADATI

export const EstraiMetadatiInputSchema = z.object({
  chatContext: z.string(),
  metadatiAttuali: z.record(z.any()),
});

export const EstraiMetadatiOutputSchema = z.object({
  dati_nuovi_o_aggiornati: z.array(
    z.object({
      chiave: z.string().describe("Esempio: 'Giudice', 'Valore Causa', 'Controparte', 'Data Sinistro'"),
      valore: z.string().describe("Il valore estratto. Usa formati standard (es. YYYY-MM-DD per le date) se possibile.")
    })
  )
});

//WORD

export const FonteSchema = z.object({
  id: z.string(),
  titolo: z.string(),
  url: z.string().optional(),
  score: z.number().optional(),
});

export const FonteDettagliataSchema = z.object({
  id: z.string().optional().describe("L'identificativo esatto (id) restituito dal tool. DEVE essere sempre conservato per creare il link."),
  url: z.string().optional().describe("L'indirizzo web (url) restituito dal tool, se presente."),
  tipo: z.enum(["Sezioni Unite", "Cassazione", "Merito", "Altra"]).describe("La gerarchia dell'organo giudicante."),
  riferimento: z.string().describe("Estremi della pronuncia (es. Cass. Civ. n. 1234/2023)."),
  data: z.string().optional().describe("Data della pronuncia, se verificata."),
  rilevanza: z.string().describe("Spiegazione sintetica del perché questa specifica fonte è pertinente alla tesi."),
});

export const ContrastoSchema = z.object({
  riferimento: z.string().describe("Estremi della pronuncia contrastante."),
  descrizione: z.string().describe("Breve sintesi dell'orientamento difforme."),
});

export const TesiReviewSchema = z.object({
  id: z.string().describe("Identificativo univoco della tesi analizzata (es. T1, T2)."),
  testoOriginale: z.string().describe("Copia-incolla letterale, contiguo e verbatim dal testo dell'utente. VIETATO parafrasare o correggere errori."),
  tesiGiuridica: z.string().describe("Formulazione sintetica e tecnica della questione giuridica individuata nel frammento."),
  semaforo: z.enum(["VERDE", "GIALLO", "ROSSO"]),
  livelloVerifica: z.enum(["ALTO", "MEDIO", "BASSO"]).describe("Riflette la qualità e la quantità delle fonti trovate, non la correttezza della tesi."),
  motivazione: z.string().describe("Spiegazione tecnica e sintetica del motivo della classificazione a semaforo."),
  orientamento: z.string().describe("Ricostruzione dell'attuale orientamento giurisprudenziale rilevato."),
  fonti: z.array(FonteDettagliataSchema).describe("Fonti REALI restituite dai tool a supporto della decisione."),
  contrasti: z.array(ContrastoSchema).optional().describe("Eventuali orientamenti difformi rilevati."),
  notaRicerca: z.string().optional().describe("Eventuali limitazioni riscontrate durante la ricerca (es. 'Nessuna pronuncia a Sezioni Unite rinvenuta')."),
});

export const ReviewListSchema = z.object({
  tesi: z.array(TesiReviewSchema).describe("Lista delle tesi giuridiche individuate e analizzate. Vuoto se non ci sono tesi rilevanti.")
});

//PROMPT

export const PromptFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string(),
  enumValues: z.string().optional(),
  isRequired: z.boolean(),
});

export const PromptOutputSchema = z.object({
  result: z.string().describe("Il prompt architetturale generato pronto all'uso"),
});

// DEEP ANALYSIS

export const PrecedenteMinimaleSchema = z.object({
  id: z.string().min(1).describe("TASSATIVO: Se fonte='web', inserisci l'URL completo. Se fonte='interna', inserisci ESCLUSIVAMENTE l'ID univoco del documento Firestore (es. hash alfanumerico dell'ID), MAI il numero della sentenza o la data."),
  fonte: z.enum(["interna", "web"]),
  gradoPertinenza: z.number().min(0).max(100),
  escluso: z.boolean().optional(),
  nuova: z.boolean().optional(), // 👈 Obbligatorio per preservare il flag dopo il .parse()
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
    puntiAperti: z.array(z.string()).describe("Questioni irrisolte, vuoti normativi o oscillazioni non composte.")
  })
});

export const ReportSintesiSchema = z.object({
  titoloReport: z.string().describe("Un titolo formale e riassuntivo per il parere strategico."),
  executiveSummary: z.string().describe("Sintesi operativa in 2-3 frasi dell'esito dell'indagine. Qual è la risposta al quesito?"),
  contestoENorme: z.string().describe("Breve riassunto della fattispecie e delle norme di riferimento (Inquadramento)."),
  argomentazioniAzione: z.array(z.string()).describe("I punti di forza e le tesi a favore. DEVI citare l'ID delle fonti a supporto."),
  rischiEEccezioni: z.array(z.string()).describe("Le debolezze, i rischi e le tesi contrarie. DEVI citare l'ID delle fonti ostili."),
  conclusioniStrategiche: z.string().describe("Il suggerimento operativo finale. Come deve muoversi l'utente alla luce dei punti aperti?")
});
