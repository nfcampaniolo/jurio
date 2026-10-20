import OpenAI from "openai";

const EMBEDDING_BATCH_SIZE = 100;

export async function createDoctrineEmbeddings(
  texts: string[],
  requestId: string
): Promise<Array<number[] | undefined>> {
  const embeddings: Array<number[] | undefined> = new Array(texts.length);
  if (texts.length === 0) return embeddings;

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    for (let start = 0; start < texts.length; start += EMBEDDING_BATCH_SIZE) {
      const batch = texts.slice(start, start + EMBEDDING_BATCH_SIZE);
      try {
        const response = await openai.embeddings.create({
          model: "text-embedding-3-small",
          input: batch,
          dimensions: 1536,
        });

        for (const item of response.data) {
          if (item.index >= 0 && item.index < batch.length) {
            embeddings[start + item.index] = item.embedding;
          }
        }
      } catch (error) {
        console.error(
          `[DOCTRINE-${requestId}] Embedding batch ${Math.floor(start / EMBEDDING_BATCH_SIZE) + 1} fallito; i trigger Firestore completeranno i vettori mancanti:`,
          error
        );
      }
    }
  } catch (error) {
    console.error(
      `[DOCTRINE-${requestId}] Client embedding non disponibile; i trigger Firestore completeranno i vettori mancanti:`,
      error
    );
  }

  return embeddings;
}
