import { z } from 'genkit';
import { ai } from "../_config";
import { getExecutionProfile, generateChatTitle, prepareContextAndMessages, appendOrchestrationRule, extractAndFormatSources, appendRetrievalContext, extractToolName, executeRequestedTools } from "./_helper";
import { FlowChunkPayload, ToolContext } from "./_schema";
import { userFileSearch, dynamicTools } from "../tools/index";

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
    appendOrchestrationRule(messages);

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
        const preRetrievalOutput = await userFileSearch({ query: prompt }, { context: toolContext });
        
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
    const orchestrationReminder = `\n\n[SISTEMA - ISTRUZIONE IMPERATIVA]: Se la richiesta prevede di cercare provvedimenti, sentenze o casi analoghi, DEVI OBBLIGATORIAMENTE USARE ORA il tool 'internalDatabaseSearch' passandogli gli argomenti chiave. È SEVERAMENTE VIETATO inventare giurisprudenza o rispondere affidandoti solo alla memoria. Usa sempre i tool.`;
    
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
        tools: dynamicTools, 
        returnToolRequests: true,
        context: toolContext,
        config: { 
          maxOutputTokens: 3000 
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
          dynamicTools,
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