import { z } from 'genkit';
import { ai } from "../_config";
import { REASONING_SYSTEM_PROMPT, buildReasoningUserPrompt, PROMPT_MASSIMAZIONE, PROMPT_DOTTRINA, buildDoctrineSystemPrompt, buildDoctrineUserPrompt } from "./_prompts";
import { DoctrineOutputSchema } from "./_schema";
import { chunkText, safeParseJson, generateWithRetry } from "./_helper";

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

    const allTematiche: any[] = [];

    for (let i = 0; i < textChunks.length; i++) {
      const chunk = textChunks[i];
      console.log(
        `[doctrineFlow] Elaborazione chunk ${i + 1}/${textChunks.length} (${chunk.length} caratteri)...`
      );

      try {
        const response = await generateWithRetry({
          model: "vertexai/gemini-3.8-flash",
          system: buildDoctrineSystemPrompt(PROMPT_DOTTRINA),
          prompt: buildDoctrineUserPrompt({
            sourceUrl: input.sourceUrl,
            chunkIndex: i + 1,
            totalChunks: textChunks.length,
            chunk,
          }),
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