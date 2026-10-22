import { z } from 'genkit';
import { ai } from "../_config";
import { logSafeError } from "../../_logging";
import { PromptFieldSchema, PromptOutputSchema } from "./_schema";
import {
  PROMPT_BUILDER_SYSTEM_PROMPT,
  buildPromptBuilderUserPrompt,
  buildPromptBuilderFallbackResult,
  getEnhancePromptSystemInstruction,
} from "./_prompts";

// ─────────────────────────────────────────────
// FLOW — Meta-Prompting
// ─────────────────────────────────────────────

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

    // 2. Definizione dei messaggi (System / User) tramite moduli estratti
    const systemPrompt = PROMPT_BUILDER_SYSTEM_PROMPT;
    const userPrompt = buildPromptBuilderUserPrompt({
      objective: input.objective,
      notes: input.notes,
      stringifiedSchema,
    });

    const messages = [
      { role: "system" as const, content: [{ text: systemPrompt }] },
      { role: "user" as const, content: [{ text: userPrompt }] },
    ];

    try {
      // 3. Chiamata Agentica
      const response = await ai.generate({
        messages: messages as any,
      });

      sendChunk({ message: { status: "Ottimizzazione e formattazione finale..." } });

      const generatedPrompt = response.text;

      // 4. Controllo di validità
      if (!generatedPrompt || generatedPrompt.trim() === "") {
        console.warn("[GUARDRAIL] L'AI ha restituito un prompt nullo o vuoto. Utilizzo template fallback.");
        return { 
          result: buildPromptBuilderFallbackResult({
            objective: input.objective,
            stringifiedSchema,
          })
        };
      }

      return { result: generatedPrompt };

    } catch (error) {
      logSafeError("PROMPT_BUILDER_FLOW_FAILED", error);
      throw new Error("Si è verificato un errore durante la generazione del prompt architetturale.");
    }
  }
);

// ─────────────────────────────────────────────
// FLOW — Enhance Prompting
// ─────────────────────────────────────────────

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
    const systemInstruction = getEnhancePromptSystemInstruction(input.type);

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