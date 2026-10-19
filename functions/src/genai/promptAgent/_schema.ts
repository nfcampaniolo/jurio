import { z } from 'genkit';

export const PromptFieldSchema = z.object({
  name: z.string(),
  type: z.string(),
  description: z.string(),
  enumValues: z.string().optional(),
  isRequired: z.boolean(),
});

export const PromptOutputSchema = z.object({
  result: z.string().describe("Il prompt architetturale generato pronto all'uso"),
});
