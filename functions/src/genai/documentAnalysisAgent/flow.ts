import { z } from 'genkit';
import { ai } from "../_config";
import { REASONING_SYSTEM_PROMPT, buildReasoningUserPrompt, PROMPT_MASSIMAZIONE, PROMPT_DOTTRINA, buildDoctrineSystemPrompt, buildDoctrineUserPrompt } from "./_prompts";
import { DoctrineOutputSchema } from "./_schema";
import { chunkText, safeParseJson, generateWithRetry } from "./_helper";

const DOCTRINE_CHUNK_CONCURRENCY = 2;
const DOCTRINE_SYSTEM_PROMPT = buildDoctrineSystemPrompt(PROMPT_DOTTRINA);

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
      system: REASONING_SYSTEM_PROMPT,
      prompt: buildReasoningUserPrompt({
        promptToUse,
        question: input.question,
      }),
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

    const allTematiche: z.infer<typeof DoctrineOutputSchema>["tematiche"] = [];

    for (let start = 0; start < textChunks.length; start += DOCTRINE_CHUNK_CONCURRENCY) {
      const batch = textChunks.slice(start, start + DOCTRINE_CHUNK_CONCURRENCY);
      const results = await Promise.allSettled(
        batch.map(async (chunk, batchIndex) => {
          const chunkIndex = start + batchIndex;
          const chunkStartedAt = Date.now();
          console.log(
            `[doctrineFlow] Elaborazione chunk ${chunkIndex + 1}/${textChunks.length} (${chunk.length} caratteri)...`
          );

          const response = await generateWithRetry({
            model: "vertexai/gemini-3.5-flash",
            system: DOCTRINE_SYSTEM_PROMPT,
            prompt: buildDoctrineUserPrompt({
              sourceUrl: input.sourceUrl,
              chunkIndex: chunkIndex + 1,
              totalChunks: textChunks.length,
              chunk,
            }),
            output: {
              format: "json",
              schema: DoctrineOutputSchema,
            },
          });

          const parsed = response.output ?? safeParseJson(response.text ?? "");
          const validated = DoctrineOutputSchema.safeParse(parsed);
          if (!validated.success) {
            throw new Error(`Output strutturato non valido: ${validated.error.message}`);
          }

          console.info(
            `[doctrineFlow] Chunk ${chunkIndex + 1}: ${validated.data.tematiche.length} tematiche in ${Date.now() - chunkStartedAt}ms`
          );

          return validated.data.tematiche.map((tema) => {
            if (tema.summary.trim()) return tema;

            const generatedSummary = [
              tema.tematica ? `Tematica: ${tema.tematica}` : "",
              tema.questione_di_diritto ? `Questione: ${tema.questione_di_diritto}` : "",
              tema.orientamento ? `Orientamento: ${tema.orientamento}` : "",
            ]
              .filter(Boolean)
              .join(" - ");

            return {
              ...tema,
              summary: generatedSummary || "Documento giuridico della Corte di Cassazione",
            };
          });
        })
      );

      const failedResult = results.find(
        (result): result is PromiseRejectedResult => result.status === "rejected"
      );
      if (failedResult) {
        const failedChunk = start + results.indexOf(failedResult) + 1;
        console.error(
          `[doctrineFlow] Errore definitivo nel chunk ${failedChunk}:`,
          failedResult.reason
        );
        throw new Error(`Elaborazione Gemini fallita nel chunk ${failedChunk}.`, {
          cause: failedResult.reason,
        });
      }

      for (const result of results) {
        if (result.status === "fulfilled") {
          allTematiche.push(...result.value);
        }
      }
    }

    console.log(
      `[doctrineFlow] Chunking completato. Totale tematiche grezze: ${allTematiche.length}`
    );

    const validatedOutput = { tematiche: allTematiche };

    console.log(
      `[doctrineFlow] Validazione completata. Tematiche finali: ${validatedOutput.tematiche.length}`
    );

    return validatedOutput;
  }
);