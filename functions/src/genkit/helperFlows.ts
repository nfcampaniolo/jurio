import { ai, CFG } from "./config";
import { ricercaFascicoloUtente, ricercaDatabaseInterno, analizzaDistinguishFattispecie, webSearchTool } from "./tools";
import { getDb } from "../deps";

const db = getDb();

// ─────────────────────────────────────────────
// Helper — Legal Agent Chat (Jurio Chat)
// ─────────────────────────────────────────────

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

export async function generateChatTitle(prompt: string, isFirstMessage?: boolean): Promise<string | undefined> {
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

export function prepareContextAndMessages(input: any): any[] {
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
    return { model: "googleai/gemini-2.5-flash", dbLimit: 5, webLimit: 2 };
  }
}

export async function executeDeterministicRetrieval(
  input: any,
  promptLower: string,
  toolContext: any,
  sendChunk: any
) {
  const isConversational =
    promptLower.length < 25 &&
    /^(grazie|ok|chiaro|perfetto|ciao|va bene|ottimo|esatto)/.test(promptLower);

  const isDatabaseQuery =
    /(sentenza|ordinanza|cassazione|tribunale|tar|provvediment|art\.|articolo|legge|codice|decreto|direttiva|giurisprudenza|massima)/i
      .test(promptLower);

  const hasDocs =
    Array.isArray(toolContext.docs) && toolContext.docs.length > 0;

  const isFascicoloQuery =
    (
      input.fascicoloId &&
      /(questo documento|il contratto|il file|fascicolo|allegato|caricato|documentazione)/i
        .test(promptLower)
    ) || hasDocs;

  const needsWebSearch =
    /(recente|news|novità|aggiornament|oggi|notizi|tempo reale|ultim'ora)/i
      .test(promptLower);

  const isDistinguishQuery =
    /(fattispecie|caso concreto|mio caso|differenz|analizza i fatti|applicabil|distinguish)/i
      .test(promptLower);

  const matchPuntuale =
    promptLower.match(/\b\d{1,6}\/\d{4}\b/);

  const matchNormativa =
    promptLower.match(
      /(?:art|articolo)\.?\s*\d+(?:\s*(?:bis|ter|quater|quinquies))?/i
    );

  const matchExecutive =
    promptLower.match(
      /\b(procedi|procediamo|vai\s+avanti|vai\s+pure|continua|continuiamo|prosegui|proseguiamo|esegui|eseguiamo|avvia|applicalo|fallo|puoi\s+procedere|andiamo\s+avanti|prcedi)\b/i
    );

  const hasExecutiveIntent = Boolean(matchExecutive);

  let preRetrievalOutput: any = null;
  let preRetrievalToolName = "";

  if (!isConversational) {
    try {
      if (hasDocs) {
        sendChunk({
          status: "Lettura dei documenti allegati..."
        });

        preRetrievalToolName = "ricercaFascicoloUtente";

        preRetrievalOutput = await ricercaFascicoloUtente(
          { query: input.prompt },
          { context: toolContext }
        );

      } else if (matchPuntuale) {
        sendChunk({
          status: `Ricerca sentenza ${matchPuntuale[0]}...`
        });

        preRetrievalToolName = "ricercaDatabaseInterno";

        preRetrievalOutput = await ricercaDatabaseInterno(
          {
            tipo_ricerca: "puntuale",
            numero_sentenza: matchPuntuale[0],
            query: input.prompt
          },
          { context: toolContext }
        );

      } else if (matchNormativa) {
        sendChunk({
          status: `Ricerca riferimento ${matchNormativa[0]}...`
        });

        preRetrievalToolName = "ricercaDatabaseInterno";

        preRetrievalOutput = await ricercaDatabaseInterno(
          {
            tipo_ricerca: "normativa",
            query: matchNormativa[0]
          }
        );
      } else if (isFascicoloQuery) {
        sendChunk({
          status: "Consultazione documenti utente..."
        });

        preRetrievalToolName = "ricercaFascicoloUtente";

        preRetrievalOutput = await ricercaFascicoloUtente(
          { query: input.prompt },
          { context: toolContext }
        );
      }
    } catch (err) {
      console.warn(
        "Errore pre-retrieval deterministico:",
        err
      );
    }
  }

  let dynamicTools: any[] = [];
  let skipTurn1 = false;

  const isEmptyRetrieval =
    preRetrievalOutput &&
    Array.isArray(preRetrievalOutput) &&
    preRetrievalOutput[0]?.messaggio?.includes("Nessun paragrafo");
  if (
    preRetrievalOutput &&
    (!Array.isArray(preRetrievalOutput) ||
      !preRetrievalOutput[0]?.error) &&
    !isEmptyRetrieval &&
    !hasExecutiveIntent
  ) {
    skipTurn1 = true;
  }

  if (!isConversational) {
    if (hasExecutiveIntent) {
      dynamicTools = [
        ricercaDatabaseInterno,
        ricercaFascicoloUtente,
        analizzaDistinguishFattispecie,
        webSearchTool,
      ];
    } else {
      if (isDatabaseQuery) {
        dynamicTools.push(ricercaDatabaseInterno);
      }
      if (isFascicoloQuery || hasDocs) {
        dynamicTools.push(ricercaFascicoloUtente);
      }
      if (isDistinguishQuery) {
        dynamicTools.push(analizzaDistinguishFattispecie);
      }
      if (needsWebSearch) {
        dynamicTools.push(webSearchTool);
      }
      if (
        hasDocs &&
        !dynamicTools.includes(ricercaFascicoloUtente)
      ) {
        dynamicTools.push(ricercaFascicoloUtente);
      }
    }
  }
  return {
    skipTurn1,
    preRetrievalOutput,
    preRetrievalToolName,
    dynamicTools,
  };
}

export function extractAndFormatSources(messages: any[]) {
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

// ─────────────────────────────────────────────
// Helper — Word
// ─────────────────────────────────────────────

export function buildQuoteSystemPrompt() {
  return `# RUOLO E OBIETTIVO
Sei l'hub di ricerca e sintesi legale di Microsoft Word. Il tuo scopo è estrarre principi di diritto esclusivamente dalle sentenze fornite dai tool e redigere una sintesi ("Quote") pronta per un atto giuridico.

# REGOLE DI OUTPUT
- Scrivi SOLO il testo giuridico formale.
- Nessun preambolo, saluto o commento (es. NON scrivere "Ecco la sintesi:").
- Integra gli estremi delle sentenze citate in modo discorsivo direttamente nel testo.
- BASATI ESCLUSIVAMENTE SULLE FONTI RESTITUITE DAI TOOL. Non utilizzare conoscenze pregresse o esterne.
- Se dai tool non emergono risultati pertinenti, rispondi tassativamente ed unicamente con il testo: "NESSUN_RISULTATO".`;
}

export function estraiFontiDalRisultato(response: any) {
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

export function buildReviewSystemPrompt() {
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

// ─────────────────────────────────────────────
// Helper — Deep Analysis
// ─────────────────────────────────────────────

export async function getModelForUser(userId: string): Promise<string> {
  if (!userId) return "googleai/gemini-2.5-flash";
  
  try {
    const userDoc = await db.collection("register").doc(userId).get();
    
    if (userDoc.exists) {
      const planId = userDoc.data()?.planId;
      if (["business", "business_m", "admin"].includes(planId)) {
        return "googleai/gemini-2.5-pro";
      }
    }
  } catch (error) {
    console.error("Errore durante il recupero del planId da Firestore:", error);
  }
  
  // Fallback di default
  return "googleai/gemini-2.5-flash";
}

export const isUrl = (val: string) => {
  try {
    const u = new URL(val);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
};

export const validaFonti = (fonti: any[]) => {
  if (!Array.isArray(fonti)) return [];
  const fontiValide = [];
  for (const item of fonti) {
    if (!item || !item.id || !item.fonte) continue;
    const id = String(item.id).trim();
    const validUrl = isUrl(id);
    
    if (item.fonte === "web" && !validUrl) {
      console.warn(`[Validazione] Scartata fonte web non valida: ${id}`);
      continue;
    }
    if (item.fonte === "interna" && validUrl) {
      console.warn(`[Validazione] Scartata fonte interna non valida (era URL): ${id}`);
      continue;
    }
    // Preserva escluso, nuova e qualsiasi altro campo passato nel payload
    fontiValide.push({ ...item, id });
  }
  return fontiValide;
};