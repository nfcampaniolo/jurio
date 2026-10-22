import { Request, Response } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { validateUserPlanAndLimits, withSecureApiEndpoint} from "../../_utils";
import { getDb } from "../../_deps";
import { promptBuilderFlow, enhancePromptFlow } from "./flow";
import { PromptFieldInput, PromptAgentRequestBody, EnhancePromptRequestBody, EnhancePromptMessage } from "../_interfaces";
import { logSafeError } from "../../_logging";


const db = getDb();

export async function executePromptAgent(req: Request, res: Response): Promise<any> {
  return withSecureApiEndpoint(req, res, async (uid): Promise<void> => {
    let clientDisconnected = false;
    req.on("close", () => {
      clientDisconnected = true;
    });

    // 1. Recupero utente e validazione unificata piano/limiti
    const userSnap = await db.collection("register").doc(uid).get();
    if (!userSnap.exists) {
      throw new Error("NOT_FOUND");
    }

    await validateUserPlanAndLimits(uid, "prompting", userSnap);

    // 2. Sanitizzazione Input (Prevenzione DoS e Storage Abuse)
    const body = (req.body ?? {}) as PromptAgentRequestBody;
    
    const title = typeof body.title === "string" ? body.title.trim().substring(0, 150) : "";
    const objective = typeof body.objective === "string" ? body.objective.trim().substring(0, 3000) : "";
    const notes = typeof body.notes === "string" ? body.notes.trim().substring(0, 2000) : "";
    const fieldsRaw = Array.isArray(body.fields) ? body.fields : [];

    if (!title || !objective || fieldsRaw.length === 0) {
      res.status(400).json({ error: "Bad Request: Dati mancanti (title, objective o fields)." });
      return;
    }

    if (fieldsRaw.length > 30) {
      res.status(400).json({ error: "Bad Request: Troppi campi definiti (Max 30)." });
      return;
    }

    const safeFields: PromptFieldInput[] = fieldsRaw.map((f: any) => ({
      name: typeof f?.name === "string" ? f.name.replace(/[^a-zA-Z0-9_ -]/g, "").trim().substring(0, 50) : "Campo_Sconosciuto",
      type: typeof f?.type === "string" ? f.type.trim().substring(0, 20) : "string",
      description: typeof f?.description === "string" ? f.description.trim().substring(0, 300) : "",
      isRequired: typeof f?.isRequired === "boolean" ? f.isRequired : false,
    }));

    // 3. Configurazione Header SSE e Flush
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    try {
      // 4. Esecuzione del Flow in Streaming
      const flowStream = promptBuilderFlow.stream({
        objective,
        notes,
        fields: safeFields,
        userId: uid,
      });

      for await (const chunk of flowStream.stream) {
        if (clientDisconnected || res.writableEnded) break;
        res.write(`data: ${JSON.stringify({ message: chunk })}\n\n`);
      }

      if (clientDisconnected) {
        console.warn("[JURIO-PROMPT] Client disconnesso prematuramente");
        return;
      }

      const finalOutput = await flowStream.output;
      const generatedContent = typeof finalOutput?.result === "string" ? finalOutput.result : "";

      // 5. Salvataggio in Firestore
      if (generatedContent.trim() && !res.writableEnded) {
        const safeContent = generatedContent.trim().substring(0, 20000);
        
        const promptRef = await db.collection("register").doc(uid).collection("prompts").add({
          title,
          objective,
          notes,
          fields: safeFields,
          content: safeContent,
          createdAt: FieldValue.serverTimestamp(),
        });
        
        res.write(`data: ${JSON.stringify({ 
          result: safeContent,
          promptId: promptRef.id
        })}\n\n`);
      } else if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: { message: "Errore durante la generazione del prompt: output vuoto." } })}\n\n`);
      }
      
      if (!res.writableEnded) {
        res.write(`data: [DONE]\n\n`);
        res.end();
      }

    } catch (streamErr) {
      const msg = streamErr instanceof Error ? streamErr.message : "Internal error";
      logSafeError("PROMPT_STREAM_FAILED", msg);

      const clientErrorMessage = "Si è verificato un errore durante la stesura del prompt.";

      if (res.headersSent && !res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: { message: clientErrorMessage } })}\n\n`);
        res.write(`data: [DONE]\n\n`);
        res.end();
        return;
      }

      throw streamErr;
    }
  });
}

export async function executeEnhancePromptAgent(req: Request, res: Response): Promise<any> {
  return withSecureApiEndpoint(req, res, async (uid): Promise<void> => {
    // 1. Recupero utente e validazione unificata piano e limiti (per feature "prompt_enhancer")
    const userSnap = await db.collection("register").doc(uid).get();
    if (!userSnap.exists) {
      throw new Error("NOT_FOUND");
    }

    await validateUserPlanAndLimits(uid, "prompt_enhancer", userSnap);

    // 2. Sanitizzazione e Type-Safety Input
    const body = (req.body ?? {}) as EnhancePromptRequestBody;
    
    const promptRaw = typeof body.prompt === "string" ? body.prompt.trim() : "";
    const typeRaw = typeof body.type === "string" ? body.type.trim() : "";
    const historyRaw = Array.isArray(body.history) ? body.history : [];

    if (!promptRaw) {
      res.status(400).json({ error: "Bad Request: Prompt mancante o invalido." });
      return;
    }

    const safePrompt = promptRaw.substring(0, 3000); 

    if (typeRaw !== "chat" && typeRaw !== "approfondimento") {
      res.status(400).json({ error: "Bad Request: Tipo di ottimizzazione non valido." });
      return;
    }

    const safeHistory: EnhancePromptMessage[] = historyRaw
      .filter((m: any) => m && typeof m.content === "string")
      .slice(-10) 
      .map((m: any) => ({
        role: (m.role === "model" || m.role === "assistant") ? "model" : "user",
        content: m.content.substring(0, 2000)
      }));

    // 3. Chiamata al Flow Genkit
    const output = await enhancePromptFlow({
      prompt: safePrompt,
      type: typeRaw as "chat" | "approfondimento",
      history: safeHistory
    });
    
    // 4. Risposta JSON al Frontend
    res.status(200).json({ 
      enhancedPrompt: typeof output?.enhancedPrompt === "string" ? output.enhancedPrompt : "" 
    });
  });
}