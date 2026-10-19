import { Request, Response } from "express";
import OpenAI from "openai";
import { withSecureApiEndpoint, validateUserPlanAndLimits } from "../_utils";
import { getDb } from "../_deps";
import { PROMPT_MASSIMAZIONE } from "../genai/documentAnalysisAgent/_prompts";
import { MAX_INPUT_CHARS_DOCUMENT } from "../_constants";
import { ReasoningAdminRequestBody, ReasoningAdminResponse } from "./_interfaces";

const db = getDb();

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

    // 2. Controllo utente nel DB e verifica ruolo Admin
    const userSnap = await db.collection("register").doc(uid).get();
    if (!userSnap.exists) { 
      res.status(404).json({ error: "Not Found" }); 
      return; 
    }

    const planId = String(userSnap.data()?.planId ?? "");
    if (planId !== "admin") {
      console.warn(`[JURIO-REASONING-ADMIN] Accesso negato per utente non admin: ${uid}`);
      res.status(403).json({ error: "Forbidden", details: "Privilegi insufficienti." });
      return;
    }

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

    // 4. Validazione unificata limiti e consumo quote per la feature "admin"
    await validateUserPlanAndLimits(uid, "admin", userSnap);

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

      const dsResponse = await dsClient.chat.completions.create({
        model: "deepseek-chat", 
        messages: [
          { role: "system", content: "Agisci come un esperto redattore giuridico. Restituisci esclusivamente JSON valido." },
          { role: "user", content: `${PROMPT_MASSIMAZIONE}\n\nTESTO DA ANALIZZARE:\n${question}` },
        ],
        response_format: { type: "json_object" },
      });

      const rawContent = dsResponse.choices[0]?.message?.content ?? "";
      const cleanJson = rawContent.replace(/```json/gi, "").replace(/```/g, "").trim();
      
      parsedJson = JSON.parse(cleanJson);
      providerUsed = "deepseek";
      modelUsed = "deepseek-chat";

    } catch (dsError) {
      console.warn(`[JURIO-REASONING-ADMIN] DeepSeek fallito per UID ${uid}. Fallback su OpenAI. Errore log:`, dsError);
      
      // TENTATIVO 2: OPENAI FALLBACK
      if (!process.env.OPENAI_API_KEY) {
        console.error("[JURIO-REASONING-ADMIN] OPENAI_API_KEY mancante. Impossibile eseguire fallback.");
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }

      const oaClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      
      const oaResponse = await oaClient.chat.completions.create({
        model: "gpt-4o-mini", 
        messages: [
          { role: "system", content: "Agisci come un esperto redattore giuridico. Restituisci esclusivamente JSON valido." },
          { role: "user", content: `${PROMPT_MASSIMAZIONE}\n\nTESTO DA ANALIZZARE:\n${question}` },
        ],
        response_format: { type: "json_object" },
      });

      const rawContent = oaResponse.choices[0]?.message?.content ?? "";
      const cleanJson = rawContent.replace(/```json/gi, "").replace(/```/g, "").trim();

      parsedJson = JSON.parse(cleanJson);
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