import { CFG } from "../_config";
import { ToolContext, ExecutionProfile } from "./_schema";
import { userFileSearch, internalDatabaseSearch, webSearch } from "../tools/index";
import {
  SYSTEM_ORCHESTRATION_RULES,
  buildLegalAgentSystemPrompt,
  formatRetrievalContextBlock,
} from "./_prompts";

export function appendOrchestrationRule(messages: any[]): void {
  const rule = SYSTEM_ORCHESTRATION_RULES;

  const sys = messages.find((msg) => msg.role === "system");
  if (sys) {
    sys.content[0].text += `\n\n${rule}`;
  } else {
    messages.unshift({ role: "system", content: [{ text: rule }] });
  }
}

export function appendRetrievalContext(messages: any[], retrievalText: string, sourceName: string): void {
  let userMessageIndex = messages.length - 1;
  while (userMessageIndex >= 0 && messages[userMessageIndex].role !== "user") userMessageIndex--;
  if (userMessageIndex === -1) return;

  messages[userMessageIndex].content.push({
    text: formatRetrievalContextBlock(sourceName, retrievalText),
  });
}

export function extractToolName(chunk: any): string | null {
  if (!chunk || !Array.isArray(chunk.content)) return null;
  for (const part of chunk.content) {
    if (part?.toolRequest?.name) return String(part.toolRequest.name);
  }
  return null;
}

export async function executeRequestedTools(
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

// Titolo deterministico: evita una chiamata LLM dedicata al primo messaggio.
export async function generateChatTitle(prompt: string, isFirstMessage?: boolean): Promise<string | undefined> {
  if (!isFirstMessage) return undefined;

  const cleaned = prompt
    .replace(/\[Testo selezionato in riferimento\]:[\s\S]*$/, "")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return undefined;

  const MAX_LEN = 60;
  if (cleaned.length <= MAX_LEN) return cleaned;
  const cut = cleaned.slice(0, MAX_LEN);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 30 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}

export function prepareContextAndMessages(input: {
  prompt: string;
  history?: Array<Record<string, unknown>>;
  filters?: unknown[];
  docs?: string[];
  userId: string;
  fascicoloId?: string | null;
  metadatiFascicolo?: Record<string, unknown>;
}): any[] {
  const trimmedHistory = (input.history ?? []).slice(-CFG.limits.historyWindow);
  const uiFiltersString = input.filters && input.filters.length > 0
    ? JSON.stringify(input.filters, null, 2)
    : "Nessun filtro imposto.";

  const alreadySeenIds: string[] = trimmedHistory.length > 0
    ? Array.from(new Set<string>(
      trimmedHistory
        .filter((msg) => msg.role === "model")
        .flatMap((msg) => {
          if (typeof msg.content !== "string") return [];
          return msg.content.match(/[a-zA-Z0-9]{20,}/g) ?? [];
        })
    )) : [];

  const systemPrompt = buildLegalAgentSystemPrompt({
    uiFiltersString,
    docs: input.docs ?? [],
    alreadySeenIds,
    fascicoloId: input.fascicoloId,
    metadatiFascicolo: input.metadatiFascicolo,
  });

  const chatContext = trimmedHistory.map((msg) => ({
    role: msg.role === "user" ? "user" : "model",
    content: [{ text: String(msg.content) }],
  }));

  return [
    { role: "system", content: [{ text: systemPrompt }] },
    ...chatContext,
    { role: "user", content: [{ text: input.prompt }] },
  ];
}

export function getExecutionProfile(promptLower: string): ExecutionProfile {
  const needsDeepReasoning =
    promptLower.length >= 600 ||
    /\b(analizza|confronta|controvers|eccezion|responsabilit|risarciment|impugn|strategia|prescrizion|decadenza|concorso|bilanciamento|distinguish)\w*/i.test(promptLower);

  if (promptLower.length < 150 && !needsDeepReasoning) {
    return { model: "vertexai/gemini-3.5-flash", dbLimit: 5, webLimit: 2, thinkingLevel: "LOW" };
  }
  return {
    model: "vertexai/gemini-3.5-flash",
    dbLimit: promptLower.length >= 600 ? 8 : 5,
    webLimit: promptLower.length >= 600 ? 3 : 2,
    thinkingLevel: needsDeepReasoning ? "HIGH" : "MEDIUM",
  };
}

export async function executeDeterministicRetrieval(
  input: { prompt: string; fascicoloId?: string | null },
  promptLower: string,
  toolContext: ToolContext,
  sendChunk: (payload: any) => void
) {
  const isConversational = promptLower.length < 25 && /^(grazie|ok|chiaro|perfetto|ciao|va bene|ottimo|esatto)/.test(promptLower);
  const hasDocs = toolContext.docs.length > 0;
  const matchPuntuale = promptLower.match(/\b\d{1,6}\/\d{4}\b/);
  const matchNormativa = promptLower.match(/(?:art|articolo|legge|l\.)\.?\s*\d+(?:\s*(?:bis|ter|quater|quinquies))?/i);
  const matchExecutive = promptLower.match(/\b(procedi|procediamo|vai\s+avanti|vai\s+pure|continua|continuiamo|prosegui|proseguiamo|esegui|eseguiamo|avvia|applicalo|fallo|puoi\s+procedere|andiamo\s+avanti|prcedi)\b/i);
  const isFascicoloQuery = (input.fascicoloId && /(questo documento|il contratto|il file|fascicolo|allegato|caricato|documentazione)/i.test(promptLower)) || hasDocs;

  const hasExecutiveIntent = Boolean(matchExecutive);
  let preRetrievalOutput: any = null;
  let preRetrievalSourceName = ""; 

  if (!isConversational) {
    try {
      if (hasDocs) {
        sendChunk({ status: "Lettura dei documenti allegati..." });
        preRetrievalSourceName = "Documentazione Allegata";
        preRetrievalOutput = await userFileSearch({ query: input.prompt }, { context: toolContext });
      } else if (matchPuntuale) {
        sendChunk({ status: `Ricerca sentenza ${matchPuntuale[0]}...` });
        preRetrievalSourceName = "Database Giurisprudenza";
        preRetrievalOutput = await internalDatabaseSearch({ searchType: "exact", caseNumber: matchPuntuale[0], query: input.prompt }, { context: toolContext });
      } else if (matchNormativa) {
        sendChunk({ status: `Ricerca riferimento normativo in corso...` });
        preRetrievalSourceName = "Ricerca Normativa Web";
        preRetrievalOutput = await webSearch({ query: `Normativa vigente giurisprudenza ${matchNormativa[0]}`, focus: "all" });
      } else if (isFascicoloQuery) {
        sendChunk({ status: "Consultazione documenti utente..." });
        preRetrievalSourceName = "Fascicolo Personale";
        preRetrievalOutput = await userFileSearch({ query: input.prompt }, { context: toolContext });
      }
    } catch (err: unknown) {
      console.warn("Errore pre-retrieval deterministico:", err);
    }
  }

  // Normalizzazione output in un array
  let normalizedArray: any[] = [];
  if (Array.isArray(preRetrievalOutput)) {
    normalizedArray = preRetrievalOutput;
  } else if (preRetrievalOutput && typeof preRetrievalOutput === "object") {
    normalizedArray = Array.isArray(preRetrievalOutput.topMatches) ? preRetrievalOutput.topMatches 
                    : Array.isArray(preRetrievalOutput.risultati) ? preRetrievalOutput.risultati 
                    : Array.isArray(preRetrievalOutput.results) ? preRetrievalOutput.results 
                    : [preRetrievalOutput];
  }

  const isEmptyRetrieval = normalizedArray.length > 0 && typeof normalizedArray[0]?.messaggio === "string" && normalizedArray[0].messaggio.includes("Nessun paragrafo");
  
  let skipTurn1 = false;
  if (preRetrievalOutput && !normalizedArray[0]?.error && !isEmptyRetrieval && !hasExecutiveIntent) {
    skipTurn1 = true;
  }
  
  return { skipTurn1, preRetrievalOutput, preRetrievalSourceName, normalizedArray };
}

export function extractAndFormatSources(
  messages: any[],
  rawOutputs: any[] = [],
  defaultDeterministicType: string = "documento_allegato",
  toolResponses: any[] = []
) {
  const fontiUniche = new Map<string, unknown>();

  const processItems = (items: any[], defaultType: string) => {
    for (const fonte of items) {
      if (
        !fonte ||
        typeof fonte !== "object" ||
        fonte.error ||
        (typeof fonte.messaggio === "string" && fonte.messaggio.includes("Nessun paragrafo"))
      ) {
        continue;
      }

      const documentId = fonte.documento_id ?? fonte.documentId ?? fonte.parentId;
      const baseKey = documentId ?? fonte.id ?? fonte._id_interno ?? fonte.urn ?? fonte.link ?? fonte.url_riferimento ?? fonte.sourceUrl;
      const fallbackKey = typeof fonte.titolo === "string"
        ? fonte.titolo
        : (fonte.title || fonte.numero_sentenza || fonte.caseNumber || fonte.nome_file || fonte.fileName || null);
      const key = baseKey ? String(baseKey) : fallbackKey;

      if (key && !fontiUniche.has(key)) {
        if (!fonte._type) fonte._type = defaultType;
        fontiUniche.set(key, fonte);
      }
    }
  };

  try {
    for (const msg of messages) {
      if (msg.role !== "tool") continue;
      for (const part of msg.content || []) {
        const output = part.toolResponse?.output as any;
        if (!output) continue;

        const toolName = part.toolResponse?.name || "";
        if (toolName === "ricercaManualeTool") continue;

        const items: any[] = Array.isArray(output) ? output : (output.topMatches || output.risultati || output.results || [output]);
        let toolType = "database_interno";
        if (toolName === "userFileSearch") toolType = "documento_allegato";
        if (toolName === "webSearch") toolType = "web_search";

        processItems(items, toolType);
      }
    }

    for (const tr of toolResponses) {
      const output = tr.toolResponse?.output;
      if (!output) continue;

      const toolName = tr.toolResponse?.name || "";
      if (toolName === "ricercaManualeTool") continue;

      const items: any[] = Array.isArray(output) ? output : (output.topMatches || output.risultati || output.results || [output]);
      let toolType = "database_interno";
      if (toolName === "userFileSearch") toolType = "documento_allegato";
      if (toolName === "webSearch") toolType = "web_search";

      processItems(items, toolType);
    }

    if (rawOutputs.length > 0) {
      processItems(rawOutputs, defaultDeterministicType);
    }
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

      const isExactMatch = f._type === "giurisprudenza_puntuale" || f._type === "giurisprudenza_normativa";

      let matchPercentage = 85;
      if (isExactMatch) {
        matchPercentage = 100;
      } else if (rawScore !== null) {
        matchPercentage = Math.max(0, Math.min(100, Math.round(rawScore * 100)));
      }

      const identificativo =
        f.nome_file ||
        f.fileName ||
        f.name ||
        f.titolo ||
        f.numero_sentenza ||
        f.caseNumber ||
        (f.organo_giudicante || f.court
          ? `${f.organo_giudicante || f.court}${(f.dataSentenza || f.data) ? ` del ${f.dataSentenza || f.data}` : ""}`
          : null) ||
        f.fonte ||
        f.source ||
        null;

      return {
        _type: f._type,
        documento_id: f.documento_id ?? f.documentId ?? f.parentId ?? f.id ?? f._id_interno ?? null,
        _id_interno: f._id_interno ?? (f._type === "document_chunk" ? f.id : null),
        posizione_originale: f.posizione_originale ?? f.originalPosition ?? f.index ?? null,
        timestamp: f.timestamp ?? new Date().toISOString(),
        identificativo,
        numero_sentenza: f.numero_sentenza ?? f.caseNumber ?? null,
        score: rawScore !== null ? rawScore : (isExactMatch ? 1 : null),
        match_percentage: matchPercentage,
        organo_giudicante: f.organo_giudicante ?? f.court ?? null,
        data_pubblicazione: f.dataSentenza ?? f.data ?? f.date ?? null,
        fonte_web: f.fonte ?? f.source ?? null,
        url_riferimento: f.link ?? f.urn ?? f.url ?? f.sourceUrl ?? null,
      };
    })
    .filter((f: any) =>
      Boolean(f.identificativo) &&
      (
        f._type === "web_search" ||
        f._type === "documento_allegato" ||
        f._type === "document_chunk" ||
        f._type === "database_interno" ||
        f._type?.startsWith("giurisprudenza_") ||
        f.fonte_web ||
        f.match_percentage >= 60
      )
    )
    .sort((a: any, b: any) => b.match_percentage - a.match_percentage)
    .slice(0, CFG.limits.maxDbLimit);
}