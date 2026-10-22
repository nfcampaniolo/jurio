import { Request, Response } from "express";
import OpenAI from "openai";
import { withSecureApiEndpoint } from "../_utils";
import { requireAdminUser } from "./_helper";
import { PROMPT_MASSIMAZIONE } from "../genai/documentAnalysisAgent/_prompts";
import { MAX_INPUT_CHARS_DOCUMENT } from "../_constants";
import { ReasoningAdminRequestBody, ReasoningAdminResponse } from "./_interfaces";
import { logSafeError } from "../_logging";

async function generateMassimazioneJson(
  client: OpenAI,
  model: string,
  question: string
): Promise<Record<string, unknown>> {
  const response = await client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: "Agisci come un esperto redattore giuridico. Restituisci esclusivamente JSON valido." },
      { role: "user", content: `${PROMPT_MASSIMAZIONE}\n\nTESTO DA ANALIZZARE:\n${question}` },
    ],
    response_format: { type: "json_object" },
  });

  const rawContent = response.choices[0]?.message?.content ?? "";
  const cleanJson = rawContent.replace(/```json/gi, "").replace(/```/g, "").trim();
  return JSON.parse(cleanJson);
}

export async function executeReasoningAdmin(req: Request, res: Response): Promise<any> {
  return withSecureApiEndpoint(req, res, async (uid): Promise<void> => {
    // 1. Sanitizzazione e validazione input
    const body = (req.body ?? {}) as ReasoningAdminRequestBody;
    const question = typeof body.question === "string" ? body.question.trim() : "";

    if (!question) { 
      res.status(400).json({ error: "Bad Request: Invalid 'question'" }); 
      return; 
    }
    if (question.length > MAX_INPUT_CHARS_DOCUMENT) { 
      res.status(413).json({ error: "Payload Too Large: Question exceeds character limit" }); 
      return; 
    }

    if (!(await requireAdminUser(uid, res, "JURIO-REASONING-ADMIN"))) return;

    // 3. Logica di business: blocco preventivo per sentenze in oscuramento
    const normalizedText = question.replace(/\s+/g, ' ').toLowerCase();
    if (
      normalizedText.includes("la sentenza richiesta è in fase di valutazione per oscuramento") ||
      normalizedText.includes("la sentenza richiesta è in fase di oscuramento")
    ) {
      res.status(403).json({ 
        error: "oscuramento_in_corso", 
        details: "La sentenza è in fase di valutazione per oscuramento e non può essere elaborata." 
      });
      return;
    }

    let parsedJson: Record<string, unknown> | null = null;
    let providerUsed = "";
    let modelUsed = "";

    // 5. Chiamate LLM Multi-Provider
    // TENTATIVO 1: DEEPSEEK
    try {
      if (!process.env.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY mancante");

      const dsClient = new OpenAI({
        apiKey: process.env.DEEPSEEK_API_KEY,
        baseURL: "https://api.deepseek.com",
      });

      parsedJson = await generateMassimazioneJson(dsClient, "deepseek-chat", question);
      providerUsed = "deepseek";
      modelUsed = "deepseek-chat";

    } catch (dsError) {
      logSafeError("REASONING_DEEPSEEK_FAILED_FALLING_BACK_TO_OPENAI", dsError);
      
      // TENTATIVO 2: OPENAI FALLBACK
      if (!process.env.OPENAI_API_KEY) {
        console.error("[JURIO-REASONING-ADMIN] OPENAI_API_KEY mancante. Impossibile eseguire fallback.");
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }

      const oaClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      parsedJson = await generateMassimazioneJson(oaClient, "gpt-4o-mini", question);
      providerUsed = "openai_fallback";
      modelUsed = "gpt-4o-mini";
    }

    // 6. Risposta al client
    if (!parsedJson) {
      res.status(500).json({ error: "Failed to generate valid JSON structure." });
      return;
    }

    const responsePayload: ReasoningAdminResponse = {
      message: parsedJson,
      status: "SENT_BY_BOT",
      model: modelUsed, 
      provider: providerUsed
    };

    res.status(200).json(responsePayload);
  });
}