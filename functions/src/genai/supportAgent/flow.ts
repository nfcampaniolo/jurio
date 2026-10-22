import {
  buildJurioSupportSystemPrompt,
  SYSTEM_PROMPT_GEMINI_FALLBACK,
  buildFallbackUserPrompt,
  buildEstraiMetadatiPrompt,
} from "./_prompts";
import { z } from 'genkit';
import { ai } from "../_config";
import { searchUserManual, type ManualSearchResult } from "../tools/support";
import { ChatMessageSchema, EstraiMetadatiInputSchema, EstraiMetadatiOutputSchema, GeminiFallbackInputSchema, GeminiFallbackOutputSchema } from "./_schema";
import { logSafeError } from "../../_logging";

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

    sendChunk({ status: "Consultazione del manuale Jurio..." });
    const searchStartedAt = Date.now();
    const recentUserMessages = (input.history ?? [])
      .filter((message) => message.role === "user")
      .slice(-2)
      .map((message) => message.content.slice(0, 500));
    const manualQuery = [...recentUserMessages, input.prompt].join("\n").slice(-3000);
    const manualResults = await searchUserManual(manualQuery);
    console.info(`[JURIO-SUPPORT] Ricerca manuale completata in ${Date.now() - searchStartedAt}ms`);
    const fontiEstratte = manualResults.filter(
      (result): result is ManualSearchResult & { id: string; text: string } =>
        typeof result.id === "string" && typeof result.text === "string"
    );
    const searchFailed = manualResults.some((result) => typeof result.error === "string");
    const fontiPerPrompt = fontiEstratte.slice(0, 2);
    const manualContext = searchFailed
      ? "La ricerca nel manuale non è riuscita. Non presentare informazioni non verificate come provenienti dal manuale."
      : fontiPerPrompt.length > 0
      ? fontiPerPrompt.map((source, index) =>
        `[Fonte ${index + 1}]\n${source.text.slice(0, 1000)}\nLink: ${source.links?.slice(0, 2).join(", ") ?? "nessuno"}`
      ).join("\n\n")
      : "Nessuna fonte pertinente è stata trovata nel manuale.";

    const history = (input.history ?? []).slice(-4).map((msg) => ({
      role: msg.role,
      content: [{ text: msg.content.slice(0, 700) }],
    }));

    const messages = [
      {
        role: "system" as const,
        content: [{
          text: `${buildJurioSupportSystemPrompt()}\n\n` +
            `Risultati aggiornati della ricerca nel manuale Jurio:\n${manualContext}`,
        }],
      },
      ...history,
      { role: "user" as const, content: [{ text: input.prompt }] },
    ];
    const ragContextChars = fontiPerPrompt.reduce(
      (total, source) => total + Math.min(source.text.length, 1000),
      0
    );
    const historyChars = history.reduce((total, message) => total + message.content[0].text.length, 0);
    const promptChars = messages.reduce(
      (total, message) => total + message.content.reduce((messageTotal, part) => messageTotal + (part.text?.length ?? 0), 0),
      0
    );
    console.info(
      `[JURIO-SUPPORT] Contesto modello: fonti=${fontiPerPrompt.length}, ` +
      `RAG=${ragContextChars} caratteri, history=${historyChars} caratteri, ` +
      `totale=${promptChars} caratteri`
    );

    const generationStartedAt = Date.now();
    let firstTokenLogged = false;
    let streamedText = "";
    const response = await ai.generate({
      messages,
      config: {
        maxOutputTokens: 1200,
        thinkingConfig: { thinkingLevel: "LOW" },
      },
      onChunk: (chunk) => {
        if (chunk.text) {
          streamedText += chunk.text;
          if (!firstTokenLogged) {
            firstTokenLogged = true;
            console.info(`[JURIO-SUPPORT] Primo token generato in ${Date.now() - generationStartedAt}ms`);
          }
          sendChunk({ text: chunk.text });
        } 
      },
    });
    const finalText = response.text;
    const risposta = streamedText.length > finalText.length ? streamedText : finalText;
    console.info(
      `[JURIO-SUPPORT] Generazione risposta completata in ${Date.now() - generationStartedAt}ms; ` +
      `stop=${response.finishReason ?? "sconosciuto"}, ` +
      `stream=${streamedText.length} caratteri, finale=${finalText.length} caratteri, ` +
      `outputTokens=${response.usage?.outputTokens ?? "sconosciuto"}`
    );

    sendChunk({ status: "Risposta completata." });

    return { 
      risposta,
      fonti: fontiEstratte
    };
  }
);

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
          content: [{ text: SYSTEM_PROMPT_GEMINI_FALLBACK }]
        },
        {
          role: "user",
          content: [{ text: buildFallbackUserPrompt(input.query) }]
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
// FLOW — Metadati
// ─────────────────────────────────────────────

export const estraiMetadatiFlow = ai.defineFlow(
  {
    name: 'estraiMetadatiFlow',
    inputSchema: EstraiMetadatiInputSchema,
    outputSchema: EstraiMetadatiOutputSchema,
  },
  async (input) => {
    const { chatContext, metadatiAttuali } = input;

    try {
      // Errori di rete transitori (es. "fetch failed" all'avvio a freddo): si riprova con backoff
      let extractionResult;
      for (let attempt = 1; ; attempt++) {
        try {
          // Timeout per tentativo: una chiamata appesa non deve consumare l'intero timeout della function
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            extractionResult = await Promise.race([
              ai.generate({
                // gemini-3.5-flash va spesso in timeout (>100s) anche su richieste banali; il lite risponde in <1s
                model: "vertexai/gemini-3.5-flash-lite",
                prompt: buildEstraiMetadatiPrompt({ metadatiAttuali, chatContext }),
                output: {
                  schema: EstraiMetadatiOutputSchema
                },
                // Estrazione dati strutturata: nessun ragionamento esteso, risposta breve
                config: {
                  maxOutputTokens: 1500,
                  thinkingConfig: { thinkingLevel: "MINIMAL" },
                },
              }),
              new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error("Timeout estrazione metadati")), 60_000);
              }),
            ]);
          } finally {
            if (timer) clearTimeout(timer);
          }
          break;
        } catch (err) {
          if (attempt >= 2) throw err;
          await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
        }
      }

      return extractionResult.output || { dati_nuovi_o_aggiornati: [] };

    } catch (error) {
      logSafeError("SUPPORT_METADATA_LLM_EXTRACTION_FAILED", error);
      // In caso di errore, restituiamo un array vuoto per non bloccare il flusso dell'app
      return { dati_nuovi_o_aggiornati: [] };
    }
  }
);