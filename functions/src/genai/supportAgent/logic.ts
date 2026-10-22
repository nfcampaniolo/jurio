import { Request, Response } from "express";
import OpenAI from "openai";
import { corsHandlerDomain, requireAppCheck, consumePerMinuteFeature, consumeDailyFeature, withSecureApiEndpoint, validateUserPlanAndLimits  } from "../../_utils";
import { hashIpForRateLimiting } from "../_utils";
import { legalAgentSupport } from "./flow";
import { extractAndSaveFascicoloMetadata } from "./_metadata";
import { JURIO_USAGE_LIMITS, JurioFeatureType } from "../../_constants";
import { MessageDoc, SupportRequestBody, GenerateEmbeddingRequestBody, GenerateEmbeddingResponse } from "../_interfaces";
import { FirestoreEvent, QueryDocumentSnapshot } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import { getDb } from "../../_deps";
import { logSafeError } from "../../_logging";

const db = getDb();
// Il trigger parte dal messaggio utente ma l'estrazione analizza l'intero thread
const MAX_THREAD_MESSAGES = 100;
const MAX_CONTEXT_CHARS = 40_000;

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
      console.warn("[JURIO-SUPPORT] Accesso fallito AppCheck");
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (rateLimitResult.status === "rejected") {
      console.warn("[JURIO-SUPPORT] Rate limit superato");
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

    req.on('aborted', () => {
      clientDisconnected = true;
    });
    res.on('close', () => {
      if (!res.writableEnded) {
        clientDisconnected = true;
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
      logSafeError("SUPPORT_STREAM_FAILED", msg);

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
  // I messaggi importati da una chat vengono analizzati una sola volta dalla migrazione
  if ((messageData as { migrated?: boolean }).migrated) return;

  // Messaggi troppo brevi (es. "ok", "grazie") non portano informazioni sul caso
  if (typeof messageData.content !== "string" || messageData.content.trim().length < 20) return;

  const { fascicoloId, threadId } = event.params;

  try {
    // Limite di frequenza: al massimo un'estrazione ogni 60s per fascicolo, anche con più messaggi ravvicinati
    const fascicoloRef = db.collection("fascicoli").doc(fascicoloId);
    const checkedAt = (await fascicoloRef.get()).data()?.metadatiCheckedAt;
    const lastMs = typeof checkedAt?.toMillis === "function" ? checkedAt.toMillis() : 0;
    const messagesRef = db.collection("fascicoli").doc(fascicoloId)
                          .collection("threads").doc(threadId)
                          .collection("messages");

    // Invece di scartare il messaggio ravvicinato, attende la fine della finestra: così le informazioni più recenti non vanno perse
    const waitMs = 60_000 - (Date.now() - lastMs);
    if (waitMs > 0) {
      if (waitMs > 90_000) return;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      // Se nel frattempo è arrivato un messaggio utente più recente, ci pensa la sua invocazione
      const recent = await messagesRef.orderBy("timestamp", "desc").limit(5).get();
      const newestUser = recent.docs.find((d) => d.data().role !== "model");
      if (newestUser && newestUser.id !== snapshot.id) return;
    }
    await fascicoloRef.set({ metadatiCheckedAt: admin.firestore.Timestamp.now() }, { merge: true });

    const historySnap = await messagesRef
      .orderBy("timestamp", "desc")
      .limit(MAX_THREAD_MESSAGES)
      .get();

    const chatContext = historySnap.docs
      .map(doc => {
        const data = doc.data() as MessageDoc;
        // Si tronca per messaggio invece di scartare l'intero contesto; i dati dell'utente hanno più spazio
        const maxChars = data.role === "model" ? 1500 : 3000;
        const safeContent = typeof data.content === "string" ? data.content.trim().substring(0, maxChars) : "";
        const ruolo = data.role === "model" ? "IA" : "UTENTE";
        return `${ruolo}: ${safeContent}`;
      })
      .reverse()
      .join("\n\n");

    if (!chatContext) return;

    // Protezione da costi eccessivi: contesto limitato agli ultimi MAX_CONTEXT_CHARS caratteri
    const updated = await extractAndSaveFascicoloMetadata(fascicoloId, chatContext.slice(-MAX_CONTEXT_CHARS));
    console.log(`[JURIO-METADATA] Analizzati ${historySnap.size} messaggi, chiavi aggiornate: ${updated}`);

  } catch (error) {
    // Nessun rethrow: un errore (es. 429) non deve far rieseguire il trigger in loop
    logSafeError("SUPPORT_METADATA_EXTRACTION_FAILED", error);
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