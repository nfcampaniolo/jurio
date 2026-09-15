import { ai } from "./config"
import { z } from 'genkit';
import { getDb } from "../deps";
import { enableFirebaseTelemetry } from '@genkit-ai/firebase';
import { FieldValue } from "firebase-admin/firestore";
import { CFG } from "./config";
import { makeRiferimentiNormativiKeys, incrementRagCounter } from "../utils";
import { mapToObject, createEmbedding, getSafeDistance} from "./helper";

const db = getDb();
enableFirebaseTelemetry();

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
      const safeLimit = context?.dbLimit ?? 10; 
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
          sentencesRef.where("numero_sentenza", "==", sanitizedNumero).limit(3).get(),
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

        // --- NUOVA LOGICA: UPDATE RAG ---
        const resultDocs = Array.from(uniqueDocs.values());
        const extractedIds = resultDocs.map(doc => doc.id);
        await incrementRagCounter("sentences", extractedIds);
        // --------------------------------

        return resultDocs.map(doc => {
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
        
        // --- NUOVA LOGICA: UPDATE RAG ---
        const extractedIds = snap.docs.map(doc => doc.id);
        await incrementRagCounter("sentences", extractedIds);
        // --------------------------------

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

      const finalResults = results.filter((r: any) => r._distance <= CFG.MAX_ALLOWED_DISTANCE).slice(0, safeLimit);

      // --- NUOVA LOGICA: UPDATE RAG ---
      const extractedIds = finalResults.map((r: any) => r.id);
      await incrementRagCounter("sentences", extractedIds);
      // --------------------------------

      return finalResults;

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
      const attachedDocs: string[] = context?.docs || [];

      if (!userId) return [{ error: "Errore di autenticazione interno." }];

      const sanitizedQuery = input.query.trim();
      const queryVector = await createEmbedding(sanitizedQuery);
      
      const safeLimit = context?.dbLimit ?? 10;
      
      let qOwner: FirebaseFirestore.Query = db.collection("document_chunks").where("user", "==", userId);
      
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
        if (fascicoloId && attachedDocs.length === 0 && (!data.fascicoloIds || !data.fascicoloIds.includes(fascicoloId))) return; 
        if (!uniqueDocsMap.has(doc.id)) uniqueDocsMap.set(doc.id, data);
      });

      // --- MODIFICA: Lavoriamo con le entries per non perdere l'ID del chunk ---
      const combinedEntries = Array.from(uniqueDocsMap.entries());
      if (combinedEntries.length === 0) {
        return [{ messaggio: "Nessun paragrafo rilevante trovato nei documenti. Attendi qualche istante se il file è stato appena caricato." }];
      }

      const slicedDocs = combinedEntries
        .sort((a, b) => ((a[1].index as number) || 0) - ((b[1].index as number) || 0))
        .slice(0, safeLimit);

      // --- NUOVA LOGICA: UPDATE RAG SUI CHUNK ESTRATTI ---
      const extractedIds = slicedDocs.map(([id, _data]) => id);
      await incrementRagCounter("document_chunks", extractedIds);
      // --------------------------------------------------

      return slicedDocs.map(([id, c]) => ({
        documento_id: c.parentId, // Manteniamo il riferimento al doc genitore come prima
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
    description: "Da usare TASSATIVAMENTE per cercare informazioni, aggiornamenti, testi o dettagli su leggi, norme, articoli di codice, provvedimenti normativi o prassi (es. Agenzia delle Entrate, INPS, prassi bancaria). Cerca online su fonti certificate.",
    inputSchema: z.object({
      query: z.string(),
      focus: z.enum(["istituzionale", "editoriale", "tutto"]).default("tutto"),
    }),
    outputSchema: z.any(),
  },

  async (input, options?: any) => {
    try {
      const apiKey = process.env.TAVILY_API_KEY;
      if (!apiKey) return [{ error: "TAVILY_API_KEY non configurata." }];

      let finalDomains = [...CFG.DOMAINS_ISTITUZIONALE, ...CFG.DOMAINS_EDITORIALE];
      if (input.focus === "istituzionale") finalDomains = [...CFG.DOMAINS_ISTITUZIONALE];
      if (input.focus === "editoriale") finalDomains = [...CFG.DOMAINS_EDITORIALE];

      // 👇 Leggiamo webLimit dal contesto, altrimenti applichiamo il default di 5
      const webLimit = options?.context?.webLimit ?? 5;

      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: apiKey,
          query: input.query,
          search_depth: "basic",
          include_domains: finalDomains,
          max_results: webLimit,
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