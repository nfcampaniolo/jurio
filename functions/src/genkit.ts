import { genkit, z } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai'
import { OpenAI } from 'openai';
import { getDb } from "./deps";
import { getKeywordStems, calculateMatchScore, applyHighlight, makeRiferimentiNormativiKeys } from './utils';
import { SYSTEM_PROMPT_JURIO_SUPPORT } from './params';
import { enableFirebaseTelemetry } from '@genkit-ai/firebase';
import { FieldValue } from "firebase-admin/firestore";
import { PROMPT_MASSIMAZIONE } from "./params";

const db = getDb();
enableFirebaseTelemetry();


// ─────────────────────────────────────────────
// CONFIG
// ─────────────────────────────────────────────

const CFG = {
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
  HISTORY_WINDOW: 4,
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

const ChatMessageSchema = z.object({
  role: z.enum(["user", "model", "system"]),
  content: z.string(),
});

const GeminiFallbackInputSchema = z.object({
  query: z.string(),
});

const GeminiFallbackOutputSchema = z.object({
  sintesi: z.string().describe("Sintesi strutturata (max 3 paragrafi) sull'argomento giuridico."),
  queryAlternativa: z.string().describe("Nuova frase di ricerca semantica ottimizzata con termini tecnici."),
}).nullable();

const EstraiMetadatiInputSchema = z.object({
  chatContext: z.string(),
  metadatiAttuali: z.record(z.any()),
});

const EstraiMetadatiOutputSchema = z.object({
  dati_nuovi_o_aggiornati: z.array(
    z.object({
      chiave: z.string().describe("Esempio: 'Giudice', 'Valore Causa', 'Controparte', 'Data Sinistro'"),
      valore: z.string().describe("Il valore estratto. Usa formati standard (es. YYYY-MM-DD per le date) se possibile.")
    })
  )
});

// ─────────────────────────────────────────────
// GENKIT INIT
// ─────────────────────────────────────────────

export const ai = genkit({
  plugins: [googleAI()],
  model: 'googleai/gemini-2.5-flash', 
});

// ─────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────

const embeddingCache = new Map<string, number[]>();

export async function createEmbedding(text: string): Promise<number[]> {
  const cacheKey = text.trim().toLowerCase();
  
  // 1. Controllo in RAM: se abbiamo già l'embedding, restituiscilo subito (0ms di latenza)
  if (embeddingCache.has(cacheKey)) {
    return embeddingCache.get(cacheKey)!;
  }

  // 2. Esecuzione standard API OpenAI
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const res = await client.embeddings.create({
    model: CFG.EMBEDDING_MODEL,
    input: text.trim(),
    dimensions: CFG.EMBEDDING_DIMS,
  });
  
  const vector = res.data[0].embedding;

  // 3. Meccanismo di sicurezza: svuota la cache se supera i 1000 elementi 
  if (embeddingCache.size > 1000) {
    embeddingCache.clear();
  }
  
  // 4. Salva il nuovo embedding e restituiscilo
  embeddingCache.set(cacheKey, vector);
  return vector;
}

function getSafeDistance(queryVec: number[], docVec: any, fallbackDist: number = 0.25): number {
  const vecArray = docVec?.toArray ? docVec.toArray() : docVec;
  if (!queryVec || !vecArray || queryVec.length !== vecArray.length) return fallbackDist;
  
  let dotProduct = 0;
  for (let i = 0; i < queryVec.length; i++) {
    dotProduct += queryVec[i] * vecArray[i];
  }
  return 1 - dotProduct; 
}

function mapToObject(doc: FirebaseFirestore.QueryDocumentSnapshot, keywords: string[]) {
  const data = doc.data();
  const kwObjects = getKeywordStems(keywords.join(" "));
  const stemsList = kwObjects.map(k => k.stem);
  const originalKws = kwObjects.map(k => k.original);

  const primaryText = data.summary || data.massima || "";
  const secondaryText = data.summary ? (data.massima || "") : (data.fattispecie || "");
  const contentForScore = `${primaryText} ${secondaryText}`.toLowerCase();
  
  const scores = calculateMatchScore(contentForScore, kwObjects, data);
  const MAX_CHARS = CFG.MAX_FIELD_CHARS || 3000;

  return {
    id: doc.id, 
    numero_sentenza: data.numero_sentenza || null,
    organo_giudicante: data.organo_giudicante || null,
    sezione: data.sezione || null, 
    dataSentenza: data.dataSentenza || null,
    massima: data.massima ? data.massima.toString().substring(0, MAX_CHARS) : null,
    summary: data.summary ? data.summary.toString().substring(0, MAX_CHARS) : null,
    _matchCount: Math.floor(scores.textMatchScore), 
    _distance: 0,
    _effectiveDistance: 0,
    _source: "database_query",
    highlighted_massima: applyHighlight(primaryText.toString(), originalKws, stemsList)
  };
}

// ─────────────────────────────────────────────
// TOOLS
// ─────────────────────────────────────────────

export const ricercaDatabaseInterno = ai.defineTool(
  {
    name: 'ricercaDatabaseInterno',
    description: 'Usa questo tool per cercare sentenze pubbliche, giurisprudenza, riferimenti normativi o categorie legali nel database interno.',
    inputSchema: z.object({
      tipo_ricerca: z.enum(["semantica", "puntuale", "normativa"]).describe("Usa 'puntuale' per numero sentenza, 'normativa' per articoli di legge, 'semantica' per concetti o categorie."),
      query: z.string().optional().describe("Il concetto giuridico, l'articolo di legge (es. 'Art. 2043 cc') o la categoria da cercare."),
      numero_sentenza: z.string().optional().describe("Compila SOLO se l'utente fornisce gli estremi di una sentenza (es. '123/2024' o '12345')."),
    }),
    outputSchema: z.any(),
  },
  async (input, { context }) => {
    try {
      const { tipo_ricerca, query, numero_sentenza } = input;

      const safeLimit = 3; 
      
      const finalQuery = (query || numero_sentenza || "").trim();
      
      if (!finalQuery) {
        return [{ messaggio: "ERRORE DI SISTEMA: Devi fornire obbligatoriamente un parametro di ricerca (query o numero_sentenza)." }];
      }
      
      const uiFilters = context?.uiFilters || [];

      const applyFilters = (baseQuery: FirebaseFirestore.Query) => {
        let q = baseQuery;
        uiFilters.forEach((f: any) => {
          let val = f.value;
          if (f.field === "dataSentenza" && typeof val === "string") val = new Date(val); 
          if (val !== undefined) q = q.where(f.field, f.operator, val);
        });
        return q;
      };

      // 1. BRANCH: Ricerca Puntuale
      if (tipo_ricerca === "puntuale") {
        const identificativo = finalQuery; 
        const match = identificativo.match(/\d+\/\d+/);
        const sanitizedNumero = match ? match[0] : identificativo;

        const sentencesRef = db.collection("sentences");
        
        const [snapNumero, snapEcli, snapUrn] = await Promise.all([
          sentencesRef.where("numero_sentenza", "==", sanitizedNumero).limit(3).get(), // CRITICO: Ridotto a 3
          sentencesRef.where("ecli", "==", identificativo).limit(3).get(),
          sentencesRef.where("urn", "==", identificativo).limit(3).get()
        ]);

        const uniqueDocs = new Map();
        [...snapNumero.docs, ...snapEcli.docs, ...snapUrn.docs].forEach((doc) => {
          uniqueDocs.set(doc.id, doc);
        });

        if (uniqueDocs.size === 0) {
          return [{ messaggio: `Nessuna sentenza trovata nel database interno per l'identificativo: ${identificativo}.` }];
        }

        return Array.from(uniqueDocs.values()).map(doc => {
          const data = doc.data();
          return { id: doc.id, ...data, organo_giudicante: data.organo_giudicante, _type: "giurisprudenza_puntuale" };
        });
      }

      // 2. BRANCH: Ricerca Normativa
      if (tipo_ricerca === "normativa") {
        const keys = makeRiferimentiNormativiKeys(finalQuery); 
        
        if (keys.length === 0) {
           return [{ messaggio: `Non è stato possibile estrarre un riferimento normativo valido da: "${finalQuery}". Riprova formattando meglio (es. "Art. 2043 cc").` }];
        }

        let baseQuery = db.collection("sentences").where("riferimenti_normativi_key", "array-contains-any", keys.slice(0, 5));
        baseQuery = applyFilters(baseQuery as FirebaseFirestore.Query);
        
        const snap = await baseQuery.limit(safeLimit).get();
        
        if (snap.empty) {
           return [{ messaggio: `Nessun provvedimento trovato nel database interno per il riferimento normativo richiesto (${keys.join(", ")}).` }];
        }
        
        return snap.docs.map(doc => {
            const data = doc.data();
            return { ...mapToObject(doc, keys), id: doc.id, organo_giudicante: data.organo_giudicante, _type: "giurisprudenza_normativa" };
        });
      }

      // 3. BRANCH: Ricerca Semantica
      const queryVector = await createEmbedding(finalQuery); 
      let baseQuery = applyFilters(db.collection("sentences") as FirebaseFirestore.Query);

      const sSnap = await (baseQuery as any)
        .findNearest("embedding", FieldValue.vector(queryVector), { limit: safeLimit, distanceMeasure: "COSINE" })
        .get();

      const results = sSnap.docs.map((doc: any) => {
        const data = doc.data();
        let rawDistance = doc.distance ?? getSafeDistance(queryVector, data.embedding);
        return { 
          id: doc.id, 
          numero_sentenza: data.numero_sentenza,
          organo_giudicante: data.organo_giudicante,
          massima: data.summary || data.massima || "",
          _distance: rawDistance,
          _type: "giurisprudenza_semantica"
        };
      });

      return results.filter((r: any) => r._distance <= CFG.MAX_ALLOWED_DISTANCE).slice(0, safeLimit);

    } catch (err: unknown) {
      console.error("[Tool: ricercaDatabaseInterno] Errore:", err);
      throw new Error(`Errore durante la ricerca nel database: ${(err as Error).message}`);
    }
  }
);

export const ricercaFascicoloUtente = ai.defineTool(
  {
    name: 'ricercaFascicoloUtente',
    description: "Cerca nei documenti o PDF caricati dall'utente. TASSATIVO: usalo sempre quando l'utente fa domande sui SUOI documenti o ha appena allegato un file.",
    inputSchema: z.object({
      query: z.string().describe("Il testo o concetto da cercare nei documenti dell'utente."),
      documentId_specifico: z.string().optional().describe("Lascia vuoto, ci pensa il sistema."),
    }),
    outputSchema: z.any(),
  },
  async (input, { context }) => {
    try {
      const userId = context?.userId;
      const fascicoloId = context?.fascicoloId;
      const attachedDocs: string[] = context?.docs || []; // Recuperiamo i documenti allegati!

      if (!userId) return [{ error: "Errore di autenticazione interno." }];

      const sanitizedQuery = input.query.trim();
      const queryVector = await createEmbedding(sanitizedQuery);
      const safeLimit = context?.dbLimit || 5;
      
      let qOwner: FirebaseFirestore.Query = db.collection("document_chunks").where("user", "==", userId);
      
      // FIX: Precedenza ASSOLUTA ai documenti inviati nel payload
      if (attachedDocs.length > 0) {
        qOwner = qOwner.where("parentId", "in", attachedDocs.slice(0, 10));
      } else if (input.documentId_specifico) {
        qOwner = qOwner.where("parentId", "==", input.documentId_specifico);
      } else if (fascicoloId) {
        qOwner = qOwner.where("fascicoloIds", "array-contains", fascicoloId);
      }

      const promiseOwner = (qOwner as any)
        .findNearest("embedding", FieldValue.vector(queryVector), { limit: safeLimit, distanceMeasure: "COSINE" })
        .get();

      let qShared: FirebaseFirestore.Query = db.collection("document_chunks").where("visibleTo", "array-contains", userId);
      
      if (attachedDocs.length > 0) {
        qShared = qShared.where("parentId", "in", attachedDocs.slice(0, 10));
      } else if (input.documentId_specifico) {
        qShared = qShared.where("parentId", "==", input.documentId_specifico);
      }

      const promiseShared = (qShared as any)
        .findNearest("embedding", FieldValue.vector(queryVector), { limit: safeLimit, distanceMeasure: "COSINE" })
        .get();

      const [snapOwner, snapShared] = await Promise.all([promiseOwner, promiseShared]);
      const uniqueDocsMap = new Map<string, FirebaseFirestore.DocumentData>();

      snapOwner.docs.forEach((doc: any) => uniqueDocsMap.set(doc.id, doc.data()));
      snapShared.docs.forEach((doc: any) => {
        const data = doc.data();
        // Se ci sono allegati espliciti, skippiamo il controllo sul fascicolo condiviso
        if (fascicoloId && attachedDocs.length === 0 && (!data.fascicoloIds || !data.fascicoloIds.includes(fascicoloId))) return; 
        if (!uniqueDocsMap.has(doc.id)) uniqueDocsMap.set(doc.id, data);
      });

      const combinedDocs = Array.from(uniqueDocsMap.values());
      if (combinedDocs.length === 0) return [{ messaggio: "Nessun paragrafo rilevante trovato nei documenti. Attendi qualche istante se il file è stato appena caricato." }];

      return combinedDocs
        .sort((a, b) => ((a.index as number) || 0) - ((b.index as number) || 0))
        .slice(0, safeLimit)
        .map(c => ({
          documento_id: c.parentId,
          nome_file: c.nome_file || c.titolo || "Documento utente",
          testo_paragrafo: c.text,
          posizione_originale: c.index,
          _type: "document_chunk",
        }));

    } catch (err: unknown) {
      console.error(`Errore ricercaFascicoloUtente:`, err);
      return [{ messaggio: "Errore temporaneo durante la consultazione dell'archivio utente." }];
    }
  }
);
export const webSearchTool = ai.defineTool(
  {
    name: 'ricercaWebLegale',
    description: 'Cerca online riforme recentissime, notizie o approfondimenti legali su fonti certificate.',
    inputSchema: z.object({
      query: z.string(),
      focus: z.enum(["istituzionale", "editoriale", "tutto"]).default("tutto"),
    }),
    outputSchema: z.any(),
  },
  async (input) => {
    try {
      const apiKey = process.env.TAVILY_API_KEY;
      if (!apiKey) return [{ error: "TAVILY_API_KEY non configurata." }];

      let finalDomains = [...CFG.DOMAINS_ISTITUZIONALE, ...CFG.DOMAINS_EDITORIALE];
      if (input.focus === "istituzionale") finalDomains = [...CFG.DOMAINS_ISTITUZIONALE];
      if (input.focus === "editoriale") finalDomains = [...CFG.DOMAINS_EDITORIALE];

      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query: input.query,
          search_depth: "basic",
          include_domains: finalDomains,
          max_results: 2,
          include_answer: false,
          include_raw_content: false,
        }),
      });

      const data = await response.json() as { results?: Array<{ title: string; url: string; content?: string }> };
      if (!data.results?.length) return [{ messaggio: "Nessun aggiornamento recente trovato." }];

      return data.results.map(res => ({
        titolo: res.title,
        link: res.url,
        contenuto: res.content?.substring(0, CFG.MAX_WEB_CHARS) ?? "Contenuto non disponibile",
        fonte: new URL(res.url).hostname,
        _type: "web_search",
      }));
    } catch (err: unknown) {
      console.error("Errore ricerca web:", err);
      return [{ error: "Servizio di ricerca web non raggiungibile." }];
    }
  }
);

export const analizzaDistinguishFattispecie = ai.defineTool(
  {
    name: 'analizzaDistinguishFattispecie',
    description: 'ESSENZIALE per il ragionamento legale (Distinguishing). Usalo quando devi confrontare i fatti concreti dell\'utente con la fattispecie di sentenze precedenti, per capire se un precedente si APPLICA o si può DISAPPLICARE per differenze fattuali.',
    inputSchema: z.object({
      query: z.string().describe("Riassunto dettagliato dei fatti specifici dichiarati dall'utente (es. 'Il pedone attraversava fuori dalle strisce di notte e pioveva')."),
    }),
    outputSchema: z.any(),
  },
  async (input, { context }) => {
    try {
      const { query } = input;
      const safeLimit = 3;
      
      const uiFilters = context?.uiFilters || [];

      const applyFilters = (baseQuery: FirebaseFirestore.Query) => {
        let q = baseQuery;
        uiFilters.forEach((f: any) => {
          let val = f.value;
          if (f.field === "dataSentenza" && typeof val === "string") val = new Date(val); 
          if (val !== undefined) q = q.where(f.field, f.operator, val);
        });
        return q;
      };

      const queryVector = await createEmbedding(query.trim());
      let baseQuery = applyFilters(db.collection("sentences") as FirebaseFirestore.Query);

      const sSnap = await (baseQuery as any)
        .findNearest("embedding", FieldValue.vector(queryVector), { limit: safeLimit, distanceMeasure: "COSINE" })
        .get();

      if (sSnap.empty) return [{ messaggio: "Nessun precedente fattualmente simile trovato nel database per effettuare il distinguish." }];

      const results = sSnap.docs.map((doc: any) => {
        const data = doc.data();
        let rawDistance = doc.distance ?? getSafeDistance(queryVector, data.embedding);
        return { 
          id: doc.id, 
          numero_sentenza: data.numero_sentenza,
          organo_giudicante: data.organo_giudicante,
          fatti_della_sentenza_trovata: data.fattispecie_rilevante || "Fatti non separati - deducibili dalla massima",
          principio_di_diritto: data.massima || "",
          _distance: rawDistance,
          _type: "giurisprudenza_distinguish"
        };
      });

      return results.filter((r: any) => r._distance <= CFG.MAX_ALLOWED_DISTANCE);

    } catch (err: unknown) {
      console.error("[Tool: analizzaDistinguishFattispecie] Errore:", err);
      throw new Error("Errore durante l'analisi della fattispecie.");
    }
  }
);

export const ricercaManualeTool = ai.defineTool(
  {
    name: 'ricercaManualeTool',
    description: 'Usa questo tool ESCLUSIVAMENTE per rispondere a domande sul funzionamento della piattaforma Jurio, guide all\'uso, limiti tecnici, piani di abbonamento, privacy policy, GDPR e normative interne. NON usare per cercare giurisprudenza o sentenze.',
    inputSchema: z.object({
      query: z.string().describe("La domanda o il concetto da cercare nel manuale utente (es. 'Come funziona la ricerca semantica?', 'Quali sono i formati supportati per l'upload?', 'Limiti di utilizzo')."),
    }),
    outputSchema: z.any(),
  },
  async (input) => {
    try {
      const { query } = input;
      // Usiamo il safe limit di default, oppure puoi forzarne uno specifico per il manuale (es. 3 o 4 chunk bastano)
      const safeLimit = 2; 
      
      const finalQuery = (query || "").trim();
      
      if (!finalQuery) {
        return [{ messaggio: "ERRORE DI SISTEMA: Devi fornire obbligatoriamente una query di ricerca per il manuale." }];
      }

      // 1. Creazione dell'embedding per la query in linguaggio naturale
      const queryVector = await createEmbedding(finalQuery);
      
      // 2. Interrogazione vettoriale sulla collection 'manual'
      // Assumiamo che qui non servano filtri UI (come la data della sentenza), ma se dovessero servire puoi re-iniettare l'helper applyFilters
      const manualRef = db.collection("manual");

      const sSnap = await (manualRef as any)
        .findNearest("embedding", FieldValue.vector(queryVector), { 
          limit: CFG.VECTOR_FETCH_LIMIT, 
          distanceMeasure: "COSINE" 
        })
        .get();

      // 3. Mappatura dei risultati basata sulla struttura del tuo documento
      const results = sSnap.docs.map((doc: any) => {
        const data = doc.data();
        let rawDistance = doc.distance ?? getSafeDistance(queryVector, data.embedding);
        
        return { 
          id: doc.id, 
          text: data.text || "",
          links: data.links || [],
          images: data.images || "",
          _distance: rawDistance,
          _type: "documentazione_manuale"
        };
      });

      // 4. Filtro per distanza massima e limitazione dei risultati da inviare al LLM
      const finalResults = results
        .filter((r: any) => r._distance <= CFG.MAX_ALLOWED_DISTANCE)
        .slice(0, safeLimit);

      // 5. Fallback se non viene trovato nulla di pertinente
      if (finalResults.length === 0) {
        return [{ messaggio: `Nessuna informazione pertinente trovata nel manuale ufficiale per la query: "${finalQuery}".` }];
      }

      return finalResults;

    } catch (err: unknown) {
      console.error("[Tool: ricercaManualeTool] Errore:", err);
      throw new Error(`Errore durante la ricerca nel manuale: ${(err as Error).message}`);
    }
  }
);

// ─────────────────────────────────────────────
// FLOW PRINCIPALE
// ─────────────────────────────────────────────

// ============================================================================
// 1. MODULI DI SUPPORTO ALL'ORCHESTRATORE
// ============================================================================

export function buildLegalAgentSystemPrompt({
  uiFiltersString,
  docs,
  alreadySeenIds,
  fascicoloId,
  metadatiFascicolo
}: {
  uiFiltersString: string;
  docs: string[];
  alreadySeenIds: string[];
  userId: string;
  fascicoloId?: string | null;
  metadatiFascicolo?: Record<string, string>;
}): string {
  const staticPrompt = `# IDENTITÀ E SCOPO
Sei Jurio, assistente legale AI specializzato esclusivamente nel diritto italiano.
Rispondi in modo tecnico e oggettivo, non integrare conoscenze esterne non presenti nei tool.

# REGOLE VINCOLANTI (CRITICO)
- DIVIETO ASSOLUTO: Non inserire MAI nella risposta all'utente "ID tecnici", UUID o stringhe alfanumeriche di sistema.
- Usa SOLO riferimenti discorsivi e testuali (es. "Il documento caricato", "La sentenza n. 123/2024").
- Inventare sentenze o fatti giuridici è severamente vietato.

# GESTIONE FILTRI E RICERCHE
I filtri richiesti dall'utente (es. Data, Organo, Materia) vengono APPLICATI AUTOMATICAMENTE DAL SISTEMA a livello di database.
- NON dire MAI all'utente "non posso applicare il filtro", "i filtri sono attivi" o frasi simili.
- Esegui le ricerche tramite i tool dando per scontato che i risultati ricevuti rispettino già i filtri imposti.

# POLITICA DI UTILIZZO DEI TOOL
- Usa i tool SOLO se le informazioni presenti nella cronologia o nel 'CONTESTO DINAMICO' non sono sufficienti per rispondere.
- Se la domanda è un follow-up logico su documenti o sentenze già discussi, RISPONDI DIRETTAMENTE senza invocare tool.
- Prediligi database interni e riferimenti normativi. Usa 'ricercaWebLegale' solo se esplicitamente richiesto o per news.

# ASSISTENZA APPLICATIVO
Nel caso di richieste sull'applicativo rimanda alla sezione contatti: https://jurio.it/contatti#bot`;

  let dynamicContext = `\n\n--- \n# CONTESTO DINAMICO CORRENTE\n`;
  dynamicContext += `- Filtri UI attivi: ${uiFiltersString}\n`;
  dynamicContext += `- Documenti allegati: ${docs.length > 0 ? docs.join(", ") : "Nessuno"}\n`;
  dynamicContext += `- Pronunce già utilizzate in chat: ${alreadySeenIds.length > 0 ? alreadySeenIds.join(", ") : "Nessuna"}\n`;

  if (fascicoloId) {
    const metadatiString = metadatiFascicolo && Object.keys(metadatiFascicolo).length > 0 
      ? Object.entries(metadatiFascicolo).map(([k, v]) => `- ${k}: ${v}`).join('\n')
      : "Nessun metadato ancora estratto.";

    dynamicContext += `\n# FASCICOLO (ID: ${fascicoloId})
Questi sono i dati strutturati (metadati) attuali del caso:
${metadatiString}

(Nota operativa: hai a disposizione il tool 'aggiornaMetadatiFascicolo'. Se dalla chat o dai documenti emergono nuovi nomi chiave, valori economici o date non presenti nei metadati, usa il tool per salvarli in autonomia).`;
  }

  return staticPrompt + dynamicContext;
}

async function generateChatTitle(prompt: string, isFirstMessage?: boolean): Promise<string | undefined> {
  if (!isFirstMessage) return undefined;
  
  const generateTask = ai.generate({
    prompt: `Genera un titolo riassuntivo di max 4 parole per questa richiesta legale: "${prompt}". REGOLE TASSATIVE: Niente ragionamenti, niente prefissi (no "Titolo:"), niente virgolette. Solo le parole.`,
    config: { temperature: 0.1 },
  }).then(res => res.text.trim()).catch(e => {
    console.warn("Errore generazione titolo:", e);
    return undefined;
  });

  const timeout = new Promise<undefined>(resolve => setTimeout(() => resolve(undefined), 4000));
  return Promise.race([generateTask, timeout]);
}

function prepareContextAndMessages(input: any): any[] {
  const trimmedHistory = (input.history ?? []).slice(-4);
  const uiFiltersString = input.filters && Object.keys(input.filters).length > 0
    ? JSON.stringify(input.filters, null, 2) : "Nessun filtro imposto.";

  const alreadySeenIds: string[] = trimmedHistory.length > 0
    ? Array.from(new Set<string>(
      trimmedHistory
        .filter((msg: { role: string }) => msg.role === 'model')
        .flatMap((msg: { content: string }) => {
           if (typeof msg.content !== 'string') return [];
           return msg.content.match(/[a-zA-Z0-9]{20,}/g) ?? [];
        })
    )) : [];

  const systemPrompt = buildLegalAgentSystemPrompt({
    uiFiltersString,
    docs: input.docs ?? [],
    alreadySeenIds,
    fascicoloId: input.fascicoloId,
    userId: input.userId,
    metadatiFascicolo: input.metadatiFascicolo,
  });

  const chatContext = trimmedHistory.map((msg: { role: string; content: string }) => ({
    role: msg.role === 'user' ? 'user' : 'model',
    content: [{ text: msg.content }],
  }));

  return [
    { role: "system" as const, content: [{ text: systemPrompt }] },
    ...chatContext,
    { role: "user" as const, content: [{ text: input.prompt }] },
  ];
}

export interface ExecutionProfile {
  model: string;
  dbLimit: number;
  webLimit: number;
}

export function getExecutionProfile(promptLower: string): ExecutionProfile {
  if (promptLower.length < 150) {
    return { model: "googleai/gemini-2.5-flash", dbLimit: 3, webLimit: 2 };
  }
  const hasComparison = /confronta|compara|differenz|distingu|paragon/i.test(promptLower);
  const hasApplicability = /si applica|applicabil|caso concreto|caso di specie|fattispecie|distinguishing/i.test(promptLower);
  const hasConflict = /conflitto|contrasto|orientament|tesi contrapposte|sezioni unite|prevale/i.test(promptLower);
  const hasLegalReasoning = /argomenta|ragionamento|spiega il perché|valuta l'esito|ricostruisci|alla luce (dei|della)/i.test(promptLower);

  const complexityScore = [hasComparison, hasApplicability, hasConflict, hasLegalReasoning].filter(Boolean).length;
  const needsDeepReasoning = complexityScore >= 3;

  if (needsDeepReasoning) {
    return { model: "googleai/gemini-1.5-pro", dbLimit: 5, webLimit: 3 };
  } else {
    return { model: "googleai/gemini-2.5-flash", dbLimit: 3, webLimit: 2 };
  }
}

async function executeDeterministicRetrieval(input: any, promptLower: string, toolContext: any, sendChunk: any) {
  const isConversational = promptLower.length < 25 && /^(grazie|ok|chiaro|perfetto|ciao|va bene|ottimo|esatto)/.test(promptLower);
  
  const isDatabaseQuery = /(sentenza|ordinanza|cassazione|tribunale|tar|provvediment|art\.|articolo|legge|codice|decreto|direttiva|giurisprudenza|massima)/i.test(promptLower);
  
  // Rileviamo se ci sono allegati nel payload
  const hasDocs = toolContext.docs && toolContext.docs.length > 0;
  const isFascicoloQuery = (input.fascicoloId && /(questo documento|il contratto|il file|fascicolo|allegato|caricato|documentazione)/i.test(promptLower)) || hasDocs;
  
  const needsWebSearch = /(recente|news|novità|aggiornament|oggi|notizi|tempo reale|ultim'ora)/i.test(promptLower);
  const isDistinguishQuery = /(fattispecie|caso concreto|mio caso|differenz|analizza i fatti|applicabil|distinguish)/i.test(promptLower);

  const matchPuntuale = promptLower.match(/\b\d{1,6}\/\d{4}\b/);
  const matchNormativa = promptLower.match(/(?:art|articolo)\.?\s*\d+(?:\s*(?:bis|ter|quater|quinquies))?/i);

  let preRetrievalOutput: any = null;
  let preRetrievalToolName = "";

  if (!isConversational) {
    try {
      if (hasDocs) {
        // TASSATIVO: Se ci sono allegati, forziamo immediatamente la lettura
        sendChunk({ status: "Lettura dei documenti allegati..." });
        preRetrievalToolName = "ricercaFascicoloUtente";
        preRetrievalOutput = await ricercaFascicoloUtente({ query: input.prompt }, { context: toolContext });
      } else if (matchPuntuale) {
        sendChunk({ status: `Ricerca sentenza ${matchPuntuale[0]}...` });
        preRetrievalToolName = "ricercaDatabaseInterno";
        preRetrievalOutput = await ricercaDatabaseInterno({ tipo_ricerca: "puntuale", numero_sentenza: matchPuntuale[0], query: input.prompt }, { context: toolContext });
      } else if (matchNormativa) {
        sendChunk({ status: `Ricerca riferimento ${matchNormativa[0]}...` });
        preRetrievalToolName = "ricercaDatabaseInterno";
        preRetrievalOutput = await ricercaDatabaseInterno({ tipo_ricerca: "normativa", query: matchNormativa[0] }, { context: toolContext });
      } else if (isFascicoloQuery) {
        sendChunk({ status: "Consultazione documenti utente..." });
        preRetrievalToolName = "ricercaFascicoloUtente";
        preRetrievalOutput = await ricercaFascicoloUtente({ query: input.prompt }, { context: toolContext });
      }
    } catch (err) {
      console.warn("Errore pre-retrieval deterministico:", err);
    }
  }

  let dynamicTools: any[] = [];
  let skipTurn1 = false;

  // FIX RACE CONDITION: Se il retrieval documentale deterministico è "vuoto" (documenti in elaborazione in background), 
  // non saltiamo il turno 1. Così l'Agente riproverà da solo concedendo tempo al DB.
  const isEmptyRetrieval = preRetrievalOutput && Array.isArray(preRetrievalOutput) && preRetrievalOutput[0]?.messaggio?.includes("Nessun paragrafo");

  if (preRetrievalOutput && (!Array.isArray(preRetrievalOutput) || !preRetrievalOutput[0]?.error) && !isEmptyRetrieval) {
    skipTurn1 = true;
  } else if (!isConversational) {
    // ABILITAZIONE CHIRURGICA DEI TOOL
    if (isDatabaseQuery) dynamicTools.push(ricercaDatabaseInterno);
    if (isFascicoloQuery || hasDocs) dynamicTools.push(ricercaFascicoloUtente);
    if (isDistinguishQuery) dynamicTools.push(analizzaDistinguishFattispecie);
    if (needsWebSearch) dynamicTools.push(webSearchTool);
    if (hasDocs && !dynamicTools.includes(ricercaFascicoloUtente)) {
      dynamicTools.push(ricercaFascicoloUtente);
    }
  }

  return { skipTurn1, preRetrievalOutput, preRetrievalToolName, dynamicTools };
}

function extractAndFormatSources(messages: any[]) {
  const fontiUniche = new Map<string, unknown>();
  
  try {
    messages.forEach((msg: any) => {
      if (msg.role !== 'tool') return;
      (msg.content || []).forEach((part: any) => {
        const output = part.toolResponse?.output;
        if (!output) return;
        const items: any[] = Array.isArray(output) ? output : (output.topMatches || []);
        items.forEach((fonte: any) => {
          if (!fonte || fonte.error || fonte.messaggio) return; 
          const baseKey = fonte.documento_id ?? fonte.id ?? fonte._id_interno ?? fonte.urn ?? fonte.link;
          const fallbackKey = typeof fonte.titolo === 'string' ? fonte.titolo : (fonte.numero_sentenza || Math.random().toString(36));
          const key = baseKey ? String(baseKey) : fallbackKey;
          if (!fontiUniche.has(key)) fontiUniche.set(key, fonte);
        });
      });
    });
  } catch (parseError) {
    console.warn("⚠️ Errore parsing fonti:", parseError);
  }

  return Array.from(fontiUniche.values())
    .map((f: any) => {
      let rawScore = f.score ?? null;
      if (rawScore === null) {
        if (f._rankingDistance !== undefined) rawScore = 1 - f._rankingDistance;
        else if (f._distance !== undefined) rawScore = 1 - f._distance;
      }

      const isExactMatch = f._type === 'giurisprudenza_puntuale' || f._type === 'giurisprudenza_normativa';
      let matchPercentage = isExactMatch ? 100 : (rawScore !== null ? Math.max(0, Math.min(100, Math.round(rawScore * 100))) : 0);

      return {
        _type: f._type || (f.fonte ? 'web_search' : 'database_interno'),
        documento_id: f.documento_id ?? f.id ?? f._id_interno ?? f.parentId ?? null,
        posizione_originale: f.posizione_originale ?? f.index ?? null,
        timestamp: f.timestamp ?? new Date().toISOString(),
        identificativo: f.nome_file || f.numero_sentenza || f.titolo || "Documento",
        score: rawScore !== null ? rawScore : (isExactMatch ? 1 : null), 
        match_percentage: matchPercentage,          
        organo_giudicante: f.organo_giudicante ?? null,
        data_pubblicazione: f.dataSentenza ?? f.data ?? f.date ?? null,
        fonte_web: f.fonte ?? null,
        url_riferimento: f.link ?? f.urn ?? f.url ?? null
      };
    })
    .filter((f: any) => 
      f._type === 'web_search' || f._type === 'documento_allegato' || f._type === 'document_chunk' || 
      f._type?.startsWith('giurisprudenza_') || f.fonte_web || f.match_percentage >= 75
    )
    .sort((a: any, b: any) => b.match_percentage - a.match_percentage)
    .slice(0, CFG.MAX_SOURCES);
}

// ============================================================================
// 2. ORCHESTRATORE PRINCIPALE (FLOW)
// ============================================================================

export const legalAgentFlow = ai.defineFlow(
  {
    name: 'legalAgentFlow',
    inputSchema: z.object({
      prompt: z.string(),
      filters: z.any().optional(),
      docs: z.array(z.string()).optional(),
      history: z.array(z.any()).optional(),
      isFirstMessage: z.boolean().optional(),
      userId: z.string(),
      fascicoloId: z.string().nullable().optional(),
      metadatiFascicolo: z.record(z.any()).optional(),
      fascicoloTitolo: z.string().nullable().optional(),
    }),
    outputSchema: z.object({
      risposta: z.string(),
      fonti: z.array(z.any()),
      titoloGenerato: z.string().optional(),
    }),
    streamSchema: z.object({
      status: z.string().optional(),
      text: z.string().optional(),
    }),
  },
  async (input, { sendChunk }) => {
    sendChunk({ status: "Analisi della richiesta..." });

    const titlePromise = generateChatTitle(input.prompt, input.isFirstMessage);
    const messages = prepareContextAndMessages(input);
    const promptLower = input.prompt.toLowerCase().trim();

    const profile = getExecutionProfile(promptLower);
    const selectedModel = profile.model;

    const toolContext = { 
      userId: input.userId, 
      fascicoloId: input.fascicoloId ?? null, 
      uiFilters: input.filters ?? [],
      docs: input.docs ?? [],
      dbLimit: profile.dbLimit,
      webLimit: profile.webLimit
    };

    const { skipTurn1, preRetrievalOutput, preRetrievalToolName, dynamicTools } = 
      await executeDeterministicRetrieval(input, promptLower, toolContext, sendChunk);

    if (skipTurn1) {
      messages.push({ role: "model" as const, content: [{ toolRequest: { name: preRetrievalToolName, ref: "deterministic-route", input: { query: input.prompt } } }] });
      messages.push({ role: "tool" as const, content: [{ toolResponse: { name: preRetrievalToolName, ref: "deterministic-route", output: preRetrievalOutput } }] });
    }

    let finalResponse;

    try {
      if (!skipTurn1) {
        // --- TURNO 1: Triage Agentico ---
        const turn1Response = await ai.generate({
          model: selectedModel,
          messages: messages,
          tools: dynamicTools,
          returnToolRequests: true,
          config: { temperature: 0.05 },
          context: toolContext, // Contesto dinamico coi limiti iniettato
          onChunk: (chunk) => {
            try {
              const toolName = chunk.content?.find(part => part.toolRequest)?.toolRequest?.name;
              if (toolName) sendChunk({ status: `Ricerca in corso: ${toolName}...` });
              if (chunk.text) sendChunk({ text: chunk.text });
            } catch (e) {}
          },
        });

        finalResponse = turn1Response;

        if (turn1Response.toolRequests && turn1Response.toolRequests.length > 0) {
          sendChunk({ status: "Consultazione archivi in corso..." });
          const executedTools = new Set<string>();

          const toolResponses = await Promise.all(
            turn1Response.toolRequests.map(async (part: any) => {
              const req = part.toolRequest;
              if (!req || !req.name) return null;
              if (executedTools.has(req.name)) return { toolResponse: { name: req.name, ref: req.ref, output: { messaggio: "Tool già eseguito." } } };
              
              executedTools.add(req.name);

              try {
                // BUGFIX APPLICATO: Controllo robusto sui metadati Genkit dell'Action
                const toolDef = dynamicTools.find(t => 
                  t.name === req.name || 
                  t.__action?.name === req.name || 
                  t.__action?.name?.endsWith(req.name)
                );
                
                if (!toolDef) throw new Error(`Tool non trovato: ${req.name}`);
                
                const output = await toolDef(req.input, { context: toolContext });
                return { toolResponse: { name: req.name, ref: req.ref, output: output } };
              } catch (err) {
                console.error(`[Orchestrator] Errore tool ${req.name}:`, err);
                return { toolResponse: { name: req.name, ref: req.ref, output: { error: "Errore temporaneo." } } };
              }
            })
          );

          messages.push(turn1Response.message);
          messages.push({ role: "tool" as const, content: toolResponses.filter(Boolean) });
        }
      }

      // --- TURNO 2: Sintesi Finale (Tools Off) ---
      if (skipTurn1 || (finalResponse?.toolRequests && finalResponse.toolRequests.length > 0)) {
        sendChunk({ status: "Sintesi finale..." });
        
        finalResponse = await ai.generate({
          model: selectedModel,
          messages: messages,
          tools: [], // Forza la generazione testuale
          config: { temperature: 0.05 },
          onChunk: (chunk) => { if (chunk.text) sendChunk({ text: chunk.text }); }
        });
      }

    } catch (generateErr) {
      console.error("Schianto su ai.generate:", generateErr);
      throw new Error("Il motore neurale ha incontrato un errore imprevisto.");
    }

    const titoloGenerato = await titlePromise;
    const fontiFinali = extractAndFormatSources(messages);

    return {
      risposta: finalResponse?.text ?? "Nessuna risposta generata.",
      fonti: fontiFinali,
      titoloGenerato,
    };
  }
);
// ─────────────────────────────────────────────
// FLOW — Legal Agent Support (Jurio Assistant)
// ─────────────────────────────────────────────

export const legalAgentSupport = ai.defineFlow(
  {
    name: 'legalAgentSupport',
    inputSchema: z.object({
      prompt: z.string(),
      history: z.array(ChatMessageSchema).optional(),
    }),
    outputSchema: z.object({
      risposta: z.string(),
      fonti: z.array(z.any()),
    }),
    streamSchema: z.object({
      status: z.string().optional(),
      text: z.string().optional(),
    }),
  },
  async (input, { sendChunk }) => {
    sendChunk({ status: "Analisi della richiesta in corso..." });

    // Preparazione della history limitata dalla finestra configurata
    const history = (input.history ?? []).slice(-CFG.HISTORY_WINDOW).map((msg) => ({
      role: msg.role,
      content: [{ text: msg.content }],
    }));

    const messages = [
      {
        role: "system" as const,
        content: [{ text: `${SYSTEM_PROMPT_JURIO_SUPPORT}\n\nSei l'assistente ufficiale di Jurio. Rispondi in modo tecnico e cordiale. Usa SEMPRE il tool "ricercaManualeTool" per rispondere a domande su funzionalità, limiti, piani o guide operative della piattaforma.` }],
      },
      ...history,
      { role: "user" as const, content: [{ text: input.prompt }] },
    ];

    const response = await ai.generate({
      messages: messages as any,
      tools: [ricercaManualeTool],
      config: { temperature: 0.3 },
      onChunk: (chunk) => {
        if (chunk.text) {
          sendChunk({ text: chunk.text });
        } 
        else if (chunk.content?.some((part: any) => part.toolRequest)) {
          sendChunk({ status: "Consultazione del manuale Jurio..." });
        }
      },
    });

    sendChunk({ status: "Risposta completata." });

    // 2. RECUPERO DELLE FONTI (Estrazione dell'output del tool)
    let fontiEstratte: any[] = [];
    
    // In Genkit, i risultati dei tool si trovano nei messaggi di tipo 'tool' all'interno della risposta
    if (response.messages) {
      const toolMessages = response.messages.filter((m: any) => m.role === 'tool');
      
      toolMessages.forEach((msg: any) => {
        msg.content.forEach((contentItem: any) => {
          if (contentItem.toolResponse && contentItem.toolResponse.name === 'ricercaManualeTool') {
            const output = contentItem.toolResponse.output;
            // Se il tool ha restituito risultati, li pushiamo nell'array delle fonti
            if (Array.isArray(output) && output.length > 0 && !output[0].messaggio) {
              fontiEstratte.push(...output);
            }
          }
        });
      });
    }

    return { 
      risposta: response.text, 
      fonti: fontiEstratte // <-- Ora il frontend riceverà i chunk usati (con links, text, id, ecc.)
    };
  }
);
// ─────────────────────────────────────────────
// FLOW — Fallback Gemini (Sintesi + Query Alternativa)
// ─────────────────────────────────────────────

export const legalGeminiFallbackFlow = ai.defineFlow(
  {
    name: 'legalGeminiFallbackFlow',
    inputSchema: GeminiFallbackInputSchema, // Assicurati che contenga almeno { query: z.string() }
    outputSchema: GeminiFallbackOutputSchema,
  },
  async (input) => {
    
    const aiResponse = await ai.generate({
      config: { 
        temperature: 0.15, 
        topP: 0.95 
      }, 
      output: {
        format: 'json',
        schema: z.object({
          sintesi: z.string(),
          queryAlternativa: z.string(),
        })
      },
      messages: [
        {
          role: "system",
          content: [{ text: `Sei un Assistente Giuridico Senior esperto in Information Retrieval per il diritto italiano.
Il database vettoriale non ha restituito risultati per la ricerca dell'utente. 

Il tuo compito è duplice e differenziato:
- Per l'utente ("sintesi"): Devi spiegare in modo DETTAGLIATO e specifico la fattispecie esatta che ha richiesto.
- Per il sistema ("queryAlternativa"): Devi astrarre la ricerca verso l'istituto generale più comune per fare un secondo tentativo nel database.

### LINEE GUIDA PER I CAMPI DEL JSON:

1. "sintesi":
   - Fornisci una spiegazione DETTAGLIATA, mirata e rigorosa (massimo 3 paragrafi) dell'istituto specifico o della situazione esatta richiesta dall'utente.
   - Non limitarti a parlare in generale: cala la norma sul suo problema (es. se chiede di un drone, parla di droni e aeromobili; se chiede di un influencer, parla di contratti di pubblicità/sponsorizzazione digitale).
   - Definisci i diritti, i doveri o le responsabilità specifiche previste dal diritto italiano per quel caso.
   - Usa il Markdown (**grassetto**) per evidenziare gli articoli di legge e i concetti chiave.

2. "queryAlternativa":
   - Crea una stringa densa di parole chiave ottimizzata per Vector Search.
   - REGOLA DI ASTRAZIONE: Se il caso specifico è troppo insolito o di nicchia per il database, la query deve "scalare verso l'alto" riconducendolo alla disciplina generale più comune e diffusa (es. da "drone giocattolo" a "cose in custodia art 2051", da "influencer sparisce" a "risoluzione contratto inadempimento").
   - Rimuovi frasi discorsive, saluti e congiunzioni. Includi i riferimenti normativi cardine.

### ESEMPI DI TRASFORMAZIONE ED ESTENSIONE (FEW-SHOT):

- Query Utente: "un drone giocattolo è caduto sulla macchina parcheggiata rompendo il parabrezza"
- Risposta Attesa:
{
  "sintesi": "Il caso in esame riguarda il danno cagionato dal volo di un **drone (aeromobile a pilotaggio remoto)**. La responsabilità per i danni a terzi in superficie causati da aeromobili è disciplinata in modo specifico dall'**art. 965 del Codice della Navigazione**, che la pone a carico dell'operatore.\\n\\nTuttavia, trattandosi di un drone giocattolo (spesso escluso da alcune regole ENAC stringenti), la giurisprudenza tende ad applicare anche le regole del codice civile, in particolare l'**art. 2051 c.c. (responsabilità per cose in custodia)** o l'**art. 2050 c.c. (attività pericolose)**. Il proprietario del drone è quindi tenuto a risarcire il danno al veicolo (parabrezza rotto) a meno che non provi il caso fortuito.",
  "queryAlternativa": "responsabilità cose in custodia art 2051 cc danno ingiusto risarcimento veicolo in sosta"
}

- Query Utente: "ho firmato un contratto con un influencer per una sponsorizzazione su Tik Tok ma questo è sparito e non ha pubblicato il video"
- Risposta Attesa:
{
  "sintesi": "La situazione descritta delinea una chiara violazione di un **contratto di sponsorizzazione (o influencer marketing)**. Questo accordo, sebbene atipico, fa nascere un'**obbligazione di fare** in capo all'influencer, che si impegna a promuovere un brand dietro corrispettivo.\\n\\nSe l'influencer non pubblica il video e si rende irreperibile, si configura un **inadempimento contrattuale ai sensi dell'art. 1218 c.c.**. In quanto parte adempiente, hai il diritto di richiedere la **risoluzione del contratto per inadempimento (art. 1453 c.c.)**, ottenendo la restituzione di quanto eventualmente già pagato e il risarcimento del danno per la mancata visibilità.",
  "queryAlternativa": "risoluzione contratto inadempimento art 1453 cc risarcimento danni obbligazione di fare"
}` }]
        },
        {
          role: "user",
          content: [{ text: `Query di ricerca originale da analizzare e ottimizzare: "${input.query}"` }]
        }
      ],
    });

    const outputData = aiResponse.output;

    // Se per qualsiasi motivo l'output non rispetta lo schema, Genkit/Gemini restituiscono null/undefined 
    if (!outputData) {
      console.warn("Gemini non ha restituito un output valido per il fallback.");
      return null;
    }

    return {
      sintesi: outputData.sintesi,
      queryAlternativa: outputData.queryAlternativa
    };
  }
);

// ─────────────────────────────────────────────
// FLOW — Fallback Gemini (Sintesi + Query Alternativa)
// ──

export const reasoningFlow = ai.defineFlow(
  {
    name: 'reasoningFlow',
    inputSchema: z.object({
      question: z.string(),
      customPrompt: z.string().optional(),
    }),
    outputSchema: z.any(),
  },
  async (input) => {
    
    const promptToUse = input.customPrompt ? input.customPrompt : PROMPT_MASSIMAZIONE;

    const response = await ai.generate({
      // Reso il System Prompt leggermente più generico per adattarsi a tutti i tipi di documenti e non solo alle "sentenze"
      system: "Agisci come un esperto analista di documenti. Restituisci esclusivamente JSON valido.",
      prompt: `${promptToUse}\n\nTESTO DA ANALIZZARE:\n${input.question}`,
      config: {
        temperature: 0.1,
      },
      output: {
        format: 'json', 
      },
    });

    if (response.output && typeof response.output === 'object') {
      return response.output;
    }

    // Fallback di sicurezza: pulizia e parsing manuale del testo
    const rawText = response.text || "";
    const cleanJson = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleanJson);
  }
);
// ─────────────────────────────────────────────
// FLOW — Metadati
// ──

export const estraiMetadatiFlow = ai.defineFlow(
  {
    name: 'estraiMetadatiFlow',
    inputSchema: EstraiMetadatiInputSchema,
    outputSchema: EstraiMetadatiOutputSchema,
  },
  async (input) => {
    const { chatContext, metadatiAttuali } = input;

    try {
      const extractionResult = await ai.generate({
        prompt: 
`Sei un assistente legale specializzato in data-entry rigoroso. 
Il tuo compito è analizzare la conversazione e identificare SOLO informazioni fattuali (Nomi, Date, Cifre, Ruoli, Organi Giudicanti, Dati anagrafici) che non sono presenti nei metadati attuali o che necessitano di aggiornamento.

REGOLE FONDAMENTALI:
- NON INVENTARE. Estrai solo dati esplicitamente menzionati nella chat.
- Se un dato è incerto o ambiguo, ignoralo.
- Sii sintetico e usa nomenclature standard per le chiavi.
- Se non ci sono novità, restituisci un array vuoto.

<metadati_attuali>
${JSON.stringify(metadatiAttuali, null, 2)}
</metadati_attuali>

<chat>
${chatContext}
</chat>`,
        
        output: {
          schema: EstraiMetadatiOutputSchema
        },
        
        config: { 
          temperature: 0.0,
        }
      });

      return extractionResult.output || { dati_nuovi_o_aggiornati: [] };

    } catch (error) {
      console.error("[estraiMetadatiFlow] Errore durante l'estrazione LLM:", error);
      // In caso di errore, restituiamo un array vuoto per non bloccare il flusso dell'app,
      // oppure potresti lanciare un errore custom se l'estrazione è un blocco critico.
      return { dati_nuovi_o_aggiornati: [] };
    }
  }
);

// ─────────────────────────────────────────────
// FLOW — TASKPANE WORD
// ──

const FonteSchema = z.object({
  id: z.string(),
  titolo: z.string(),
  url: z.string().optional(),
  score: z.number().optional(),
});

const FonteDettagliataSchema = z.object({
  id: z.string().optional().describe("L'identificativo esatto (id) restituito dal tool. DEVE essere sempre conservato per creare il link."),
  url: z.string().optional().describe("L'indirizzo web (url) restituito dal tool, se presente."),
  tipo: z.enum(["Sezioni Unite", "Cassazione", "Merito", "Altra"]).describe("La gerarchia dell'organo giudicante."),
  riferimento: z.string().describe("Estremi della pronuncia (es. Cass. Civ. n. 1234/2023)."),
  data: z.string().optional().describe("Data della pronuncia, se verificata."),
  rilevanza: z.string().describe("Spiegazione sintetica del perché questa specifica fonte è pertinente alla tesi."),
});

const ContrastoSchema = z.object({
  riferimento: z.string().describe("Estremi della pronuncia contrastante."),
  descrizione: z.string().describe("Breve sintesi dell'orientamento difforme."),
});

const TesiReviewSchema = z.object({
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

function buildQuoteSystemPrompt() {
  return `# RUOLO E OBIETTIVO
Sei l'hub di ricerca e sintesi legale di Microsoft Word. Il tuo scopo è estrarre principi di diritto esclusivamente dalle sentenze fornite dai tool e redigere una sintesi ("Quote") pronta per un atto giuridico.

# REGOLE DI OUTPUT
- Scrivi SOLO il testo giuridico formale.
- Nessun preambolo, saluto o commento (es. NON scrivere "Ecco la sintesi:").
- Integra gli estremi delle sentenze citate in modo discorsivo direttamente nel testo.
- BASATI ESCLUSIVAMENTE SULLE FONTI RESTITUITE DAI TOOL. Non utilizzare conoscenze pregresse o esterne.
- Se dai tool non emergono risultati pertinenti, rispondi tassativamente ed unicamente con il testo: "NESSUN_RISULTATO".`;
}

// 1. HELPER DI PARSING (Adattato allo schema FonteSchema)
function estraiFontiDalRisultato(response: any) {
  const fontiUniche = new Map<string, any>();
  
  try {
    const resultMessages = response.request?.messages || response.messages || [];
    
    resultMessages.forEach((msg: any) => {
      if (msg.role !== 'tool') return;
      
      const content = msg.content || [];
      content.forEach((part: any) => {
        const output = part.toolResponse?.output;
        if (!output) return;

        const items: any[] = Array.isArray(output) ? output : (output.topMatches || []);

        items.forEach((fonte: any) => {
          if (!fonte || fonte.error || fonte.messaggio) return; 
          
          // Chiave di deduplicazione sicura
          const key = String(fonte.documento_id ?? fonte.id ?? fonte.numero_sentenza ?? Math.random());
          if (!fontiUniche.has(key)) fontiUniche.set(key, fonte);
        });
      });
    });
  } catch (parseError) {
    console.warn("⚠️ Errore non bloccante durante il parsing delle fonti:", parseError);
  }

  // Mappatura esatta verso FonteSchema
  return Array.from(fontiUniche.values()).map(f => {
    let rawScore = f.score ?? null;
    if (rawScore === null && f._distance !== undefined) {
      rawScore = 1 - f._distance; // Converte la distanza coseno in score
    }

    return {
      id: String(f.documento_id ?? f.id ?? "id-non-disponibile"),
      titolo: String(f.titolo ?? f.numero_sentenza ?? "Documento senza titolo"),
      url: f.link ?? f.url ?? f.urn ?? undefined,
      score: rawScore !== null ? Math.round(rawScore * 100) / 100 : undefined
    };
  }).slice(0, 5); // Limitiamo l'output alle top 5 per pulizia della UI
}

// 2. FLOW OTTIMIZZATO
export const wordQuoteFlow = ai.defineFlow(
  {
    name: 'wordQuoteFlow',
    inputSchema: z.object({
      contesto: z.string().min(1).describe("Il testo evidenziato in Word o il concetto digitato dall'utente."),
      promptIndirizzamento: z.string().optional().describe("Eventuale direttiva specifica."),
      filters: z.array(z.any()).optional(),
      userId: z.string(),
    }),
    outputSchema: z.object({
      testoQuote: z.string(),
      fonti: z.array(FonteSchema),
    }),
  },
  async (input, { sendChunk }) => {
    sendChunk({ status: "Ricerca nel database..." });

    // Isolamento degli input dell'utente con Delimitatori XML per evitare Prompt Injection
    let userPrompt = `<CONTESTO_GIURIDICO>\n${input.contesto}\n</CONTESTO_GIURIDICO>`;
    
    if (input.promptIndirizzamento?.trim()) {
      userPrompt += `\n<ISTRUZIONE_UTENTE>\n${input.promptIndirizzamento.trim()}\n</ISTRUZIONE_UTENTE>`;
    }

    const messages = [
      { role: "system" as const, content: [{ text: buildQuoteSystemPrompt() }] },
      { role: "user" as const, content: [{ text: userPrompt }] },
    ];

    try {
      const response = await ai.generate({
        messages: messages as any,
        tools: [ricercaDatabaseInterno], 
        config: { temperature: 0.1 }, // Temperatura bassa per massima aderenza ai tool
        context: {
          userId: input.userId,
          uiFilters: Array.isArray(input.filters) ? input.filters : []
        },
        onChunk: (chunk) => {
          const toolName = chunk.content?.find((p: any) => p.toolRequest)?.toolRequest?.name;
          if (toolName) sendChunk({ status: "Analisi sentenze trovate..." });
        }
      });

      const fontiFinali = estraiFontiDalRisultato(response); 
      const rawText = response.text?.trim() ?? "";

      // Gestione sicura del fallback
      if (rawText.includes("NESSUN_RISULTATO") || fontiFinali.length === 0) {
        return {
          testoQuote: "Nessuna giurisprudenza pertinente trovata per questo concetto.",
          fonti: [],
        };
      }

      return {
        testoQuote: rawText,
        fonti: fontiFinali,
      };

    } catch (error) {
      console.error("Errore wordQuoteFlow:", error);
      throw new Error("Si è verificato un errore durante la ricerca o la generazione della citazione.");
    }
  }
);

// 2. SYSTEM PROMPT OTTIMIZZATO
function buildReviewSystemPrompt() {
  return `# RUOLO
Sei un Revisore Legale Esperto incaricato di analizzare e verificare criticamente documenti giuridici italiani (atti processuali, contratti, pareri, diffide).

Operi secondo il modello "SEMAFORO".

Il tuo compito NON è riscrivere il documento, migliorarne lo stile o esprimere opinioni personali.
Il tuo compito è:
1. identificare le affermazioni o clausole aventi contenuto giuridico rilevante;
2. verificare ciascuna tesi/clausola mediante le fonti restituite dai tool disponibili (giurisprudenza e normativa);
3. ricostruire l'orientamento o il quadro normativo rilevante;
4. classificare l'elemento con il semaforo;
5. motivare la classificazione in modo sintetico, tecnico e verificabile.

# PRINCIPIO FONDAMENTALE
Non devi mai trasformare una semplice difficoltà di ricerca in una valutazione negativa.
Devi distinguere sempre tra:
- CORRETTEZZA GIURIDICA DELLA TESI O VALIDITÀ DELLA CLAUSOLA;
- ORIENTAMENTO GIURISPRUDENZIALE/NORMATIVO RINVENUTO;
- QUALITÀ/COMPLETEZZA DELLA VERIFICA.
L'assenza di risultati non equivale, da sola, a una smentita.

# FLUSSO DI LAVORO OBBLIGATORIO

## FASE 1 — INDIVIDUAZIONE DELLE QUESTIONI (TESI O CLAUSOLE)
Analizza il testo in input e individua soltanto gli elementi giuridicamente rilevanti. 
- Negli atti processuali: individua le "tesi in diritto" (proposizioni che sostengono, negano, interpretano o applicano una regola/istituto).
- Nei contratti/documenti stragiudiziali: individua le clausole, gli assunti normativi, i patti che regolano obblighi/diritti o le limitazioni di responsabilità.

NON considerare:
- fatti narrati, descrizioni dei luoghi, date, nominativi, saluti;
- premesse di rito prive di contenuto dispositivo o giuridico;
- mere valutazioni retoriche.

## FASE 2 — CONSERVAZIONE LETTERALE (CRITICA)
Per ogni questione devi individuare un segmento del testo originale.
Il campo "testoOriginale" DEVE essere una copia-incolla LETTERALE e CONTIGUA del testo fornito dall'utente.

REGOLE ASSOLUTE:
- non parafrasare, non correggere errori, refusi o punteggiatura;
- non modificare maiuscole/minuscole o inserire sinonimi;
- non unire frammenti provenienti da punti diversi.
Il valore di "testoOriginale" deve essere sempre rintracciabile esattamente nel testo sorgente.

## FASE 3 — FORMULAZIONE DELLA QUERY (OTTIMIZZAZIONE TOOL)
Per ogni questione formula una o più query di ricerca mirate.
ATTENZIONE: Le query devono essere CONCISE e OTTIMIZZATE per un motore di ricerca vettoriale/semantico. 
- NON usare frasi discorsive (es. Sbagliato: "È valida la clausola risolutiva espressa nel contratto?").
- USA stringhe dense di concetti chiave (es. Corretto: "validità clausola risolutiva espressa inadempimento locazione").
- Quando necessario, effettua ricerche mirate agli articoli di legge (es. "Art. 1456 cc").

## FASE 4 — RICERCA DELLE FONTI E OBBLIGO RICERCA WEB
Utilizza i tool disponibili nel seguente ordine di preferenza:
1. "ricercaDatabaseInterno"
2. "ricercaWebLegale"

REGOLA TASSATIVA SULLA RICERCA WEB:
Se, dopo aver consultato il database interno, l'esito provvisorio risulta essere GIALLO o ROSSO, sei OBBLIGATO a chiamare anche il tool "ricercaWebLegale" per cercare conferme, smentite o novità normative prima di emettere il verdetto finale. Non fermarti mai al database interno se l'esito non è Verde.

## FASE 5 — VALUTAZIONE E GERARCHIA DELLE FONTI
Una fonte è rilevante se riguarda realmente la medesima questione giuridica (o fattuale tramite distinguishing).
Attribuisci maggiore peso a (in ordine):
1. Disposizioni normative (Codice, Leggi speciali) e divieti inderogabili (Norme imperative);
2. Sezioni Unite della Corte di Cassazione / Corte Costituzionale;
3. Orientamento consolidato e ripetuto della Cassazione;
4. Singole pronunce recenti di Cassazione;
5. Pronunce di merito.

# SISTEMA SEMAFORO

## 🟢 VERDE — CONFORME / SUPPORTATO
- Atti: Tesi coerente con orientamento consolidato, Sezioni Unite, o normativa palese. Nessun contrasto.
- Contratti: Clausola pienamente legittima, tipica o conforme a norme inderogabili. Nessun rischio di nullità.

## 🟡 GIALLO — DUBBIO / DIBATTUTO / INSUFFICIENTE
- Esiste un contrasto giurisprudenziale, un orientamento minoritario o una lacuna normativa.
- Contratti: Clausola atipica ai limiti della liceità, soggetta a interpretazione restrittiva o potenziale inefficacia.
- Ricerca insufficiente: Non hai trovato fonti dirimenti (in questo caso indica esplicitamente "Nessuna giurisprudenza/normativa rilevante rinvenuta"). Il Giallo NON equivale a "tesi/clausola errata".

## 🔴 ROSSO — CONTRARIO A NORMA O GIURISPRUDENZA
- Atti: Tesi smentita da Sezioni Unite o orientamento consolidato.
- Contratti: Clausola palesemente nulla, annullabile, contraria a norme imperative, ordine pubblico o buon costume (es. patto leonino, interessi usurari).

# PRINCIPIO ANTI-ALLUCINAZIONE
Non inventare MAI: numeri di sentenza, date, articoli di legge, principi di diritto o massime. Usa SOLO informazioni presenti nell'output dei tool.

# REGOLE SULL'OUTPUT
Restituisci ESCLUSIVAMENTE l'output nel formato strutturato richiesto dal sistema, rispettando i tipi e le istruzioni fornite nello schema JSON. Nessun commento esterno o formattazione markdown.
Quando citi una fonte estratta dai tool, DEVI riportare ESATTAMENTE il campo "id" restituito dal JSON del tool (es. un ID alfanumerico lungo o un path Firestore). 
Se il tool non restituisce alcun "id", NON DEVI INVENTARNE UNO. Lascia il campo vuoto o omettilo. Inserire ID fittizi come "sentenza-1" o "fonte-xyz" è una grave violazione.

# CASO LIMITE: ZERO TESI GIURIDICHE (FALLBACK)
Se analizzando il testo ritieni che NON sia presente alcuna questione giuridica rilevante (ad esempio se il testo contiene solo narrazione di fatti, date, saluti o mere formule di rito senza riflessi normativi), sei OBBLIGATO a rispettare comunque lo schema JSON.
In questo caso, devi restituire un oggetto valido con l'array "tesi" vuoto.
ESEMPIO CORRETTO: {"tesi": []}
VIETATO: Non restituire MAI un valore null, stringhe vuote, messaggi di errore o formati non strutturati.

# TONO E STILE
Il linguaggio deve essere: freddo, tecnico, impersonale (terza persona). Privo di preamboli o formule persuasive (vietato usare: "a mio avviso", "sembra", "potrebbe essere"). Se l'evidenza è insufficiente, dichiaralo oggettivamente.`;
}

// 3. IL FLOW "ANALISI CONFORMITÀ (SEMAFORO)"
export const wordReviewFlow = ai.defineFlow(
  {
    name: 'wordReviewFlow',
    inputSchema: z.object({
      chunks: z.array(z.string()).describe("L'array dei frammenti di testo da analizzare inviati dal Frontend."),
      promptIndirizzamento: z.string().optional().describe("Eventuali direttive specifiche dell'avvocato."),
      userId: z.string(),
    }),
    outputSchema: ReviewListSchema,
  },
  async (input, { sendChunk }) => {
    sendChunk({ message: { status: "Lettura dell'atto e individuazione tesi critiche..." } });

    // 1. Assembliamo i chunk in un formato leggibile per l'AI
    let contestoDocumento = `<TESTO_DOCUMENTO>\n`;
    input.chunks.forEach((chunk, index) => {
      if (chunk.trim()) {
        contestoDocumento += `[BLOCCO ${index + 1}]\n${chunk}\n\n`;
      }
    });
    contestoDocumento += `</TESTO_DOCUMENTO>`;

    if (input.promptIndirizzamento?.trim()) {
      contestoDocumento += `\n<ISTRUZIONI_SPECIFICHE>\n${input.promptIndirizzamento}\n</ISTRUZIONI_SPECIFICHE>`;
    }

    const messages = [
      { role: "system" as const, content: [{ text: buildReviewSystemPrompt() }] },
      { role: "user" as const, content: [{ text: contestoDocumento }] },
    ];

    try {
      // 2. Chiamata agentica
      const response = await ai.generate({
        // model: 'googleai/gemini-2.5-pro',
        messages: messages as any,
        tools: [ricercaDatabaseInterno, webSearchTool, analizzaDistinguishFattispecie], 
        config: { 
          temperature: 0.0,
          topK: 1,
          topP: 0.1
        }, 
        context: { userId: input.userId },
        output: { schema: ReviewListSchema },
        onChunk: (chunk) => {
          const toolReq = chunk.content?.find((p: any) => p.toolRequest)?.toolRequest;
          if (toolReq) {
            const toolName = toolReq.name;
            const args = toolReq.input as any;
            const queryStr = args.query ? `"${args.query}"` : "argomento";
            
            if (toolName === 'ricercaDatabaseInterno') {
              sendChunk({ message: { status: `Ricerca in archivio: ${queryStr}...` } });
            }
            if (toolName === 'ricercaWebLegale') {
              sendChunk({ message: { status: `Ricerca web di conferma: ${queryStr}...` } });
            }
          }
        }
      });
      sendChunk({ message: { status: "Stesura dell'analisi e assegnazione semafori..." } });

      // 🛡️ PARACADUTE ALGORITMICO: Se response.output è null, undefined o vuoto
      if (!response.output || !response.output.tesi) {
        console.warn("[GUARDRAIL] L'AI ha restituito un output nullo o vuoto. Forzo un array tesi vuoto.");
        return { tesi: [] };
      }

      // 4. GUARDRAIL ALGORITMICO: Normalizzazione e Sterilizzazione
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      const tesiNormalizzate = response.output.tesi.map((item, index) => {
        
        // Tieni SOLO le fonti che hanno un ID reale e conforme al formato UUID
        const fontiPulite = (item.fonti || []).filter((f: any) => {
          const rawId = f.id !== undefined && f.id !== null ? String(f.id).trim() : "";
          const isValid = rawId !== "" && uuidRegex.test(rawId);
          
          if (!isValid) {
            console.warn(`[GUARDRAIL] Fonte scartata per assenza di ID valido:`, f);
          }
          
          return isValid;
        });

        return {
          ...item,
          id: item.id || `tesi_${Date.now()}_${index}`,
          fonti: fontiPulite,
          testoOriginale: item.testoOriginale
        };
      });

      type ReviewOutput = z.infer<typeof ReviewListSchema>;
  
      return { tesi: tesiNormalizzate } as ReviewOutput;

    } catch (error) {
      console.error("Errore wordReviewFlow:", error);
      throw new Error("Si è verificato un errore durante l'analisi di conformità.");
    }
  }
);


// ─────────────────────────────────────────────
// FLOW — Meta-Prompting
// ──

const PromptFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string(),
  enumValues: z.string().optional(),
  isRequired: z.boolean(),
});

// Schema di Output
const PromptOutputSchema = z.object({
  result: z.string().describe("Il prompt architetturale generato pronto all'uso"),
});

export const promptBuilderFlow = ai.defineFlow(
  {
    name: 'promptBuilderFlow',
    inputSchema: z.object({
      objective: z.string().describe("L'obiettivo principale del prompt (es. estrarre dati da un contratto)"),
      notes: z.string().optional().describe("Eventuali linee guida o regole specifiche aggiuntive"),
      fields: z.array(PromptFieldSchema).describe("I campi che comporranno lo schema JSON target"),
      userId: z.string().optional(),
    }),
    outputSchema: PromptOutputSchema,
  },
  async (input, { sendChunk }) => {
    sendChunk({ message: { status: "Analisi dell'obiettivo e normalizzazione dei campi..." } });

    // 1. Costruiamo il JSON Schema target dinamicamente in base agli input
    const properties: Record<string, any> = {};
    const required: string[] = [];

    input.fields.forEach(f => {
      properties[f.name] = { 
        type: f.type, 
        description: f.description 
      };
      
      // Gestione specifica per i tipi Enum
      if (f.type === "enum" && f.enumValues) {
        properties[f.name].enum = f.enumValues
          .split(',')
          .map(v => v.trim())
          .filter(v => v !== "");
      }
      
      if (f.isRequired) required.push(f.name);
    });

    const baseSchema = {
      type: "object",
      additionalProperties: false,
      properties,
      required
    };

    const stringifiedSchema = JSON.stringify(baseSchema, null, 2);

    sendChunk({ message: { status: "Elaborazione dell'architettura del prompt..." } });

    // 2. Definizione dei messaggi (System / User)
const systemPrompt = `Agisci come un Senior AI Architect ed Esperto di Prompt Engineering.
Il tuo compito è scrivere un "System Prompt" altamente professionale, strutturato e rigoroso, destinato a un'altra Intelligenza Artificiale per un compito di estrazione dati strutturata (Information Extraction).

REGOLE PER LA STESURA DEL TUO OUTPUT:
1. Inizia definendo il RUOLO dell'AI (Es. "Agisci come revisore / analista...").
2. Spiega il CONTESTO e l'OBIETTIVO in modo chiaro.
3. Elenca le REGOLE DI ESTRAZIONE in modo puntato, usando le descrizioni dei campi dello schema fornito.
4. INSERISCI LE DUE REGOLE TASSATIVE (Uniformità JSON e Zero Deduzioni) in un blocco ben visibile (es. "REGOLE RIGOROSE:" o "VINCOLI ASSOLUTI:").
5. Inserisci lo Schema JSON esattamente come ti viene fornito, istruendo l'AI a usarlo come unica fonte di verità per la formattazione.
6. Concludi SEMPRE con l'istruzione finale: l'AI dovrà restituire ESCLUSIVAMENTE JSON valido, senza blocchi markdown (no \`\`\`json), senza premesse e senza commenti.
7. Scrivi SOLO il prompt risultante. Non aggiungere "Ecco il prompt richiesto:" o altre formule di cortesia. Usa un tono imperativo e formale.

REGOLE TASSATIVE CHE IL TUO PROMPT GENERATO DEVE CONTENERE AL SUO INTERNO:
Devi inserire esplicitamente, all'interno del prompt che stai scrivendo, queste due direttive assolute per l'AI che dovrà eseguirlo:
1. VINCOLO DI UNIFORMITÀ JSON: L'AI dovrà formattare i campi JSON sempre allo stesso identico modo, rispettando pedissequamente lo schema target fornito, senza MAI alterare i nomi delle chiavi, i tipi, o aggiungere campi non previsti. Il JSON generato deve includere obbligatoriamente il campo summary: un riassunto ad alta densità informativa, rigorosamente valorizzato (stringa non vuota), essenziale per i successivi processi di indicizzazione.
2. VINCOLO DI ADERENZA AL TESTO (ZERO DEDUZIONI): L'AI deve affidarsi SEMPRE E SOLO ai dati esplicitamente presenti nel documento di input. È severamente vietato trarre deduzioni logiche, inferenze, inventare fonti o citare erroneamente fatti. Se un'informazione non è letteralmente deducibile dal testo, il campo deve rimanere vuoto o nullo.`;

    const userPrompt = `<OBIETTIVO_DEL_PROMPT_DA_CREARE>\n${input.objective}\n</OBIETTIVO_DEL_PROMPT_DA_CREARE>
    
${input.notes ? `<NOTE_E_LINEE_GUIDA>\n${input.notes}\n</NOTE_E_LINEE_GUIDA>` : ''}

<SCHEMA_JSON_TARGET_OBBLIGATORIO>
${stringifiedSchema}
</SCHEMA_JSON_TARGET_OBBLIGATORIO>`;

    const messages = [
      { role: "system" as const, content: [{ text: systemPrompt }] },
      { role: "user" as const, content: [{ text: userPrompt }] },
    ];

    try {
      // 3. Chiamata Agentica (Stessi parametri rigorosi della review)
      const response = await ai.generate({
        // model: 'googleai/gemini-2.5-pro', 
        messages: messages as any,
        config: { 
          temperature: 0.1, // Temperatura bassissima per massima precisione architetturale
          topK: 1,
          topP: 0.1
        }
      });

      sendChunk({ message: { status: "Ottimizzazione e formattazione finale..." } });

      const generatedPrompt = response.text;

      // 4. 🛡️ PARACADUTE ALGORITMICO: Controllo validità
      if (!generatedPrompt || generatedPrompt.trim() === "") {
        console.warn("[GUARDRAIL] L'AI ha restituito un prompt nullo o vuoto. Utilizzo template fallback.");
        return { 
          result: `Agisci come esperto estrattore dati.\nIl tuo obiettivo è:\n${input.objective}\n\nRestituisci esclusivamente il seguente JSON compilato:\n${stringifiedSchema}`
        };
      }

      // Restituisce l'output rispettando il PromptOutputSchema
      return { result: generatedPrompt };

    } catch (error) {
      console.error("Errore promptBuilderFlow:", error);
      throw new Error("Si è verificato un errore durante la generazione del prompt architetturale.");
    }
  }
);