import { ai, CFG, ChatMessageSchema, GeminiFallbackInputSchema, GeminiFallbackOutputSchema, EstraiMetadatiInputSchema, EstraiMetadatiOutputSchema, ReviewListSchema, FonteSchema, ResearchOutputSchema, PromptFieldSchema, PromptOutputSchema, ReportSintesiSchema } from "./config";
import { z } from 'genkit';
import { generateChatTitle, prepareContextAndMessages, getExecutionProfile, executeDeterministicRetrieval, extractAndFormatSources, estraiFontiDalRisultato, buildQuoteSystemPrompt, buildReviewSystemPrompt, getModelForUser, validaFonti} from "./helperFlows";
import { SYSTEM_PROMPT_JURIO_SUPPORT, PROMPT_MASSIMAZIONE } from '../params';
import { ricercaManualeTool, ricercaDatabaseInterno, webSearchTool, analizzaDistinguishFattispecie, ricercaFascicoloUtente } from "./tools";

// ─────────────────────────────────────────────
// FLOW — Legal Agent Chat (Jurio Chat)
// ─────────────────────────────────────────────

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
    inputSchema: GeminiFallbackInputSchema,
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

// ─────────────────────────────────────────────
// FLOW — Deep Analysis
// ──

// FLOW 1: PRIMA RICERCA
export const researchAnalysisFlow = ai.defineFlow(
  {
    name: "researchAnalysisFlow",
    inputSchema: z.object({
      prompt: z.string().min(1),
      docs: z
        .array(z.union([z.string(), z.object({ id: z.string() })]))
        .optional()
        .default([])
        .transform((items) =>
          items.map((item) => (typeof item === "string" ? item : item.id))
        ),
      userId: z.string().min(1),
      config: z.object({
        confidenceLevel: z.number().min(0).max(100).default(80),
        sourceWeb: z.boolean().default(true),
        sourceInternalDB: z.boolean().default(true),
        temperature: z.number().min(0).max(2).default(0.2),
        topK: z.number().int().min(1).default(10),
        webLimit: z.number().int().min(1).default(5),
      }).optional().default({}),
    }),
    outputSchema: ResearchOutputSchema,
  },
  async ({ prompt, docs = [], userId, config }) => {
    const { 
      confidenceLevel = 80, 
      sourceWeb = true, 
      sourceInternalDB = true, 
      temperature = 0.2, 
      topK = 10, 
      webLimit = 5 
    } = config;

    const aiModel = await getModelForUser(userId);
    const hasUserDocs = docs.length > 0;

    const dynamicTools = [
      sourceInternalDB && ricercaDatabaseInterno,
      sourceWeb && webSearchTool,
      hasUserDocs && ricercaFascicoloUtente,
    ].filter(Boolean);

    const requiredTools = [
      sourceWeb && "ricercaWebLegale",
      sourceInternalDB && "ricercaDatabaseInterno",
      hasUserDocs && "ricercaFascicoloUtente",
    ].filter(Boolean) as string[];

    // 1. CHIAMATA DI ESECUZIONE TOOL FORZATA
    const searchPrompt = `Agisci come un assistente di ricerca legale. 
Esegui immediatamente le ricerche necessarie usando i tool disponibili per il seguente quesito:
"${prompt}"
Raccogli tutte le massime, i precedenti e le informazioni utili sia a favore che contrarie.`;

    let searchResponse;
    try {
      searchResponse = await ai.generate({
        model: aiModel,
        messages: [
          { role: "user", content: [{ text: searchPrompt }] }
        ],
        tools: dynamicTools as any,
        config: { temperature: 0.1 },
        maxTurns: 3,
        context: { userId, docs, dbLimit: topK, webLimit, confidenceLevel, sourceWeb, sourceInternalDB, requiredTools },
      });
    } catch (err: any) {
      console.error("Errore durante l'esecuzione dei tool di ricerca:", err);
      if (err.message && err.message.includes("Exceeded maximum tool call iterations")) {
        throw new Error("ToolLoop: Il modello ha superato il limite di iterazioni per i tool di ricerca.");
      }
      throw new Error(`Errore di rete o timeout durante l'interrogazione delle banche dati: ${err.message}`);
    }

    // 2. CHIAMATA DI MAPPATURA DIALETTICA
    const mappingSystemPrompt = `SEI JURIO, motore di analisi dialettica giuridica.
Analizza i dati raccolti dalla ricerca precedente e compila la "Mappa Dialettica" per il quesito: "${prompt}".

REGOLE TASSATIVE:
1. SMISTA rigorosamente le fonti trovate tra 'orientamentoFavorevole' e 'orientamentoContrario'.
2. Se un orientamento ha riscontri, compila 'titoloTesi', 'argomentazioneLogica' e inserisci le fonti nell'array.
3. Estrai eventuali 'puntiAperti' (incertezze normative o dubbi interpretativi).
4. 'fonte': 'web' -> 'id' DEVE essere l'URL completo. 'fonte': 'interna' -> 'id' DEVE essere L'ID INTERNO DEL DOCUMENTO FIRESTORE fornito dal tool (es. stringa alfanumerica), VIETATISSIMO inserire il numero di sentenza o altri estremi.
5. Restituisci ESCLUSIVAMENTE JSON conforme allo schema richiesto.`;

    const cleanHistory = (searchResponse.messages || []).filter(
      (msg: any) => msg?.role !== "system"
    );
    let mappingResponse;
    try {
      mappingResponse = await ai.generate({
        model: aiModel, // Utilizzo dinamico del modello anche per il JSON mapping
        messages: [
          { role: "system", content: [{ text: mappingSystemPrompt }] },
          ...cleanHistory,
          { role: "user", content: [{ text: "Genera ora la Mappa Dialettica in formato JSON basandoti sulle fonti reperite." }] }
        ],
        output: { schema: ResearchOutputSchema },
        config: { temperature },
      });
    } catch (err: any) {
      throw new Error(`Errore durante la formattazione strutturata della mappa: ${err.message}`);
    }

    const output = mappingResponse.output;
    if (!output) {
      throw new Error("[ResearchAnalysisFlow] Impossibile generare la mappa dialettica dalle fonti estratte.");
    }

    if (output.mappaDialettica.orientamentoFavorevole) {
      output.mappaDialettica.orientamentoFavorevole.fonti = validaFonti(output.mappaDialettica.orientamentoFavorevole.fonti);
    }
    if (output.mappaDialettica.orientamentoContrario) {
      output.mappaDialettica.orientamentoContrario.fonti = validaFonti(output.mappaDialettica.orientamentoContrario.fonti);
    }

    return ResearchOutputSchema.parse(output);
  }
);

// 2. FLOW 2: APPROFONDIMENTO MIRATO
export const refineResearchFlow = ai.defineFlow(
  {
    name: "refineResearchFlow",
    inputSchema: z.object({
      originalPrompt: z.string(),
      direttivaHitl: z.string().describe("Azione strategica, es: 'Rafforza orientamento favorevole', 'Smonta tesi contraria'"),
      currentInquadramento: z.any(), 
      currentMappaDialettica: z.any(),
      docs: z
      .array(z.union([z.string(), z.object({ id: z.string() })]))
      .optional()
      .default([])
      .transform((items) =>
        items.map((item) => (typeof item === "string" ? item : item.id))
      ),
      userId: z.string().min(1),
      config: z.any()
    }),
    outputSchema: ResearchOutputSchema,
  },
  async ({ originalPrompt, direttivaHitl, currentInquadramento, currentMappaDialettica, docs, userId, config }) => {
    const { 
      confidenceLevel = 80, 
      sourceWeb = true, 
      sourceInternalDB = true, 
      temperature = 0.2, 
      topK = 10, 
      webLimit = 5 
    } = config || {};

    const aiModel = await getModelForUser(userId);
    const hasUserDocs = docs.length > 0;

    const dynamicTools = [
      sourceInternalDB && ricercaDatabaseInterno,
      sourceWeb && webSearchTool,
      hasUserDocs && ricercaFascicoloUtente,
    ].filter(Boolean);

    const oldFavFonts = currentMappaDialettica?.orientamentoFavorevole?.fonti || [];
    const oldContFonts = currentMappaDialettica?.orientamentoContrario?.fonti || [];
    const knownIds = [...oldFavFonts, ...oldContFonts].map((f: any) => f.id);

    const systemPrompt = `SEI JURIO. Stai eseguendo un approfondimento MIRATO sulla mappa dialettica esistente.

QUESITO ORIGINALE: "${originalPrompt}"

ID/URL FONTI GIA' ACQUISITE (NON RESTITUIRE QUESTE NELLA RICERCA):
${knownIds.join("\n")}

OBIETTIVO TASSATIVO:
1. Usa i tool per trovare NUOVE fonti specifiche per soddisfare l'AZIONE RICHIESTA dall'utente.
2. Raccogli tutte le informazioni necessarie per l'aggiornamento.
3. STOP LOOP: Fai max 3 chiamate ai tool. Se non trovi nulla di nuovo, fermati.`;

    // PASSO 1: Esecuzione dei tool di ricerca
    let searchResponse;
    try {
      searchResponse = await ai.generate({
        model: aiModel,
        messages: [
          { role: "system", content: [{ text: systemPrompt }] },
          { 
            role: "user", 
            content: [{ text: `Esegui la ricerca mirata usando i tool necessari per soddisfare questa azione richiesta: "${direttivaHitl}"` }] 
          },
        ],
        tools: dynamicTools as any,
        config: { temperature },
        maxTurns: 3, 
        context: { userId, docs, dbLimit: topK, webLimit, confidenceLevel, sourceWeb, sourceInternalDB, requiredTools: [] },
      });
    } catch (err: any) {
      if (err.message && err.message.includes("Exceeded maximum tool call iterations")) {
        console.warn("⚠️ [Refine] Loop intercettato. Propagazione errore ToolLoop al client.");
        throw new Error("ToolLoop: Il modello ha superato il limite di iterazioni durante l'approfondimento.");
      }
      throw err;
    }

    // PASSO 2: Formattazione JSON strutturata
    const mappingSystemPrompt = `SEI JURIO. In base ai risultati della ricerca mirata appena eseguita, restituisci la mappa dialettica aggiornata e completa in formato JSON strutturato.
REGOLE:
1. Integra le nuove fonti trovate senza perdere quelle esistenti.
2. Mantieni l'inquadramento e assegna correttamente le nuove fonti al ramo di pertinenza.`;

    const historyWithoutSystem = searchResponse.messages.filter((msg: any) => msg.role !== "system");

    let rawData: any = {};
    try {
      const mappingResponse = await ai.generate({
        model: aiModel,
        messages: [
          { role: "system", content: [{ text: mappingSystemPrompt }] },
          ...historyWithoutSystem,
          { role: "user", content: [{ text: "Genera ora la Mappa Dialettica finale integrando le nuove fonti e argomentazioni." }] }
        ],
        output: { schema: ResearchOutputSchema },
        config: { temperature },
      });

      rawData = mappingResponse.output;
      if (!rawData) {
        throw new Error("Nessun output strutturato restituito dal modello.");
      }
    } catch (err: any) {
      console.error("❌ [Refine] Errore nella generazione strutturata della mappa:", err);
      throw new Error(`[Refine] Errore formattazione mappa: ${err.message}`);
    }

    const mergeFonti = (oldF: any[], newF: any[]) => {
      const map = new Map();
      (oldF || []).forEach((s: any) => map.set(s.id, s));

      const valideNew = validaFonti(newF || []);
      valideNew.forEach((s: any) => {
        if (!map.has(s.id)) {
          map.set(s.id, { ...s, nuova: true });
        } else {
          const existing = map.get(s.id);
          map.set(s.id, { ...s, escluso: existing.escluso, nuova: existing.nuova });
        }
      });

      return Array.from(map.values());
    };

    const parsedData = {
      inquadramento: {
        qualificazioneGiuridica: rawData?.inquadramento?.qualificazioneGiuridica || currentInquadramento.qualificazioneGiuridica,
        fattispecieEstratta: rawData?.inquadramento?.fattispecieEstratta || currentInquadramento.fattispecieEstratta,
        normeRiferimento: Array.isArray(rawData?.inquadramento?.normeRiferimento) ? rawData.inquadramento.normeRiferimento : currentInquadramento.normeRiferimento
      },
      mappaDialettica: {
        orientamentoFavorevole: rawData?.mappaDialettica?.orientamentoFavorevole ? {
          ...rawData.mappaDialettica.orientamentoFavorevole,
          fonti: mergeFonti(oldFavFonts, rawData.mappaDialettica.orientamentoFavorevole.fonti)
        } : currentMappaDialettica.orientamentoFavorevole,

        orientamentoContrario: rawData?.mappaDialettica?.orientamentoContrario ? {
          ...rawData.mappaDialettica.orientamentoContrario,
          fonti: mergeFonti(oldContFonts, rawData.mappaDialettica.orientamentoContrario.fonti)
        } : currentMappaDialettica.orientamentoContrario,

        puntiAperti: Array.isArray(rawData?.mappaDialettica?.puntiAperti) 
          ? Array.from(new Set([...(currentMappaDialettica.puntiAperti || []), ...rawData.mappaDialettica.puntiAperti]))
          : (currentMappaDialettica.puntiAperti || [])
      }
    };

    return ResearchOutputSchema.parse(parsedData);
  }
);

// 3. FLOW 3: GENERAZIONE REPORT STRATEGICO
export const generateSynthesisReportFlow = ai.defineFlow(
  {
    name: "generateSynthesisReportFlow",
    inputSchema: z.object({
      quesitoOriginale: z.string(),
      inquadramento: z.any(),
      mappaDialettica: z.any(),
      userId: z.string().min(1), // Aggiunto per consentire il controllo Firestore
      config: z.object({
        temperature: z.number().min(0).max(2).default(0.3),
      }).optional().default({}),
    }),
    outputSchema: ReportSintesiSchema,
  },
  async ({ quesitoOriginale, inquadramento, mappaDialettica, userId, config }) => {

    const aiModel = await getModelForUser(userId);

    // 1. PRE-PROCESSING
    const filtraFontiAttive = (fonti: any[]) => {
      if (!Array.isArray(fonti)) return [];
      return fonti.filter((f) => !f.escluso);
    };

    const mappaFiltrata = {
      orientamentoFavorevole: mappaDialettica?.orientamentoFavorevole ? {
        ...mappaDialettica.orientamentoFavorevole,
        fonti: filtraFontiAttive(mappaDialettica.orientamentoFavorevole.fonti)
      } : null,
      orientamentoContrario: mappaDialettica?.orientamentoContrario ? {
        ...mappaDialettica.orientamentoContrario,
        fonti: filtraFontiAttive(mappaDialettica.orientamentoContrario.fonti)
      } : null,
      puntiAperti: mappaDialettica?.puntiAperti || []
    };

    // 2. COSTRUZIONE DEL PAYLOAD TESTUALE
    const datiAnalisiJSON = JSON.stringify({
      inquadramento,
      mappaDialettica: mappaFiltrata
    }, null, 2);

    // 3. SYSTEM PROMPT
    const systemPrompt = `SEI JURIO, un Avvocato Cassazionista e Senior Legal Strategist.
Il tuo compito ESCLUSIVO è redigere un "Report Strategico Finale" basandoti UNICAMENTE sui dati JSON che ti vengono forniti. Non inventare giurisprudenza e non fare ulteriori ricerche.

QUESITO DEL CLIENTE:
"${quesitoOriginale}"

REGOLE DI REDAZIONE:
1. Usa un tono formale, giuridicamente ineccepibile ma estremamente operativo e chiaro.
2. Basati SOLO sulle informazioni presenti nel JSON fornito.
3. Nelle sezioni 'argomentazioniAzione' e 'rischiEEccezioni', quando menzioni un principio, CITA SEMPRE la fonte associata riportando testualmente il suo ID (che sia un UUID o un URL web).
4. Le 'conclusioniStrategiche' devono rispondere direttamente al quesito del cliente, fornendo un parere definitivo basato sul bilanciamento tra orientamento favorevole e contrario.`;

    // 4. GENERAZIONE
    try {
      const response = await ai.generate({
        model: aiModel,
        messages: [
          { role: "system", content: [{ text: systemPrompt }] },
          { 
            role: "user", 
            content: [{ 
              text: `Ecco i risultati consolidati della ricerca in formato JSON. Estrai il report strutturato.\n\nDATI:\n${datiAnalisiJSON}` 
            }] 
          }
        ],
        output: { schema: ReportSintesiSchema },
        config: { temperature: config.temperature },
      });

      const output = response.output;
      if (!output) {
        throw new Error("Generazione del report fallita: output vuoto.");
      }

      return ReportSintesiSchema.parse(output);

    } catch (err: any) {
      console.error("❌ Errore durante la generazione del report di sintesi:", err);
      throw new Error(`Errore nella stesura del report: ${err.message}`);
    }
  }
);