import { Request, Response } from "express";
import OpenAI from "openai";
import { corsHandlerDomain, requireAppCheck, consumePerMinuteFeature, consumeDailyFeature, withSecureApiEndpoint, validateUserPlanAndLimits  } from "../../_utils";
import { hashIpForRateLimiting } from "../_utils";
import { legalAgentSupport, estraiMetadatiFlow } from "./flow";
import { JURIO_USAGE_LIMITS, JurioFeatureType } from "../../_constants";
import { MessageDoc, FascicoloDoc, ExtractedMetadataItem, EstraiMetadatiResult, SupportRequestBody, GenerateEmbeddingRequestBody, GenerateEmbeddingResponse } from "../_interfaces";
import { FirestoreEvent, QueryDocumentSnapshot } from "firebase-functions/v2/firestore";
import { getDb } from "../../_deps";

const db = getDb();

export async function enforcePublicRateLimit(
  req: Request, 
  featureKey: JurioFeatureType
): Promise<string> {
  const clientIp = typeof req.headers["x-forwarded-for"] === "string" 
    ? req.headers["x-forwarded-for"].split(",")[0].trim() 
    : req.ip || req.socket.remoteAddress || "unknown_ip";

  const hashedIp = hashIpForRateLimiting(clientIp);
  const ipIdentifier = `ip_${hashedIp}`;
  
  const limits = (JURIO_USAGE_LIMITS[featureKey] as any)?.global ?? { perMinute: 5, perDay: 30 };

  await Promise.all([
    consumePerMinuteFeature(ipIdentifier, featureKey, limits.perMinute),
    consumeDailyFeature(ipIdentifier, featureKey, limits.perDay)
  ]);

  return ipIdentifier;
}

export async function executeSupport(req: Request, res: Response): Promise<any> {
  return corsHandlerDomain(req, res, async (): Promise<void> => {
    // 1. Gestione rapida preflight e validazione metodo
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    // 2. Controlli di sicurezza in parallelo per azzerare la latenza iniziale
    const [appCheckResult, rateLimitResult] = await Promise.allSettled([
      requireAppCheck(req),
      enforcePublicRateLimit(req, "support_public")
    ]);
    if (appCheckResult.status === "rejected") {
      console.warn(`[JURIO-SUPPORT] Accesso fallito AppCheck: ${req.ip}`);
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (rateLimitResult.status === "rejected") {
      console.warn(`[JURIO-SUPPORT] Rate limit superato: ${req.ip}`);
      res.status(429).json({ error: "Too Many Requests" });
      return;
    }

    // 3. Validazione e Sanitizzazione Rigorosa dell'Input (Prevenzione DoS)
    const body = (req.body ?? {}) as SupportRequestBody;
    const messages = body.messages;

    if (!Array.isArray(messages) || messages.length === 0 || messages.length > 20) {
      res.status(400).json({ error: "Bad Request: Invalid messages array length." });
      return;
    }

    const lastMessage = messages[messages.length - 1];
    if (typeof lastMessage?.content !== "string" || !lastMessage.content.trim()) {
      res.status(400).json({ error: "Bad Request: Invalid prompt content." });
      return;
    }

    const safePrompt = lastMessage.content.trim().substring(0, 1000);
    const safeHistory = messages.slice(0, -1)
      .filter(m => m && typeof m.content === "string")
      .map(m => ({
         role: (m.role === 'assistant' || m.role === 'model') ? 'model' as const : 'user' as const,
         content: m.content.substring(0, 2000)
      }));

    // 4. Configurazione Header SSE ad alte prestazioni
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // Disabilita il buffering dei proxy (es. Nginx/Cloudflare)
    });
    res.flushHeaders();

    // 5. Gestione del ciclo di vita della connessione (Disconnessione client)
    let clientDisconnected = false;
    const abortController = new AbortController();

    req.on('close', () => {
      if (!clientDisconnected) {
        clientDisconnected = true;
        abortController.abort();
        if (!res.writableEnded) res.end();
      }
    });

    try {
      // 6. Avvio del Flow GenAI in Streaming
      const flowStream = legalAgentSupport.stream({ 
        prompt: safePrompt, 
        history: safeHistory 
      });

      // Iterazione in tempo reale sui chunk emessi dal flow (status e text)
      for await (const chunk of flowStream.stream) {
        if (clientDisconnected || res.writableEnded) break;
        res.write(`data: ${JSON.stringify({ message: chunk })}\n\n`);
      }

      // 7. Attesa e invio dell'output finale (risposta + fonti strutturate)
      if (!clientDisconnected && !res.writableEnded) {
        const finalOutput = await flowStream.output; 
        res.write(`data: ${JSON.stringify({ result: finalOutput })}\n\n`);
        res.write(`data: [DONE]\n\n`);
        res.end();
      }

    } catch (err: unknown) {
      if (clientDisconnected) return; // Ignora se il client ha chiuso volontariamente la connessione

      const msg = err instanceof Error ? err.message : "Internal error";
      console.error(`[JURIO-SUPPORT] Errore durante lo streaming del flow: ${msg}`);

      // Anti Information Disclosure sullo stream SSE
      if (res.headersSent && !res.writableEnded) {
        res.write(`data: ${JSON.stringify({ error: "Si è verificato un errore durante l'elaborazione." })}\n\n`);
        res.write(`data: [DONE]\n\n`);
        res.end();
      } else if (!res.headersSent) {
        res.status(500).json({ error: "Internal Server Error" });
      }
    }
  });
}

export async function executeUpdateMetadataFromChat(
  event: FirestoreEvent<QueryDocumentSnapshot | undefined, { fascicoloId: string; threadId: string; messageId: string }>
): Promise<void> {
  const snapshot = event.data;
  if (!snapshot) return;

  const messageData = snapshot.data() as Partial<MessageDoc>;
  
  // Evita loop e risparmia token: analizziamo solo i messaggi dell'utente
  if (messageData.role === "model") return; 

  const { fascicoloId, threadId } = event.params;

  try {
    const messagesRef = db.collection("fascicoli").doc(fascicoloId)
                          .collection("threads").doc(threadId)
                          .collection("messages");
    
    const historySnap = await messagesRef
      .orderBy("timestamp", "desc")
      .limit(4) 
      .get();

    const chatContext = historySnap.docs
      .map(doc => {
        const data = doc.data() as MessageDoc;
        const safeContent = typeof data.content === "string" ? data.content.trim() : "";
        const ruolo = data.role === "model" ? "IA" : "UTENTE";
        return `${ruolo}: ${safeContent}`;
      })
      .reverse()
      .join("\n\n");

    // Protezione da costi eccessivi: blocco contesto anomalo
    if (!chatContext || chatContext.length > 5000) return;

    const fascicoloRef = db.collection("fascicoli").doc(fascicoloId);
    const fascicoloSnap = await fascicoloRef.get();
    if (!fascicoloSnap.exists) return;
    
    const fascicoloData = fascicoloSnap.data() as FascicoloDoc;
    const metadatiAttuali = fascicoloData.metadati || {};

    const result = (await estraiMetadatiFlow({
      chatContext,
      metadatiAttuali
    })) as EstraiMetadatiResult;

    const estratti = result.dati_nuovi_o_aggiornati || [];
    if (!Array.isArray(estratti) || estratti.length === 0) return;

    const updatePayload: Record<string, string> = {};
    let hasUpdates = false;

    // Sanitizzazione input IA prima della scrittura DB
    estratti.forEach((item: ExtractedMetadataItem) => {
      if (typeof item.chiave === "string" && typeof item.valore === "string") {
        const safeKey = item.chiave.replace(/[^a-zA-Z0-9_]/g, '').trim().substring(0, 50);
        const safeValue = item.valore.trim().substring(0, 500); 

        if (safeKey && safeValue) {
          updatePayload[`metadati.${safeKey}`] = safeValue;
          hasUpdates = true;
        }
      }
    });

    if (!hasUpdates) return;

    await fascicoloRef.update(updatePayload);
    
    console.log(`[JURIO-METADATA] Aggiornate ${Object.keys(updatePayload).length} chiavi per fascicolo ${fascicoloId}`);

  } catch (error) {
    console.error(`[JURIO-METADATA] Errore estrazione metadati per fascicolo ${fascicoloId}`);
    throw error; 
  }
}

export async function executeGenerateEmbedding(req: Request, res: Response): Promise<any> {
  return withSecureApiEndpoint(req, res, async (uid): Promise<void> => {
    // 1. Verifica utente nel DB
    const userSnap = await db.collection("register").doc(uid).get();
    if (!userSnap.exists) {
      res.status(404).json({ error: "Not Found" });
      return;
    }

    // 2. Validazione unificata piano e consumo quote/rate limit (feature "embedding")
    await validateUserPlanAndLimits(uid, "embedding", userSnap);

    // 3. Validazione e sanitizzazione input
    const body = (req.body ?? {}) as GenerateEmbeddingRequestBody;
    const textRaw = typeof body.text === "string" ? body.text : "";

    if (!textRaw.trim()) {
      res.status(400).json({ error: "Bad Request: Invalid or missing 'text' field" });
      return;
    }

    // Troncamento di sicurezza per prevenire token exhaustion / DoS sull'API OpenAI
    const textToEmbed = textRaw.trim().substring(0, 10000); // Max 10k caratteri

    // 4. Chiamata a OpenAI per l'embedding
    const oaApiKey = process.env.OPENAI_API_KEY;
    if (!oaApiKey) {
      console.error("[JURIO-EMBEDDING] OPENAI_API_KEY non configurata nei secrets.");
      res.status(500).json({ error: "Internal Server Error" });
      return;
    }

    const oaClient = new OpenAI({ apiKey: oaApiKey });
    const embeddingResponse = await oaClient.embeddings.create({
      model: "text-embedding-3-small", 
      input: textToEmbed,
      dimensions: 1536 // Manteniamo la coerenza con i vettori attuali di Firestore
    });

    const vectorArray = embeddingResponse.data[0]?.embedding;
    
    if (!Array.isArray(vectorArray) || vectorArray.length === 0) {
      res.status(500).json({ error: "Failed to generate embedding vector." });
      return;
    }

    // 5. Risposta al client
    const responsePayload: GenerateEmbeddingResponse = {
      vector: vectorArray,
      status: "SUCCESS"
    };

    res.status(200).json(responsePayload);
  });
}