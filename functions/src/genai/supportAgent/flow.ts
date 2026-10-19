import {
  buildJurioSupportSystemPrompt,
  SYSTEM_PROMPT_JURIO_SUPPORT,
  SYSTEM_PROMPT_GEMINI_FALLBACK,
  buildFallbackUserPrompt,
  buildEstraiMetadatiPrompt,
} from "./_prompts";
import { z } from 'genkit';
import { ai, CFG } from "../_config";
import { userManualSearch } from "../tools/index";
import {ChatMessageSchema, EstraiMetadatiInputSchema, EstraiMetadatiOutputSchema, GeminiFallbackInputSchema, GeminiFallbackOutputSchema} from "./_schema";
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
    const history = (input.history ?? []).slice(-CFG.limits.historyWindow).map((msg) => ({
      role: msg.role,
      content: [{ text: msg.content }],
    }));

    const messages = [
      {
        role: "system" as const,
        content: [{ text: buildJurioSupportSystemPrompt(SYSTEM_PROMPT_JURIO_SUPPORT) }],
      },
      ...history,
      { role: "user" as const, content: [{ text: input.prompt }] },
    ];

    const response = await ai.generate({
      messages: messages as any,
      tools: [userManualSearch],
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
          if (contentItem.toolResponse && contentItem.toolResponse.name === 'userManualSearch') {
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
      const extractionResult = await ai.generate({
        prompt: buildEstraiMetadatiPrompt({ metadatiAttuali, chatContext }),
        
        output: {
          schema: EstraiMetadatiOutputSchema
        },
      });

      return extractionResult.output || { dati_nuovi_o_aggiornati: [] };

    } catch (error) {
      console.error("[estraiMetadatiFlow] Errore durante l'estrazione LLM:", error);
      // In caso di errore, restituiamo un array vuoto per non bloccare il flusso dell'app
      return { dati_nuovi_o_aggiornati: [] };
    }
  }
);