import { ai, CFG, ChatMessageSchema, GeminiFallbackInputSchema, GeminiFallbackOutputSchema, EstraiMetadatiInputSchema, EstraiMetadatiOutputSchema, ReviewListSchema, FonteSchema, ResearchOutputSchema, PromptFieldSchema, PromptOutputSchema, ReportSintesiSchema, DoctrineOutputSchema } from "./config";
import { z } from 'genkit';
import { generateChatTitle, prepareContextAndMessages, getExecutionProfile, extractAndFormatSources, estraiFontiDalRisultato, buildQuoteSystemPrompt, buildReviewSystemPrompt, validaFonti, ToolContext, FlowChunkPayload} from "./helperFlows";
import { SYSTEM_PROMPT_JURIO_SUPPORT, PROMPT_MASSIMAZIONE, PROMPT_DOTTRINA } from '../params';
import { ricercaManualeTool, ricercaDatabaseInterno, webSearchTool, analizzaDistinguishFattispecie, ricercaFascicoloUtente, ricercaDottrina } from "./tools";

// ─────────────────────────────────────────────
// FLOW — Legal Agent Chat (Jurio Chat)
// ─────────────────────────────────────────────
// Passiamo tutti i tool all'orchestratore per evitare che invenzioni del LLM causino crash "NOT_FOUND"
const ALL_TOOLS = [ricercaDatabaseInterno, ricercaFascicoloUtente, analizzaDistinguishFattispecie, webSearchTool, ricercaManualeTool];

export const legalAgentFlow = ai.defineFlow(
  {
    name: "legalAgentFlow",
    inputSchema: z.object({
      prompt: z.string().min(1).max(20_000),
      filters: z.array(z.unknown()).optional(),
      docs: z.array(z.string()).optional(),
      history: z.array(z.record(z.string(), z.unknown())).optional(),
      isFirstMessage: z.boolean().optional(),
      userId: z.string().min(1),
      fascicoloId: z.string().nullable().optional(),
      metadatiFascicolo: z.record(z.unknown()).optional(),
      fascicoloTitolo: z.string().nullable().optional(),
    }),
    outputSchema: z.object({
      risposta: z.string(),
      fonti: z.array(z.unknown()),
      titoloGenerato: z.string().optional(),
    }),
    streamSchema: z.object({
      status: z.string().optional(),
      text: z.string().optional(),
      error: z.any().optional(),
    }),
  },
  async (input, { sendChunk }) => {
    
    // Wrapper sicuro per prevenire crash su disconnessione client
    const safeSend = (payload: FlowChunkPayload | { error: { message: string } }) => {
      try {
        sendChunk(payload as any);
      } catch (e: any) {
        if (e?.code === 'ERR_INVALID_STATE' || e?.message?.includes('already closed')) {
          // Client disconnesso prematuramente: ignoriamo l'errore
        } else {
          console.warn("[legalAgentFlow] Errore non critico in sendChunk:", e);
        }
      }
    };

    const prompt = input.prompt.trim();
    const promptLower = prompt.toLowerCase();

    safeSend({ status: "Analisi della richiesta..." });

    const profile = getExecutionProfile(promptLower);
    const selectedModel = profile.model;

    const titlePromise = input.isFirstMessage
      ? generateChatTitle(prompt, true)
      : Promise.resolve(undefined);

    const messages = prepareContextAndMessages({ ...input, prompt });
    appendOrchestrationRule(messages); // Regole ferree iniettate subito

    const toolContext: ToolContext = {
      userId: input.userId,
      fascicoloId: input.fascicoloId ?? null,
      uiFilters: Array.isArray(input.filters) ? input.filters : [],
      docs: Array.isArray(input.docs) ? input.docs : [],
      dbLimit: profile.dbLimit,
      webLimit: profile.webLimit,
    };

    let rawOutputs: any[] = []; 

    // Pre-caricamento intelligente dei documenti allegati
    if (toolContext.docs.length > 0) {
      safeSend({ status: "Lettura dei documenti allegati..." });
      try {
        const preRetrievalOutput = await ricercaFascicoloUtente({ query: prompt }, { context: toolContext });
        
        if (Array.isArray(preRetrievalOutput)) {
          rawOutputs = preRetrievalOutput;
        } else if (preRetrievalOutput && typeof preRetrievalOutput === "object") {
          const po = preRetrievalOutput as any;
          rawOutputs = Array.isArray(po.topMatches) ? po.topMatches 
                     : Array.isArray(po.risultati) ? po.risultati 
                     : Array.isArray(po.results) ? po.results 
                     : [po];
        }

        const isErr = rawOutputs.length > 0 && typeof rawOutputs[0]?.messaggio === "string" && rawOutputs[0].messaggio.includes("Nessun paragrafo");
        
        if (!isErr && rawOutputs.length > 0) {
          const retrievalText = JSON.stringify(preRetrievalOutput);
          appendRetrievalContext(messages, retrievalText, "Documentazione Allegata");
        }
      } catch (e) {
        console.warn("Errore lettura documenti iniziali:", e);
      }
    }

    // FIX ANT-ALLUCINAZIONE: L'istruzione in coda "sopravvive" al testo lungo dei PDF allegati.
    // Viene appesa all'ultimissimo messaggio dell'utente per bypassare il 'Recency Bias'.
    const orchestrationReminder = `\n\n[SISTEMA - ISTRUZIONE IMPERATIVA]: Se la richiesta prevede di cercare provvedimenti, sentenze o casi analoghi, DEVI OBBLIGATORIAMENTE USARE ORA il tool 'ricercaDatabaseInterno' passandogli gli argomenti chiave. È SEVERAMENTE VIETATO inventare giurisprudenza o rispondere affidandoti solo alla memoria. Usa sempre i tool.`;
    
    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage && lastUserMessage.role === "user") {
      lastUserMessage.content.push({ text: orchestrationReminder });
    }

    let finalResponse: any = null;
    let activeToolResponses: any[] = []; 

    try {
      safeSend({ status: "Districando..." });

      // PRIMA CHIAMATA LLM (Totalmente Agentica)
      const turn1Response = await ai.generate({
        model: selectedModel,
        messages: messages,
        tools: ALL_TOOLS, 
        returnToolRequests: true,
        context: toolContext,
        config: { 
          maxOutputTokens: 2500 
        },
        onChunk: (chunk: any) => {
          const toolName = extractToolName(chunk);
          if (toolName) {
            safeSend({ status: `Ricerca in corso: ${toolName}...` });
          } else if (typeof chunk?.text === "string" && chunk.text.length > 0) {
            safeSend({ text: chunk.text });
          }
        },
      });

      finalResponse = turn1Response;

      // ESECUZIONE TOOL E SINTESI (Solo se l'LLM ha deciso di chiamarli)
      if (Array.isArray(turn1Response.toolRequests) && turn1Response.toolRequests.length > 0) {
        safeSend({ status: "Consultazione archivi in corso..." });

        const toolResponses = await executeRequestedTools(
          turn1Response.toolRequests,
          ALL_TOOLS,
          toolContext,
          safeSend
        );
        
        activeToolResponses = toolResponses;

        if (toolResponses.length > 0) {
          safeSend({ status: "Sintesi finale..." });
          
          // 1. Formattiamo i risultati dei tool come contesto testuale pulito
          const toolResultsContext = toolResponses.map((tr: any) => {
            const name = tr.toolResponse?.name || "archivio";
            const output = tr.toolResponse?.output;
            const content = typeof output === "string" ? output : JSON.stringify(output, null, 2);
            return `--- DATI REPERITI DA [${name}] ---\n${content}`;
          }).join("\n\n");

          // 2. Prepariamo i messaggi per la sintesi: cronologia originale + dati estratti.
          // Escludiamo i messaggi tecnici con toolRequest per evitare blocchi da Vertex AI.
          const synthesisMessages = [
            ...messages,
            {
              role: "user" as const,
              content: [
                {
                  text: `[DATI REPERITI DAGLI ARCHIVI/TOOL]:\n${toolResultsContext}\n\n[ISTRUZIONE DI SINTESI]: Rispondi alla richiesta dell'utente in modo esaustivo, chiaro e strutturato, basandoti ESCLUSIVAMENTE sulle informazioni sopra riportate. Rispondi direttamente al quesito senza menzionare passaggi tecnici interni o i nomi dei tool utilizzati.`
                }
              ]
            }
          ];

          // 3. Generazione testuale pura (Niente tools -> Nessun loop possibile)
          finalResponse = await ai.generate({
            model: selectedModel,
            messages: synthesisMessages,
            config: { 
              maxOutputTokens: 3000 
            },
            onChunk: (chunk: any) => {
              if (typeof chunk?.text === "string" && chunk.text.length > 0) {
                safeSend({ text: chunk.text });
              }
            },
          });
        }
      }

    } catch (error: unknown) {
      console.error("[legalAgentFlow] Errore ai.generate:", error);
      const msg = "Il motore neurale ha incontrato un errore imprevisto durante l'elaborazione.";
      safeSend({ error: { message: msg } }); 
      throw new Error(msg);
    }

    const titoloGenerato = await titlePromise;
    const sourceMessages = finalResponse?.messages ?? messages;
    
    // Estrazione Fonti Combinata 
    const defaultSourceType = toolContext.docs.length > 0 ? "documento_allegato" : "database_interno";
    const fontiFinali = extractAndFormatSources(sourceMessages, rawOutputs, defaultSourceType, activeToolResponses);

    return {
      risposta: typeof finalResponse?.text === "string" && finalResponse.text.trim()
        ? finalResponse.text
        : "Nessuna risposta generata.",
      fonti: fontiFinali,
      titoloGenerato,
    };
  }
);

// ─────────────────────────────────────────────
// REGOLA DI ORCHESTRAZIONE AGGIORNATA
// ─────────────────────────────────────────────
function appendOrchestrationRule(messages: any[]): void {
  const rule = `
REGOLE TASSATIVE E INVALICABILI DI ORCHESTRAZIONE:

1. DIVIETO DI ALLUCINAZIONE: Non puoi MAI generare o elencare sentenze, ordinanze o provvedimenti basandoti sulla tua memoria interna.
2. OBBLIGO DI TOOL: Se l'utente ti chiede "cerchi provvedimenti", "trovami sentenze analoghe", TU DEVI ASSOLUTAMENTE USARE lo strumento "ricercaDatabaseInterno". 
3. Se l'utente ti allega un documento e ti chiede sentenze "analoghe", usa "ricercaDatabaseInterno" passandogli come query l'argomento chiave del documento.
4. USO DEL WEB: Usa "webSearchTool" per cercare leggi, norme, articoli, OPPURE se l'utente chiede esplicitamente di cercare "su internet" o "sul web".
5. Per documenti/fascicoli usa "ricercaFascicoloUtente".
6. ASSISTENZA PIATTAFORMA: Se l'utente fa domande sul funzionamento di Jurio, su come si usa la piattaforma, come compiere un'azione o gestire l'account, DEVI USARE il tool "ricercaManualeTool". Non inventare procedure.
7. Le tue risposte devono basarsi ESCLUSIVAMENTE sull'output dei tool. Se non trovi risultati, ammettilo chiaramente.
`;

  const sys = messages.find((msg) => msg.role === "system");
  if (sys) {
    sys.content[0].text += `\n\n${rule}`;
  } else {
    messages.unshift({ role: "system", content: [{ text: rule }] });
  }
}

function appendRetrievalContext(messages: any[], retrievalText: string, sourceName: string): void { // 👈 sourceName
  let userMessageIndex = messages.length - 1;
  while (userMessageIndex >= 0 && messages[userMessageIndex].role !== "user") userMessageIndex--;
  if (userMessageIndex === -1) return;

  messages[userMessageIndex].content.push({
    // 👈 Usa sourceName (il nome descrittivo che non causa false invocazioni di tool)
    text: `\n\n--- CONTESTO RECUPERATO AUTOMATICAMENTE ---\nOrigine: ${sourceName}\n${retrievalText}\n--- FINE CONTESTO RECUPERATO ---`,
  });
}
function extractToolName(chunk: any): string | null {
  if (!chunk || !Array.isArray(chunk.content)) return null;
  for (const part of chunk.content) {
    if (part?.toolRequest?.name) return String(part.toolRequest.name);
  }
  return null;
}

async function executeRequestedTools(
  toolRequests: any[],
  dynamicTools: any[],
  toolContext: any,
  sendChunk: (chunk: { status: string } | { text: string }) => void
): Promise<any[]> {
  const requests = toolRequests.slice(0, 8);
  const seenCalls = new Set<string>();

  const executableRequests = requests.filter((part: any) => {
    const req = part?.toolRequest;
    if (!req?.name) {
      return false;
    }

    const key = JSON.stringify({
      name: req.name,
      input: req.input ?? {},
    });

    if (seenCalls.has(key)) {
      return false;
    }

    seenCalls.add(key);
    return true;
  });

  const results = await Promise.all(
    executableRequests.map(async (part: any) => {
      const req = part.toolRequest;

      try {
        const toolDef = dynamicTools.find(
          (tool: any) =>
            tool.name === req.name ||
            tool.__action?.name === req.name ||
            tool.__action?.name?.endsWith(req.name)
        );

        if (!toolDef) {
          throw new Error(`Tool non trovato: ${req.name}`);
        }

        sendChunk({ status: `Esecuzione: ${req.name}...` });

        const output = await toolDef(req.input, {
          context: toolContext,
        });

        return {
          toolResponse: {
            name: req.name,
            ref: req.ref,
            output,
          },
        };
      } catch (error) {
        console.error(`[Orchestrator] Errore tool ${req.name}:`, error);

        return {
          toolResponse: {
            name: req.name,
            ref: req.ref,
            output: {
              error: "Errore temporaneo durante l'esecuzione del tool.",
            },
          },
        };
      }
    })
  );

  return results;
}

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
    inputSchema: GeminiFallbackInputSchema,
    outputSchema: GeminiFallbackOutputSchema,
  },
  async (input) => {
    
    const aiResponse = await ai.generate({
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
// FLOW — Analisi documentale
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
// FLOW — Meta-Prompting
// ──

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
        messages: messages as any,
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

// ─────────────────────────────────────────────
// FLOW — Enhance Prompting
// ──

export const enhancePromptFlow = ai.defineFlow(
  {
    name: 'enhancePromptFlow',
    inputSchema: z.object({
      prompt: z.string(),
      type: z.enum(["chat", "approfondimento"]),
      history: z.array(z.any()).optional(),
    }),
    outputSchema: z.object({
      enhancedPrompt: z.string(),
    }),
  },
  async (input) => {
    let systemInstruction = "";

    // Adattiamo il comportamento dell'IA al contesto in cui l'utente si trova
    if (input.type === "chat") {
      systemInstruction = `Sei un esperto avvocato cassazionista italiano. Il tuo compito è ottimizzare il prompt dell'utente per renderlo un quesito giuridico perfetto per un motore di ricerca legale AI.
Regole Tassative:
1. Riscrivi il testo migliorando la terminologia giuridica, rendendola più precisa e professionale.
2. Isola chiaramente la premessa in fatto (se presente) dal quesito di diritto.
3. NON rispondere alla domanda. Il tuo scopo è SOLO migliorare la formulazione della domanda stessa.
4. RESTITUISCI ESCLUSIVAMENTE IL TESTO OTTIMIZZATO, senza preamboli, senza virgolette e senza frasi come "Ecco il prompt migliorato:".`;
    } else if (input.type === "approfondimento") {
      systemInstruction = `Sei un legal prompt engineer specializzato in ricerca giurisprudenziale e dottrinale. Il tuo compito è ottimizzare l'input dell'utente per definire con estrema precisione i criteri, il perimetro e l'ordinamento di una ricerca legale complessa affidata a un'IA.
Regole Tassative:
1. Riscrivi la richiesta specificando chiaramente il tipo di ricerca da effettuare, i criteri di ordinamento (es. cronologico decrescente, gerarchico per grado di giudizio, rilevanza) e la tipologia di fonti da privilegiare (es. Cassazione a Sezioni Unite, giurisprudenza di merito, prassi).
2. Traduci eventuali espressioni colloquiali in terminologia tecnico-giuridica avanzata per massimizzare la precisione del motore di ricerca (retrieval).
3. NON rispondere al quesito e non eseguire la ricerca. Il tuo scopo è SOLO formulare la direttiva di ricerca perfetta.
4. RESTITUISCI ESCLUSIVAMENTE IL TESTO OTTIMIZZATO, senza preamboli, senza virgolette e senza frasi introduttive.`;
    }

    const { text } = await ai.generate({
      messages: [
        { role: "system", content: [{ text: systemInstruction }] },
        { role: "user", content: [{ text: input.prompt }] }
      ]
    });

    return {
      enhancedPrompt: text.trim(),
    };
  }
);

// ─────────────────────────────────────────────
// FLOW — Deep Analysis
// ──

/* ============================================================
   DEEP ANALYSIS - SHARED SCHEMAS
============================================================ */

const ConceptMapNodeSchema = z.object({
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

const ConceptMapEdgeSchema = z.object({
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

const ResearchOutputWithConceptMapSchema = ResearchOutputSchema.extend({
  mappaConcettuale: ConceptMapSchema,
});

const ResearchMappingSchema = ResearchOutputSchema.pick({
  inquadramento: true,
  mappaDialettica: true,
});

/* ============================================================
   CONFIG TIPIZZATA
============================================================ */

const DeepAnalysisConfigSchema = z.object({
  confidenceLevel: z.number().min(0).max(100).default(80),
  sourceWeb: z.boolean().default(true),
  sourceInternalDB: z.boolean().default(true),
  sourceDoctrine: z.boolean().default(true),
  webLimit: z.number().int().min(1).max(10).default(5),
});


/* ============================================================
   INPUT TYPES
============================================================ */

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

type ResearchSource = {
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

/* ============================================================
   UTILITY
============================================================ */

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function stableId(prefix: string, value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }
  return `${prefix}_${(hash >>> 0).toString(16)}`;
}

function normalizeArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map(normalizeText)
        .filter(Boolean)
    )
  );
}

function normalizePrecedenti(
  value: unknown
): Array<{
  numero: string;
  anno: number | null;
  sezione?: string;
}> {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const raw = item as Record<string, unknown>;
      const numero = normalizeText(raw.numero);
      if (!numero) return null;

      const anno =
        typeof raw.anno === "number" && Number.isFinite(raw.anno)
          ? raw.anno
          : null;

      const sezione = normalizeText(raw.sezione);

      return {
        numero,
        anno,
        ...(sezione ? { sezione } : {}),
      };
    })
    .filter(
      (
        item
      ): item is {
        numero: string;
        anno: number | null;
        sezione?: string;
      } => item !== null
    );
}

/* ============================================================
   ESTRAZIONE OUTPUT DEI TOOL
============================================================ */

function extractToolOutputs(messages: any[]): any[] {
  const outputs: any[] = [];
  for (const message of messages ?? []) {
    if (!Array.isArray(message?.content)) {
      continue;
    }
    for (const part of message.content) {
      const output = part?.toolResponse?.output;
      if (output !== undefined) {
        outputs.push(output);
      }
    }
  }
  return outputs;
}

/* ============================================================
   ESTRAZIONE FONTI REALI
============================================================ */

function extractResearchSources(messages: any[]): ResearchSource[] {
  const outputs = extractToolOutputs(messages);
  const registry = new Map<string, ResearchSource>();

  for (const output of outputs) {
    const items = Array.isArray(output) ? output : [output];

    for (const item of items) {
      if (!item || typeof item !== "object" || item.error || item.messaggio) {
        continue;
      }

      if (
        typeof item._type === "string" &&
        item._type.startsWith("giurisprudenza_") &&
        typeof item.id === "string"
      ) {
        const sourceId = item.id;
        registry.set(`internal:${sourceId}`, {
          nodeId: stableId("prov", sourceId),
          sourceId,
          source: "internal",
          kind: "provvedimento",
          label: item.numero_sentenza
            ? `Sentenza ${item.numero_sentenza}`
            : "Provvedimento",
          url: typeof item.sourceUrl === "string" ? item.sourceUrl : null,
          metadata: {
            numero_sentenza: item.numero_sentenza ?? "",
            organo_giudicante: item.organo_giudicante ?? "",
            type: item._type,
          },
          normeCitate: normalizeArray(
            item.norme_citate ?? item.riferimenti_normativi_key
          ),
          precedentiCitati: normalizePrecedenti(item.precedenti_citati),
        });
        continue;
      }

      if (
        item._type === "web_search" &&
        item.sourceType === "doctrine" &&
        typeof item.id === "string"
      ) {
        const sourceId = item.id;
        const url =
          typeof item.sourceUrl === "string"
            ? item.sourceUrl
            : typeof item.link === "string"
            ? item.link
            : null;

        registry.set(`doctrine:${sourceId}`, {
          nodeId: stableId("doctrine", sourceId),
          sourceId,
          source: "doctrine",
          kind: "dottrina",
          label:
            normalizeText(item.titolo) ||
            normalizeText(item.tematica) ||
            "Documento Doctrine",
          url,
          metadata: {
            materia: item.materia ?? "",
            tipo_orientamento: item.tipo_orientamento ?? "",
            data_documento: item.data_documento ?? "",
            pagine: item.pagine ?? "",
          },
          normeCitate: normalizeArray(item.norme_citate),
          precedentiCitati: normalizePrecedenti(item.precedenti_citati),
        });
        continue;
      }

      if (item._type === "web_search") {
        const url =
          typeof item.link === "string"
            ? item.link
            : typeof item.url === "string"
            ? item.url
            : null;

        if (!url) {
          continue;
        }

        registry.set(`web:${url}`, {
          nodeId: stableId("web", url),
          sourceId: url,
          source: "web",
          kind: "web",
          label: normalizeText(item.titolo) || url,
          url,
          metadata: {
            fonte: item.fonte ?? "",
          },
          normeCitate: [],
          precedentiCitati: [],
        });
        continue;
      }

      if (item._type === "document_chunk") {
        const docId =
          typeof item.documento_id === "string" && item.documento_id.trim().length > 0
            ? item.documento_id.trim()
            : typeof item.id === "string"
            ? item.id
            : null;

        if (!docId) {
          continue;
        }

        const registryKey = `document:${docId}`;
        const existing = registry.get(registryKey);

        const nuovoEstratto = {
          chunkId: item.id ?? "",
          testo: item.testo_paragrafo ?? "",
          posizione: item.posizione_originale ?? 0,
          score: item._score ?? 0,
        };

        if (existing) {
          const estrattiEsistenti = existing.metadata.estratti || [];
          const giaPresente = estrattiEsistenti.some(
            (e: any) => e.chunkId === nuovoEstratto.chunkId
          );

          if (!giaPresente) {
            existing.metadata.estratti = [...estrattiEsistenti, nuovoEstratto];
          }
        } else {
          registry.set(registryKey, {
            nodeId: stableId("document", docId),
            sourceId: docId,
            source: "document",
            kind: "documento",
            label: normalizeText(item.nome_file) || "Documento utente",
            url: null,
            metadata: {
              posizione: item.posizione_originale ?? 0,
              estratti: [nuovoEstratto],
            },
            normeCitate: [],
            precedentiCitati: [],
          });
        }
      }
    }
  }

  return Array.from(registry.values());
}

/* ============================================================
   CONCEPT MAP
============================================================ */

function buildConceptMap(args: {
  prompt: string;
  sources: ResearchSource[];
  mappaDialettica: any;
}): z.infer<typeof ConceptMapSchema> {
  const { prompt, sources, mappaDialettica } = args;

  const nodes = new Map<string, z.infer<typeof ConceptMapNodeSchema>>();
  const edges = new Map<string, z.infer<typeof ConceptMapEdgeSchema>>();

  const rootId = stableId("question", prompt);

  nodes.set(rootId, {
    id: rootId,
    kind: "quesito",
    source: "system",
    sourceId: null,
    label: prompt,
    resolved: true,
    used: true,
  });

  const sourceNodeById = new Map<string, string>();

  for (const source of sources) {
    nodes.set(source.nodeId, {
      id: source.nodeId,
      kind: source.kind,
      source: source.source,
      sourceId: source.sourceId,
      label: source.label,
      url: source.url,
      resolved: true,
      used: true,
      metadata: source.metadata,
    });

    sourceNodeById.set(source.sourceId, source.nodeId);
    addConceptEdge(edges, source.nodeId, rootId, "rilevante_per");
  }

  const knownPrecedents = new Map<string, ResearchSource>();
  for (const source of sources) {
    if (source.kind !== "provvedimento" || !source.metadata?.numero_sentenza) {
      continue;
    }
    const key = normalizeText(source.metadata.numero_sentenza);
    knownPrecedents.set(key, source);
  }

  for (const source of sources) {
    for (const precedent of source.precedentiCitati) {
      const key = precedent.anno
        ? `${precedent.numero}/${precedent.anno}`
        : precedent.numero;

      const resolved = knownPrecedents.get(key);
      const nodeId = resolved
        ? resolved.nodeId
        : stableId("reference_prov", key);

      if (!nodes.has(nodeId)) {
        nodes.set(nodeId, {
          id: nodeId,
          kind: "provvedimento",
          source: "reference",
          sourceId: null,
          label: `Sentenza ${key}`,
          resolved: false,
          used: false,
          metadata: {
            numero_sentenza: key,
          },
        });
      }

      addConceptEdge(edges, source.nodeId, nodeId, "cita");
    }
  }

  for (const source of sources) {
    for (const norma of source.normeCitate) {
      const normalized = normalizeText(norma).toLowerCase();
      if (!normalized) {
        continue;
      }

      const normaId = stableId("norma", normalized);
      if (!nodes.has(normaId)) {
        nodes.set(normaId, {
          id: normaId,
          kind: "norma",
          source: "reference",
          sourceId: null,
          label: normalizeText(norma),
          resolved: true,
          used: true,
        });
      }

      addConceptEdge(edges, source.nodeId, normaId, "richiama_norma");
    }
  }

  addThesisToMap(
    nodes,
    edges,
    sourceNodeById,
    mappaDialettica?.orientamentoFavorevole,
    "supporta"
  );

  addThesisToMap(
    nodes,
    edges,
    sourceNodeById,
    mappaDialettica?.orientamentoContrario,
    "contrasta"
  );

  const nodeList = Array.from(nodes.values());
  const edgeList = Array.from(edges.values());

  return {
    version: 1,
    quesito: prompt,
    rootId,
    nodes: nodeList.slice(0, 200),
    edges: edgeList.slice(0, 500),
    sourceIds: sources.map((source) => source.sourceId).slice(0, 200),
    stats: {
      provvedimenti: nodeList.filter(
        (node) => node.kind === "provvedimento"
      ).length,
      dottrina: nodeList.filter((node) => node.kind === "dottrina").length,
      web: nodeList.filter((node) => node.kind === "web").length,
      documenti: nodeList.filter((node) => node.kind === "documento").length,
      norme: nodeList.filter((node) => node.kind === "norma").length,
      tesi: nodeList.filter((node) => node.kind === "tesi").length,
      relazioni: edgeList.length,
    },
  };
}

function addConceptEdge(
  edges: Map<string, any>,
  source: string,
  target: string,
  type:
    | "rilevante_per"
    | "cita"
    | "richiama_norma"
    | "supporta"
    | "contrasta"
    | "correlato"
): void {
  const id = stableId("edge", `${source}|${target}|${type}`);
  edges.set(id, {
    id,
    source,
    target,
    type,
  });
}

function addThesisToMap(
  nodes: Map<string, any>,
  edges: Map<string, any>,
  sourceNodeById: Map<string, string>,
  branch: any,
  edgeType: "supporta" | "contrasta"
): void {
  if (!branch) {
    return;
  }

  const title = normalizeText(branch.titoloTesi);
  if (!title) {
    return;
  }

  const thesisId = stableId("thesis", `${edgeType}|${title}`);

  nodes.set(thesisId, {
    id: thesisId,
    kind: "tesi",
    source: "system",
    sourceId: null,
    label: title,
    resolved: true,
    used: true,
    metadata: {
      argomentazione: normalizeText(branch.argomentazioneLogica),
    },
  });

  const fonti = Array.isArray(branch.fonti) ? branch.fonti : [];

  for (const fonte of fonti as Array<{ id: string }>) {
    const sourceNodeId = sourceNodeById.get(fonte.id);
    if (!sourceNodeId) {
      continue;
    }
    addConceptEdge(edges, sourceNodeId, thesisId, edgeType);
  }
}

/* ============================================================
   MERGE MAPPE
============================================================ */

function mergeConceptMaps(
  current: z.infer<typeof ConceptMapSchema> | null | undefined,
  incoming: z.infer<typeof ConceptMapSchema> | null | undefined
): z.infer<typeof ConceptMapSchema> {
  if (!current) {
    return incoming ?? createEmptyConceptMap("");
  }

  if (!incoming) {
    return current;
  }

  const nodes = new Map<string, any>();
  for (const node of current.nodes) {
    nodes.set(node.id, node);
  }

  for (const node of incoming.nodes) {
    const existing = nodes.get(node.id);
    nodes.set(
      node.id,
      existing
        ? {
            ...existing,
            ...node,
            metadata: {
              ...(existing.metadata ?? {}),
              ...(node.metadata ?? {}),
            },
          }
        : node
    );
  }

  const edges = new Map<string, any>();
  for (const edge of current.edges) {
    edges.set(edge.id, edge);
  }

  for (const edge of incoming.edges) {
    edges.set(edge.id, edge);
  }

  const mergedNodes = Array.from(nodes.values()).slice(0, 200);
  const mergedEdges = Array.from(edges.values()).slice(0, 500);

  return {
    version: 1,
    quesito: current.quesito,
    rootId: current.rootId,
    nodes: mergedNodes,
    edges: mergedEdges,
    sourceIds: Array.from(
      new Set([...current.sourceIds, ...incoming.sourceIds])
    ).slice(0, 200),
    stats: {
      provvedimenti: mergedNodes.filter(
        (node) => node.kind === "provvedimento"
      ).length,
      dottrina: mergedNodes.filter((node) => node.kind === "dottrina").length,
      web: mergedNodes.filter((node) => node.kind === "web").length,
      documenti: mergedNodes.filter((node) => node.kind === "documento").length,
      norme: mergedNodes.filter((node) => node.kind === "norma").length,
      tesi: mergedNodes.filter((node) => node.kind === "tesi").length,
      relazioni: mergedEdges.length,
    },
  };
}

function createEmptyConceptMap(
  prompt: string
): z.infer<typeof ConceptMapSchema> {
  const rootId = stableId("question", prompt);
  return {
    version: 1,
    quesito: prompt,
    rootId,
    nodes: [
      {
        id: rootId,
        kind: "quesito",
        source: "system",
        sourceId: null,
        label: prompt,
        resolved: true,
        used: true,
      },
    ],
    edges: [],
    sourceIds: [],
    stats: {
      provvedimenti: 0,
      dottrina: 0,
      web: 0,
      documenti: 0,
      norme: 0,
      tesi: 0,
      relazioni: 0,
    },
  };
}

/* ============================================================
   ACTIVE SOURCE IDS
============================================================ */

function extractKnownSourceIds(
  conceptMap: any,
  mappaDialettica: any
): string[] {
  const mapIds = Array.isArray(conceptMap?.sourceIds)
    ? conceptMap.sourceIds
    : [];

  const favIds = Array.isArray(mappaDialettica?.orientamentoFavorevole?.fonti)
    ? mappaDialettica.orientamentoFavorevole.fonti.map(
        (source: { id?: unknown }) =>
          typeof source.id === "string" ? source.id : null
      )
    : [];

  const contIds = Array.isArray(mappaDialettica?.orientamentoContrario?.fonti)
    ? mappaDialettica.orientamentoContrario.fonti.map(
        (source: { id?: unknown }) =>
          typeof source.id === "string" ? source.id : null
      )
    : [];

  return Array.from(
    new Set(
      [...mapIds, ...favIds, ...contIds].filter(
        (id): id is string => typeof id === "string"
      )
    )
  );
}

/* ============================================================
   SOURCE SANITIZATION FOR SYNTHESIS
============================================================ */

function sanitizeConceptMapForSynthesis(
  conceptMap: z.infer<typeof ConceptMapSchema> | null | undefined
) {
  if (!conceptMap) {
    return null;
  }

  return {
    version: conceptMap.version,
    quesito: conceptMap.quesito,
    rootId: conceptMap.rootId,
    sourceIds: conceptMap.sourceIds,
    nodes: conceptMap.nodes,
    edges: conceptMap.edges,
    stats: conceptMap.stats,
  };
}

export const researchAnalysisFlow = ai.defineFlow(
  {
    name: "researchAnalysisFlow",
    inputSchema: z.object({
      prompt: z.string().min(1).max(20_000),
      docs: z
        .array(
          z.union([
            z.string(),
            z.object({
              id: z.string(),
            }),
          ])
        )
        .optional()
        .default([])
        .transform((items) =>
          Array.from(
            new Set(
              items
                .map((item) => (typeof item === "string" ? item : item.id))
                .map((id) => id.trim())
                .filter(Boolean)
            )
          ).slice(0, 50)
        ),
      userId: z.string().min(1),
      config: DeepAnalysisConfigSchema.optional().default({}),
    }),
    outputSchema: ResearchOutputWithConceptMapSchema,
  },
  async ({ prompt, docs, userId, config }) => {
    const {
      confidenceLevel,
      sourceWeb,
      sourceInternalDB,
      sourceDoctrine,
      webLimit,
    } = config;

    const hasUserDocs = docs.length > 0;

    const dynamicTools = [
      sourceInternalDB ? ricercaDatabaseInterno : null,
      sourceDoctrine ? ricercaDottrina : null,
      sourceWeb ? webSearchTool : null,
      hasUserDocs ? ricercaFascicoloUtente : null,
    ].filter(Boolean);

    const requiredTools = [
      sourceInternalDB ? "ricercaDatabaseInterno" : null,
      sourceDoctrine ? "ricercaDottrina" : null,
      sourceWeb ? "webSearchTool" : null,
      hasUserDocs ? "ricercaFascicoloUtente" : null,
    ].filter((tool): tool is string => typeof tool === "string");

    const systemPrompt = `
SEI JURIO.

Esegui un'analisi giurisprudenziale e dottrinale approfondita sul seguente quesito.

QUESITO UTENTE:
"${prompt}"

FONTI ABILITATE:
${requiredTools.length ? requiredTools.join("\n") : "(Nessun tool esterno abilitato)"}

ALLEGATI / FASCICOLO UTENTE CARICATI (${docs.length}):
${hasUserDocs ? docs.map((id) => `- \${id}`).join("\n") : "(Nessun allegato presente)"}

REGOLE TASSATIVE DI RICERCA ED ESTRAZIONE:
1. ${
      hasUserDocs
        ? "ALLEGATI UTENTE DETECTATI: DEVI consultare obbligatoriamente 'ricercaFascicoloUtente' per analizzare il contenuto dei documenti allegati."
        : "Nessun allegato utente presente."
    }
2. Effettua al massimo 2 chiamate di ricerca in totale (Massimo 3 turni di tool).
3. CIRCUIT BREAKER: Se trovi giurisprudenza/documenti sufficienti per inquadrare la questione, FERMATI IMMEDIATAMENTE. Non effettuare ricerche ridondanti.
4. Non inventare mai fonti. I risultati dei tool costituiscono i tuoi unici dati reali.
5. Utilizza il database interno per i precedenti giurisprudenziali, Dottrina per orientamenti e note, il Web per la normativa aggiornata e la prassi, e il Fascicolo Utente per gli allegati di causa.
`;

    let searchResponse: any = null;

    try {
      searchResponse = await ai.generate({
        messages: [
          {
            role: "system",
            content: [{ text: systemPrompt }],
          },
          {
            role: "user",
            content: [
              {
                text: `Avvia la ricerca di approfondimento per il quesito: "${prompt}"`,
              },
            ],
          },
        ],
        tools: dynamicTools as any,
        maxTurns: 3,
        context: {
          userId,
          docs,
          webLimit,
          confidenceLevel,
          sourceWeb,
          sourceInternalDB,
          sourceDoctrine,
          requiredTools,
        },
      });
    } catch (err: any) {
      console.error("[ResearchAnalysisFlow] Tool execution warning/error:", err);
      const message = String(err?.message ?? "");

      // Graceful degradation: recupera la cronologia messaggi anche in caso di superamento iterazioni
      if (
        message.includes("Exceeded maximum tool call iterations") ||
        message.includes("ToolLoop")
      ) {
        console.warn(
          "[ResearchAnalysisFlow] Raggiunto limite iterazioni tool. Procedo con le evidenze parziali estratte."
        );
        searchResponse = {
          messages: err?.messages || err?.customProperties?.messages || [],
        };
      } else {
        throw new Error(
          `Errore durante la fase di ricerca delle fonti: ${
            message || "errore sconosciuto"
          }`
        );
      }
    }

    const allSources = extractResearchSources(
      searchResponse?.messages ?? []
    );

    const mappingSystemPrompt = `
SEI JURIO.

Estrai e sintetizza l'Inquadramento Giuridico e la Mappa Dialettica sulla base delle fonti trovate.

QUESITO:
"${prompt}"

FONTI TROVATE E REALI:
${JSON.stringify(allSources)}

REGOLE TASSATIVE:
1. Utilizza ESCLUSIVAMENTE gli ID fonti presenti nell'elenco fornito. NON inventare ID né citazioni.
2. Identifica chiaramente orientamento favorevole e contrario (se presenti).
3. Restituisci l'output esattamente conforme allo schema JSON richiesto.
`;

    let mappingResponse: any;

    try {
      mappingResponse = await ai.generate({
        messages: [
          {
            role: "system",
            content: [{ text: mappingSystemPrompt }],
          },
          {
            role: "user",
            content: [
              {
                text: "Genera l'inquadramento e la mappa dialettica in formato strutturato.",
              },
            ],
          },
        ],
        output: {
          schema: ResearchMappingSchema,
        },
      });
    } catch (err: any) {
      console.error("[ResearchAnalysisFlow] Mapping error:", err);
      throw new Error(
        `Errore durante la generazione della mappa dialettica: ${
          err?.message ?? "errore sconosciuto"
        }`
      );
    }

    if (!mappingResponse?.output) {
      throw new Error("Output della mappa dialettica vuoto.");
    }

    const rawMapping = ResearchMappingSchema.parse(mappingResponse.output);

    const validFavSources = validaFonti(
      rawMapping.mappaDialettica.orientamentoFavorevole?.fonti ?? []
    );
    const validContSources = validaFonti(
      rawMapping.mappaDialettica.orientamentoContrario?.fonti ?? []
    );

    const mappedMappaDialettica: z.infer<typeof MappaDialetticaSchema> = {
      orientamentoFavorevole: rawMapping.mappaDialettica.orientamentoFavorevole
        ? {
            titoloTesi: rawMapping.mappaDialettica.orientamentoFavorevole.titoloTesi,
            argomentazioneLogica: rawMapping.mappaDialettica.orientamentoFavorevole.argomentazioneLogica,
            fonti: validFavSources,
          }
        : null,
      orientamentoContrario: rawMapping.mappaDialettica.orientamentoContrario
        ? {
            titoloTesi: rawMapping.mappaDialettica.orientamentoContrario.titoloTesi,
            argomentazioneLogica: rawMapping.mappaDialettica.orientamentoContrario.argomentazioneLogica,
            fonti: validContSources,
          }
        : null,
      puntiAperti: rawMapping.mappaDialettica.puntiAperti ?? [],
    };

    const mappaConcettuale = buildConceptMap({
      prompt,
      sources: allSources,
      mappaDialettica: mappedMappaDialettica,
    });

    return {
      inquadramento: rawMapping.inquadramento,
      mappaDialettica: mappedMappaDialettica,
      mappaConcettuale,
    };
  }
);

export const refineResearchFlow = ai.defineFlow(
  {
    name: "refineResearchFlow",
    inputSchema: z.object({
      originalPrompt: z.string().min(1).max(20_000),
      direttivaHitl: z.string().min(1).max(4_000),
      currentInquadramento: InquadramentoSchema,
      currentMappaDialettica: MappaDialetticaSchema,
      currentMappaConcettuale: ConceptMapSchema.nullable().optional(),
      docs: z
        .array(
          z.union([
            z.string(),
            z.object({
              id: z.string(),
            }),
          ])
        )
        .optional()
        .default([])
        .transform((items) =>
          Array.from(
            new Set(
              items
                .map((item) => (typeof item === "string" ? item : item.id))
                .map((id) => id.trim())
                .filter(Boolean)
            )
          ).slice(0, 50)
        ),
      userId: z.string().min(1),
      config: DeepAnalysisConfigSchema.optional().default({}),
    }),
    outputSchema: ResearchOutputWithConceptMapSchema,
  },
  async ({
    originalPrompt,
    direttivaHitl,
    currentInquadramento,
    currentMappaDialettica,
    currentMappaConcettuale,
    docs,
    userId,
    config,
  }) => {
    const {
      confidenceLevel,
      sourceWeb,
      sourceInternalDB,
      sourceDoctrine,
      webLimit,
    } = config;

    const hasUserDocs = docs.length > 0;

    const dynamicTools = [
      sourceInternalDB ? ricercaDatabaseInterno : null,
      sourceDoctrine ? ricercaDottrina : null,
      sourceWeb ? webSearchTool : null,
      hasUserDocs ? ricercaFascicoloUtente : null,
    ].filter(Boolean);

    const requiredTools = [
      sourceInternalDB ? "ricercaDatabaseInterno" : null,
      sourceDoctrine ? "ricercaDottrina" : null,
      sourceWeb ? "webSearchTool" : null,
      hasUserDocs ? "ricercaFascicoloUtente" : null,
    ].filter((tool): tool is string => typeof tool === "string");

    const knownIds = extractKnownSourceIds(
      currentMappaConcettuale,
      currentMappaDialettica
    );

    const systemPrompt = `
SEI JURIO.

Esegui un affinamento e approfondimento MIRATO del quadro giurisprudenziale.

QUESITO ORIGINALE:
"${originalPrompt}"

DIRETTIVA UTENTE (HITL):
"${direttivaHitl}"

FONTI ABILITATE:
${requiredTools.length ? requiredTools.join("\n") : "(Nessun tool esterno abilitato)"}

ALLEGATI / FASCICOLO UTENTE CARICATI (${docs.length}):
${hasUserDocs ? docs.map((id) => `- \${id}`).join("\n") : "(Nessun allegato presente)"}

FONTI GIÀ ACQUISITE (DA NON RIPETERE):
${knownIds.length ? knownIds.map((id) => `- \${id}`).join("\n") : "(nessuna)"}

REGOLE DI LIMITAZIONE E CIRCUIT BREAKER (TASSATIVE):
1. Cerca nuove fonti pertinenti alla direttiva senza rieseguire query su ID già acquisiti.
2. ${
      hasUserDocs
        ? "Se la direttiva fa riferimento agli allegati, usa 'ricercaFascicoloUtente' interrogando direttamente i documenti del fascicolo caricati."
        : "Nessun allegato disponibile."
    }
3. Effettua al massimo 2 chiamate di ricerca in totale (Massimo 3 turni di tool).
4. CIRCUIT BREAKER: Se trovi elementi sufficienti per soddisfare la direttiva o se una ricerca non produce esiti, FERMATI IMMEDIATAMENTE.
5. Non inventare mai fonti. I risultati dei tool costituiscono i tuoi unici dati reali.
`;

    let searchResponse: any = null;

    try {
      searchResponse = await ai.generate({
        messages: [
          {
            role: "system",
            content: [{ text: systemPrompt }],
          },
          {
            role: "user",
            content: [
              {
                text: `Esegui l'approfondimento richiesto: "${direttivaHitl}"`,
              },
            ],
          },
        ],
        tools: dynamicTools as any,
        maxTurns: 3,
        context: {
          userId,
          docs,
          webLimit,
          confidenceLevel,
          sourceWeb,
          sourceInternalDB,
          sourceDoctrine,
          requiredTools,
        },
      });
    } catch (err: any) {
      console.error("[RefineResearchFlow] Tool execution warning/error:", err);
      const message = String(err?.message ?? "");

      // Graceful degradation per ToolLoop
      if (
        message.includes("Exceeded maximum tool call iterations") ||
        message.includes("ToolLoop")
      ) {
        console.warn(
          "[RefineResearchFlow] Raggiunto il limite di iterazioni tool. Procedo con le evidenze parziali."
        );
        searchResponse = {
          messages: err?.messages || err?.customProperties?.messages || [],
        };
      } else {
        throw new Error(
          `Errore durante l'approfondimento delle fonti: ${
            message || "errore sconosciuto"
          }`
        );
      }
    }

    const allSources = extractResearchSources(
      searchResponse?.messages ?? []
    );

    const knownSet = new Set(knownIds);
    const newSources = allSources.filter(
      (source: ResearchSource) => !knownSet.has(source.sourceId)
    );

    const mappingSystemPrompt = `
SEI JURIO.

Aggiorna la mappa dialettica esistente integrando le nuove evidenze trovate.

QUESITO:
"${originalPrompt}"

DIRETTIVA HITL:
"${direttivaHitl}"

REGOLE TASSATIVE:
1. Mantieni le fonti esistenti valide.
2. Integra le nuove fonti realmente recuperate (evitando duplicati).
3. NON inventare mai fonti o identificativi.
4. Aggiorna l'inquadramento e i punti aperti solo se supportati dalle nuove evidenze.
`;

    let mappingResponse: any;

    try {
      mappingResponse = await ai.generate({
        messages: [
          {
            role: "system",
            content: [{ text: mappingSystemPrompt }],
          },
          {
            role: "user",
            content: [
              {
                text: JSON.stringify({
                  currentInquadramento,
                  currentMappaDialettica,
                  nuoveFonti: newSources,
                }),
              },
            ],
          },
        ],
        output: {
          schema: ResearchMappingSchema,
        },
      });
    } catch (err: any) {
      console.error("[RefineResearchFlow] Mapping error:", err);
      throw new Error(
        `Errore durante l'aggiornamento della mappa dialettica: ${
          err?.message ?? "errore sconosciuto"
        }`
      );
    }

    if (!mappingResponse?.output) {
      throw new Error("Output della mappa dialettica vuoto.");
    }

    const rawMapping = ResearchMappingSchema.parse(mappingResponse.output);

    const mergeFonti = (
      oldFonts: Array<{
        id: string;
        fonte: "web" | "interna";
        gradoPertinenza: number;
        escluso?: boolean;
        nuova?: boolean;
      }>,
      newFonts: unknown
    ) => {
      const map = new Map<string, any>();

      for (const source of oldFonts) {
        if (source?.id) {
          map.set(source.id, source);
        }
      }

      const allowedIds = new Set(
        newSources.map((source: ResearchSource) => source.sourceId)
      );

      const incoming = validaFonti(
        Array.isArray(newFonts) ? newFonts : []
      ).filter(
        (source: { id?: unknown }) =>
          typeof source.id === "string" &&
          (knownSet.has(source.id) || allowedIds.has(source.id))
      );

      for (const source of incoming) {
        const existing = map.get(source.id);
        if (!existing) {
          map.set(source.id, {
            ...source,
            nuova: allowedIds.has(source.id),
          });
          continue;
        }

        map.set(source.id, {
          ...existing,
          ...source,
          escluso: existing.escluso ?? source.escluso,
          nuova: existing.nuova ?? false,
        });
      }

      return Array.from(map.values());
    };

    const mergedFav = rawMapping.mappaDialettica.orientamentoFavorevole
      ? {
          ...rawMapping.mappaDialettica.orientamentoFavorevole,
          fonti: mergeFonti(
            currentMappaDialettica.orientamentoFavorevole?.fonti ?? [],
            rawMapping.mappaDialettica.orientamentoFavorevole.fonti
          ),
        }
      : currentMappaDialettica.orientamentoFavorevole;

    const mergedCont = rawMapping.mappaDialettica.orientamentoContrario
      ? {
          ...rawMapping.mappaDialettica.orientamentoContrario,
          fonti: mergeFonti(
            currentMappaDialettica.orientamentoContrario?.fonti ?? [],
            rawMapping.mappaDialettica.orientamentoContrario.fonti
          ),
        }
      : currentMappaDialettica.orientamentoContrario;

    const mergedMappaDialettica = {
      orientamentoFavorevole: mergedFav,
      orientamentoContrario: mergedCont,
      puntiAperti: Array.from(
        new Set([
          ...(currentMappaDialettica.puntiAperti ?? []),
          ...(rawMapping.mappaDialettica.puntiAperti ?? []),
        ])
      ),
    };

    const mergedInquadramento = {
      qualificazioneGiuridica:
        rawMapping.inquadramento.qualificazioneGiuridica ||
        currentInquadramento.qualificazioneGiuridica,
      fattispecieEstratta:
        rawMapping.inquadramento.fattispecieEstratta ||
        currentInquadramento.fattispecieEstratta,
      normeRiferimento: rawMapping.inquadramento.normeRiferimento?.length
        ? rawMapping.inquadramento.normeRiferimento
        : currentInquadramento.normeRiferimento,
    };

    const newConceptMap = buildConceptMap({
      prompt: originalPrompt,
      sources: newSources,
      mappaDialettica: mergedMappaDialettica,
    });

    const finalConceptMap = mergeConceptMaps(
      currentMappaConcettuale,
      newConceptMap
    );

    return {
      inquadramento: mergedInquadramento,
      mappaDialettica: mergedMappaDialettica,
      mappaConcettuale: finalConceptMap,
    };
  }
);

export const generateSynthesisReportFlow = ai.defineFlow(
  {
    name: "generateSynthesisReportFlow",
    inputSchema: z.object({
      quesitoOriginale: z.string().min(1).max(20_000),
      inquadramento: InquadramentoSchema,
      mappaDialettica: MappaDialetticaSchema,
      mappaConcettuale: ConceptMapSchema.nullable().optional(),
      userId: z.string().min(1),
    }), 
    outputSchema: ReportSintesiSchema,
  },
  async ({
    quesitoOriginale,
    inquadramento,
    mappaDialettica,
    mappaConcettuale,
  }) => {

    const filterActiveSources = (fonti: unknown): any[] => {
      if (!Array.isArray(fonti)) {
        return [];
      }
      return fonti.filter((source: { escluso?: boolean }) => !source.escluso);
    };

    const mappaFiltrata = {
      orientamentoFavorevole: mappaDialettica.orientamentoFavorevole
        ? {
            ...mappaDialettica.orientamentoFavorevole,
            fonti: filterActiveSources(
              mappaDialettica.orientamentoFavorevole.fonti
            ),
          }
        : null,
      orientamentoContrario: mappaDialettica.orientamentoContrario
        ? {
            ...mappaDialettica.orientamentoContrario,
            fonti: filterActiveSources(
              mappaDialettica.orientamentoContrario.fonti
            ),
          }
        : null,
      puntiAperti: Array.from(new Set(mappaDialettica.puntiAperti ?? [])),
    };

    const conceptMap = sanitizeConceptMapForSynthesis(mappaConcettuale);

    const datiAnalisiJSON = JSON.stringify(
      {
        inquadramento,
        mappaDialettica: mappaFiltrata,
        mappaConcettuale: conceptMap,
      },
      null,
      2
    );

    const systemPrompt = `
SEI JURIO, SENIOR LEGAL STRATEGIST.

QUESITO DEL CLIENTE:
"${quesitoOriginale}"

Redigi il Report Strategico Finale
utilizzando esclusivamente i dati JSON forniti.

REGOLE TASSATIVE:

1. Non inventare norme.
2. Non inventare sentenze.
3. Non inventare fonti.
4. Non effettuare nuove ricerche.
5. Ogni fonte citata deve essere presente
   nei dati forniti.
6. Usa esattamente l'ID o URL della fonte.
7. Distingui normativa, giurisprudenza,
   Doctrine, web e documenti dell'utente.
8. Doctrine e relazioni hanno valore interpretativo.
9. Se esiste contrasto tra fonti, dichiaralo.
10. Se le informazioni non permettono una conclusione
    certa, esplicita il limite.
11. Le conclusioni strategiche devono derivare
    esclusivamente dalle evidenze presenti.
`;

    try {
      const response = await ai.generate({
        messages: [
          {
            role: "system",
            content: [
              {
                text: systemPrompt,
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                text: `DATI CONSOLIDATI DELLA RICERCA:\n\n${datiAnalisiJSON}`,
              },
            ],
          },
        ],
        output: {
          schema: ReportSintesiSchema,
        },
      });

      if (!response?.output) {
        throw new Error("Generazione del report fallita: output vuoto.");
      }

      return ReportSintesiSchema.parse(response.output);
    } catch (err: any) {
      console.error("[GenerateSynthesisReportFlow] errore:", err);
      throw new Error(
        `Errore nella stesura del report: ${
          err?.message ?? "errore sconosciuto"
        }`
      );
    }
  }
);

// ─────────────────────────────────────────────
// FLOW — Doctrine Extraction
// ──

function chunkText(text: string, maxChunkSize = 70000): string[] {
  const chunks: string[] = [];
  let index = 0;

  while (index < text.length) {
    let end = Math.min(index + maxChunkSize, text.length);

    if (end < text.length) {
      const paragraphBreak = text.lastIndexOf("\n\n", end);
      if (paragraphBreak > index + maxChunkSize * 0.7) {
        end = paragraphBreak;
      }
    }

    chunks.push(text.slice(index, end).trim());
    index = end;
  }

  return chunks;
}

function safeParseJson(rawText: string): unknown | null {
  const clean = rawText
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  try {
    return JSON.parse(clean);
  } catch (error) {
    console.warn("[doctrineFlow] JSON non valido ricevuto dal modello.");
    return null;
  }
}

function isResourceExhaustedError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const e = error as any;
  return (
    e.code === 429 ||
    e.status === "RESOURCE_EXHAUSTED" ||
    e.status === 429 ||
    e.detail?.error?.code === 429
  );
}

async function generateWithRetry(
  request: Parameters<typeof ai.generate>[0],
  maxRetries = 3
) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await ai.generate(request);
    } catch (error) {
      lastError = error;

      if (!isResourceExhaustedError(error)) {
        throw error;
      }

      if (attempt === maxRetries) {
        break;
      }

      const baseDelay = 2000 * Math.pow(2, attempt);
      const jitter = Math.floor(Math.random() * 1000);
      const delay = baseDelay + jitter;

      console.warn(
        `[doctrineFlow] 429 RESOURCE_EXHAUSTED. Retry ${attempt + 1}/${maxRetries} tra ${delay}ms...`
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

export const doctrineFlow = ai.defineFlow(
  {
    name: "doctrineFlow",
    inputSchema: z.object({
      extractedText: z.string(),
      sourceUrl: z.string(),
    }),
    outputSchema: DoctrineOutputSchema,
  },
  async (input) => {
    console.log(
      `[doctrineFlow] Avvio chunking per testo di ${input.extractedText.length} caratteri...`
    );

    const textChunks = chunkText(input.extractedText, 70000);
    console.log(
      `[doctrineFlow] Documento suddiviso in ${textChunks.length} chunk.`
    );

    const allTematiche: any[] = [];

    for (let i = 0; i < textChunks.length; i++) {
      const chunk = textChunks[i];
      console.log(
        `[doctrineFlow] Elaborazione chunk ${i + 1}/${textChunks.length} (${chunk.length} caratteri)...`
      );

      try {
        const response = await generateWithRetry({
          model: "vertexai/gemini-3.8-flash",
          system: `${PROMPT_DOTTRINA}\n\nRETE DI SICUREZZA CHUNK:\nEstrai esclusivamente le tematiche presenti nel frammento del documento ricevuto.\nNon inventare contenuti assenti nel testo.\nRestituisci tassativamente un JSON valido con la chiave "tematiche".`,
          prompt: `URL ORIGINE:\n${input.sourceUrl}\n\nPARTE:\n${i + 1}/${textChunks.length}\n\nTESTO:\n${chunk}`,
          output: {
            format: "json",
          },
        });

        if (!response?.text) {
          console.warn(`[doctrineFlow] Chunk ${i + 1}: risposta AI vuota.`);
          continue;
        }

        const parsed = safeParseJson(response.text);
        if (!parsed) {
          console.warn(`[doctrineFlow] Chunk ${i + 1}: JSON non parsabile.`);
          continue;
        }

        let tematicheList: any[] = [];
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          Array.isArray((parsed as any).tematiche)
        ) {
          tematicheList = (parsed as any).tematiche;
        }

        console.log(
          `[doctrineFlow] Chunk ${i + 1}: ${tematicheList.length} tematiche`
        );

        for (const t of tematicheList) {
          const generatedSummary = [
            t.tematica ? `Tematica: ${t.tematica}` : "",
            t.questione_di_diritto ? `Questione: ${t.questione_di_diritto}` : "",
            t.orientamento ? `Orientamento: ${t.orientamento}` : "",
            t.sintesi ? `Sintesi: ${t.sintesi}` : "",
          ]
            .filter(Boolean)
            .join(" - ");

          if (!t.summary || typeof t.summary !== "string" || !t.summary.trim()) {
            t.summary =
              generatedSummary ||
              "Documento giuridico della Corte di Cassazione";
          }
        }

        allTematiche.push(...tematicheList);
      } catch (chunkError) {
        console.error(
          `[doctrineFlow] Errore definitivo nel chunk ${i + 1}:`,
          chunkError
        );
        throw new Error(`Elaborazione Gemini fallita nel chunk ${i + 1}.`);
      }
    }

    console.log(
      `[doctrineFlow] Chunking completato. Totale tematiche grezze: ${allTematiche.length}`
    );

    const validatedOutput = DoctrineOutputSchema.parse({
      tematiche: allTematiche,
    });

    console.log(
      `[doctrineFlow] Validazione completata. Tematiche finali: ${validatedOutput.tematiche.length}`
    );

    return validatedOutput;
  }
);

// ─────────────────────────────────────────────
// FLOW — Word
// ──

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
      const response = await ai.generate({
        messages: messages as any,
        tools: [ricercaDatabaseInterno, webSearchTool, analizzaDistinguishFattispecie], 
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
            if (toolName === 'webSearchTool') {
              sendChunk({ message: { status: `Ricerca web di conferma: ${queryStr}...` } });
            }
          }
        }
      });
      sendChunk({ message: { status: "Stesura dell'analisi e assegnazione semafori..." } });

      if (!response.output || !response.output.tesi) {
        console.warn("[GUARDRAIL] L'AI ha restituito un output nullo o vuoto. Forzo un array tesi vuoto.");
        return { tesi: [] };
      }

      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

      const tesiNormalizzate = response.output.tesi.map((item, index) => {
        
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
