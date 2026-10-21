import { z } from 'genkit';
import { ai } from "../_config";
import { getExecutionProfile, generateChatTitle, prepareContextAndMessages, appendOrchestrationRule, extractAndFormatSources, appendRetrievalContext, extractToolName, executeRequestedTools } from "./_helper";
import { FlowChunkPayload, ToolContext } from "./_schema";
import { userFileSearch, internalDatabaseSearch, webSearch, dynamicTools } from "../tools/index";

interface ToolResponseContext {
  toolResponse?: {
    name?: string;
    output?: unknown;
  };
}

function isToolNamed(tool: unknown, expectedName: string): boolean {
  if (!tool || (typeof tool !== "object" && typeof tool !== "function")) return false;
  const candidate = tool as { name?: unknown; __action?: { name?: unknown } };
  return candidate.name === expectedName || candidate.__action?.name === expectedName;
}

const isQuotaError = (error: unknown): boolean => {
  const e = error as { status?: string; code?: number } | null;
  return e?.status === "RESOURCE_EXHAUSTED" || e?.code === 429;
};

// Vertex restituisce 429 prima di emettere token: riprovare non duplica l'output in streaming.
async function generateWithQuotaRetry<T>(fn: () => Promise<T>, delaysMs: number[] = [2000, 5000]): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (!isQuotaError(error) || attempt >= delaysMs.length) throw error;
      console.warn(`[legalAgentFlow] 429 da Vertex, nuovo tentativo ${attempt + 1}/${delaysMs.length}`);
      await new Promise((resolve) => setTimeout(resolve, delaysMs[attempt]));
    }
  }
}

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

    const flowStart = Date.now();
    const stageTimes: Record<string, number> = {};
    const markStage = (name: string, since: number) => { stageTimes[name] = Date.now() - since; };

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
    const availableTools = toolContext.docs.length > 0
      ? dynamicTools.filter((tool) => !isToolNamed(tool, "userFileSearch"))
      : dynamicTools;

    let rawOutputs: any[] = []; 

    // Pre-caricamento intelligente dei documenti allegati
    if (toolContext.docs.length > 0) {
      safeSend({ status: "Lettura dei documenti allegati..." });
      const preRetrievalStart = Date.now();
      try {
        const documentQuery = prompt.length >= 3
          ? prompt.slice(0, 4000)
          : "Analizza i documenti allegati";
        const preRetrievalOutput = await userFileSearch({ query: documentQuery }, { context: toolContext });
        
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
      } finally {
        markStage("preRetrievalMs", preRetrievalStart);
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
    let activeToolResponses: ToolResponseContext[] = [];
    const initialTextChunks: string[] = [];

    try {
      safeSend({ status: "Districando..." });
      const turn1Start = Date.now();

      // PRIMA CHIAMATA LLM (Totalmente Agentica)
      const turn1Response = await generateWithQuotaRetry(() => ai.generate({
        model: selectedModel,
        messages: messages,
        tools: availableTools,
        returnToolRequests: true,
        context: toolContext,
        config: {
          maxOutputTokens: 3000,
          thinkingConfig: { thinkingLevel: profile.thinkingLevel },
        },
        onChunk: (chunk: any) => {
          const toolName = extractToolName(chunk);
          if (toolName) {
            safeSend({ status: `Ricerca in corso: ${toolName}...` });
          } else if (typeof chunk?.text === "string" && chunk.text.length > 0) {
            initialTextChunks.push(chunk.text);
          }
        },
      }));

      finalResponse = turn1Response;
      markStage("turn1Ms", turn1Start);

      // ESECUZIONE TOOL E SINTESI (Solo se l'LLM ha deciso di chiamarli)
      if (Array.isArray(turn1Response.toolRequests) && turn1Response.toolRequests.length > 0) {
        safeSend({ status: "Consultazione archivi in corso..." });
        const toolsStart = Date.now();

        const toolResponses = await executeRequestedTools(
          turn1Response.toolRequests,
          availableTools,
          toolContext,
          safeSend
        );
        
        activeToolResponses = toolResponses;
        markStage("toolsMs", toolsStart);
      }

      const isConversational = /^(grazie|ok|chiaro|perfetto|ciao|va bene|ottimo|esatto)[.!?]*$/i.test(promptLower);
      if (!isConversational && activeToolResponses.length === 0 && rawOutputs.length === 0) {
        safeSend({ status: "Ricerca delle fonti giuridiche..." });
        const fallbackStart = Date.now();
        const legalReferenceQuery = /\b(art(?:icolo)?\.?|legge|d\.?\s*lgs\.?|codice|normativa|vigente|aggiornament\w*)\b/i.test(prompt);
        const fallbackToolName = legalReferenceQuery ? "ricerca web" : "ricerca in banca dati interna";
        const sourceQuery = prompt.slice(0, 3000);
        const fallbackOutput = legalReferenceQuery
          ? await webSearch({ query: sourceQuery, focus: "institutional" }, { context: toolContext })
          : await internalDatabaseSearch({ searchType: "semantic", query: sourceQuery }, { context: toolContext });
        activeToolResponses = [{
          toolResponse: { name: fallbackToolName, output: fallbackOutput },
        }];
        markStage("fallbackSearchMs", fallbackStart);
      }

      if (activeToolResponses.length === 0 && initialTextChunks.length > 0) {
        safeSend({ text: initialTextChunks.join("") });
      }

      if (activeToolResponses.length > 0) {
        safeSend({ status: "Sintesi finale..." });
        const synthesisStart = Date.now();
        const toolResultsContext = activeToolResponses.map((tr) => {
          const name = tr.toolResponse?.name || "archivio";
          const output = tr.toolResponse?.output;
          const content = typeof output === "string" ? output : JSON.stringify(output, null, 2);
          return `--- DATI REPERITI DA [${name}] ---\n${content}`;
        }).join("\n\n");
        const synthesisMessages = [
          ...messages,
          {
            role: "user" as const,
            content: [{
              text: `[DATI REPERITI DAGLI ARCHIVI/TOOL]:\n${toolResultsContext}\n\n[ISTRUZIONE DI SINTESI]: Rispondi in modo chiaro e strutturato basandoti ESCLUSIVAMENTE sui dati reperiti. Cita nel testo le fonti pertinenti con i riferimenti riconoscibili presenti nei risultati (organo, numero, titolo o URL); se i risultati non contengono fonti verificabili, dichiaralo e non presentare conclusioni non supportate come certe. Fornisci una motivazione sintetica quando utile, senza esporre ragionamenti interni. Non menzionare i nomi dei tool o passaggi tecnici.`
            }]
          }
        ];

        finalResponse = await generateWithQuotaRetry(() => ai.generate({
          model: selectedModel,
          messages: synthesisMessages,
          config: {
            maxOutputTokens: 3000,
            thinkingConfig: { thinkingLevel: profile.thinkingLevel },
          },
          onChunk: (chunk: any) => {
            if (typeof chunk?.text === "string" && chunk.text.length > 0) {
              safeSend({ text: chunk.text });
            }
          },
        }));
        markStage("synthesisMs", synthesisStart);
      }

    } catch (error: unknown) {
      console.error("[legalAgentFlow] Errore ai.generate:", error);
      const msg = isQuotaError(error)
        ? "Il servizio AI è temporaneamente sovraccarico. Riprova tra qualche istante."
        : "Il motore neurale ha incontrato un errore imprevisto durante l'elaborazione.";
      safeSend({ error: { message: msg } }); 
      throw new Error(msg);
    }

    const titoloGenerato = await titlePromise;
    console.log("[legalAgentFlow] Timing", JSON.stringify({ ...stageTimes, totalMs: Date.now() - flowStart }));
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