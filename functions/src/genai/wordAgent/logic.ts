import { Request, Response } from "express";
import { validateUserPlanAndLimits, withSecureApiEndpoint } from "../../_utils";
import { getDb } from "../../_deps";
import { wordQuoteFlow, wordReviewFlow } from "./flow";

const db = getDb();

async function streamFlowResponse<T, Output>(
  flowStream: { stream: AsyncIterable<T>; output: Promise<Output> },
  res: Response,
  isClientDisconnected: () => boolean
): Promise<void> {
  for await (const chunk of flowStream.stream) {
    if (isClientDisconnected() || res.writableEnded) break;
    res.write(`data: ${JSON.stringify({ message: chunk })}\n\n`);
  }

  if (isClientDisconnected()) return;

  const finalOutput = await flowStream.output;
  if (!res.writableEnded) {
    res.write(`data: ${JSON.stringify({ result: finalOutput })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
}

export async function executeWordAgent(req: Request, res: Response): Promise<any> {
  return withSecureApiEndpoint(req, res, async (uid): Promise<void> => {
    let clientDisconnected = false;
    req.on("close", () => {
      clientDisconnected = true;
    });

    // 1. Validazione Azione a monte (necessaria per calcolare il nome della feature nel rate limiter)
    const action = req.body?.action;
    if (!action || typeof action !== "string") {
      res.status(400).json({ error: "Bad Request", details: "Parametro 'action' mancante o non valido." });
      return;
    }

    // 2. Controllo utente e validazione unificata piano/limiti dinamica per azione
    const userSnap = await db.collection("register").doc(uid).get();
    if (!userSnap.exists) {
      throw new Error("NOT_FOUND");
    }

    const featureKey = `${action}_agent` as any;
    await validateUserPlanAndLimits(uid, featureKey, userSnap);

    // 3. Configurazione Header SSE (A monte del routing poiché tutte le azioni sono generative)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    // 4. Routing delle Azioni
    if (action === "research") {
      const { contesto, promptIndirizzamento, filters } = req.body;

      if (!contesto) {
        throw new Error("Il parametro 'contesto' è obbligatorio per l'azione research.");
      }

      const flowStream = wordQuoteFlow.stream({
        contesto,
        promptIndirizzamento: promptIndirizzamento || "",
        filters: filters || {},
        userId: uid
      });

      await streamFlowResponse(flowStream, res, () => clientDisconnected);
      return;
    } 

    if (action === "review") {
      const { promptIndirizzamento, chunks } = req.body;
      
      if (!chunks || !Array.isArray(chunks)) {
        res.status(400).json({ error: "Per la review serve un array di chunks." });
        return;
      }

      const flowStream = wordReviewFlow.stream({ 
        chunks, 
        promptIndirizzamento: promptIndirizzamento || "", 
        userId: uid 
      });

      await streamFlowResponse(flowStream, res, () => clientDisconnected);
      return;
    }

    if (action === "drafting") {
      throw new Error("Azione 'drafting' in fase di sviluppo.");
    } 

    throw new Error(`Azione '${action}' non supportata da wordAgent.`);
  });
}