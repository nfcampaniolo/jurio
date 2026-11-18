import { randomUUID } from "node:crypto";
import { z } from 'genkit';
import { ai } from "../_config";
import { internalDatabaseSearch, userFileSearch, webSearch } from "../tools/index";
import { FonteSchema, ReviewListSchema } from "./_schema";
import {
  buildAskSystemPrompt,
  buildCaseLawSummaryPrompt,
  buildQuoteSystemPrompt,
  buildRedraftSystemPrompt,
  buildReviewSystemPrompt,
  formatReviewCriteria,
} from "./_prompts";
import { RisultatoRicerca, searchJurioDatabase } from "./_search";
import { logSafeError } from "../../_logging";

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
        tools: [internalDatabaseSearch], 
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
      logSafeError("WORD_QUOTE_FLOW_FAILED", error);
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
      criteri: z
        .object({ titolo: z.string(), testo: z.string() })
        .nullable()
        .optional()
        .describe("Prompt Jurio o playbook dell'utente da applicare, già caricato e autorizzato dal chiamante."),
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
    if (input.criteri?.testo.trim()) {
      contestoDocumento += `\n${formatReviewCriteria(input.criteri.titolo, input.criteri.testo)}`;
    }

    const messages = [
      { role: "system" as const, content: [{ text: buildReviewSystemPrompt() }] },
      { role: "user" as const, content: [{ text: contestoDocumento }] },
    ];

    try {
      const response = await ai.generate({
        messages: messages as any,
        tools: [internalDatabaseSearch, webSearch], 
        context: { userId: input.userId },
        output: { schema: ReviewListSchema },
        onChunk: (chunk) => {
          const toolReq = chunk.content?.find((p: any) => p.toolRequest)?.toolRequest;
          if (toolReq) {
            const toolName = toolReq.name;
            const args = toolReq.input as any;
            const queryStr = args.query ? `"${args.query}"` : "argomento";
            
            if (toolName === 'internalDatabaseSearch') {
              sendChunk({ message: { status: `Ricerca in archivio: ${queryStr}...` } });
            }
            if (toolName === 'webSearch') {
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
      logSafeError("WORD_REVIEW_FLOW_FAILED", error);
      throw new Error("Si è verificato un errore durante l'analisi di conformità.");
    }
  }
);

export const wordRedraftFlow = ai.defineFlow(
  {
    name: 'wordRedraftFlow',
    inputSchema: z.object({
      text: z.string().min(1).describe("Il testo selezionato in Word da riscrivere."),
      promptDirettiva: z.string().optional().describe("La direttiva di riscrittura dell'avvocato."),
      fascicoloId: z.string().nullable().optional().describe("Fascicolo di contesto, già verificato dal chiamante."),
      userId: z.string(),
    }),
    outputSchema: z.object({
      risultato: z.string(),
      fonti: z.array(FonteSchema),
    }),
  },
  async (input, { sendChunk }) => {
    sendChunk({ status: "Analisi del testo e ricerca dei precedenti..." });

    const hasFascicolo = Boolean(input.fascicoloId);
    let userPrompt = `<TESTO_DA_RISCRIVERE>\n${input.text}\n</TESTO_DA_RISCRIVERE>`;
    if (input.promptDirettiva?.trim()) {
      userPrompt += `\n<DIRETTIVA>\n${input.promptDirettiva.trim()}\n</DIRETTIVA>`;
    }

    const messages = [
      { role: "system" as const, content: [{ text: buildRedraftSystemPrompt(hasFascicolo) }] },
      { role: "user" as const, content: [{ text: userPrompt }] },
    ];

    try {
      const response = await ai.generate({
        messages: messages as any,
        tools: hasFascicolo ? [internalDatabaseSearch, userFileSearch] : [internalDatabaseSearch],
        context: { userId: input.userId, fascicoloId: input.fascicoloId ?? undefined },
        onChunk: (chunk) => {
          const toolName = chunk.content?.find((p: any) => p.toolRequest)?.toolRequest?.name;
          if (toolName === "userFileSearch") sendChunk({ status: "Consultazione dei documenti del fascicolo..." });
          else if (toolName) sendChunk({ status: "Verifica giurisprudenziale..." });
        },
      });

      sendChunk({ status: "Stesura della proposta..." });
      const risultato = response.text?.trim() ?? "";
      if (!risultato) {
        throw new Error("EMPTY_REDRAFT");
      }

      return { risultato, fonti: estraiFontiDalRisultato(response) };
    } catch (error) {
      logSafeError("WORD_REDRAFT_FLOW_FAILED", error);
      throw new Error("Si è verificato un errore durante la riscrittura.");
    }
  }
);

const AskTurnSchema = z.object({ role: z.enum(["user", "model"]), text: z.string() });

/** Domande sul documento. Nessuna persistenza: la cronologia arriva dal pannello e lì resta. */
export const wordAskFlow = ai.defineFlow(
  {
    name: "wordAskFlow",
    inputSchema: z.object({
      domanda: z.string().min(1),
      documento: z.string().optional(),
      cronologia: z.array(AskTurnSchema).optional(),
      userId: z.string(),
    }),
    outputSchema: z.object({ risposta: z.string(), fonti: z.array(FonteSchema) }),
  },
  async (input, { sendChunk }) => {
    sendChunk({ status: "Lettura del documento..." });
    const hasDocument = Boolean(input.documento?.trim());

    const storia = (input.cronologia ?? []).map((turn) => ({
      role: turn.role,
      content: [{ text: turn.text }],
    }));
    let domanda = `<DOMANDA>\n${input.domanda.trim()}\n</DOMANDA>`;
    if (hasDocument) domanda = `<DOCUMENTO>\n${input.documento}\n</DOCUMENTO>\n${domanda}`;

    const messages = [
      { role: "system" as const, content: [{ text: buildAskSystemPrompt(hasDocument) }] },
      ...storia,
      { role: "user" as const, content: [{ text: domanda }] },
    ];

    try {
      const response = await ai.generate({
        messages: messages as any,
        tools: [internalDatabaseSearch],
        context: { userId: input.userId, uiFilters: [] },
        onChunk: (chunk) => {
          const toolName = chunk.content?.find((p: any) => p.toolRequest)?.toolRequest?.name;
          if (toolName) sendChunk({ status: "Ricerca nella banca dati Jurio..." });
        },
      });
      const risposta = response.text?.trim() ?? "";
      if (!risposta) throw new Error("EMPTY_ASK");
      return { risposta, fonti: estraiFontiDalRisultato(response) };
    } catch (error) {
      logSafeError("WORD_ASK_FLOW_FAILED", error);
      throw new Error("Si è verificato un errore durante la risposta.");
    }
  }
);

const CaseLawPlanSchema = z.object({
  sintesi: z.string(),
  query: z.array(z.string()).min(1).max(3),
});

/** Una sola chiamata al modello (sintesi + query), poi ricerca semantica senza AI. */
export const wordCaseLawFlow = ai.defineFlow(
  {
    name: "wordCaseLawFlow",
    inputSchema: z.object({ documento: z.string().min(1), userId: z.string() }),
    outputSchema: z.object({
      sintesi: z.string(),
      query: z.array(z.string()),
      risultati: z.array(z.any()),
    }),
  },
  async (input, { sendChunk }) => {
    sendChunk({ status: "Sintesi del documento..." });
    let piano: z.infer<typeof CaseLawPlanSchema>;
    try {
      const response = await ai.generate({
        system: buildCaseLawSummaryPrompt(),
        prompt: `<DOCUMENTO>\n${input.documento}\n</DOCUMENTO>`,
        output: { schema: CaseLawPlanSchema },
      });
      if (!response.output?.sintesi || !response.output.query?.length) throw new Error("EMPTY_CASE_LAW_PLAN");
      piano = response.output;
    } catch (error) {
      logSafeError("WORD_CASE_LAW_SUMMARY_FAILED", error);
      throw new Error("Si è verificato un errore durante la sintesi del documento.");
    }

    sendChunk({ status: "Ricerca dei precedenti pertinenti..." });
    const query = piano.query.map((q) => q.trim()).filter(Boolean).slice(0, 3);
    const esiti = await Promise.all(
      query.map((q) =>
        searchJurioDatabase({ mode: "semantic", query: q, userId: input.userId, limit: 8 }).catch((error) => {
          logSafeError("WORD_CASE_LAW_SEARCH_FAILED", error);
          return { risultati: [] as RisultatoRicerca[], messaggio: null };
        })
      )
    );

    const unici = new Map<string, RisultatoRicerca>();
    for (const r of esiti.flatMap((e) => e.risultati)) {
      const prev = unici.get(r.id);
      if (!prev || (r.score ?? 0) > (prev.score ?? 0)) unici.set(r.id, r);
    }
    const risultati = [...unici.values()].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 12);
    return { sintesi: piano.sintesi.trim(), query, risultati };
  }
);

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
          
          const key = String(fonte.documento_id ?? fonte.id ?? fonte.numero_sentenza ?? randomUUID());
          if (!fontiUniche.has(key)) fontiUniche.set(key, fonte);
        });
      });
    });
  } catch (parseError) {
    logSafeError("WORD_REVIEW_SOURCE_PARSING_FAILED", parseError);
  }

  return Array.from(fontiUniche.values()).map(f => {
    let rawScore = f.score ?? null;
    if (rawScore === null && f._distance !== undefined) {
      rawScore = 1 - f._distance; 
    }

    return {
      id: String(f.documento_id ?? f.id ?? "id-non-disponibile"),
      titolo: String(f.titolo ?? f.numero_sentenza ?? "Documento senza titolo"),
      url: f.link ?? f.url ?? f.urn ?? undefined,
      score: rawScore !== null ? Math.round(rawScore * 100) / 100 : undefined
    };
  }).slice(0, 5); 
}