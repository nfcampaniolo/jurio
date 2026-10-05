import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2/options";
import { Timestamp, FieldValue, Query, WriteBatch } from "firebase-admin/firestore";
import { getAdmin, getDb, getAdminAuth, getAdminStorage, sanitize } from "./deps";
import { MAX_INPUT_CHARS, PROMPT_MASSIMAZIONE } from "./params";
import { enqueueWelcomeEmail, enqueueTrialEmail, queuePurchaseEmailOnceStripe, enqueueDowngradeEmail, enqueueContactEmail, enqueueVoucherEmail, enqueueWelcomeTeamEmail, enqueueRemoveTeamEmail, enqueueCloseTeamEmail, dispatchMailAndNotification, NotificationType } from "./email";
import { corsHandlerDomain, requireAppCheck, requireUidFromAuthHeader, consumePerMinuteFeature, consumeDailyFeature, getKeywordStems, calculateMatchScore, applyHighlightWithRegex, generateHighlightRegex, runUpdateFonte, runUpdateMetadata, runCleanupDuplicates, processFascicoloDocs, processSubscriptionInTx, tryScheduleDowngradeTask, updateUserDocuments, removeUserVisibilityFromDocuments, incrementRagCounter, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, PlanDoc, getStripe, getWebhookSecret,normalizePlanId, handleEmbeddingCreation, handleEmbeddingDocumentCreation, handleFascicoloCreation, handleEmbeddingManualCreation} from "./utils";
import { scheduleDowngradeTask, DowngradeTxResult, computeAndSaveWeeklyStats, computeAndSaveMonthlyUsage } from "./tasks";
import {FilterInput, SearchRequestBody, ScoredJurioItem, JurioSentenceDoc, MessageDoc, FascicoloDoc, ExtractedMetadataItem, EstraiMetadatiResult, SupportRequestBody, ReasoningRequestBody, ReasoningFlowOutput, PromptFieldInput, PromptAgentRequestBody, EnhancePromptMessage, EnhancePromptRequestBody, MaintenanceTaskBody, ProgressCallback, MergeCategoryRequestBody, ReasoningAdminResponse, ReasoningAdminRequestBody, ManualContentRequestBody, SubmitFeedbackRequestBody, DeepAnalysisRequestBody, DeepAnalysisConfig, DEFAULT_CONFIG, AdminNotificationRequestBody, GenerateEmbeddingRequestBody, GenerateEmbeddingResponse, ExtractDocumentRequestBody, GetRegisterResponse, GetPriceRequestBody, GetPriceResponse, CheckoutSessionRequestBody, SyncUserSessionResponse, ForceTakeoverSessionResponse, AssignTeamSeatRequestBody, AssignTeamSeatResponse, SendTeamInviteEmailResponse, SendTeamInviteEmailRequestBody, ShareAllTeamDocumentsResponse, ShareAllTeamDocumentsRequestBody, VerifyVoucherRequestBody, VerifyVoucherResponse, RemoveTeamMemberRequestBody, RemoveTeamMemberResponse, ApplyCouponRequestBody, ApplyCouponResponse, DeleteTeamResponse, DeleteTeamRequestBody, CloudFileDownloadRequestBody, CloudFilesListRequestBody} from "./interfaces";
import { onDocumentCreated, onDocumentWritten } from "firebase-functions/v2/firestore";
import OpenAI from "openai";
import Stripe from "stripe";
import { SpeechClient } from "@google-cloud/speech";
import { legalAgentFlow, legalAgentSupport, legalGeminiFallbackFlow, reasoningFlow, estraiMetadatiFlow, wordQuoteFlow, wordReviewFlow, promptBuilderFlow, researchAnalysisFlow, refineResearchFlow, generateSynthesisReportFlow, enhancePromptFlow } from './genkit/flows';
import { onSchedule } from "firebase-functions/v2/scheduler"; 
// @ts-ignore
import pdfExtract from "pdf-extraction";
import * as busboyModule from "busboy";
import { google } from "googleapis";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpServer } from "./mcpServer";
import { createHash, randomBytes, randomUUID } from "crypto";

import express from "express";
import cors from "cors";

const Busboy = busboyModule.default || busboyModule;
const db = getDb();
const admin = getAdmin();
const MAX_NOTES_CHARS = 2000;

let oaClient: OpenAI;
let speechClientInstance: SpeechClient | null = null;

setGlobalOptions({
  region: "europe-west1",
  timeoutSeconds: 300,
  memory: "1GiB",
  invoker: "public"
});

// ============================================================================
// MCP SERVER (EXPRESS)
// ============================================================================

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

// Normalizza le richieste: rimuove il prefisso /mcp se presente
app.use((req, res, next) => {
  if (req.url.startsWith("/mcp/")) {
    req.url = req.url.replace(/^\/mcp/, "");
  } else if (req.url === "/mcp") {
    req.url = "/";
  }
  next();
});

// 1. Server Card
app.get(["/.well-known/mcp/server-card", "/.well-known/mcp/server-card/"], (req, res) => {
  res.status(200).json({
    name: "Jurio MCP Server",
    version: "1.0.4",
    description: "Server MCP per la ricerca nella giurisprudenza italiana",
  });
});

// 2. Protected Resource (RFC 9723)
app.get([
  "/.well-known/oauth-protected-resource",
  "/.well-known/oauth-protected-resource/",
  "/.well-known/oauth-protected-resource/mcp"
], (req, res) => {
  res.status(200).json({
    resource: "https://jurio.it/mcp",
    authorization_servers: ["https://jurio.it/mcp"]
  });
});

// 3. Authorization Server Metadata (RFC 8414 & OpenID Discovery)
app.get([
  "/.well-known/oauth-authorization-server",
  "/.well-known/oauth-authorization-server/",
  "/.well-known/oauth-authorization-server/mcp",
  "/.well-known/openid-configuration",
  "/.well-known/openid-configuration/",
  "/.well-known/openid-configuration/mcp"
], (req, res) => {
  res.status(200).json({
    issuer: "https://jurio.it/mcp",
    authorization_endpoint: "https://jurio.it/mcp/authorize",
    token_endpoint: "https://jurio.it/mcp/token",
    registration_endpoint: "https://jurio.it/mcp/register",
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256", "plain"]
  });
});

// 4. Dynamic Client Registration (RFC 7591)
app.post("/register", (req, res) => {
  res.status(201).json({
    client_id: "jurio_claude_client_id_auto",
    client_secret: "jurio_secret_dummy",
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_secret_expires_at: 0,
    grant_types: ["authorization_code"],
    response_types: ["code"],
    redirect_uris: req.body?.redirect_uris || [],
    token_endpoint_auth_method: "client_secret_post"
  });
});

// 5. OAuth Authorize
app.get("/authorize", (req, res) => {
  const { client_id, redirect_uri, state, response_type } = req.query;
  if (response_type !== "code") {
    res.status(400).send("Unsupported response_type. Must be 'code'.");
    return;
  }
  const loginUrl = new URL("https://jurio.it/oauth-login");
  if (client_id) loginUrl.searchParams.append("client_id", String(client_id));
  if (redirect_uri) loginUrl.searchParams.append("redirect_uri", String(redirect_uri));
  if (state) loginUrl.searchParams.append("state", String(state));
  res.redirect(302, loginUrl.toString());
});

// 6. OAuth Token Exchange
app.post("/token", async (req, res) => {
  const code = req.body?.code || req.query?.code;
  const grant_type = req.body?.grant_type || req.query?.grant_type;

  if (grant_type !== "authorization_code" || !code) {
    res.status(400).json({ error: "unsupported_grant_type" });
    return;
  }

  try {
    const codeRef = db.collection("oauth_codes").doc(code as string);
    const codeSnap = await codeRef.get();

    if (!codeSnap.exists) {
      res.status(401).json({ error: "invalid_grant", error_description: "Codice non valido o scaduto" });
      return;
    }

    await codeRef.delete();
    const accessToken = randomBytes(32).toString("hex");

    const expireDate = new Date();
    expireDate.setFullYear(expireDate.getFullYear() + 1);

    await db.collection("oauth_tokens").doc(accessToken).set({
      uid: codeSnap.data()?.uid,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Timestamp.fromDate(expireDate),
      client_id: req.body?.client_id || req.query?.client_id || "claude_web"
    });

    res.status(200).json({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: 31536000,
    });
  } catch (err) {
    console.error("[JURIO-MCP] Errore scambio token:", err);
    res.status(500).json({ error: "server_error" });
  }
});

// 7. MCP Protocol Transport (protetto da Bearer token)
app.use(async (req, res) => {
  if (req.method === "OPTIONS") { 
    res.status(204).end(); 
    return; 
  }

  const authHeader = typeof req.headers?.authorization === "string" ? req.headers.authorization : "";

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.set("WWW-Authenticate", 'Bearer realm="jurio", error="unauthorized"');
    res.status(401).json({
      error: "unauthorized",
      message: "Autenticazione richiesta per utilizzare Jurio MCP."
    });
    return;
  }

  const server = createMcpServer(authHeader);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => {
    transport.close().catch(console.error);
  });

  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    console.error("[JURIO-MCP] Errore MCP:", error);
    if (!res.headersSent) res.status(500).json({ error: "MCP server error" });
  }
});

export const jurioMcpServer = onRequest(
  { timeoutSeconds: 300, memory: "512MiB" },
  app
);

// ============================================================================
// AI ENDPOINTS
// ============================================================================

export const vectorSearchJurio = onRequest(
  {
    secrets: ["OPENAI_API_KEY", "GOOGLE_GENAI_API_KEY"],
    timeoutSeconds: 75,
    memory: "2GiB",
    cpu: 1,
    concurrency: 80
  },
  async (req, res) => {
    return corsHandlerDomain(req, res, async () => {
      if (req.method === "OPTIONS") return res.status(204).end();
      if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

      // Istanziazione Lazy e Sicura del client
      if (!oaClient && process.env.OPENAI_API_KEY) {
        oaClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      } else if (!oaClient) {
        console.error("[JURIO-SEARCH] OPENAI_API_KEY mancante nel Secret Manager.");
        return res.status(500).json({ error: "Internal Server Error" });
      }

      try {
        // 2) INPUT SANITIZATION & DATA MINIMIZATION
        const body = (req.body ?? {}) as SearchRequestBody;
        const queryText = typeof body.query === "string" ? body.query.trim() : "";

        // Prevenzione attacchi di saturazione token (es. payload enormi mandati a OpenAI)
        if (!queryText || queryText.length > 1500) {
          return res.status(400).json({ error: "Bad Request: Invalid or excessively long 'query'" });
        }

        const requestedLimit = Number(body.limit);
        const limit = Number.isFinite(requestedLimit)
          ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100)
          : 50;

        const filters: FilterInput[] = Array.isArray(body.filters) ? body.filters : [];
        
        // FORZATURA COLLECTION 
        const collectionName = "sentences";

        // 3) PREPARAZIONE NLP INIZIALE
        let kwObjects = getKeywordStems(queryText);
        let originalKws = kwObjects.map((k: { original: string }) => k.original);
        let stemsList = kwObjects.map((k: { stem: string }) => k.stem);

        const totalKeywords = kwObjects.length;
        let minRequiredKeywords = Math.max(1, Math.ceil(totalKeywords * 0.8));

        // 4) AUTH BASE CON SEGREGAZIONE ERRORI
        let uid: string = "";
        const authHeader = req.headers.authorization || "";
        const token = authHeader.replace("Bearer ", "").trim();
        let isOAuthRequest = false;

        if (token) {
          const [tokenSnap, directUserSnap] = await Promise.all([
            db.collection("oauth_tokens").doc(token).get(),
            db.collection("register").doc(token).get()
          ]);

          if (tokenSnap.exists) {
            uid = String(tokenSnap.data()?.uid || "");
            isOAuthRequest = true;
          } else if (directUserSnap.exists) {
            uid = token;
            isOAuthRequest = true;
          }
        }

        // Se non è OAuth (B2B), esigiamo App Check (Anti-Fraud) e Auth Header Standard
        if (!isOAuthRequest || !uid) {
          try {
            await requireAppCheck(req);
            uid = await requireUidFromAuthHeader(req);
          } catch (authError) {
            console.warn(`[JURIO-SEARCH] Fallimento AppCheck/Auth per IP: ${req.ip}`);
            return res.status(401).json({ error: "Unauthorized" });
          }
        }

        if (!uid) {
          return res.status(401).json({ error: "Unauthorized" });
        }
        
        const limits = { perMinute: 20, perDay: 200 };
         
        // 5) ESECUZIONE PARALLELA SICURA (OpenAI + Firebase Auth/Rate Limits)
        const [embeddingPromiseResult, userSnap] = await Promise.all([
          oaClient.embeddings.create({
            model: "text-embedding-3-small",
            input: `Contesto giuridico italiano: ${queryText}`,
            dimensions: 1536,
          }),
          db.collection("register").doc(uid).get(),
          consumePerMinuteFeature(uid, "research", limits.perMinute),
          consumeDailyFeature(uid, "research", limits.perDay)
        ]);

        // VERIFICA PIANO UTENTE
        if (!userSnap.exists) {
          return res.status(404).json({ error: "Not Found" }); // Non riveliamo dettagli sull'assenza dell'utente
        }
        
        const planId = String(userSnap.data()?.planId ?? "");
        const allowedPlans = new Set([
          "prova", "admin", "business", "personale", "business_m", "personale_m",
        ]);

        if (!allowedPlans.has(planId)) {
          return res.status(403).json({ 
            error: "Forbidden", 
            message: "Piano non abilitato alla ricerca." 
          });
        }
        
        const queryVector = embeddingPromiseResult.data[0].embedding;

        // 6) COSTRUZIONE QUERY TYPE-SAFE
        let baseQuery: FirebaseFirestore.Query<FirebaseFirestore.DocumentData> = db.collection(collectionName).select(
          "tipo_documento", "fonte", "logo_fonte", "organo_giudicante", "sezione", 
          "numero_sentenza", "dataSentenza", "data_sentenza", "ecli", "urn",
          "tipo_ordinanza", "efficacia_temporale", "misura_disposta", "fumus_boni_iuris", "periculum_in_mora",
          "tipo_decreto", "contraddittorio", "autorita_monocratica", "contenuto_precettivo",
          "massima", "summary", "fattispecie_rilevante"
        );

        // PREPARAZIONE FILTRI
        const appliedFilters = filters.reduce((q: FirebaseFirestore.Query, f: FilterInput) => {
          if (f && typeof f.field === "string" && typeof f.operator === "string" && f.value !== undefined) {
            let queryValue = f.value;
            
            // Gestione sicura dei Timestamp serializzati dal client
            if (
              f.value && 
              typeof f.value === "object" && 
              f.value !== null &&
              (("type" in f.value && f.value.type === "firestore/timestamp/1.0") || "seconds" in f.value)
            ) {
              const valAsObj = f.value as { seconds?: number, nanoseconds?: number };
              if (typeof valAsObj.seconds === "number") {
                queryValue = new Timestamp(valAsObj.seconds, valAsObj.nanoseconds || 0);
              }
            }
            return q.where(f.field, f.operator, queryValue);
          }
          return q;
        }, baseQuery);

        // HELPER DI RICERCA INTERNO
        const performSearchAndScoring = async (vector: number[], currentKwObjects: any[]): Promise<ScoredJurioItem[]> => {
          const candidateLimit = Math.min(Math.max(limit * 2, 50), 100);
        
          // FIRMA AGGIORNATA findNearest
          const sSnap = await appliedFilters
            .findNearest({
              vectorField: "embedding",
              queryVector: FieldValue.vector(vector),
              limit: candidateLimit,
              distanceMeasure: "COSINE",
              distanceResultField: "distance"
            })
            .get();

          const maxScoringCandidates = Math.min(limit * 2, 40); 
          const candidateDocs = sSnap.docs.slice(0, maxScoringCandidates);

          const MAX_CHARS = 10000;
          const safeTruncate = (text: unknown): string | null => 
            typeof text === "string" && text.length > 0 ? text.substring(0, MAX_CHARS) : null;

          return candidateDocs
            .map((doc: FirebaseFirestore.QueryDocumentSnapshot) => {
              const data = doc.data() as JurioSentenceDoc;
              const content = [data.summary, data.massima, data.fattispecie_rilevante]
                .filter(Boolean)
                .join(" ");

              const scores = calculateMatchScore(content, currentKwObjects, data);
              
              // Lettura sicura del campo distance generato da distanceResultField
              const distanceData = doc.data() as { distance?: number };
              const baseDistance = typeof distanceData.distance === "number" ? distanceData.distance : 0.8;

              let rankingDistance = scores.textMatchScore === 0
                  ? baseDistance * 1.25
                  : baseDistance * Math.pow(0.96, scores.textMatchScore);

              rankingDistance -= (scores.authorityBonus ?? 0) + (scores.recencyBonus ?? 0);
              rankingDistance = Math.max(0.001, rankingDistance);

              return {
                id: doc.id,
                url: `https://jurio.it/giurisprudenza/${doc.id}`,
                tipo_documento: data.tipo_documento || "sentenza",
                fonte: data.fonte || null,
                logo_fonte: data.logo_fonte || null,
                organo_giudicante: data.organo_giudicante || null,
                sezione: data.sezione || null,
                numero_sentenza: data.numero_sentenza || null,
                
                // Mappa entrambi i campi per soddisfare l'interfaccia
                dataSentenza: data.dataSentenza || data.data_sentenza || null,
                data_sentenza: data.data_sentenza || data.dataSentenza || null,
                
                ecli: data.ecli || null,
                urn: data.urn || null,
                tipo_ordinanza: data.tipo_ordinanza || null,
                efficacia_temporale: data.efficacia_temporale || null,
                misura_disposta: data.misura_disposta || null,
                fumus_boni_iuris: data.fumus_boni_iuris || null,
                periculum_in_mora: data.periculum_in_mora || null,
                tipo_decreto: data.tipo_decreto || null,
                contraddittorio: data.contraddittorio !== undefined && data.contraddittorio !== null ? data.contraddittorio : null,
                autorita_monocratica: data.autorita_monocratica !== undefined && data.autorita_monocratica !== null ? data.autorita_monocratica : null,
                contenuto_precettivo: data.contenuto_precettivo || null,
                massima: safeTruncate(data.massima),
                summary: safeTruncate(data.summary),
                fattispecie_rilevante: safeTruncate(data.fattispecie_rilevante),
                _matchCount: Math.floor(scores.textMatchScore ?? 0),
                _distance: baseDistance,
                _rankingDistance: rankingDistance,
                _source: "direct" as const,
              };
            })
            .filter((item) => item._matchCount > 0 || item._distance <= 0.75)
            .sort((a, b) => a._rankingDistance - b._rankingDistance);
        };

        // 7) PRIMA RICERCA VETTORIALE
        let scoredItems = await performSearchAndScoring(queryVector, kwObjects);

        // 8) FALLBACK GEMINI TRAMITE GENKIT FLOW
        let geminiResponsePayload: { sintesi: string, queryAlternativa: string } | null = null;
        const FALLBACK_THRESHOLD = 0.7; 
        const needsFallback = scoredItems.length === 0 || scoredItems[0]._rankingDistance > FALLBACK_THRESHOLD;

        // Eseguiamo fallback solo se non è richiesta B2B (OAuth) per evitare latenza API esterne
        if (needsFallback && !isOAuthRequest) {
          try {
            const fallbackResult = await legalGeminiFallbackFlow({ query: queryText });
            
            if (fallbackResult && typeof fallbackResult.sintesi === "string" && typeof fallbackResult.queryAlternativa === "string") {
              geminiResponsePayload = {
                sintesi: fallbackResult.sintesi,
                queryAlternativa: fallbackResult.queryAlternativa,
              };

              const altQueryText = fallbackResult.queryAlternativa;
              kwObjects = getKeywordStems(altQueryText); 
              originalKws = kwObjects.map((k: { original: string }) => k.original);
              stemsList = kwObjects.map((k: { stem: string }) => k.stem);
              minRequiredKeywords = Math.max(1, Math.ceil(kwObjects.length * 0.8));

              const altEmbeddingRes = await oaClient.embeddings.create({
                model: "text-embedding-3-small",
                input: `Contesto giuridico italiano: ${altQueryText}`,
                dimensions: 1536,
              });
              
              const altScoredItems = await performSearchAndScoring(altEmbeddingRes.data[0].embedding, kwObjects);

              if (altScoredItems.length > 0) {
                scoredItems = altScoredItems.map((item) => ({
                  ...item,
                  _source: "gemini_fallback",
                }));
              }
            }
          } catch (geminiErr) {
            console.error(`[JURIO-SEARCH] Errore fallback Genkit per UID ${uid}:`, geminiErr);
            // Non blocchiamo il flusso in caso di errore Gemini, ritorniamo i risultati base (se ci sono)
          }
        }

        // 9) OUTPUT & LAZY HIGHLIGHTING
        const highlightRegex = generateHighlightRegex(originalKws, stemsList);
        const limitedItems = scoredItems.slice(0, limit);

        const finalItems = limitedItems.map((item) => ({
          ...item,
          highlighted_massima: item.massima
            ? applyHighlightWithRegex(item.massima, highlightRegex)
            : null,
          highlighted_fattispecie: item.fattispecie_rilevante
            ? applyHighlightWithRegex(item.fattispecie_rilevante, highlightRegex)
            : null,
          highlighted_preview: item.summary
            ? applyHighlightWithRegex(item.summary, highlightRegex)
            : null,
        }));

        const topMatches = finalItems.filter((item) => item._matchCount >= minRequiredKeywords);
        const regularMatches = finalItems.filter((item) => item._matchCount < minRequiredKeywords);
        const extractedIds = finalItems.map((d) => d.id);
        
        if (extractedIds.length > 0) {
          // Fire & forget: non blocchiamo la risposta del client per contare le stat
          incrementRagCounter(collectionName, extractedIds).catch(err => 
            console.error("[JURIO-SEARCH] Errore incremento contatore RAG:", err)
          );
        }

        return res.status(200).json({
          ids: extractedIds,
          topMatches,
          allMatches: regularMatches,
          status: geminiResponsePayload ? "GEMINI_FALLBACK" : "SUCCESS",
          webFallback: geminiResponsePayload,
          metadata: {
            total: scoredItems.length,
            keywords: originalKws,
            threshold: minRequiredKeywords,
            bestDistance: scoredItems.length > 0 ? scoredItems[0]._rankingDistance : null,
          },
        });

      } catch (err) {
        // 10) ANTI INFORMATION DISCLOSURE
        console.error("[JURIO-SEARCH] Errore non gestito:", err);
        return res.status(500).json({ error: "Internal Server Error" });
      }
    });
  }
);

export const legalAgent = onRequest(
  { 
    secrets: ["GOOGLE_GENAI_API_KEY", "OPENAI_API_KEY", "TAVILY_API_KEY"],
    timeoutSeconds: 300,
    memory: "2GiB",
    concurrency: 80 // Consigliato per scalare meglio su singola istanza
  }, 
  async (req, res) => {
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

     try {
        await requireAppCheck(req);
        const uid = await requireUidFromAuthHeader(req);

        const { prompt, context, filters, docs, metadatiFascicolo, action, old_chat_uuid, new_fascicolo_uuid, title } = req.body;
        
        // GESTIONE MIGRAZIONE 
        if (action === "migrate") {
          const batch = db.batch();
          const oldChatDoc = await db.collection('chats').doc(old_chat_uuid).get();
          const oldChatTitle = oldChatDoc.data()?.title || "Conversazione importata";
          const oldChatRef = db.collection('chats').doc(old_chat_uuid).collection('messages');
          const oldChatSnap = await oldChatRef.get();
          
          batch.set(db.collection('fascicoli').doc(new_fascicolo_uuid), {
            ownerId: uid, title: title || oldChatTitle,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          }, { merge: true });

          if (!oldChatSnap.empty) {
            const threadRef = db.collection('fascicoli').doc(new_fascicolo_uuid).collection('threads').doc(old_chat_uuid);
            batch.set(threadRef, { title: oldChatTitle, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            
            const newMsgRef = threadRef.collection('messages');
            oldChatSnap.forEach((doc) => {
              const data = doc.data();
              batch.set(newMsgRef.doc(doc.id), { ...sanitize(data), timestamp: data.timestamp || data.createdAt || admin.firestore.FieldValue.serverTimestamp() });
              batch.delete(doc.ref);
            });
            batch.delete(db.collection('chats').doc(old_chat_uuid));
          }
          await batch.commit();
          res.status(200).json({ success: true });
          return;
        }

        const isFascicolo = context?.type === 'fascicolo';
        const fascicoloId = isFascicolo ? context.fascicolo_uuid : null;
        const parentId = isFascicolo ? context.fascicolo_uuid : context.chat_uuid;
        const threadId = isFascicolo ? context.thread_uuid : null;

        if (!parentId || typeof parentId !== 'string') { res.status(400).json({ error: "Bad Request", details: "Identificativo sessione mancante." }); return; }

        let messagesRef: FirebaseFirestore.CollectionReference;
        const backgroundTasks: Promise<any>[] = []; // Gestione sicura dei task pendenti

        if (isFascicolo && threadId) {
          messagesRef = db.collection('fascicoli').doc(parentId).collection('threads').doc(threadId).collection('messages');
          backgroundTasks.push(processFascicoloDocs(fascicoloId!, docs || []).catch(e => console.error("Errore processFascicoloDocs:", e)));
        } else {
          messagesRef = db.collection('chats').doc(parentId).collection('messages');
        }

        const userPromise = db.collection("register").doc(uid).get();
        const historyPromise = messagesRef.orderBy('timestamp', 'desc').limit(6).get();

        const [userSnap, historySnap] = await Promise.all([userPromise, historyPromise]);

        if (!userSnap.exists) { res.status(404).json({ error: "User not found" }); return; }
        const planId = String(userSnap.data()?.planId ?? "");
        if (!["prova", "admin", "business", "business_m"].includes(planId)) { res.status(403).json({ error: "Access denied" }); return; }

        const limits = planId === "prova" ? { perMinute: 5, perDay: 20 }
                     : ["business", "business_m"].includes(planId) ? { perMinute: 20, perDay: 200 }
                     : { perMinute: 60, perDay: 10_000 };
        
        // RATE LIMITING NON BLOCCANTE (Eseguito in background)
        backgroundTasks.push(
          Promise.all([
            consumePerMinuteFeature(uid, "legal_agent" as any, limits.perMinute),
            consumeDailyFeature(uid, "legal_agent" as any, limits.perDay)
          ]).catch(e => console.error("Errore limiti:", e))
        );

        const dbHistory = historySnap.docs.map((doc) => {
          const data = doc.data();
          return { role: String(data.role || 'user'), content: String(data.content || '') };
        }).reverse();
        const isFirstMessage = historySnap.empty;

        // FLUSH HEADER SSE: Apre la connessione istantaneamente
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders(); 

        const flowStream = legalAgentFlow.stream({
          prompt, filters, docs: docs || [], history: dbHistory, isFirstMessage, userId: uid, fascicoloId: fascicoloId, metadatiFascicolo: metadatiFascicolo || {}
        });

        for await (const chunk of flowStream.stream) {
          res.write(`data: ${JSON.stringify({ message: chunk })}\n\n`);
        }

        const finalOutput = await flowStream.output; 
        const sanitizedResult = sanitize(finalOutput);
        
        res.write(`data: ${JSON.stringify({ result: sanitizedResult })}\n\n`);
        res.write(`data: [DONE]\n\n`);
        res.end();

        // PREPARAZIONE BATCH UPDATE
        const batch = db.batch();
        batch.set(messagesRef.doc(), { role: 'user', content: prompt, timestamp: admin.firestore.FieldValue.serverTimestamp() });
        batch.set(messagesRef.doc(), { role: 'model', content: sanitizedResult.risposta, sources: sanitizedResult.fonti || [], timestamp: admin.firestore.FieldValue.serverTimestamp() });
        
        const parentRef = db.collection(isFascicolo ? 'fascicoli' : 'chats').doc(parentId);
        const parentUpdate: any = { updatedAt: admin.firestore.FieldValue.serverTimestamp(), ownerId: uid };

        if (isFirstMessage && sanitizedResult.titoloGenerato) {
          if (isFascicolo && threadId) {
            batch.set(db.collection('fascicoli').doc(parentId).collection('threads').doc(threadId), { title: sanitizedResult.titoloGenerato, createdAt: admin.firestore.FieldValue.serverTimestamp(), updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            if (context.title) parentUpdate.title = context.title;
          } else {
            parentUpdate.title = sanitizedResult.titoloGenerato;
          }
        }
        if(isFascicolo && threadId) {
          batch.set(db.collection('fascicoli').doc(parentId).collection('threads').doc(threadId), { updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        }
        
        batch.set(parentRef, parentUpdate, { merge: true });

        // Aggiungiamo la scrittura DB ai task in background e attendiamo la fine sicura
        backgroundTasks.push(batch.commit().catch(e => console.error("Errore batch:", e)));
        await Promise.all(backgroundTasks);

      } catch (err: any) {
        const msg = err instanceof Error ? err.message : "Internal error";
        console.error("ERRORE CRITICO LEGAL AGENT:", err);

        if (res.headersSent) {
          res.write(`data: ${JSON.stringify({ error: { message: msg } })}\n\n`);
          res.end();
        } else {
          res.status(500).json({ error: "Process failed", details: msg });
        }
      }
    });
  }
);

export const deepAnalysisAgent = onRequest(
  { 
    secrets: ["GOOGLE_GENAI_API_KEY", "OPENAI_API_KEY", "TAVILY_API_KEY"],
    timeoutSeconds: 540,
    memory: "2GiB",
    concurrency: 80 
  }, 
  async (req, res) => {
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

      try {
        await requireAppCheck(req);
        const uid = await requireUidFromAuthHeader(req);

        const body = req.body as DeepAnalysisRequestBody;
        const { action, sessionId, prompt, direttivaHitl, docs, config } = body;

        if (!action || !["start_research", "refine_research", "generate_synthesis"].includes(action)) { 
          res.status(400).json({ error: "Bad Request", details: "Action non valida." }); 
          return; 
        }
        if (!sessionId || typeof sessionId !== "string") {
          res.status(400).json({ error: "Bad Request", details: "SessionId mancante o non valido." }); 
          return;
        }

        const userSnap = await admin.firestore().collection("register").doc(uid).get();
        if (!userSnap.exists) { 
          res.status(404).json({ error: "User not found" }); 
          return; 
        }
        
        const planId = String(userSnap.data()?.planId ?? "");
        if (!["admin", "personale", "personale_m", "business", "business_m"].includes(planId)) { 
          res.status(403).json({ error: "Access denied." }); 
          return; 
        }

        const sessionRef = admin.firestore().collection("deep_analysis_sessions").doc(sessionId);
        const sessionSnap = await sessionRef.get();

        // ─── AZIONE 1: START ──────────────────────────────────────────
        if (action === "start_research") {
          if (!prompt || typeof prompt !== "string") {
            res.status(400).json({ error: "Bad Request", details: "Prompt mancante per start_research." });
            return;
          }

          // 1. CONTROLLO QUOTE IMMEDIATO (Lancia errore se superate bloccando il flusso)
          await Promise.all([
            consumePerMinuteFeature(uid, "deep_analysis" as any, 10),
            consumeDailyFeature(uid, "deep_analysis" as any, 30)
          ]);

          const resolvedConfig: DeepAnalysisConfig = {
            ...DEFAULT_CONFIG,
            ...(config || {}),
          };

          const output = await researchAnalysisFlow({
            prompt, 
            docs: docs || [], 
            userId: uid, 
            config: resolvedConfig
          });
          
          await sessionRef.set(
            sanitize({
              user: uid,
              title: prompt.substring(0, 30) + "...",
              status: "review",
              promptOriginale: prompt,
              documentiAllegati: docs || [],
              configurazione: config || {},
              inquadramento: output.inquadramento,
              mappaDialettica: output.mappaDialettica,
              updatedAt: admin.firestore.FieldValue.serverTimestamp(),
              createdAt: sessionSnap.exists ? sessionSnap.data()?.createdAt : admin.firestore.FieldValue.serverTimestamp()
            }), 
            { merge: true }
          );

          res.status(200).json({ success: true, status: "review" });
          return;
        }

        // ─── AZIONE 2: REFINE / HITL ──────────────────────────────────
        if (action === "refine_research") {
          if (!sessionSnap.exists) { 
            res.status(404).json({ error: "Session not found." }); 
            return; 
          }
          const sessionData = sessionSnap.data();

          // 1. CONTROLLO QUOTE IMMEDIATO
          await Promise.all([
            consumePerMinuteFeature(uid, "deep_analysis" as any, 10),
            consumeDailyFeature(uid, "deep_analysis" as any, 30)
          ]);

          const savedConfig = (sessionData?.configurazione as Partial<DeepAnalysisConfig>) || {};
          const resolvedConfig: DeepAnalysisConfig = {
            ...DEFAULT_CONFIG,
            ...savedConfig,
          };

          const output = await refineResearchFlow({
            originalPrompt: (sessionData?.promptOriginale as string) || "",
            direttivaHitl: direttivaHitl || "Ricerca approfondimenti", 
            currentInquadramento: (sessionData?.inquadramento as Record<string, unknown>) || {},
            currentMappaDialettica: (sessionData?.mappaDialettica as Record<string, unknown>) || {},
            docs: (sessionData?.documentiAllegati as string[]) || [],
            userId: uid,
            config: resolvedConfig
          });

          await sessionRef.update(
            sanitize({
              inquadramento: output.inquadramento,
              mappaDialettica: output.mappaDialettica,
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            })
          );

          res.status(200).json({ success: true, status: "review" });
          return;
        }

        // ─── AZIONE 3: GENERATE SYNTHESIS ─────────────────────────────
        if (action === "generate_synthesis") {
          if (!sessionSnap.exists) { 
            res.status(404).json({ error: "Session not found." }); 
            return; 
          }
          const sessionData = sessionSnap.data();

          // 1. CONTROLLO QUOTE IMMEDIATO
          await Promise.all([
            consumePerMinuteFeature(uid, "deep_analysis" as any, 10),
            consumeDailyFeature(uid, "deep_analysis" as any, 30)
          ]);

          const savedConfig = (sessionData?.configurazione as Partial<DeepAnalysisConfig>) || {};
          const resolvedConfig: DeepAnalysisConfig = {
            ...DEFAULT_CONFIG,
            ...savedConfig,
          };

          const output = await generateSynthesisReportFlow({
            quesitoOriginale: (sessionData?.promptOriginale as string) || "",
            inquadramento: sessionData?.inquadramento || {},
            mappaDialettica: sessionData?.mappaDialettica || {},
            userId: uid,
            config: resolvedConfig
          });

          await sessionRef.update(
            sanitize({
              sintesiStrategica: output,
              status: "completed",
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            })
          );

          res.status(200).json({ success: true, status: "completed" });
          return;
        }

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Internal error";
        console.error("ERRORE CRITICO DEEP ANALYSIS AGENT:", err);
        
        // CATTURA L'ERRORE DELLE QUOTE E RESTITUISCE 429
        if (msg.includes("quota_exceeded")) {
          res.status(429).json({ error: "Quota Exceeded", details: msg });
          return;
        }
        
        if (msg.includes("ToolLoop")) {
          res.status(422).json({ error: "ToolLoop", details: msg });
          return;
        }
        
        res.status(500).json({ error: "Process failed", details: msg });
      }
    });
  }
);

export const wordAgent = onRequest(
  { 
    secrets: ["GOOGLE_GENAI_API_KEY", "OPENAI_API_KEY", "TAVILY_API_KEY"],
    timeoutSeconds: 300,
    memory: "1GiB"
  }, 
  async (req, res) => {
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      // 1. GESTIONE CORS E METODO
      
      if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

      try {
        // 2. AUTH, SICUREZZA E LIMITI
        await requireAppCheck(req);
        const uid = await requireUidFromAuthHeader(req);

        const userSnap = await db.collection("register").doc(uid).get();
        if (!userSnap.exists) { res.status(404).json({ error: "User not found" }); return; }

        const planId = String(userSnap.data()?.planId ?? "");
        if (!["prova", "admin", "business", "business_m"].includes(planId)) { 
          res.status(403).json({ error: "Access denied" }); 
          return; 
        }

        const limits = planId === "prova" ? { perMinute: 5, perDay: 20 }
                     : planId === "business" ? { perMinute: 20, perDay: 200 }
                     : planId === "business_m" ? { perMinute: 20, perDay: 200 }
                     : { perMinute: 60, perDay: 10_000 };
        
        await Promise.all([
          consumePerMinuteFeature(uid, req.body.action+"_agent" as any, limits.perMinute),
          consumeDailyFeature(uid, req.body.action+"_agent" as any, limits.perDay)
        ]);

        // 3. ESTRAZIONE AZIONE
        const action = req.body.action;
        if (!action) {
          res.status(400).json({ error: "Bad Request", details: "Parametro 'action' mancante." });
          return;
        }

        // 4. PREPARAZIONE SSE (Essendo tutte funzioni generative, lo prepariamo a monte)
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // 5. ROUTING DELLE AZIONI
        if (action === "research") {
          // --- AZIONE 1: RICERCA E INSERIMENTO (Il modulo che abbiamo appena costruito) ---
          const { contesto, promptIndirizzamento, filters } = req.body;

          if (!contesto) throw new Error("Il parametro 'contesto' è obbligatorio per l'azione quote.");

          const flowStream = wordQuoteFlow.stream({
            contesto,
            promptIndirizzamento: promptIndirizzamento || "",
            filters: filters || {},
            userId: uid
          });

          for await (const chunk of flowStream.stream) {
            res.write(`data: ${JSON.stringify({ message: chunk })}\n\n`);
          }

          const finalOutput = await flowStream.output;
          const sanitizedResult = sanitize(finalOutput);

          res.write(`data: ${JSON.stringify({ result: sanitizedResult })}\n\n`);
          res.write(`data: [DONE]\n\n`);
          res.end();
          return;

        } 
        else if (action === "review") {
          const { promptIndirizzamento, chunks } = req.body;
          
          if (!chunks || !Array.isArray(chunks)) {
            res.status(400).json({ error: "Per la review serve un array di chunks." });
            return;
          }

          try {
            // Avvio dello stream passando userId corretto
            const flowStream = wordReviewFlow.stream({ 
              chunks, 
              promptIndirizzamento: promptIndirizzamento || "", 
              userId: uid 
            });

            // 1. Invio dei chunk di stato in tempo reale al frontend
            for await (const chunk of flowStream.stream) {
              res.write(`data: ${JSON.stringify({ message: chunk })}\n\n`);
            }

            // 2. Attesa della risoluzione del JSON strutturato (Semafori)
            const finalOutput = await flowStream.output;
            const sanitizedResult = sanitize(finalOutput); // Opzionale: usa la tua funzione di pulizia se serve

            // 3. Invio del risultato finale e chiusura
            res.write(`data: ${JSON.stringify({ result: sanitizedResult })}\n\n`);
            res.write("data: [DONE]\n\n");
            res.end();

          } catch (err: any) {
            console.error("Errore wordReviewFlow streaming:", err);
            res.write(`data: ${JSON.stringify({ error: { message: err.message } })}\n\n`);
            res.end();
          }
        }
        else if (action === "drafting") {
          // --- AZIONE 3: RE-DRAFTING / RISCRITTURA - DA IMPLEMENTARE IN FUTURO ---
          /*
          const { testoOriginale, istruzioniRiscrittura } = req.body;
          const flowStream = wordDraftingFlow.stream({ testo: testoOriginale, istruzioni: istruzioniRiscrittura, userId: uid });
          // ... logica di streaming analoga ...
          */
          throw new Error("Azione 'drafting' in fase di sviluppo.");
        } 
        else {
          // --- FALLBACK AZIONE SCONOSCIUTA ---
          throw new Error(`Azione '${action}' non supportata da wordAgent.`);
        }

      } catch (err: any) {
        const msg = err instanceof Error ? err.message : "Internal error";
        console.error("ERRORE CRITICO WORD AGENT:", err);

        if (res.headersSent) {
          res.write(`data: ${JSON.stringify({ error: { message: msg } })}\n\n`);
          res.end();
        } else {
          res.status(500).json({ error: "Process failed", details: msg });
        }
      }
    });
  }
);

export const aggiornaMetadatiDaChat = onDocumentCreated(
  {
    document: "fascicoli/{fascicoloId}/threads/{threadId}/messages/{messageId}",
    timeoutSeconds: 60,
    memory: "512MiB",
    secrets: ["GOOGLE_GENAI_API_KEY"],
  },
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const messageData = snapshot.data() as Partial<MessageDoc>;
    
    // Evita loop e risparmia token: analizziamo solo i messaggi dell'utente
    if (messageData.role === "model") return; 

    const fascicoloId = event.params.fascicoloId;
    const threadId = event.params.threadId;

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
      
      // Privacy-by-design: loggati solo conteggi, mai dati PII
      console.log(`[JURIO-METADATA] Aggiornate ${Object.keys(updatePayload).length} chiavi per fascicolo ${fascicoloId}`);

    } catch (error) {
      console.error(`[JURIO-METADATA] Errore estrazione metadati per fascicolo ${fascicoloId}`);
    }
  }
);

const hashIpForRateLimiting = (ip: string): string => {
  const dateSalt = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  return createHash("sha256").update(`${ip}-${dateSalt}`).digest("hex");
};

export const support = onRequest(
  { 
    secrets: ["GOOGLE_GENAI_API_KEY"],
    timeoutSeconds: 300,
    memory: "1GiB",
  }, 
  async (req, res) => {
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
      }
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
      }

      try {
        // 1. APP CHECK (Essenziale per endpoint pubblici senza Auth)
        try {
          await requireAppCheck(req);
        } catch (appCheckError) {
          console.warn(`[JURIO-SUPPORT] Tentativo di accesso fallito AppCheck: ${req.ip}`);
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
       
        // 2. RATE LIMITING COMPLIANT (GDPR)
        const clientIp = typeof req.headers["x-forwarded-for"] === "string" 
          ? req.headers["x-forwarded-for"].split(",")[0].trim() 
          : req.ip || req.socket.remoteAddress || "unknown_ip";

        // Anonimizzazione obbligatoria IP
        const hashedIp = hashIpForRateLimiting(clientIp);
        const ipIdentifier = `ip_${hashedIp}`;
        const publicLimits = { perMinute: 5, perDay: 30 };

        try {
          await Promise.all([
            consumePerMinuteFeature(ipIdentifier, "support_public", publicLimits.perMinute),
            consumeDailyFeature(ipIdentifier, "support_public", publicLimits.perDay)
          ]);
        } catch (rateLimitError: unknown) {
           const msg = rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError);
           if (msg === "rate_limited" || msg === "quota_exceeded") {
              res.status(429).json({ error: "Too Many Requests" });
              return;
           }
           throw rateLimitError; // Rilancia per gestire nel catch generico
        }

        // 3. ADEGUAMENTO E VALIDAZIONE INPUT (Prevenzione DoS)
        const body = (req.body ?? {}) as SupportRequestBody;
        const messages = body.messages;

        if (!Array.isArray(messages) || messages.length === 0) {
          res.status(400).json({ error: "Bad Request: Missing or empty messages array." });
          return;
        }

        // Prevenzione saturazione token: Limite al numero di messaggi e alla lunghezza del contesto
        if (messages.length > 20) {
          res.status(400).json({ error: "Bad Request: Conversation history too long." });
          return;
        }

        // 4. MAPPAZIONE RIGOROSA
        const lastMessage = messages[messages.length - 1];
        
        if (typeof lastMessage?.content !== "string" || !lastMessage.content.trim()) {
           res.status(400).json({ error: "Bad Request: Invalid prompt content." });
           return;
        }

        const safePrompt = lastMessage.content.trim().substring(0, 1000); // Max 1000 chars per il prompt corrente

        const historyRaw = messages.slice(0, -1);
        const safeHistory = historyRaw
          .filter(m => m && typeof m.content === "string")
          .map(m => ({
             role: (m.role === 'assistant' || m.role === 'model') ? 'model' as const : 'user' as const,
             content: m.content.substring(0, 2000) // Tronca messaggi vecchi enormi
          }));

        const flowInput = {
          prompt: safePrompt,
          history: safeHistory
        };

        // 5. CONFIGURAZIONE HEADER SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders(); 

        // 6. ESECUZIONE DEL FLOW STREAMING
        const flowStream = legalAgentSupport.stream(flowInput);

        for await (const chunk of flowStream.stream) {
          res.write(`data: ${JSON.stringify({ message: chunk })}\n\n`);
        }

        const finalOutput = await flowStream.output; 
        res.write(`data: ${JSON.stringify({ result: finalOutput })}\n\n`);
        
        res.write(`data: [DONE]\n\n`);
        res.end();
        return;

      } catch (err: unknown) {
        // ANTI INFORMATION DISCLOSURE IN SSE
        const msg = err instanceof Error ? err.message : "Internal error";
        console.error(`[JURIO-SUPPORT] Errore Streaming Endpoint: ${msg}`);

        const clientErrorMessage = "Si è verificato un errore durante l'elaborazione della richiesta.";

        if (res.headersSent) {
          res.write(`data: ${JSON.stringify({ error: clientErrorMessage })}\n\n`);
          res.write(`data: [DONE]\n\n`);
          res.end();
        } else {
          res.status(500).json({ error: "Internal Server Error" });
        }
        return;
      }
    });
  }
);
 
export const reasoning = onRequest(
  { 
    secrets: ["GOOGLE_GENAI_API_KEY"],
    timeoutSeconds: 300, 
    memory: "1GiB",
  },
  async (req, res) => {
    return corsHandlerDomain(req, res, async () => {
      // 1. GESTIONE CORS E METODO
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

      try {
        // 2. AUTH E APP CHECK
        let uid: string;
        try {
          await requireAppCheck(req);
          uid = await requireUidFromAuthHeader(req);
        } catch (authError) {
          console.warn(`[JURIO-REASONING] Fallimento AppCheck/Auth per IP: ${req.ip}`);
          res.status(401).json({ error: "Unauthorized" }); 
          return;
        }

        if (!uid) {
          res.status(401).json({ error: "Unauthorized" }); 
          return; 
        }

        // 3. SANITIZZAZIONE DATI INGRESSO
        const body = (req.body ?? {}) as ReasoningRequestBody;
        
        const question = typeof body.question === "string" ? body.question.trim() : "";
        const promptId = typeof body.promptId === "string" ? body.promptId.trim() : null;

        if (!question) { 
          res.status(400).json({ error: "Bad Request: Invalid or missing 'question'" }); 
          return; 
        }

        if (question.length > MAX_INPUT_CHARS) { 
          res.status(413).json({ error: "Payload Too Large: Question exceeds character limit" }); 
          return; 
        }

        // 4. CONTROLLO UTENTE E PIANI
        const snap = await db.collection("register").doc(uid).get();
        if (!snap.exists) { 
          res.status(404).json({ error: "Not Found" }); 
          return; 
        }

        const planId = String(snap.data()?.planId ?? "");
        const allowedPlans = new Set(["prova", "admin", "business", "business_m"]);

        if (!allowedPlans.has(planId)) {
          res.status(403).json({ 
            error: "Forbidden", 
            details: "Il tuo piano non consente questa operazione." 
          }); 
          return; 
        }

        // 5. CONTROLLO LIMITE DI 100 DOCUMENTI (Opzionale: wrappato in try/catch per non rompere il flow principale se c'è un timeout)
        try {
          const docsCountSnap = await db.collection("documents")
            .where("userId", "==", uid)
            .count()
            .get();

          if (docsCountSnap.data().count >= 100) {
            res.status(403).json({ 
              error: "document_limit_reached", 
              details: "Hai già raggiunto il limite massimo di 100 documenti analizzati." 
            });
            return;
          }
        } catch (dbErr) {
          console.error(`[JURIO-REASONING] Errore conteggio documenti per utente ${uid}`);
          // Scegliamo di non bloccare il fallback reasoning se il count fallisce per timeout interno
        }

        // 6. GESTIONE RATE LIMITS TRAMITE FEATURE
        const limits = planId === "prova" ? { perMinute: 5, perDay: 20 }
                     : allowedPlans.has(planId) && planId !== "admin" ? { perMinute: 20, perDay: 200 }
                     : { perMinute: 120, perDay: 10_000 };

        try {
          await Promise.all([
            consumePerMinuteFeature(uid, "reasoning", limits.perMinute),
            consumeDailyFeature(uid, "reasoning", limits.perDay)
          ]);
        } catch (rateError: unknown) {
          const msg = rateError instanceof Error ? rateError.message : String(rateError);
          if (msg === "rate_limited" || msg === "quota_exceeded") {
            res.status(429).json({ error: "Too Many Requests" });
            return;
          }
          throw rateError;
        }

        // 7. RECUPERO DEL PROMPT CUSTOM DA FIRESTORE (Privacy Segregation)
        let customPromptText: string | undefined = undefined;

        if (promptId && promptId !== "default") {
          // Sanitizzazione del promptId per evitare injection nei path Firestore
          const safePromptId = promptId.replace(/[^a-zA-Z0-9_-]/g, "");

          if (safePromptId) {
            // 1. Priorità ai prompt personali (Segregazione Dati per Utente)
            const promptDoc = await db.collection("register").doc(uid).collection("prompts").doc(safePromptId).get();
            
            if (promptDoc.exists) {
              const content = promptDoc.data()?.content;
              customPromptText = typeof content === "string" ? content : undefined;
            } else {
              // 2. Fallback ai prompt globali pubblici
              const publicPromptDoc = await db.collection("prompt_list").doc(safePromptId).get();
              
              if (publicPromptDoc.exists) {
                const content = publicPromptDoc.data()?.content;
                customPromptText = typeof content === "string" ? content : undefined;
              } else {
                console.warn(`[JURIO-REASONING] Prompt ID ${safePromptId} non trovato per utente ${uid}. Fallback default.`);
              }
            }
          }
        }

        // 8. ESECUZIONE DEL FLOW GENKIT
        const parsedJson = (await reasoningFlow({ 
          question, 
          customPrompt: customPromptText 
        })) as ReasoningFlowOutput;

        // 9. RISPOSTA AL CLIENT
        res.status(200).json({
          message: parsedJson,
          status: "SENT_BY_BOT",
          model: "gemini-3.8-flash", // Assicurati che corrisponda alla realtà del flow
          provider: "google"
        });
        return;

      } catch (err: unknown) {
        // 10. ANTI INFORMATION DISCLOSURE NEI CATCH
        const msg = err instanceof Error ? err.message : "Internal error";
        console.error(`[JURIO-REASONING] Errore imprevisto per UID ${req.headers.authorization ? "AuthPresent" : "NoAuth"}:`, msg);
        
        // Se l'errore arriva dal flow LLM per input non processabili
        if (msg.includes("SAFETY_RATING") || msg.includes("BLOCKED")) {
          res.status(400).json({ error: "Content blocked by safety filters." });
          return;
        }
        
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }
    });
  }
);

export const speechToTextAgent = onRequest(
  {
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (req, res) => {
    // req è di tipo https.Request in v2.
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
      }

      if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
      }

      try {
        // 1. AUTH & APP CHECK 
        let uid: string;
        try {
          await requireAppCheck(req);
          uid = await requireUidFromAuthHeader(req);
        } catch (authError) {
          const clientIp = req.ip || req.socket?.remoteAddress || "unknown";
          console.warn(`[JURIO-STT] Fallimento AppCheck/Auth per IP: ${clientIp}`);
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        if (!uid) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        // 2. USER / PLAN
        const userSnap = await db.collection("register").doc(uid).get();

        if (!userSnap.exists) {
          res.status(404).json({ error: "Not Found" }); 
          return;
        }

        const planId = String(userSnap.data()?.planId ?? "");
        const allowedPlans = new Set(["prova", "admin", "business", "business_m"]);

        if (!allowedPlans.has(planId)) {
          res.status(403).json({
            error: "Forbidden",
            details: "Piano non abilitato alla trascrizione.",
          });
          return;
        }

        // 3. LIMITS 
        const limits =
          planId === "prova"
            ? { perMinute: 5, perDay: 20 }
            : allowedPlans.has(planId) && planId !== "admin"
              ? { perMinute: 20, perDay: 200 }
              : { perMinute: 60, perDay: 10_000 }; 

        await Promise.all([
          consumePerMinuteFeature(uid, "speech_to_text", limits.perMinute),
          consumeDailyFeature(uid, "speech_to_text", limits.perDay),
        ]);

        // 4. MULTIPART PARSING SICURO
        const reqContentType = req.headers["content-type"] || req.header("content-type");
        const contentType = String(reqContentType ?? "");

        if (!contentType.includes("multipart/form-data")) {
          res.status(400).json({ error: "Bad Request", details: "Invalid content-type." });
          return;
        }

        const rawBody = (req as any).rawBody;

        if (!rawBody || !Buffer.isBuffer(rawBody)) {
          res.status(400).json({ error: "Bad Request", details: "Manca il payload." });
          return;
        }

        let fileBuffer: Buffer | undefined;
        let filename = "";
        let mimeType = "";

        await new Promise<void>((resolve, reject) => {
          const busboyHeaders = Object.fromEntries(
            Object.entries(req.headers).map(([k, v]) => [k, Array.isArray(v) ? v.join(',') : v])
          ) as Record<string, string>;

          const busboy = Busboy({
            headers: busboyHeaders,
            limits: {
              fileSize: 25 * 1024 * 1024, 
              files: 1, 
            },
          });

          busboy.on("file", (fieldname, file, info) => {
            if (fieldname !== "file") {
              file.resume(); 
              return;
            }

            filename = info.filename.replace(/[^a-zA-Z0-9.\-_]/g, '');
            mimeType = info.mimeType.toLowerCase();

            const chunks: Buffer[] = [];

            file.on("data", (chunk: Buffer) => {
              chunks.push(chunk);
            });

            file.on("limit", () => {
              file.resume(); 
              reject(new Error("FILE_TOO_LARGE"));
            });

            file.on("end", () => {
              fileBuffer = Buffer.concat(chunks);
            });
          });

          busboy.on("finish", resolve);
          busboy.on("error", (err) => reject(err));

          busboy.end(rawBody);
        });

        // 5. VALIDAZIONE
        if (!fileBuffer || fileBuffer.length === 0) {
          res.status(400).json({ error: "Bad Request", details: "Nessun file audio." });
          return;
        }

        if (fileBuffer.length > 25 * 1024 * 1024) {
          res.status(413).json({ error: "Payload Too Large" });
          return;
        }

        // 6. FORMATO 
        const extension = filename.split(".").pop()?.toLowerCase() ?? "";
        
        type AudioEncoding = 'MP3' | 'LINEAR16' | 'OGG_OPUS' | 'WEBM_OPUS' | null;

        const encoding: AudioEncoding =
          mimeType === "audio/mpeg" || mimeType === "audio/mp3" || extension === "mp3"
            ? "MP3"
            : mimeType.includes("wav") || extension === "wav"
              ? "LINEAR16"
              : mimeType === "audio/ogg" || mimeType === "audio/opus" || extension === "ogg" || extension === "opus"
                ? "OGG_OPUS"
                : mimeType === "audio/webm" || extension === "webm"
                  ? "WEBM_OPUS"
                  : null;

        if (!encoding) {
          res.status(400).json({
            error: "Bad Request",
            details: "Formato audio non supportato (Richiesti: mp3, wav, ogg, webm).",
          });
          return;
        }

        // 7. GOOGLE SPEECH
        if (!speechClientInstance) {
          speechClientInstance = new SpeechClient();
        }

        // Risolve implicit any per result, tipizzando l'array restituito
        const [response] = await speechClientInstance.recognize({
          audio: {
            content: fileBuffer.toString("base64"),
          },
          config: {
            encoding: encoding as any, 
            sampleRateHertz: 16000,
            languageCode: "it-IT",
            enableAutomaticPunctuation: true,
          },
        });

        // 8. TESTO
        const text =
          response.results
            ?.map((result: any) => result.alternatives?.[0]?.transcript ?? "")
            .filter(Boolean)
            .join(" ")
            .trim() ?? "";

        console.log(`[JURIO-STT] Trascrizione completata per fascicoli UID: ${uid} (bytes: ${fileBuffer.length})`);

        res.status(200).json({
          success: true,
          text,
        });

      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Unknown error";
        
        console.error(`[JURIO-STT] SpeechToText error: ${message}`);

        if (message === "FILE_TOO_LARGE") {
          res.status(413).json({
            error: "Payload Too Large",
            details: "Il file supera il limite di 25 MB.",
          });
          return;
        }

        res.status(500).json({ error: "Internal Server Error" });
      }
    });
  }
);

export const promptAgent = onRequest(
  { 
    secrets: ["GOOGLE_GENAI_API_KEY", "OPENAI_API_KEY"],
    timeoutSeconds: 300,
    memory: "1GiB",
  }, 
  async (req, res) => {
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      // 1. CORS & Metodo
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

      try {
        // 2. AUTH E APP CHECK
        let uid: string;
        try {
          await requireAppCheck(req);
          uid = await requireUidFromAuthHeader(req);
        } catch (authError) {
          console.warn(`[JURIO-PROMPT] Fallimento AppCheck/Auth per IP: ${req.ip}`);
          res.status(401).json({ error: "Unauthorized" }); 
          return;
        }

        if (!uid) {
          res.status(401).json({ error: "Unauthorized" }); 
          return; 
        }

        // 3. CONTROLLO UTENTE E PIANI
        const userSnap = await db.collection("register").doc(uid).get();
        if (!userSnap.exists) { 
          res.status(404).json({ error: "Not Found" }); 
          return; 
        }

        const planId = String(userSnap.data()?.planId ?? "");
        const allowedPlans = new Set(["prova", "admin", "business", "business_m"]);

        if (!allowedPlans.has(planId)) { 
          res.status(403).json({ error: "Forbidden", details: "Piano non abilitato alla generazione di prompt." }); 
          return; 
        }

        // 4. RATE LIMITING TRAMITE FEATURE
        const limits = planId === "prova" ? { perMinute: 5, perDay: 20 }
                     : allowedPlans.has(planId) && planId !== "admin" ? { perMinute: 20, perDay: 200 }
                     : { perMinute: 60, perDay: 10_000 };
        
        try {
          await Promise.all([
            consumePerMinuteFeature(uid, "prompting", limits.perMinute),
            consumeDailyFeature(uid, "prompting", limits.perDay)
          ]);
        } catch (rateLimitError: unknown) {
           const msg = rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError);
           if (msg === "rate_limited" || msg === "quota_exceeded") {
              res.status(429).json({ error: "Too Many Requests" });
              return;
           }
           throw rateLimitError;
        }

        // 5. SANITIZZAZIONE INPUT (Prevenzione DoS e Storage Abuse)
        const body = (req.body ?? {}) as PromptAgentRequestBody;
        
        // Estrazione sicura con limiti massimi di caratteri
        const title = typeof body.title === "string" ? body.title.trim().substring(0, 150) : "";
        const objective = typeof body.objective === "string" ? body.objective.trim().substring(0, 3000) : "";
        const notes = typeof body.notes === "string" ? body.notes.trim().substring(0, 2000) : "";
        const fieldsRaw = Array.isArray(body.fields) ? body.fields : [];

        if (!title || !objective || fieldsRaw.length === 0) {
          res.status(400).json({ error: "Bad Request: Dati mancanti (title, objective o fields)." });
          return;
        }

        // Limite al numero di parametri richiesti (Prevenzione Token Exhaustion e DB bloat)
        if (fieldsRaw.length > 30) {
          res.status(400).json({ error: "Bad Request: Troppi campi definiti (Max 30)." });
          return;
        }

        // Sanitizzazione array dei campi (Ora include il mapping esatto del tuo snapshot Firestore)
        const safeFields: PromptFieldInput[] = fieldsRaw.map((f: any) => ({
          name: typeof f?.name === "string" ? f.name.replace(/[^a-zA-Z0-9_ -]/g, '').trim().substring(0, 50) : "Campo_Sconosciuto",
          type: typeof f?.type === "string" ? f.type.trim().substring(0, 20) : "string",
          description: typeof f?.description === "string" ? f.description.trim().substring(0, 300) : "",
          isRequired: typeof f?.isRequired === "boolean" ? f.isRequired : false // Estrazione boolean dal payload
        }));

        // 6. PREPARAZIONE STREAMING (SSE)
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders(); 

        // 7. ESECUZIONE DEL FLOW IN STREAMING
        const flowStream = promptBuilderFlow.stream({
          objective,
          notes,
          fields: safeFields,
          userId: uid
        });

        for await (const chunk of flowStream.stream) {
          res.write(`data: ${JSON.stringify({ message: chunk })}\n\n`);
        }

        const finalOutput = await flowStream.output;
        // Tipizzazione basata sull'output di promptBuilderFlow
        const generatedContent = typeof finalOutput.result === "string" ? finalOutput.result : "";
        
        // 8. SALVATAGGIO IN FIRESTORE (con mapping allineato al tuo snapshot)
        if (generatedContent.trim()) {
           const safeContent = generatedContent.trim().substring(0, 20000); // Max 20k chars per Firestore field
           
           const promptRef = await db.collection("register").doc(uid).collection("prompts").add({
             title,
             objective,
             notes,
             fields: safeFields, // Ora questo array mapperà perfettamente lo snapshot che mi hai mostrato
             content: safeContent,
             createdAt: FieldValue.serverTimestamp() // Sfrutta il FieldValue per timestamp omogenei
           });
           
           // Invio risultato finale e ID documento creato
           res.write(`data: ${JSON.stringify({ 
             result: safeContent,
             promptId: promptRef.id
           })}\n\n`);
        } else {
           res.write(`data: ${JSON.stringify({ error: { message: "Errore durante la generazione del prompt: output vuoto." } })}\n\n`);
        }
        
        res.write(`data: [DONE]\n\n`);
        res.end();

      } catch (err: unknown) {
        // 9. ANTI INFORMATION DISCLOSURE IN SSE
        const msg = err instanceof Error ? err.message : "Internal error";
        console.error(`[JURIO-PROMPT] Errore Prompt Agent per UID ${req.headers.authorization ? "AuthPresent" : "NoAuth"}:`, msg);
        
        const clientErrorMessage = "Si è verificato un errore durante la stesura del prompt.";

        if (res.headersSent) {
          // Stream aperto, chiudiamola notificando l'errore senza dump stacktrace
          res.write(`data: ${JSON.stringify({ error: { message: clientErrorMessage } })}\n\n`);
          res.write(`data: [DONE]\n\n`);
          res.end();
        } else {
          // Stream chiuso, rispondiamo con codice HTTP pulito
          res.status(500).json({ error: "Internal Server Error" });
        }
      }
    });
  }
);

export const enhancePromptAgent = onRequest(
  { 
    secrets: ["GOOGLE_GENAI_API_KEY"],
    timeoutSeconds: 60,
    memory: "512MiB",
  }, 
  async (req, res) => {
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      // 1. Gestione preflight (OPTIONS) e metodo (POST)
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

      try {
        // 2. AUTH E APP CHECK
        let uid: string;
        try {
          await requireAppCheck(req);
          uid = await requireUidFromAuthHeader(req);
        } catch (authError) {
          console.warn(`[JURIO-ENHANCE] Fallimento AppCheck/Auth per IP: ${req.ip}`);
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        if (!uid) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
        
        // 3. CONTROLLO PIANI UTENTE
        const userSnap = await db.collection("register").doc(uid).get();
        if (!userSnap.exists) { 
          res.status(404).json({ error: "Not Found" }); 
          return; 
        }

        const planId = String(userSnap.data()?.planId ?? "");
        const allowedPlans = new Set(["prova", "admin", "business", "business_m"]);

        if (!allowedPlans.has(planId)) { 
          res.status(403).json({ error: "Forbidden", details: "Piano non abilitato all'ottimizzazione prompt." }); 
          return; 
        }

        // 4. RATE LIMITING
        const limits = { perMinute: 5, perDay: 20 };
        
        try {
          await Promise.all([
            consumePerMinuteFeature(uid, "prompt_enhancer", limits.perMinute),
            consumeDailyFeature(uid, "prompt_enhancer", limits.perDay)
          ]);
        } catch (rateLimitError: unknown) {
           const msg = rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError);
           if (msg === "rate_limited" || msg === "quota_exceeded") {
              res.status(429).json({ error: "Too Many Requests" });
              return;
           }
           throw rateLimitError;
        }

        // 5. SANITIZZAZIONE E TYPE-SAFETY INPUT
        const body = (req.body ?? {}) as EnhancePromptRequestBody;
        
        const promptRaw = typeof body.prompt === "string" ? body.prompt.trim() : "";
        const typeRaw = typeof body.type === "string" ? body.type.trim() : "";
        const historyRaw = Array.isArray(body.history) ? body.history : [];

        // Validazione Prompt
        if (!promptRaw) {
          res.status(400).json({ error: "Bad Request: Prompt mancante o invalido." });
          return;
        }

        // Limite drastico: evitiamo che un utente incolli 100 pagine di PDF nell'enhancer 
        // e mandi in esaurimento i token Gemini.
        const safePrompt = promptRaw.substring(0, 3000); 

        // Validazione Tipo
        if (typeRaw !== "chat" && typeRaw !== "approfondimento") {
          res.status(400).json({ error: "Bad Request: Tipo di ottimizzazione non valido." });
          return;
        }

        // Sanitizzazione Cronologia (Prendiamo al max gli ultimi 10 scambi)
        const safeHistory: EnhancePromptMessage[] = historyRaw
          .filter((m: any) => m && typeof m.content === "string")
          .slice(-10) 
          .map((m: any) => ({
            role: (m.role === "model" || m.role === "assistant") ? "model" : "user",
            content: m.content.substring(0, 2000) // Troncamento sicureza per ogni messaggio
          }));

        // 6. CHIAMATA AL FLOW GENKIT
        const output = await enhancePromptFlow({
          prompt: safePrompt,
          type: typeRaw as "chat" | "approfondimento",
          history: safeHistory
        });
        
        // 7. RISPOSTA JSON AL FRONTEND
        res.status(200).json({ 
          enhancedPrompt: typeof output?.enhancedPrompt === "string" ? output.enhancedPrompt : "" 
        });

      } catch (err: unknown) {
        // 8. ANTI INFORMATION DISCLOSURE
        const msg = err instanceof Error ? err.message : "Internal error";
        console.error(`[JURIO-ENHANCE] Errore Prompt Enhancer per UID ${req.headers.authorization ? "AuthPresent" : "NoAuth"}:`, msg);
        
        // Risposta blindata senza stacktrace e dettagli
        res.status(500).json({ 
          error: "Internal Server Error"
        });
      }
    });
  }
);

// ============================================================================
// ADMIN TASKS
// ============================================================================

export const adminMaintenanceTask = onRequest(
  { 
    timeoutSeconds: 540, // Max consentito per le funzioni HTTP standard Firebase (9 min)
    memory: "1GiB",
  }, 
  async (req, res) => {
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      // 1. CORS e Metodi Permessi
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

      try {
        // 2. SICUREZZA: APP CHECK E AUTH HEADER
        let uid: string;
        try {
          await requireAppCheck(req);
          uid = await requireUidFromAuthHeader(req);
        } catch (authError) {
          console.warn(`[JURIO-ADMIN] Fallimento Auth/AppCheck Maintenance per IP: ${req.ip}`);
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        if (!uid) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        // 3. VERIFICA RUOLO NEL DATABASE (SOLO ADMIN)
        const userSnap = await db.collection("register").doc(uid).get();
        if (!userSnap.exists) { 
          res.status(404).json({ error: "Not Found" }); 
          return; 
        }

        const planId = String(userSnap.data()?.planId ?? "");
        // Sicurezza critica: solo l'admin può avviare questo task massivo
        if (planId !== "admin") { 
          console.warn(`[JURIO-ADMIN] Tentativo bloccato di avvio task da utente non admin: ${uid}`);
          res.status(403).json({ error: "Forbidden", details: "Privilegi insufficienti." }); 
          return; 
        }

        // 4. RATE LIMITING PER ADMIN (Protezione Anti-Abuse)
        const limits = { perMinute: 60, perDay: 10_000 };
        try {
          await Promise.all([
            consumePerMinuteFeature(uid, "admin", limits.perMinute),
            consumeDailyFeature(uid, "admin", limits.perDay)
          ]);
        } catch (rateLimitError: unknown) {
           const msg = rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError);
           if (msg === "rate_limited" || msg === "quota_exceeded") {
              res.status(429).json({ error: "Too Many Requests" });
              return;
           }
           throw rateLimitError;
        }

        // 5. PREPARAZIONE SERVER-SENT EVENTS (SSE)
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        // Type assertion per la compatibilità con i framework HTTP nativi
        if (typeof (res as any).flushHeaders === "function") {
          (res as any).flushHeaders(); 
        }

        // Callback SSE Tipizzata e Sicura (Non passa MAI oggetti complessi non-serializzabili)
        const sendSseProgress: ProgressCallback = (msg, data) => {
          try {
            res.write(`data: ${JSON.stringify({ message: msg, ...data })}\n\n`);
          } catch (e) {
            console.error(`[JURIO-ADMIN] Impossibile serializzare dati progresso:`, e);
          }
        };

        const body = (req.body ?? {}) as MaintenanceTaskBody;
        
        sendSseProgress("Avvio procedura di manutenzione generale", { status: "started" });

        // 6. ESECUZIONE TASK (PRIMA FASE: AGGIORNAMENTO)
        sendSseProgress("Avvio aggiornamento fonti e metadati in corso...", { status: "updating" });
        
        const [resultFonte, resultMetadata] = await Promise.all([
          runUpdateFonte(body, sendSseProgress),
          runUpdateMetadata(sendSseProgress)
        ]);
        
        sendSseProgress("Aggiornamento completato. Avvio verifica duplicati...", { status: "updating_completed" });

        // 7. RILEVAMENTO ED ELIMINAZIONE DUPLICATI DAL DB (SECONDA FASE: PULIZIA)
        const resultCleanup = await runCleanupDuplicates(sendSseProgress);

        // 8. CHIUSURA STREAM CON STATISTICHE
        sendSseProgress("Tutte le operazioni completate con successo", { 
          status: "completed", 
          finalStats: { 
            fontiAggiornate: resultFonte?.updatedSentences || 0, 
            documentiScansionati: resultMetadata?.scanned || 0,
            recordDuplicatiEliminatiDalDb: resultCleanup?.deletedCount || 0
          }
        });
        
        res.write(`data: [DONE]\n\n`);
        res.end();

      } catch (err: unknown) {
        // 9. GESTIONE ERRORI E ANTI-LEAKAGE
        const msg = err instanceof Error ? err.message : "Internal error";
        console.error(`[JURIO-ADMIN] Errore critico nel Task Maintenance (UID: ${req.headers.authorization ? "AuthPresent" : "NoAuth"}):`, msg);
        
        const isRateLimitError = msg === "rate_limited" || msg === "quota_exceeded";
        
        if (res.headersSent) {
          // SSE già aperto
          const errorMessage = isRateLimitError 
            ? "Limite di richieste superato." 
            : "Si è verificato un errore interno durante l'elaborazione.";
            
          res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
          res.write(`data: [DONE]\n\n`);
          res.end();
        } else {
          // Header non ancora inviati
          const status = isRateLimitError ? 429 : 500;
          res.status(status).json({ error: isRateLimitError ? "Too Many Requests" : "Internal Server Error" });
        }
      }
    });
  }
);

export const adminMergeCategoryTask = onRequest(
  { 
    timeoutSeconds: 300, 
    memory: "2GiB",
  }, 
  async (req, res) => {
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

      try {
        // 1. APP CHECK E AUTH
        let uid: string;
        try {
          await requireAppCheck(req);
          uid = await requireUidFromAuthHeader(req);
        } catch (authError) {
          console.warn(`[JURIO-MERGE] Fallimento Auth/AppCheck per IP: ${req.ip}`);
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        if (!uid) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        // 2. VERIFICA PRIVILEGI ADMIN
        const userSnap = await db.collection("register").doc(uid).get();
        if (!userSnap.exists) { 
          res.status(404).json({ error: "Not Found" }); 
          return; 
        }

        if (String(userSnap.data()?.planId ?? "") !== "admin") { 
          console.warn(`[JURIO-MERGE] Tentativo bloccato da utente non admin: ${uid}`);
          res.status(403).json({ error: "Forbidden", details: "Privilegi insufficienti." }); 
          return; 
        }

        // 3. RATE LIMITING (Anti-Abuse su operazioni di Bulk)
        const limits = { perMinute: 30, perDay: 1000 };
        try {
          await Promise.all([
            consumePerMinuteFeature(uid, "admin", limits.perMinute),
            consumeDailyFeature(uid, "admin", limits.perDay)
          ]);
        } catch (rateLimitError: unknown) {
           const msg = rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError);
           if (msg === "rate_limited" || msg === "quota_exceeded") {
              res.status(429).json({ error: "Too Many Requests" });
              return;
           }
           throw rateLimitError;
        }

        // 4. SANITIZZAZIONE E TYPE-SAFETY INPUT
        const body = (req.body ?? {}) as MergeCategoryRequestBody;
        
        // Assicuriamo che i parametri siano stringhe prima di trimmare
        const inputVecchia = typeof body.vecchiaCategoria === "string" ? body.vecchiaCategoria : "";
        const inputNuova = typeof body.nuovaCategoria === "string" ? body.nuovaCategoria : "";

        if (!inputVecchia.trim()) {
          res.status(400).json({ error: "Bad Request: 'vecchiaCategoria' obbligatoria." });
          return;
        }

        // Prevenzione saturazione e iniezioni di stringhe kilometriche come categorie
        const vecchiaOriginale = inputVecchia.trim().substring(0, 100);
        const nuovaOriginale = inputNuova.trim().substring(0, 100);
        const isSostituzione = nuovaOriginale.length > 0;
        
        const bulkWriter = db.bulkWriter();
        let updatedCount = 0;

        // 5. QUERY BULK SENTENZE
        const sentenzeQuery = db.collection("sentences").where("sottocategoria", "array-contains", vecchiaOriginale);
        const snap = await sentenzeQuery.get();

        for (const d of snap.docs) {
          const data = d.data();
          const arrayAttuale = Array.isArray(data.sottocategoria) ? data.sottocategoria : [];
          
          // Rimuoviamo la vecchia categoria
          const nuovoArray = arrayAttuale.filter(c => typeof c === 'string' && c.trim() !== vecchiaOriginale);
          
          // Se stiamo unificando, aggiungiamo la nuova categoria senza duplicare
          if (isSostituzione) {
            const giaPresente = nuovoArray.some(c => typeof c === 'string' && c.trim() === nuovaOriginale);
            if (!giaPresente) {
              nuovoArray.push(nuovaOriginale);
            }
          }

          bulkWriter.update(d.ref, { sottocategoria: nuovoArray });
          updatedCount++;
        }

        // 6. AGGIORNAMENTO TAXONOMY (Sottoraccolte)
        const taxSubcatsRef = db.collection('meta').doc('taxonomy').collection('sottocategorie');
        
        // A) Eliminiamo SEMPRE la vecchia categoria dalla taxonomy
        const checkVecchia = await taxSubcatsRef.where('nome', '==', vecchiaOriginale).limit(1).get();
        if (!checkVecchia.empty) {
          checkVecchia.docs.forEach(doc => bulkWriter.delete(doc.ref));
        }

        // B) Gestiamo la nuova categoria (solo se c'è stata una sostituzione E se abbiamo aggiornato sentenze)
        if (isSostituzione && updatedCount > 0) {
          const checkNuova = await taxSubcatsRef.where('nome', '==', nuovaOriginale).limit(1).get();
          if (checkNuova.empty) {
            bulkWriter.set(taxSubcatsRef.doc(), { nome: nuovaOriginale, sentences: updatedCount });
          } else {
            bulkWriter.update(checkNuova.docs[0].ref, { sentences: FieldValue.increment(updatedCount) });
          }
        }

        // 7. PULIZIA UI E CLOSE WRITER
        bulkWriter.update(db.collection('meta').doc('taxonomy'), {
          sottocategorie_superflue: FieldValue.arrayRemove(vecchiaOriginale)
        });

        await bulkWriter.close();
        
        // 8. RISPOSTA SICURA
        const azioneMsg = isSostituzione ? "Sostituzione e unificazione" : "Eliminazione";
        res.status(200).json({ 
          success: true, 
          message: `${azioneMsg} completata. Modificate ${updatedCount} sentenze.` 
        });

      } catch (err: unknown) {
        // 9. ANTI INFORMATION DISCLOSURE
        const msg = err instanceof Error ? err.message : "Internal error";
        console.error(`[JURIO-MERGE] Errore critico nel task Merge (UID: ${req.headers.authorization ? "AuthPresent" : "NoAuth"}):`, msg);
        res.status(500).json({ error: "Internal Server Error" });
      }
    });
  }
);

export const reasoningAdmin = onRequest(
  { 
    secrets: ["DEEPSEEK_API_KEY", "OPENAI_API_KEY"],
    timeoutSeconds: 300, 
    memory: "1GiB",
  },
  async (req, res) => {
    // Nota: Ho aggiunto "return" esplicito per assicurare che la funzione risolva la promise
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

      try {
        // 1. APP CHECK E AUTH
        let uid: string;
        try {
          await requireAppCheck(req);
          uid = await requireUidFromAuthHeader(req);
        } catch (authError) {
          console.warn(`[JURIO-REASONING-ADMIN] Fallimento Auth/AppCheck per IP: ${req.ip}`);
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        if (!uid) { 
          res.status(401).json({ error: "Unauthorized" }); 
          return; 
        }

        // 2. SANITIZZAZIONE INPUT
        const body = (req.body ?? {}) as ReasoningAdminRequestBody;
        const question = typeof body.question === "string" ? body.question.trim() : "";

        if (!question) { 
          res.status(400).json({ error: "Bad Request: Invalid 'question'" }); 
          return; 
        }
        if (question.length > MAX_INPUT_CHARS) { 
          res.status(413).json({ error: "Payload Too Large: Question exceeds character limit" }); 
          return; 
        }

        // 3. VERIFICA PIANO E LOGICHE DI BUSINESS
        const snap = await db.collection("register").doc(uid).get();
        if (!snap.exists) { 
          res.status(404).json({ error: "Not Found" }); 
          return; 
        }

        const planId = String(snap.data()?.planId ?? "");
        const allowedPlans = new Set(["prova", "admin", "business", "business_m"]);

        if (!allowedPlans.has(planId)) { 
          res.status(403).json({ error: "Forbidden", details: "Privilegi insufficienti." }); 
          return; 
        }
        
        // Logica di business: blocco preventivo oscuramento (solo se admin)
        const normalizedText = question.replace(/\s+/g, ' ').toLowerCase();
        if (
          planId === "admin" &&
          (normalizedText.includes("la sentenza richiesta è in fase di valutazione per oscuramento") ||
           normalizedText.includes("la sentenza richiesta è in fase di oscuramento"))
        ) {
          res.status(403).json({ 
            error: "oscuramento_in_corso", 
            details: "La sentenza è in fase di valutazione per oscuramento e non può essere elaborata." 
          });
          return;
        }
        
        // 4. RATE LIMITING
        const limits = planId === "prova" ? { perMinute: 5, perDay: 20 }
                     : allowedPlans.has(planId) && planId !== "admin" ? { perMinute: 20, perDay: 200 }
                     : { perMinute: 120, perDay: 10_000 };

        try {
          await Promise.all([
            consumePerMinuteFeature(uid, "reasoning", limits.perMinute),
            consumeDailyFeature(uid, "reasoning", limits.perDay)
          ]);
        } catch (rateError: unknown) {
          const msg = rateError instanceof Error ? rateError.message : String(rateError);
          if (msg === "rate_limited" || msg === "quota_exceeded") {
            res.status(429).json({ error: "Too Many Requests" });
            return;
          }
          throw rateError;
        }

        let parsedJson: Record<string, unknown> | null = null;
        let providerUsed = "";
        let modelUsed = "";

        // 5. CHIAMATE LLM MULTI-PROVIDER
        // TENTATIVO 1: DEEPSEEK
        try {
          // Prevenzione crash se la chiave manca a runtime
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
            temperature: 0.1,
          });

          // Parsing sicuro del JSON
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
          
          // Fix dell'SDK OpenAI v4 (chat.completions invece di responses.create)
          const oaResponse = await oaClient.chat.completions.create({
            model: "gpt-4o-mini", 
            messages: [
              { role: "system", content: "Agisci come un esperto redattore giuridico. Restituisci esclusivamente JSON valido." },
              { role: "user", content: `${PROMPT_MASSIMAZIONE}\n\nTESTO DA ANALIZZARE:\n${question}` },
            ],
            response_format: { type: "json_object" },
            temperature: 0.1,
          });

          const rawContent = oaResponse.choices[0]?.message?.content ?? "";
          const cleanJson = rawContent.replace(/```json/gi, "").replace(/```/g, "").trim();

          // Proviamo il parse, se fallisce anche questo l'errore sarà catturato dal catch esterno
          parsedJson = JSON.parse(cleanJson);
          providerUsed = "openai_fallback";
          modelUsed = "gpt-4o-mini";
        }

        // 6. RISPOSTA SICURA
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

      } catch (err: unknown) {
        // 7. ANTI INFORMATION DISCLOSURE
        const msg = err instanceof Error ? err.message : "Internal error";
        console.error(`[JURIO-REASONING-ADMIN] Errore imprevisto (UID: ${req.headers.authorization ? "AuthPresent" : "NoAuth"}):`, msg);
        
        // Se c'è stato un problema di parsing del JSON in entrambi gli LLM
        if (msg.includes("Unexpected token") || msg.includes("JSON")) {
           res.status(500).json({ error: "Generazione testo invalida. Riprova." });
           return;
        }
        res.status(500).json({ error: "Internal Server Error" });
      }
    });
  }
);

export const adminUploadManualContentTask = onRequest(
  { 
    timeoutSeconds: 30, 
    memory: "512MiB",
  }, 
  async (req, res) => {
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      // 1. GESTIONE PREFLIGHT E METODO
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

      try {
        // 2. SICUREZZA: APP CHECK E AUTHENTICAZIONE
        let uid: string;
        try {
          await requireAppCheck(req);
          uid = await requireUidFromAuthHeader(req);
        } catch (authError) {
          console.warn(`[JURIO-MANUAL] Fallimento Auth/AppCheck per IP: ${req.ip}`);
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        if (!uid) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        // 3. CONTROLLO PRIVILEGI (SOLO ADMIN)
        const userSnap = await db.collection("register").doc(uid).get();
        if (!userSnap.exists) { 
          res.status(404).json({ error: "Not Found" }); 
          return; 
        }
        
        if (String(userSnap.data()?.planId ?? "") !== "admin") { 
          console.warn(`[JURIO-MANUAL] Tentativo bloccato da utente non admin: ${uid}`);
          res.status(403).json({ error: "Forbidden", details: "Privilegi insufficienti." }); 
          return; 
        }

        // 4. RATE LIMITING (Anti-Abuse)
        const limits = { perMinute: 30, perDay: 1000 };
        try {
          await Promise.all([
            consumePerMinuteFeature(uid, "admin", limits.perMinute),
            consumeDailyFeature(uid, "admin", limits.perDay)
          ]);
        } catch (rateLimitError: unknown) {
           const msg = rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError);
           if (msg === "rate_limited" || msg === "quota_exceeded") {
              res.status(429).json({ error: "Too Many Requests" });
              return;
           }
           throw rateLimitError;
        }

        // 5. ESTRAZIONE E SANITIZZAZIONE PAYLOAD
        const body = (req.body ?? {}) as ManualContentRequestBody;
        
        // Estrazione type-safe
        const idRaw = typeof body.id === "string" ? body.id : "";
        const textRaw = typeof body.text === "string" ? body.text : "";
        const imagesRaw = typeof body.images === "string" ? body.images : "";
        const linksRaw = Array.isArray(body.links) ? body.links : [];

        // Validazione formale
        if (!idRaw.trim()) {
          res.status(400).json({ error: "Bad Request: Il parametro 'id' è obbligatorio." });
          return;
        }
        if (!textRaw.trim()) {
          res.status(400).json({ error: "Bad Request: Il parametro 'text' è obbligatorio." });
          return;
        }
        if (linksRaw.length === 0) {
          res.status(400).json({ error: "Bad Request: Il parametro 'links' deve contenere almeno un link." });
          return;
        }
        if (!imagesRaw.trim()) {
          res.status(400).json({ error: "Bad Request: Il parametro 'images' è obbligatorio." });
          return;
        }

        // Troncamento di sicurezza (Data Minimization e prevenzione Storage Abuse)
        const cleanId = idRaw.replace(/[^a-zA-Z0-9_-]/g, "").trim().substring(0, 100);
        
        // Limiti logici di grandezza
        const cleanText = textRaw.trim().substring(0, 30000);
        const cleanImages = imagesRaw.trim().substring(0, 1000); 
        
        // Mappatura e pulizia dei link (max 50 link per prevenire DB Bloat)
        const cleanLinks = linksRaw
          .filter(l => typeof l === "string" && l.trim().length > 0)
          .slice(0, 50)
          .map(l => (l as string).trim().substring(0, 500));

        if (!cleanId) {
          res.status(400).json({ error: "Bad Request: Formato 'id' non valido." });
          return;
        }

        // 6. SCRITTURA SU FIRESTORE
        const docRef = db.collection("manual").doc(cleanId);
        
        // Usiamo set con merge: true per mantenere (se lo si desidera) campi esistenti non sovrascritti
        // oppure set() base se l'admin deve rimpiazzare sempre in blocco. 
        // Lascio .set(...) normale come da tuo codice originale.
        await docRef.set({
          text: cleanText,
          links: cleanLinks,
          images: cleanImages,
          // Gestione Timestamp per audit log
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          authorId: uid 
        });

        // 7. RISPOSTA AL CLIENT
        res.status(200).json({ 
          success: true, 
          message: `Documento '${cleanId}' salvato correttamente.` 
        });

      } catch (err: unknown) {
        // 8. ANTI INFORMATION DISCLOSURE
        const msg = err instanceof Error ? err.message : "Internal error";
        console.error(`[JURIO-MANUAL] Errore Upload (UID: ${req.headers.authorization ? "AuthPresent" : "NoAuth"}):`, msg);
        
        // Risposta blindata al client
        res.status(500).json({ error: "Internal Server Error" });
      }
    });
  }
);

export const submitFeedback = onRequest(
  { 
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (req, res) => {
    // Nota: Aggiunto return per assicurare la risoluzione della promise
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      // 1. CORS E METODO
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

      try {
        // 2. AUTH E APP CHECK
        let uid: string;
        try {
          await requireAppCheck(req);
          uid = await requireUidFromAuthHeader(req);
        } catch (authError) {
          console.warn(`[JURIO-FEEDBACK] Fallimento Auth/AppCheck per IP: ${req.ip}`);
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        if (!uid) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        // 3. RATE LIMITING (Protezione da Spam Database)
        const limits = { perMinute: 15, perDay: 100 };
        try {
          await Promise.all([
            consumePerMinuteFeature(uid, "feedback", limits.perMinute),
            consumeDailyFeature(uid, "feedback", limits.perDay)
          ]);
        } catch (rateLimitError: unknown) {
           const msg = rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError);
           if (msg === "rate_limited" || msg === "quota_exceeded") {
              res.status(429).json({ error: "Too Many Requests" });
              return;
           }
           throw rateLimitError;
        }
        
        // 4. SANITIZZAZIONE E TYPE-SAFETY INPUT
        const body = (req.body ?? {}) as SubmitFeedbackRequestBody;
        
        const isThumbsUp = typeof body.isThumbsUp === "boolean" ? body.isThumbsUp : null;
        if (isThumbsUp === null) {
           res.status(400).json({ error: "Bad Request: Missing or invalid 'isThumbsUp'" });
           return;
        }

        // Troncamento delle note per evitare storage abuse nei reclami
        const rawNotes = typeof body.notes === "string" ? body.notes.trim() : "";
        const MAX_SAFE_NOTES = typeof MAX_NOTES_CHARS === "number" ? MAX_NOTES_CHARS : 2000;
        
        if (rawNotes.length > MAX_SAFE_NOTES) {
           res.status(413).json({ error: "Payload Too Large: Notes length exceeds maximum limit" });
           return;
        }
        // Evitiamo injection di codice base (pulizia molto light)
        const notes = rawNotes.substring(0, MAX_SAFE_NOTES); 
        
        // Pulizia degli ID in arrivo
        const rawIds = Array.isArray(body.ids) ? body.ids : [];
        
        // Protezione DB: max 30 ID processabili in una singola richiesta
        if (rawIds.length > 30) {
           res.status(400).json({ error: "Bad Request: Too many IDs provided in a single request (Max 30)." });
           return;
        }

        // Sanitizziamo gli ID (max 300 caratteri in caso siano URL completi)
        const ids = rawIds
          .filter(id => typeof id === "string")
          .map(id => (id as string).trim().substring(0, 300))
          .filter(id => id.length > 0);
        
        if (ids.length === 0) {
          res.status(200).json({ success: true, message: "Nessun ID valido fornito." });
          return;
        }

        // ==========================================
        // 5. LOGICA FEEDBACK POSITIVO
        // ==========================================
        if (isThumbsUp) {
          // Scartiamo i link web esterni. Accettiamo solo ID alfanumerici standard di Firestore.
          // Filtriamo via anche path traverse tipo "../" 
          const validDbIds = ids.filter(id => !id.includes("/") && /^[a-zA-Z0-9_-]+$/.test(id));
          
          if (validDbIds.length === 0) {
             res.status(200).json({ success: true, message: "Feedback ignorato: IDs non validi o link esterni." });
             return;
          }

          const refs = validDbIds.map(id => db.collection("sentences").doc(id));
          const snaps = await db.getAll(...refs);
          const batch = db.batch();
          
          let updatedCount = 0;
          snaps.forEach(snap => {
            if (snap.exists) {
              batch.update(snap.ref, { feedbacks: FieldValue.increment(1) });
              updatedCount++;
            }
          });

          if (updatedCount > 0) {
             await batch.commit();
          }

          res.status(200).json({ success: true, message: `Feedback positivo registrato per ${updatedCount} documenti.` });
          return;
        } 
        
        // ==========================================
        // 6. LOGICA FEEDBACK NEGATIVO (RECLAMO)
        // ==========================================
        else {
          // Salviamo tutto, inclusi gli URL web lunghi passati nell'array ids
          await db.collection("complaints").add({
            uid: uid,
            urls: ids, 
            reason: notes,    
            status: "pending",  
            createdAt: FieldValue.serverTimestamp()
          });

          res.status(200).json({ success: true, message: "Reclamo registrato con successo." });
          return;
        }

      } catch (err: unknown) {
        // 7. ANTI INFORMATION DISCLOSURE
        const msg = err instanceof Error ? err.message : "Internal error";
        console.error(`[JURIO-FEEDBACK] Errore (UID: ${req.headers.authorization ? "AuthPresent" : "NoAuth"}):`, msg);
        
        // Fallback silenzioso per non rompere la UI utente, ma rimuoviamo `details: msg` per sicurezza
        res.status(200).json({ success: false, message: "Impossibile registrare il feedback in questo momento." });
      }
    });
  }
);

export const sendAdminNotification = onRequest(
  { 
    timeoutSeconds: 300, 
    memory: "1GiB",
  },
  async (req, res) => {
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      // 1. CORS E METODO
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

      try {
        // 2. SICUREZZA: APP CHECK E AUTH HEADER
        let adminUid: string;
        try {
          await requireAppCheck(req);
          adminUid = await requireUidFromAuthHeader(req);
        } catch (authError) {
          console.warn(`[JURIO-NOTIF] Fallimento Auth/AppCheck per IP: ${req.ip}`);
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        if (!adminUid) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        // 3. VERIFICA RUOLO NEL DATABASE (SOLO ADMIN)
        const userSnap = await db.collection("register").doc(adminUid).get();
        if (!userSnap.exists) { 
          res.status(404).json({ error: "Not Found" }); 
          return; 
        }

        if (String(userSnap.data()?.planId ?? "") !== "admin") { 
          console.warn(`[JURIO-NOTIF] Tentativo bloccato da utente non admin: ${adminUid}`);
          res.status(403).json({ error: "Forbidden", details: "Privilegi insufficienti" }); 
          return; 
        }

        // 4. RATE LIMITING (Anti-Abuse Admin)
        const limits = { perMinute: 20, perDay: 500 };
        try {
          await Promise.all([
            consumePerMinuteFeature(adminUid, "admin_notif", limits.perMinute),
            consumeDailyFeature(adminUid, "admin_notif", limits.perDay)
          ]);
        } catch (rateLimitError: unknown) {
           const msg = rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError);
           if (msg === "rate_limited" || msg === "quota_exceeded") {
              res.status(429).json({ error: "Too Many Requests" });
              return;
           }
           throw rateLimitError;
        }

        // 5. SANITIZZAZIONE E TYPE-SAFETY DEL PAYLOAD
        const body = (req.body ?? {}) as AdminNotificationRequestBody;

        const targetMode = typeof body.targetMode === "string" ? body.targetMode.trim() : "";
        const consentFilter = typeof body.consentFilter === "string" ? body.consentFilter.trim() : "";
        const targetUid = typeof body.uid === "string" ? body.uid.trim().substring(0, 100) : "";
        
        const sendInApp = typeof body.sendInApp === "boolean" ? body.sendInApp : false;
        const sendEmail = typeof body.sendEmail === "boolean" ? body.sendEmail : false;

        // Limiti rigidi sui contenuti per evitare Memory Exhaustion
        const title = typeof body.title === "string" ? body.title.trim().substring(0, 150) : "";
        const message = typeof body.message === "string" ? body.message.trim().substring(0, 2000) : "";
        const emailHtml = typeof body.emailHtml === "string" ? body.emailHtml.trim().substring(0, 100000) : "";
        const link = typeof body.link === "string" ? body.link.trim().substring(0, 500) : "";
        const type = typeof body.type === "string" ? body.type.trim().substring(0, 50) : "info";

        // Validazioni base
        if (!targetMode || !title) {
          res.status(400).json({ error: "Bad Request: Parametri 'targetMode' o 'title' mancanti." });
          return;
        }

        if (!sendInApp && !sendEmail) {
          res.status(400).json({ error: "Bad Request: Nessun canale di invio selezionato." });
          return;
        }

        let targetEmails: string[] = [];
        let targetUids: string[] = [];
        let useGlobalBroadcast = false;

        // 6. IDENTIFICAZIONE DESTINATARI (COLLECTION "users")
        if (targetMode === "single") {
          if (!targetUid) {
            res.status(400).json({ error: "Bad Request: UID mancante per target singolo." });
            return;
          }
          targetUids.push(targetUid);
          
          if (sendEmail) {
            const uDoc = await db.collection("users").doc(targetUid).get();
            if (uDoc.exists && uDoc.data()?.email) {
              targetEmails.push(uDoc.data()!.email);
            }
          }
        } else if (targetMode === "broadcast") {
          let usersQuery: FirebaseFirestore.Query = db.collection("users");
          
          if (consentFilter === "comms") {
            usersQuery = usersQuery.where("consents.comms", "==", true);
          } else if (consentFilter === "marketing") {
            usersQuery = usersQuery.where("consents.marketing", "==", true);
          } else {
            useGlobalBroadcast = true;
          }

          const usersSnap = await usersQuery.get();
          usersSnap.forEach(doc => {
            const data = doc.data();
            targetUids.push(doc.id);
            if (sendEmail && data.email && typeof data.email === "string") {
              targetEmails.push(data.email);
            }
          });
        }

        // 7. ESECUZIONE SCRITTURE E INVIO CHUNK
        
        // CASO SPECIALE: Ottimizzazione Broadcast Globale per In-App
        if (sendInApp && useGlobalBroadcast && targetMode === "broadcast") {
          await db.collection("broadcast").add({
            title,
            message,
            type,
            link,
            createdAt: FieldValue.serverTimestamp(),
          });
          // Svuotiamo gli UID per evitare di creare N documenti inutili in "notification"
          targetUids = []; 
        }

        // Gestione a CHUNK (max 300 per non superare il limite di 500 batch ops)
        const CHUNK_SIZE = 300; 
        const maxLen = Math.max(targetEmails.length, targetUids.length);

        for (let i = 0; i < maxLen; i += CHUNK_SIZE) {
          const chunkEmails = targetEmails.slice(i, i + CHUNK_SIZE);
          const chunkUids = targetUids.slice(i, i + CHUNK_SIZE);

          const notifications = sendInApp && chunkUids.length > 0
            ? chunkUids.map(u => ({
                uid: u,
                title,
                message,
                type: type as NotificationType,
                link,
              }))
            : undefined;

          const toAddress = sendEmail && chunkEmails.length === 1 ? chunkEmails[0] : undefined;
          const bccAddresses = sendEmail && chunkEmails.length > 1 ? chunkEmails : undefined;

          await dispatchMailAndNotification({
            to: toAddress,
            bcc: bccAddresses,
            subject: title,
            html: sendEmail ? emailHtml : "", 
            notifications: notifications,
          });
        }

        // 8. RISPOSTA SICURA
        res.status(200).json({ 
          success: true, 
          message: `Elaborazione completata. Destinatari identificati: ${Math.max(targetEmails.length, targetUids.length)}.` 
        });

      } catch (err: unknown) {
        // 9. ANTI INFORMATION DISCLOSURE
        const msg = err instanceof Error ? err.message : "Errore interno";
        console.error(`[JURIO-NOTIF] Errore invio notifiche admin (AdminUID: ${req.headers.authorization ? "AuthPresent" : "NoAuth"}):`, msg);
        
        // Restituisce un 500 pulito senza svelare query fallite o limitazioni SMTP esterne
        res.status(500).json({ success: false, error: "Internal Server Error" });
      }
    });
  }
);

// ============================================================================
// EMBEDDING FUNCTIONS
// ============================================================================

export const generateEmbedding = onRequest(
  { 
    secrets: ["OPENAI_API_KEY"],
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (req, res) => {
    // Restituzione esplicita della Promise per evitare timeout anomali di Express
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      // 1. CORS E METODO
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

      try {
        // 2. SICUREZZA: APP CHECK E AUTH
        let uid: string;
        try {
          await requireAppCheck(req);
          uid = await requireUidFromAuthHeader(req);
        } catch (authError) {
          console.warn(`[JURIO-EMBEDDING] Fallimento Auth/AppCheck per IP: ${req.ip}`);
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        if (!uid) { 
          res.status(401).json({ error: "Unauthorized" }); 
          return; 
        }

        // 3. VERIFICA UTENTE NEL DB
        const snap = await db.collection("register").doc(uid).get();
        if (!snap.exists) { 
          res.status(404).json({ error: "Not Found" }); 
          return; 
        }

        const planId = String(snap.data()?.planId ?? "");
        const allowedPlans = new Set(["prova", "admin", "business", "business_m"]);

        if (!allowedPlans.has(planId)) {
          res.status(403).json({ error: "Forbidden", details: "Piano non abilitato." });
          return;
        }

        // 4. RATE LIMITING (Protezione da loop di generazione massiva vettori)
        const limits = { perMinute: 30, perDay: 500 };
        try {
          await Promise.all([
            consumePerMinuteFeature(uid, "embedding", limits.perMinute),
            consumeDailyFeature(uid, "embedding", limits.perDay)
          ]);
        } catch (rateLimitError: unknown) {
           const msg = rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError);
           if (msg === "rate_limited" || msg === "quota_exceeded") {
              res.status(429).json({ error: "Too Many Requests" });
              return;
           }
           throw rateLimitError;
        }

        // 5. VALIDAZIONE E SANITIZZAZIONE INPUT
        const body = (req.body ?? {}) as GenerateEmbeddingRequestBody;
        const textRaw = typeof body.text === "string" ? body.text : "";

        if (!textRaw.trim()) {
          res.status(400).json({ error: "Bad Request: Invalid or missing 'text' field" });
          return;
        }

        // Troncamento di sicurezza per prevenire token exhaustion / DoS sull'API OpenAI
        const textToEmbed = textRaw.trim().substring(0, 10000); // Max 10k caratteri per embedding

        // 6. CHIAMATA A OPENAI PER L'EMBEDDING
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
          dimensions: 1536 // Manteniamo la coerenza con i 1536 attuali per Firestore
        });

        const vectorArray = embeddingResponse.data[0]?.embedding;
        
        if (!Array.isArray(vectorArray) || vectorArray.length === 0) {
           res.status(500).json({ error: "Failed to generate embedding vector." });
           return;
        }

        // 7. RISPOSTA AL CLIENT
        const responsePayload: GenerateEmbeddingResponse = {
          vector: vectorArray,
          status: "SUCCESS"
        };

        res.status(200).json(responsePayload);

      } catch (err: unknown) {
        // 8. ANTI INFORMATION DISCLOSURE
        const msg = err instanceof Error ? err.message : "Internal error";
        console.error(`[JURIO-EMBEDDING] Errore critico (UID: ${req.headers.authorization ? "AuthPresent" : "NoAuth"}):`, msg);
        
        // Rimuoviamo `details: msg` per evitare di esporre chiavi scadute o errori di OpenAI al client
        res.status(500).json({ 
          error: "Internal Server Error" 
        });
      }
    });
  }
);

export const extractDocumentText = onRequest(
  { 
    timeoutSeconds: 120,
    memory: "1GiB",
  }, 
  async (req, res) => {
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      // 1. CORS E METODO
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

      try {
        // 2. SANITIZZAZIONE E TYPE-SAFETY INPUT
        const body = (req.body ?? {}) as ExtractDocumentRequestBody;
        const storagePathRaw = typeof body.storagePath === "string" ? body.storagePath.trim() : "";
        
        if (!storagePathRaw) {
          res.status(400).json({ error: "Bad Request: Percorso del file (storagePath) mancante o invalido." });
          return;
        }

        // 3. LOGICA AUTH CONDIVISA (OAuth token o Bearer standard)
        let uid: string = "";
        const authHeader = req.headers.authorization || "";
        const token = authHeader.replace("Bearer ", "").trim();
        let isOAuthRequest = false;

        if (token) {
          const [tokenSnap, directUserSnap] = await Promise.all([
            db.collection("oauth_tokens").doc(token).get(),
            db.collection("register").doc(token).get()
          ]);

          if (tokenSnap.exists) {
            uid = typeof tokenSnap.data()?.uid === "string" ? tokenSnap.data()!.uid : "";
            isOAuthRequest = true;
          } else if (directUserSnap.exists) {
            uid = token;
            isOAuthRequest = true;
          }
        }

        if (!isOAuthRequest || !uid) {
          try {
            await requireAppCheck(req);
            uid = await requireUidFromAuthHeader(req);
          } catch (authErr) {
            console.warn(`[JURIO-EXTRACT] Fallimento Auth/AppCheck per IP: ${req.ip}`);
            res.status(401).json({ error: "Unauthorized" });
            return;
          }
        }

        if (!uid) {
          res.status(401).json({ error: "Unauthorized: Access denied" });
          return;
        }

        // 4. PATH TRAVERSAL PROTECTION (Sicurezza Storage)
        const safeStoragePath = storagePathRaw.replace(/\.\./g, "");
        
        if (!safeStoragePath.includes(uid) && !safeStoragePath.startsWith("public/")) {
           console.warn(`[JURIO-EXTRACT] Tentativo di accesso non autorizzato al file '${safeStoragePath}' da parte dell'utente ${uid}`);
           res.status(403).json({ error: "Forbidden: Accesso al file non consentito." });
           return;
        }

        // 5. VERIFICA PIANO E LIMITI
        const limits = { perMinute: 20, perDay: 200 };
        let userSnap;
        
        try {
          const results = await Promise.all([
            db.collection("register").doc(uid).get(),
            consumePerMinuteFeature(uid, "research", limits.perMinute),
            consumeDailyFeature(uid, "research", limits.perDay)
          ]);
          userSnap = results[0];
        } catch (limitErr: unknown) {
          const msg = limitErr instanceof Error ? limitErr.message : String(limitErr);
          if (msg === "rate_limited" || msg === "quota_exceeded") {
             res.status(429).json({ error: "Too Many Requests", details: "Hai raggiunto il limite massimo di richieste." });
             return;
          }
          throw limitErr;
        }

        if (!userSnap.exists) {
          res.status(404).json({ error: "Not Found" });
          return;
        }

        const planId = String(userSnap.data()?.planId ?? "");
        const allowedPlans = new Set([
          "prova", "admin", "business", "personale", "business_m", "personale_m",
        ]);

        if (!allowedPlans.has(planId)) {
          res.status(403).json({ 
            error: "Forbidden", 
            message: "È richiesto un piano attivo per utilizzare l'estrazione." 
          });
          return;
        }

        // 6. ESTRAZIONE DOCUMENTO DA STORAGE
        const admin = getAdmin();
        const bucket = admin.storage().bucket();
        const file = bucket.file(safeStoragePath);

        const [exists] = await file.exists();
        if (!exists) {
          res.status(404).json({ error: "Not Found: Il file non esiste nello storage." });
          return;
        }

        // Limite di sicurezza sulla dimensione del file scaricabile (es. max 30MB)
        const [metadata] = await file.getMetadata();
        const fileSize = Number(metadata.size || 0);
        
        if (fileSize > 30 * 1024 * 1024) {
           res.status(413).json({ error: "Payload Too Large: Il file supera la dimensione massima consentita di 30MB." });
           return;
        }

        const [buffer] = await file.download();
        
        // Estrazione testo tramite pdf-extraction
        const pdfData = await pdfExtract(buffer);
        let cleanedText = typeof pdfData?.text === "string" ? pdfData.text : "";

        // Pulizia testuale standardizzata
        cleanedText = cleanedText
          .replace(/([^\n])\n(?=[^\n])/g, "$1 ")
          .replace(/[ \t]+/g, " ")
          .replace(/\n\s*\n\s*\n/g, "\n\n")
          .trim();

        // 7. RISPOSTA AL CLIENT
        res.status(200).json({ 
          success: true,
          text: cleanedText,
          pages: typeof pdfData?.numpages === "number" ? pdfData.numpages : 1
        });

      } catch (err: unknown) {
        // 8. ANTI INFORMATION DISCLOSURE
        const msg = err instanceof Error ? err.message : "Internal error";
        console.error(`[JURIO-EXTRACT] Errore estrazione testo (UID: ${req.headers.authorization ? "AuthPresent" : "NoAuth"}):`, msg);
        
        res.status(500).json({ 
          error: "Internal Server Error"
        });
      }
    });
  }
);

export const processDocumentEmbedding = onDocumentCreated(
  {
    document: "documents/{docId}", 
    secrets: ["OPENAI_API_KEY", "DEEPSEEK_API_KEY"],
    timeoutSeconds: 120,
    memory: "512MiB"
  },
  handleEmbeddingDocumentCreation
);

export const processSentenceEmbedding = onDocumentCreated(
  {
    document: "sentences/{docId}", 
    secrets: ["OPENAI_API_KEY", "DEEPSEEK_API_KEY"],
    timeoutSeconds: 120,
    memory: "512MiB"
  },
  handleEmbeddingCreation
);

export const processManualEmbedding = onDocumentCreated(
  {
    document: "manual/{docId}", 
    secrets: ["OPENAI_API_KEY", "DEEPSEEK_API_KEY"],
    timeoutSeconds: 120,
    memory: "512MiB"
  },
  handleEmbeddingManualCreation
);

export const processFascicoloCreation = onDocumentCreated(
  {
    document: "fascicoli/{fascicoloId}", 
    timeoutSeconds: 60, // Parametri base per i fascicoli
    memory: "512MiB"
  },
  handleFascicoloCreation
);

export const generateStaticStatsJson = onDocumentCreated("metadocument/{docId}", async (event) => {
  const snapshot = event.data;
  if (!snapshot) return;
  const data = snapshot.data();
  // 1. Filtriamo solo i documenti che ci interessano
  if (data.type !== "weekly_sentences_stats") {
    console.log(`Documento ${event.params.docId} ignorato: non è una statistica settimanale.`);
    return;
  }
  console.log(`Elaborazione nuove statistiche dal documento: ${event.params.docId}`);
  // 2. Formattiamo la data per il frontend (es: "31 Maggio 2026")
  const createdAtDate = data.createdAt ? data.createdAt.toDate() : new Date();
  const dateFormatter = new Intl.DateTimeFormat('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  const dataAggiornamento = dateFormatter.format(createdAtDate);
  // 3. Mappiamo il documento Firestore nella struttura esatta attesa dal file HTML
  const configJson = {
    meta: {
      totale_documenti: data.totale_documenti || 0,
      data_aggiornamento: dataAggiornamento
    },
    per_anno: data.per_anno || {},
    per_organo: {
      "Cassazione": data.per_organo?.corte_di_cassazione || 0,
      "Consiglio di Stato": data.per_organo?.consiglio_di_stato || 0,
      "Corte Costituzionale": data.per_organo?.corte_costituzionale || 0,
    },
    per_tipo: {
      "Ordinanza": data.per_tipo?.ordinanza || 0,
      "Sentenza": data.per_tipo?.sentenza || 0,
      "Decreto": data.per_tipo?.decreto || 0,
    },
    per_materia: {
      "civile": data.per_materia?.civile || 0,
      "penale": data.per_materia?.penale || 0,
    },
    // Le sezioni sono già oggetti mappati, le passiamo direttamente
    per_sezione_cassazione: data.per_sezione_cassazione || { civili: {}, penali: {} }
  };
  // 4. Scriviamo il file su Firebase Cloud Storage
  try {
    const storage = getAdminStorage();
    const bucket = storage.bucket();
    const file = bucket.file("dataConfig.json");
    await file.save(JSON.stringify(configJson, null, 2), {
      contentType: "application/json",
      metadata: {
        cacheControl: "public, max-age=3600", 
      }
    });
    await file.makePublic();
    console.log(`Successo! dataConfig.json sovrascritto e reso pubblico: ${file.publicUrl()}`);
  } catch (error) {
    console.error("Errore durante il salvataggio su Cloud Storage:", error);
  }
});

// ============================================================================
// SCHEDULAZIONI
// ============================================================================

export const weeklySentencesStatsCron = onSchedule(
  {
    schedule: "0 2 * * 0",
    timeZone: "Europe/Rome",
    timeoutSeconds: 60,
    memory: "512MiB",
    retryCount: 3,
  },
  async (event) => {
    console.log(`⏰ Inizio task schedulato: calcolo statistiche settimanali: ${event}`);
    try {
      const stats = await computeAndSaveWeeklyStats();
      console.log(`✅ Statistiche salvate con successo. Totale documenti: ${stats.totale_documenti}`);
    } catch (error) {
      console.error("❌ Errore durante il calcolo delle statistiche settimanali:", error);
      throw error; 
    }
  }
);

export const monthlyUsageStatsCron = onSchedule(
  {
    schedule: "0 2 1 * *", // Gira il 1° giorno di ogni mese alle 02:00
    timeZone: "Europe/Rome",
    timeoutSeconds: 300, // Alzato a 5 min per sicurezza su grandi moli di dati
    memory: "512MiB",    // Alzato a 512MB per l'aggregazione in memoria
    retryCount: 3,
  },
  async (event) => {
    console.log(`⏰ Inizio task schedulato: consolidamento usage mensile: ${event.scheduleTime}`);
    try {
      const stats = await computeAndSaveMonthlyUsage();
      console.log(`✅ Consolidamento usage completato. Utenti processati: ${stats.utenti_processati}`);
    } catch (error) {
      console.error("❌ Errore durante il consolidamento degli usage mensili:", error);
      throw error;
    }
  }
);

// ============================================================================
// SUBSCRIPTIONS AND PAYMENTS
// ============================================================================

export const getRegister = onRequest(
  { 
    secrets: ["PROJECT_ID", "TASK_SERVICE_ACCOUNT"],
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (req, res) => {
    // Restituzione esplicita della Promise per evitare timeout anomali
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

      try {
        // 1. SICUREZZA: APP CHECK E AUTH
        let uid: string;
        try {
          await requireAppCheck(req);
          uid = await requireUidFromAuthHeader(req);
        } catch (authError) {
          console.warn(`[JURIO-REGISTER] Fallimento Auth/AppCheck per IP: ${req.ip}`);
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        if (!uid) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        // 2. RATE LIMITING (Prevenzione DoS e abusi di registrazione)
        const limits = { perMinute: 5, perDay: 20 };
        try {
          await Promise.all([
            consumePerMinuteFeature(uid, "register", limits.perMinute),
            consumeDailyFeature(uid, "register", limits.perDay)
          ]);
        } catch (rateLimitError: unknown) {
           const msg = rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError);
           if (msg === "rate_limited" || msg === "quota_exceeded") {
              res.status(429).json({ error: "Too Many Requests" });
              return;
           }
           throw rateLimitError;
        }

        // 3. CONTROLLI DI SICUREZZA TELEFONO (Anti-Farming)
        const userRecord = await getAdminAuth().getUser(uid);
        
        if (!userRecord.phoneNumber) {
          res.status(403).json({ 
            error: "Forbidden",
            details: "Operazione negata: Nessun numero di telefono verificato associato a questo account." 
          });
          return;
        }

        // Verifica anti-farming cross-account sullo stesso numero di telefono
        const existingPhoneUsers = await db.collection("users")
          .where("phoneNumber", "==", userRecord.phoneNumber)
          .where("__name__", "!=", uid) 
          .limit(1)
          .get();

        if (!existingPhoneUsers.empty) {
          res.status(403).json({ 
            error: "Forbidden",
            details: "Questo numero di telefono ha già usufruito di una prova gratuita in passato." 
          });
          return;
        }

        // 4. CREAZIONE / LETTURA ATOMICA (TRANSAZIONE)
        const ref = db.collection("register").doc(uid);
        
        const out = await db.runTransaction(async (tx) => {
          const snap = await tx.get(ref);
          if (snap.exists) {
            const data = snap.data() ?? {};
            return {
              created: false,
              uid,
              start: data.start ?? null,
              expireSec: typeof data.expireSec === "number" ? data.expireSec : null,
            };
          }
          
          const start = Timestamp.now();
          const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
          const expire = Timestamp.fromMillis(start.toMillis() + SEVEN_DAYS_MS);
          const expireSec = Math.floor(expire.toMillis() / 1000);
          
          // A) Crea register/{uid}
          tx.set(
            ref,
            { uid, start, expire, expireSec, planId: "prova" },
            { merge: true }
          );

          // B) Aggiorna users/{uid}.status = "prova"
          const userRef = db.collection("users").doc(uid);
          tx.set(userRef, { status: "prova" }, { merge: true });

          return { created: true, uid, start, expireSec };
        }) as GetRegisterResponse;

        // 5. TASK ASINCRONI POST-CREAZIONE (EMAIL)
        if (out.created) {
          // Esecuzione non bloccante con catch isolato per non fallire la risposta HTTP
          Promise.allSettled([
            enqueueWelcomeEmail({ uid }),
            enqueueTrialEmail({ uid })
          ]).catch(emailErr => {
            console.error(`[JURIO-REGISTER] Errore nell'accodamento email per UID ${uid}:`, emailErr);
          });
        }

        // 6. PIANIFICAZIONE TASK DOWNGRADE (Cloud Tasks)
        if (out.created && typeof out.expireSec === "number") {
          const currentProjectId = process.env.PROJECT_ID || "jurio-it";
          const taskServiceAccount = process.env.TASK_SERVICE_ACCOUNT || "130993418358-compute@developer.gserviceaccount.com";
          const dynamicTargetUrl = `https://europe-west1-${currentProjectId}.cloudfunctions.net/tasksDowngrade`;

          try {
            await scheduleDowngradeTask({
              projectId: currentProjectId,
              location: "europe-west1",
              queue: "subscription-expire",
              targetUrl: dynamicTargetUrl,
              serviceAccountEmail: taskServiceAccount,
              uid,
              expireSec: out.expireSec,
            });
          } catch (taskErr) {
            // Logghiamo l'errore del task ma non blocchiamo l'onboarding dell'utente
            console.error(`[JURIO-REGISTER] Impossibile pianificare il task di downgrade per UID ${uid}:`, taskErr);
          }
        }

        res.status(200).json(out);
        return;
        
      } catch (err: unknown) {
        // 7. ANTI INFORMATION DISCLOSURE
        const msg = err instanceof Error ? err.message : "Internal error";
        console.error(`[JURIO-REGISTER] Errore critico in getRegister (UID: ${req.headers.authorization ? "AuthPresent" : "NoAuth"}):`, msg);
        
        const lower = msg.toLowerCase();
        const isAuth = lower.includes("bearer") || lower.includes("token") || lower.includes("auth");
        
        if (isAuth) {
           res.status(401).json({ error: "Unauthorized" });
           return;
        }

        // Risposta blindata senza svelare dettagli interni di Firebase Auth o Cloud Tasks
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }
    });
  }
);

export const getPrice = onRequest(
  {
    timeoutSeconds: 30,
    memory: "512MiB",
  },
  async (req, res) => {
    // Restituzione esplicita della Promise per evitare timeout di Express
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      // 1. CORS E METODO
      if (req.method === "OPTIONS") { 
        res.status(204).end(); 
        return; 
      }
      if (req.method !== "POST") { 
        res.status(405).json({ error: "Method Not Allowed" }); 
        return; 
      }

      try {
        // 2. SICUREZZA: APP CHECK (Protezione da client non autorizzati / scraper esterni)
        try {
          await requireAppCheck(req);
        } catch (appCheckError) {
          console.warn(`[JURIO-PRICE] Fallimento AppCheck per IP: ${req.ip}`);
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        // 3. SANITIZZAZIONE E TYPE-SAFETY INPUT
        const body = (req.body ?? {}) as GetPriceRequestBody;
        const rawId = typeof body.id === "string" ? body.id : "";

        if (!rawId.trim()) {
          res.status(400).json({ error: "Bad Request: Missing or invalid 'id'" });
          return;
        }

        // Sanitizzazione rigorosa dell'ID del piano per prevenire injection nel path di Firestore
        const planId = rawId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "").substring(0, 50);

        if (!planId) {
          res.status(400).json({ error: "Bad Request: Invalid plan ID format" });
          return;
        }

        // 4. LETTURA DA FIRESTORE (Collection 'plans')
        const snap = await db.collection("plans").doc(planId).get();

        if (!snap.exists) {
          res.status(404).json({ error: "Not Found: Plan not found" });
          return;
        }

        const data = snap.data() as {
          price?: unknown;
          currency?: unknown;
        };

        const price = typeof data?.price === "number" ? data.price : null;
        if (price === null) {
          console.error(`[JURIO-PRICE] Formato prezzo non valido nel DB per il piano: ${planId}`);
          res.status(500).json({ error: "Internal Server Error" });
          return;
        }

        const currency = typeof data?.currency === "string" && data.currency.trim() 
          ? data.currency.trim().toUpperCase().substring(0, 3) 
          : "EUR";

        // 5. RISPOSTA AL CLIENT
        const responsePayload: GetPriceResponse = {
          id: planId,
          price,
          currency,
        };

        res.status(200).json(responsePayload);
        return;

      } catch (err: unknown) {
        // 6. ANTI INFORMATION DISCLOSURE
        const msg = err instanceof Error ? err.message : "Internal error";
        console.error(`[JURIO-PRICE] Errore critico nel recupero prezzo:`, msg);
        
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }
    });
  }
);

export const payWithStripeCreateCheckoutSession = onRequest(
  { 
    invoker: "public", 
    secrets: [STRIPE_SECRET_KEY],
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (req, res) => {
    // Restituzione esplicita della Promise per evitare timeout anomali di Express
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

      try {
        // 1. SICUREZZA: APP CHECK E AUTH
        let uid: string;
        try {
          await requireAppCheck(req);
          uid = await requireUidFromAuthHeader(req);
        } catch (authError) {
          console.warn(`[JURIO-STRIPE] Fallimento Auth/AppCheck per IP: ${req.ip}`);
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        if (!uid) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        // 2. RATE LIMITING (Prevenzione DoS / Generazione massiva sessioni Stripe)
        const limits = { perMinute: 10, perDay: 50 };
        try {
          await Promise.all([
            consumePerMinuteFeature(uid, "stripe_checkout", limits.perMinute),
            consumeDailyFeature(uid, "stripe_checkout", limits.perDay)
          ]);
        } catch (rateLimitError: unknown) {
           const msg = rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError);
           if (msg === "rate_limited" || msg === "quota_exceeded") {
              res.status(429).json({ error: "Too Many Requests" });
              return;
           }
           throw rateLimitError;
        }

        // 3. VALIDAZIONE INPUT E NORMALIZZAZIONE PLAN ID
        const body = (req.body ?? {}) as CheckoutSessionRequestBody;
        const rawId = typeof body.id === "string" ? body.id : "";
        
        const planId = normalizePlanId(rawId);
        if (!planId) {
          res.status(400).json({ error: "Bad Request: Missing/invalid 'id' (planId)" });
          return;
        }

        // 4. RECUPERO PIANO DA FIRESTORE
        const snap = await db.collection("plans").doc(planId).get();
        if (!snap.exists) {
          res.status(404).json({ error: "Not Found: Plan not found" });
          return;
        }

        const plan = snap.data() as PlanDoc;
        const currency = String(plan.currency ?? "EUR").toLowerCase();

        if (!plan.stripePriceId || typeof plan.stripePriceId !== "string") {
          console.error(`[JURIO-STRIPE] stripePriceId mancante nel documento piano: ${planId}`);
          res.status(500).json({ error: "Internal Server Error" });
          return;
        }

        const stripe = getStripe();

        // 5. GESTIONE CUSTOMER STRIPE (Associato a users/{uid})
        const userRef = db.collection("users").doc(uid);
        const userSnap = await userRef.get();
        let customerId = typeof userSnap.get("stripeCustomerId") === "string" 
          ? userSnap.get("stripeCustomerId") 
          : undefined;

        if (!customerId) {
          const customer = await stripe.customers.create({ metadata: { uid } });
          customerId = customer.id;
          await userRef.set({ stripeCustomerId: customerId }, { merge: true });
        }

        const appUrl = "https://jurio.it";

        // Configurazione della sessione Stripe (Tipizzata in modo sicuro)
        const sessionConfig: Record<string, unknown> = {
          mode: "payment",
          customer: customerId,
          line_items: [{ price: plan.stripePriceId, quantity: 1 }],
          success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${appUrl}/billing/cancel`,
          metadata: { uid, planId },
        };

        // -------------------------------------------------------------
        // LOGICA COUPON DA REGISTER
        // -------------------------------------------------------------
        const registerSnap = await db.collection("register").doc(uid).get();
        let appliedStripeCoupon = false;

        if (registerSnap.exists) {
          const coupon = registerSnap.get("coupon");
          
          if (coupon && typeof coupon === "object" && coupon.id) {
            let isValid = true;
            if (coupon.expire) {
              const expireDate = typeof coupon.expire.toDate === 'function' 
                ? coupon.expire.toDate() 
                : new Date(coupon.expire);
              if (expireDate < new Date()) isValid = false;
            }

            if (isValid) {
              const couponIdStr = String(coupon.id);
              if (couponIdStr.startsWith("promo_")) {
                sessionConfig.discounts = [{ promotion_code: couponIdStr }];
              } else {
                sessionConfig.discounts = [{ coupon: couponIdStr }];
              }
              appliedStripeCoupon = true;
            }
          }
        }

        if (!appliedStripeCoupon) {
          sessionConfig.allow_promotion_codes = true;
        }
        // -------------------------------------------------------------

        // 6. CREAZIONE CHECKOUT SESSION SU STRIPE
        const session = await stripe.checkout.sessions.create(sessionConfig as any);

        // 7. REGISTRAZIONE SESSIONE SU FIRESTORE
        await db.collection("stripeSessions").doc(session.id).set({
          uid,
          planId,
          expectedCurrency: currency.toUpperCase(),
          expectedPriceId: plan.stripePriceId,
          status: "CREATED",
          createdAt: Timestamp.now(),
          customerId,
        });

        // 8. RISPOSTA AL CLIENT
        res.status(200).json({ 
          url: session.url, 
          sessionId: session.id 
        });
        return;

      } catch (err: unknown) {
        // 9. ANTI INFORMATION DISCLOSURE
        const msg = err instanceof Error ? err.message : "Internal error";
        console.error(`[JURIO-STRIPE] Errore in payWithStripeCreateCheckoutSession (UID: ${req.headers.authorization ? "AuthPresent" : "NoAuth"}):`, msg);
        
        const lowerMsg = msg.toLowerCase();
        const isAuth = lowerMsg.includes("unauthorized") || lowerMsg.includes("bearer") || lowerMsg.includes("token");
        
        if (isAuth) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        res.status(500).json({ error: "Internal Server Error" });
        return;
      }
    });
  }
);

export const stripeWebhook = onRequest(
  { 
    invoker: "public", 
    secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, "PROJECT_ID", "TASK_SERVICE_ACCOUNT"],
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (req, res): Promise<void> => {
    // 1. GESTIONE PREFLIGHT
    if (req.method === "OPTIONS") { 
      res.status(204).end(); 
      return; 
    }

    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    try {
      const stripe = getStripe();
      const webhookSecret = getWebhookSecret();
      
      // 2. VERIFICA FIRMA CRITTOGRAFICA STRIPE (Protezione da spoofing e replay attack)
      const sig = req.headers["stripe-signature"];
      if (!sig || typeof sig !== "string") { 
        res.status(400).json({ error: "Missing stripe-signature" }); 
        return; 
      }

      const rawBody = (req as any).rawBody;
      if (!rawBody) {
        res.status(400).json({ error: "Missing rawBody for webhook verification" });
        return;
      }

      let event: Stripe.Event;
      try { 
        event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret); 
      } catch (err: unknown) {
        const errMessage = err instanceof Error ? err.message : "Invalid signature";
        console.warn(`[JURIO-WEBHOOK] Fallimento verifica firma Stripe: ${errMessage}`);
        res.status(400).json({ error: "Invalid signature" }); 
        return; 
      }

      // 3. IDEMPOTENZA (Prevenzione elaborazione duplicati di Stripe)
      const eventRef = db.collection("stripeEvents").doc(event.id);
      const already = await eventRef.get();
      if (already.exists) { 
        res.status(200).json({ received: true, already: true }); 
        return; 
      }

      // Ignoriamo eventi diversi da checkout.session.completed ma tracciamo la ricezione
      if (event.type !== "checkout.session.completed") {
        await eventRef.set({ type: event.type, ignored: true, createdAt: Timestamp.now() }, { merge: true });
        res.status(200).json({ received: true, ignored: event.type }); 
        return;
      }

      const session = event.data.object as Stripe.Checkout.Session;
      const uid = session.metadata?.uid;
      const planId = session.metadata?.planId ? String(session.metadata.planId) : "";

      if (!uid || !planId) {
        console.warn(`[JURIO-WEBHOOK] Evento ${event.id} ricevuto senza metadata 'uid' o 'planId'.`);
        await eventRef.set({ type: event.type, missing: true, createdAt: Timestamp.now() }, { merge: true });
        res.status(200).json({ received: true, skipped: "missing_metadata" }); 
        return;
      }

      // 4. TRANSAZIONE ATOMICA SU FIRESTORE
      const out = await db.runTransaction(async (tx) => {
        const providerData = { 
          provider: "stripe", 
          stripeSessionId: session.id, 
          stripePaymentIntentId: session.payment_intent ?? null 
        };
        
        const { expireSec, needsTask } = await processSubscriptionInTx(
          tx, 
          db, 
          uid, 
          planId, 
          providerData, 
          session.amount_total
        );

        tx.set(eventRef, { type: event.type, createdAt: Timestamp.now() }, { merge: true });
        tx.set(
          db.collection("stripeSessions").doc(session.id),
          { 
            status: "COMPLETED", 
            completedAt: Timestamp.now(), 
            paidCurrency: session.currency, 
            paidAmountMinor: session.amount_total 
          },
          { merge: true }
        );

        return { status: "COMPLETED", expireSec, needsTask };
      });

      // 5. SIDE-EFFECTS: PIANIFICAZIONE TASK DI DOWNGRADE (Cloud Tasks)
      if (out.needsTask && typeof out.expireSec === "number") {
        try {
          await tryScheduleDowngradeTask(uid, out.expireSec);
        } catch (taskErr) {
          console.error(`[JURIO-WEBHOOK] Impossibile pianificare il task di downgrade per l'utente ${uid}:`, taskErr);
        }
      }

      // 6. INVIO EMAIL DI CONFERMA ACQUISTO (Asincrono e non bloccante)
      try {
        const planSnap = await db.collection("plans").doc(planId).get();
        const plan = (planSnap.exists ? planSnap.data() : {}) as PlanDoc;
        const amountTotal = session.amount_total;
        const expectedCurrency = String(plan.currency ?? "EUR").toUpperCase();
        
        const paidValue = typeof amountTotal === "number" 
          ? amountTotal / 100 
          : (typeof plan.price === "number" ? plan.price : 0);

        void queuePurchaseEmailOnceStripe({
          requestId: event.id.slice(0, 8), 
          uid, 
          sessionId: session.id, 
          paidValue, 
          paidCurrency: session.currency || expectedCurrency,
        });
      } catch (emailErr) {
        console.error(`[JURIO-WEBHOOK] Errore nell'accodamento email di acquisto per event ${event.id}:`, emailErr);
      }

      // 7. RISPOSTA DI SUCCESSO A STRIPE
      res.status(200).json({ received: true, out: { status: out.status } });
      return;

    } catch (err: unknown) {
      // 8. ANTI INFORMATION DISCLOSURE
      const msg = err instanceof Error ? err.message : "Internal error";
      console.error(`[JURIO-WEBHOOK] Errore critico nell'elaborazione del webhook Stripe:`, msg);
      
      // Risposta blindata verso Stripe (Stripe riproverà l'invio in caso di 500)
      res.status(500).json({ error: "Webhook handler failed" });
      return;
    }
  }
);

export const applyDiscountCoupon = onRequest(
  {
    timeoutSeconds: 30, 
    memory: "512MiB",
  },
  async (req, res) => {
    // Restituzione esplicita della Promise per evitare timeout anomali di Express
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      // 1. GESTIONE PREFLIGHT E METODO
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

      try {
        // 2. SICUREZZA: APP CHECK E AUTH
        let uid: string;
        try {
          await requireAppCheck(req);
          uid = await requireUidFromAuthHeader(req);
        } catch (authError) {
          console.warn(`[JURIO-COUPON] Fallimento Auth/AppCheck per IP: ${req.ip}`);
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        if (!uid) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        // 3. RATE LIMITING (Fondamentale: protegge da attacchi di brute-force / enumerazione codici coupon)
        const limits = { perMinute: 10, perDay: 30 };
        try {
          await Promise.all([
            consumePerMinuteFeature(uid, "apply_coupon" as any, limits.perMinute),
            consumeDailyFeature(uid, "apply_coupon" as any, limits.perDay)
          ]);
        } catch (rateLimitError: unknown) {
           const msg = rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError);
           if (msg === "rate_limited" || msg === "quota_exceeded") {
              res.status(429).json({ error: "Too Many Requests", details: "Troppi tentativi. Riprova più tardi." });
              return;
           }
           throw rateLimitError;
        }

        // 4. VALIDAZIONE E SANITIZZAZIONE INPUT
        const body = (req.body ?? {}) as ApplyCouponRequestBody;
        const couponCodeRaw = typeof body.couponCode === "string" ? body.couponCode : "";

        if (!couponCodeRaw.trim()) {
          res.status(400).json({ error: "Bad Request: Codice coupon mancante o non valido" });
          return;
        }

        // Normalizzazione e sanitizzazione rigorosa per prevenire injection nel path di Firestore
        const normalizedCode = couponCodeRaw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").substring(0, 50);

        if (!normalizedCode) {
          res.status(400).json({ error: "Bad Request: Formato codice coupon non valido" });
          return;
        }

        // 5. CONTROLLO UTENTE (Collection 'register')
        const userRef = db.collection("register").doc(uid);
        const userSnap = await userRef.get();
        
        if (!userSnap.exists) {
          res.status(404).json({ error: "Not Found: Utente non trovato" });
          return;
        }

        // Verifica se l'utente ha già un coupon attivo sul proprio account
        const existingCoupon = userSnap.get("coupon");
        if (existingCoupon) {
          res.status(400).json({ error: "Conflict: Hai già un coupon attivo sul tuo account." });
          return;
        }

        // 6. CONTROLLO ESISTENZA COUPON (Collection 'discount')
        const couponRef = db.collection("discount").doc(normalizedCode);
        const couponSnap = await couponRef.get();

        if (!couponSnap.exists) {
          res.status(404).json({ error: "Not Found: Codice promozionale non valido." });
          return;
        }

        const couponData = couponSnap.data() ?? {};

        // 7. CONTROLLO SCADENZA
        const expireField = couponData.expire;
        if (expireField) {
          const expireDate = typeof expireField.toDate === 'function' 
            ? expireField.toDate() 
            : new Date(expireField);
            
          if (expireDate < new Date()) {
            res.status(400).json({ error: "Bad Request: Questo coupon è scaduto." });
            return;
          }
        }

        // 8. PREPARAZIONE MAPPA COUPON DA SALVARE
        const stripeCouponId = typeof couponData.stripeCustomerId === "string" ? couponData.stripeCustomerId : "";
        const discountPercentage = typeof couponData.discount === "number" ? couponData.discount : 0;
        const durationLabel = typeof couponData.durationLabel === "string" ? couponData.durationLabel : "Applicato con successo";

        const couponMapToSave: Record<string, unknown> = {
          id: stripeCouponId,
          name: normalizedCode,
          discount: discountPercentage,
        };
        
        if (expireField) {
          couponMapToSave.expire = expireField;
        }

        // 9. SALVATAGGIO SU FIRESTORE
        await userRef.update({
          coupon: couponMapToSave
        });

        // 10. RISPOSTA DI SUCCESSO
        const responsePayload: ApplyCouponResponse = {
          status: "SUCCESS",
          coupon: {
            code: normalizedCode,
            percentage: discountPercentage,
            durationLabel: durationLabel
          }
        };

        res.status(200).json(responsePayload);
        return;

      } catch (err: unknown) {
        // 11. ANTI INFORMATION DISCLOSURE
        const msg = err instanceof Error ? err.message : "Internal error";
        console.error(`[JURIO-COUPON] Errore applicazione coupon (UID: ${req.headers.authorization ? "AuthPresent" : "NoAuth"}):`, msg);
        
        const lower = msg.toLowerCase();
        const isAuth = lower.includes("bearer") || lower.includes("token") || lower.includes("auth");
        
        if (isAuth) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        // Risposta blindata senza svelare dettagli interni di Firestore o stacktrace
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }
    });
  }
);

export const syncUserSession = onRequest(
  {
    timeoutSeconds: 30,
    memory: "512MiB",
  },
  async (req, res) => {
    // Restituzione esplicita della Promise per evitare timeout di Express
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      // 1. GESTIONE PREFLIGHT E METODO
      if (req.method === "OPTIONS") { 
        res.status(204).end(); 
        return; 
      }
      if (req.method !== "POST") { 
        res.status(405).json({ error: "Method Not Allowed" }); 
        return; 
      }

      try {
        // 2. SICUREZZA: APP CHECK E AUTH
        try {
          await requireAppCheck(req);
        } catch (appCheckError) {
          console.warn(`[JURIO-SYNC] Fallimento AppCheck per IP: ${req.ip}`);
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          res.status(401).json({ error: "Unauthorized: Missing authentication token" });
          return;
        }

        const idToken = authHeader.split("Bearer ")[1].trim();
        let uid: string;
        
        try {
          // Usiamo getAdminAuth() in linea con le tue utility centralizzate
          const decodedToken = await getAdminAuth().verifyIdToken(idToken);
          uid = decodedToken.uid;
        } catch (authErr: unknown) {
          console.warn("[JURIO-SYNC] Token invalido in syncUserSession", authErr);
          res.status(401).json({ error: "Unauthorized: Invalid token" });
          return;
        }

        if (!uid) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        // 3. RATE LIMITING (Prevenzione DoS / Rigenerazione forzata continua di session ID)
        const limits = { perMinute: 15, perDay: 200 };
        try {
          await Promise.all([
            consumePerMinuteFeature(uid, "sync_session" as any, limits.perMinute),
            consumeDailyFeature(uid, "sync_session" as any, limits.perDay)
          ]);
        } catch (rateLimitError: unknown) {
           const msg = rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError);
           if (msg === "rate_limited" || msg === "quota_exceeded") {
              res.status(429).json({ error: "Too Many Requests" });
              return;
           }
           throw rateLimitError;
        }

        // 4. GENERAZIONE E SALVATAGGIO ATOMICO DEL SESSION ID
        const sessionId = randomUUID();

        await db.collection("users").doc(uid).set({
          currentSessionId: sessionId
        }, { merge: true });

        // 5. RISPOSTA AL CLIENT
        const responsePayload: SyncUserSessionResponse = { 
          success: true, 
          sessionId 
        };

        res.status(200).json(responsePayload);
        return;

      } catch (err: unknown) {
        // 6. ANTI INFORMATION DISCLOSURE
        const msg = err instanceof Error ? err.message : "Internal error";
        console.error(`[JURIO-SYNC] Errore critico in syncUserSession:`, msg);
        
        // Risposta blindata senza svelare dettagli interni di Firestore o di Firebase Auth
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }
    });
  }
);

export const forceTakeoverSession = onRequest(
  {
    timeoutSeconds: 30,
    memory: "512MiB",
    region: "europe-west1" // Data Residency UE obbligatoria
  },
  async (req, res) => {
    // Restituzione esplicita della Promise per evitare timeout di Express
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      // 1. GESTIONE PREFLIGHT E METODO
      if (req.method === "OPTIONS") { 
        res.status(204).end(); 
        return; 
      }
      if (req.method !== "POST") { 
        res.status(405).json({ error: "Method Not Allowed" }); 
        return; 
      }

      try {
        // 2. SICUREZZA: APP CHECK E AUTH
        try {
          await requireAppCheck(req);
        } catch (appCheckError) {
          console.warn(`[JURIO-TAKEOVER] Fallimento AppCheck per IP: ${req.ip}`);
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith("Bearer ")) {
          res.status(401).json({ error: "Unauthorized: Missing authentication token" });
          return;
        }

        const idToken = authHeader.split("Bearer ")[1].trim();
        let uid: string;
        
        try {
          // Utilizziamo l'utility centralizzata getAdminAuth()
          const decodedToken = await getAdminAuth().verifyIdToken(idToken);
          uid = decodedToken.uid;
        } catch (authErr: unknown) {
          console.warn("[JURIO-TAKEOVER] Token invalido in forceTakeoverSession", authErr);
          res.status(401).json({ error: "Unauthorized: Invalid token" });
          return;
        }

        if (!uid) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        // 3. RATE LIMITING
        const limits = { perMinute: 5, perDay: 20 };
        try {
          await Promise.all([
            consumePerMinuteFeature(uid, "force_takeover" as any, limits.perMinute),
            consumeDailyFeature(uid, "force_takeover" as any, limits.perDay)
          ]);
        } catch (rateLimitError: unknown) {
           const msg = rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError);
           if (msg === "rate_limited" || msg === "quota_exceeded") {
              res.status(429).json({ error: "Too Many Requests" });
              return;
           }
           throw rateLimitError;
        }

        // 4. ESECUZIONE TAKEOVER
        const newSessionId = randomUUID();

        // A) Revoca dei token di refresh (il vero kick-out di sicurezza su Firebase Auth)
        await getAdminAuth().revokeRefreshTokens(uid);

        // B) Aggiornamento database
        await db.collection("users").doc(uid).set({
          currentSessionId: newSessionId
        }, { merge: true });

        // 5. RISPOSTA AL CLIENT
        const responsePayload: ForceTakeoverSessionResponse = { 
          success: true, 
          newSessionId 
        };

        res.status(200).json(responsePayload);
        return;

      } catch (err: unknown) {
        // 6. ANTI INFORMATION DISCLOSURE
        const msg = err instanceof Error ? err.message : "Internal error";
        console.error(`[JURIO-TAKEOVER] Errore critico in forceTakeoverSession:`, msg);
        
        // Risposta blindata senza svelare dettagli interni di Firebase Auth o Firestore
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }
    });
  }
);

// ============================================================================
// TEAM FUNCTIONS
// ============================================================================

export const assignTeamSeat = onRequest(
  {
    timeoutSeconds: 60,
    memory: "512MiB"
  },
  async (req, res) => {
    // Restituzione esplicita della Promise per evitare timeout di Express
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      // 1. GESTIONE PREFLIGHT E METODO
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

      try {
        // 2. SICUREZZA: APP CHECK E AUTH
        let callerUid: string;
        try {
          await requireAppCheck(req);
          callerUid = await requireUidFromAuthHeader(req);
        } catch (authError) {
          console.warn(`[JURIO-SEAT] Fallimento Auth/AppCheck per IP: ${req.ip}`);
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        if (!callerUid) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        // 3. RATE LIMITING (Prevenzione DoS / Tentativi massivi di assegnazione o bruteforce voucher)
        const limits = { perMinute: 10, perDay: 50 };
        try {
          await Promise.all([
            consumePerMinuteFeature(callerUid, "assign_seat" as any, limits.perMinute),
            consumeDailyFeature(callerUid, "assign_seat" as any, limits.perDay)
          ]);
        } catch (rateLimitError: unknown) {
           const msg = rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError);
           if (msg === "rate_limited" || msg === "quota_exceeded") {
              res.status(429).json({ error: "Too Many Requests" });
              return;
           }
           throw rateLimitError;
        }

        // 4. SANITIZZAZIONE E TYPE-SAFETY INPUT
        const body = (req.body ?? {}) as AssignTeamSeatRequestBody;
        
        const teamIdRaw = typeof body.teamId === "string" ? body.teamId : "";
        const emailRaw = typeof body.email === "string" ? body.email : "";
        const voucherRaw = typeof body.voucher === "string" ? body.voucher : "";

        // Sanitizzazione rigorosa dell'ID del team (alfanumerico, trattini, underscore)
        const teamId = teamIdRaw.trim().replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 100);

        if (!teamId) {
          res.status(400).json({ error: "Bad Request: Missing or invalid 'teamId'" });
          return;
        }

        if (!emailRaw && !voucherRaw) {
          res.status(400).json({ error: "Bad Request: Devi fornire 'email' o 'voucher'" });
          return;
        }

        // Normalizzazione sicura del voucher e dell'email
        const cleanVoucher = voucherRaw ? voucherRaw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").substring(0, 50) : "";
        const isInviteFlow = !!emailRaw.trim();
        let targetUid: string;
        let targetEmail: string;

        // 5. DETERMINAZIONE UID ED EMAIL (Con controllo preventivo su Firebase Auth)
        if (isInviteFlow) {
          targetEmail = emailRaw.trim().toLowerCase().substring(0, 254);
          try {
            const userRecord = await getAdminAuth().getUserByEmail(targetEmail);
            targetUid = userRecord.uid;
          } catch (err: any) {
            if (err?.code === 'auth/user-not-found') {
              res.status(404).json({ errorCode: "user-not-found", error: "L'utente non è ancora registrato." });
              return;
            }
            throw err;
          }
        } else {
          targetUid = callerUid;
          const userRecord = await getAdminAuth().getUser(callerUid);
          targetEmail = typeof userRecord.email === "string" ? userRecord.email : ""; 
        }

        // 6. TRANSAZIONE ATOMICA SU FIRESTORE
        const out = await db.runTransaction(async (tx) => {
          const teamRef = db.collection("teams").doc(teamId);
          const registerRef = db.collection("register").doc(targetUid);

          const [teamSnap, registerSnap] = await Promise.all([
            tx.get(teamRef),
            tx.get(registerRef)
          ]);

          if (!teamSnap.exists) {
            throw new Error("NOT_FOUND: Team non trovato");
          }
          
          const teamData = teamSnap.data() as Record<string, any>;
          const registerData = registerSnap.exists ? registerSnap.data() : {};

          // Controllo permessi se è un flusso di invito
          if (isInviteFlow) {
            const owners = Array.isArray(teamData.owners) ? teamData.owners : [];
            const coOwners = Array.isArray(teamData.co_owners) ? teamData.co_owners : [];
            
            const isOwner = owners.includes(callerUid);
            const isCoOwner = coOwners.includes(callerUid);
            
            if (!isOwner && !isCoOwner) {
              throw new Error("FORBIDDEN: Solo i proprietari o co-proprietari possono assegnare i posti");
            }
          }

          const memberIds = Array.isArray(teamData.member_ids) ? teamData.member_ids : [];
          if (memberIds.includes(targetUid)) {
            throw new Error("CONFLICT: L'utente fa già parte del Workspace");
          }

          const isAlreadyBusiness = registerData?.planId === "business";
          const vouchers = Array.isArray(teamData.vouchers) ? teamData.vouchers : [];
          const updatedVouchers = [...vouchers];
          
          let grantBusiness = false;
          let expireTimestamp: any;
          const now = admin.firestore.Timestamp.now();

          if (isAlreadyBusiness) {
            expireTimestamp = registerData?.expire ?? admin.firestore.Timestamp.fromMillis(now.toMillis() + (365 * 24 * 60 * 60 * 1000));
            if (!isInviteFlow) {
              const vIndex = vouchers.findIndex((v: any) => v && v.id === cleanVoucher);
              if (vIndex === -1) {
                throw new Error("EXHAUSTED: Il voucher fornito non è valido o non appartiene a questo team");
              }
            }
          } else {
            let voucherIndex = -1;
            if (isInviteFlow) {
              voucherIndex = vouchers.findIndex((v: any) => v && v.used === false);
            } else {
              voucherIndex = vouchers.findIndex((v: any) => v && v.id === cleanVoucher && v.used === false); 
            }

            if (voucherIndex === -1) {
              if (isInviteFlow) {
                throw new Error("EXHAUSTED: Nessun posto disponibile nel team");
              } else {
                throw new Error("EXHAUSTED: Il voucher fornito è già stato utilizzato o non è valido");
              }
            }

            const usedVoucher = vouchers[voucherIndex];
            const durationDays = typeof usedVoucher.duration === "number" ? usedVoucher.duration : 365;

            updatedVouchers[voucherIndex] = {
              ...usedVoucher,
              used: true,
              assignedTo: targetUid,
              assignedAt: now
            };
            
            grantBusiness = true;
            expireTimestamp = admin.firestore.Timestamp.fromMillis(now.toMillis() + (durationDays * 24 * 60 * 60 * 1000));
          }

          // SCRITTURE ATOMICHE NEL BATCH DELLA TRANSAZIONE
          tx.update(teamRef, {
            vouchers: updatedVouchers,
            member_ids: admin.firestore.FieldValue.arrayUnion(targetUid) 
          });

          tx.set(teamRef.collection("members").doc(targetUid), {
            role: "editor",
            date_start: now,
            expire: expireTimestamp,
            email: targetEmail
          });

          const expireSec = Math.floor(expireTimestamp.toMillis() / 1000);
          
          tx.set(db.collection("users").doc(targetUid), { 
            status: "business",
            assignedTeamId: teamId 
          }, { merge: true });
          
          tx.set(registerRef, { 
            planId: "business",
            status: "active",
            provider: "team_invite",
            assignedTeamId: teamId,
            start: now,
            expire: expireTimestamp,
            expireSec,
            update: now
          }, { merge: true });

          const teamNameStr = typeof teamData.name === "string" ? teamData.name : "Workspace";

          return { 
            success: true, 
            targetUid, 
            targetEmail,
            teamName: teamNameStr,
            voucherUsed: grantBusiness 
          } as AssignTeamSeatResponse;
        });

        // 7. EFFETTI COLLATERALI FUORI TRANSAZIONE (Email di benvenuto team)
        if (out && out.targetEmail) {
          void enqueueWelcomeTeamEmail({ 
            email: out.targetEmail, 
            teamName: out.teamName 
          }).catch(mailErr => {
            console.error(`[JURIO-SEAT] Errore nell'invio dell'email di benvenuto team per ${out.targetEmail}:`, mailErr);
          });
        }

        // 8. RISPOSTA AL CLIENT
        res.status(200).json(out);
        return;

      } catch (err: unknown) {
        // 9. ANTI INFORMATION DISCLOSURE E GESTIONE ERRORI CUSTOM
        const msg = err instanceof Error ? err.message : "Internal Error";
        console.error(`[JURIO-SEAT] Errore in assignTeamSeat (Caller: ${req.headers.authorization ? "AuthPresent" : "NoAuth"}):`, msg);

        if (msg.startsWith("NOT_FOUND:")) {
          res.status(404).json({ error: msg.split(":")[1].trim() });
          return;
        }
        if (msg.startsWith("FORBIDDEN:")) {
          res.status(403).json({ error: msg.split(":")[1].trim() });
          return;
        }
        if (msg.startsWith("CONFLICT:")) {
          res.status(409).json({ errorCode: "already-exists", error: msg.split(":")[1].trim() });
          return;
        }
        if (msg.startsWith("EXHAUSTED:")) {
          res.status(409).json({ error: msg.split(":")[1].trim() });
          return;
        }
        if (msg.startsWith("ALREADY_ASSIGNED:")) {
          res.status(409).json({ errorCode: "already-assigned", error: msg.split(":")[1].trim() });
          return;
        }

        const lowerMsg = msg.toLowerCase();
        const isAuth = lowerMsg.includes("bearer") || lowerMsg.includes("token") || lowerMsg.includes("unauthorized");
        
        if (isAuth) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        // Risposta blindata per qualsiasi altra eccezione imprevista
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }
    });
  }
);

export const sendTeamInviteEmail = onRequest(
  {
    timeoutSeconds: 30,
    memory: "512MiB",
  },
  async (req, res) => {
    // Restituzione esplicita della Promise per evitare timeout di Express
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      // 1. GESTIONE PREFLIGHT E METODO
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

      try {
        // 2. SICUREZZA: APP CHECK E AUTH
        let callerUid: string;
        try {
          await requireAppCheck(req);
          callerUid = await requireUidFromAuthHeader(req);
        } catch (authError) {
          console.warn(`[JURIO-INVITE] Fallimento Auth/AppCheck per IP: ${req.ip}`);
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        if (!callerUid) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        // 3. RATE LIMITING (Prevenzione DoS / Invio massivo di inviti spam)
        const limits = { perMinute: 15, perDay: 60 };
        try {
          await Promise.all([
            consumePerMinuteFeature(callerUid, "team_invite" as any, limits.perMinute),
            consumeDailyFeature(callerUid, "team_invite" as any, limits.perDay)
          ]);
        } catch (rateLimitError: unknown) {
           const msg = rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError);
           if (msg === "rate_limited" || msg === "quota_exceeded") {
              res.status(429).json({ error: "Too Many Requests" });
              return;
           }
           throw rateLimitError;
        }

        // 4. SANITIZZAZIONE E TYPE-SAFETY INPUT
        const body = (req.body ?? {}) as SendTeamInviteEmailRequestBody;
        
        const teamIdRaw = typeof body.teamId === "string" ? body.teamId : "";
        const emailRaw = typeof body.email === "string" ? body.email : "";
        const voucherRaw = typeof body.voucher === "string" ? body.voucher : "";

        // Sanitizzazione rigorosa dell'ID team e del codice voucher
        const teamId = teamIdRaw.trim().replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 100);
        const voucher = voucherRaw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").substring(0, 50);

        if (!teamId) {
          res.status(400).json({ error: "Bad Request: Missing or invalid 'teamId'" });
          return;
        }
        if (!emailRaw.trim()) {
          res.status(400).json({ error: "Bad Request: Missing or invalid 'email'" });
          return;
        }
        if (!voucher) {
          res.status(400).json({ error: "Bad Request: Missing or invalid 'voucher'" });
          return;
        }

        const targetEmail = emailRaw.trim().toLowerCase().substring(0, 254);

        // 5. LETTURA TEAM E CONTROLLI DI ACCESSO
        const teamRef = db.collection("teams").doc(teamId);
        const teamSnap = await teamRef.get();

        if (!teamSnap.exists) {
          res.status(404).json({ error: "Not Found: Team non trovato" });
          return;
        }

        const teamData = teamSnap.data() as Record<string, any>;

        // A. Verifica permessi (Owner o Co-owner)
        const owners = Array.isArray(teamData.owners) ? teamData.owners : [];
        const coOwners = Array.isArray(teamData.co_owners) ? teamData.co_owners : [];
        
        const isOwner = owners.includes(callerUid);
        const isCoOwner = coOwners.includes(callerUid);
        
        if (!isOwner && !isCoOwner) {
          res.status(403).json({ error: "Forbidden: Solo i proprietari o co-proprietari possono inviare inviti" });
          return;
        }

        // B. Controllo validità e disponibilità del voucher nel team
        const vouchers = Array.isArray(teamData.vouchers) ? teamData.vouchers : [];
        const voucherIndex = vouchers.findIndex((v: any) => v && v.id === voucher && v.used === false);

        if (voucherIndex === -1) {
          res.status(409).json({ error: "Conflict: Il codice invito fornito non è valido o è già stato utilizzato" });
          return;
        }

        const teamNameStr = typeof teamData.name === "string" ? teamData.name : "un Workspace";

        // 6. ACCODAMENTO EMAIL
        await enqueueVoucherEmail({
          email: targetEmail,
          voucherCode: voucher,
          teamName: teamNameStr
        });

        // 7. RISPOSTA AL CLIENT
        const responsePayload: SendTeamInviteEmailResponse = { 
          success: true, 
          message: "Email di invito accodata con successo",
          email: targetEmail
        };

        res.status(200).json(responsePayload);
        return;

      } catch (err: unknown) {
        // 8. ANTI INFORMATION DISCLOSURE
        const msg = err instanceof Error ? err.message : "Internal Error";
        console.error(`[JURIO-INVITE-MAIL] Errore in sendTeamInviteEmail (Caller: ${req.headers.authorization ? "AuthPresent" : "NoAuth"}):`, msg);

        const lowerMsg = msg.toLowerCase();
        const isAuth = lowerMsg.includes("bearer") || lowerMsg.includes("token") || lowerMsg.includes("unauthorized");
        
        if (isAuth) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        // Risposta blindata senza svelare stacktrace o dettagli interni
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }
    });
  }
);

export const shareAllTeamDocuments = onRequest(
  {
    timeoutSeconds: 300,
    memory: "1GiB", 
  },
  async (req, res) => {
    // Restituzione esplicita della Promise per evitare timeout di Express
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      // 1. GESTIONE PREFLIGHT E METODO
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

      try {
        // 2. SICUREZZA: APP CHECK E AUTH
        let callerUid: string;
        try {
          await requireAppCheck(req);
          callerUid = await requireUidFromAuthHeader(req);
        } catch (authError) {
          console.warn(`[JURIO-SHARE-DOCS] Fallimento Auth/AppCheck per IP: ${req.ip}`);
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        if (!callerUid) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        // 3. RATE LIMITING (Fondamentale: previene abusi di esecuzione bulk massiva su Firestore)
        const limits = { perMinute: 3, perDay: 10 };
        try {
          await Promise.all([
            consumePerMinuteFeature(callerUid, "share_docs" as any, limits.perMinute),
            consumeDailyFeature(callerUid, "share_docs" as any, limits.perDay)
          ]);
        } catch (rateLimitError: unknown) {
           const msg = rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError);
           if (msg === "rate_limited" || msg === "quota_exceeded") {
              res.status(429).json({ error: "Too Many Requests", details: "Operazione eseguita troppo spesso. Riprova più tardi." });
              return;
           }
           throw rateLimitError;
        }

        // 4. SANITIZZAZIONE E TYPE-SAFETY INPUT
        const body = (req.body ?? {}) as ShareAllTeamDocumentsRequestBody;
        const teamIdRaw = typeof body.teamId === "string" ? body.teamId : "";
        
        // Sanitizzazione rigorosa dell'ID team
        const teamId = teamIdRaw.trim().replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 100);

        if (!teamId) {
          res.status(400).json({ error: "Bad Request: Missing or invalid 'teamId'" });
          return;
        }

        // 5. LETTURA TEAM E CONTROLLI DI ACCESSO
        const teamRef = db.collection("teams").doc(teamId);
        const teamSnap = await teamRef.get();

        if (!teamSnap.exists) {
          res.status(404).json({ error: "Not Found: Team non trovato" });
          return;
        }

        const teamData = teamSnap.data() as Record<string, any>;
        const owners = Array.isArray(teamData.owners) ? teamData.owners : [];
        const coOwners = Array.isArray(teamData.co_owners) ? teamData.co_owners : [];

        const isOwner = owners.includes(callerUid);
        const isCoOwner = coOwners.includes(callerUid);
        
        if (!isOwner && !isCoOwner) {
          res.status(403).json({ error: "Forbidden: Solo i manager possono forzare la condivisione dello storico" });
          return;
        }

        // 6. RECUPERO MEMBRI DEL TEAM
        const membersSnap = await teamRef.collection("members").get();
        const memberIds = membersSnap.docs
          .map(doc => doc.id)
          .filter(id => typeof id === "string" && id.trim().length > 0);

        if (memberIds.length === 0) {
          res.status(200).json({ 
            success: true, 
            updatedCount: 0, 
            message: "Nessun membro nel team" 
          } as ShareAllTeamDocumentsResponse);
          return;
        }

        const bulkWriter = db.bulkWriter();
        let updatedCount = 0;

        const updateData = {
          visibleTo: FieldValue.arrayUnion(...memberIds)
        };

        const queueUpdates = async (query: Query) => {
          const snap = await query.get();
          snap.docs.forEach((doc) => {
            bulkWriter.update(doc.ref, updateData);
            updatedCount++;
          });
        };

        // 7. ESECUZIONE QUERY MULTIPLE E AGGIORNAMENTO BULK
        for (const uid of memberIds) {
          await Promise.all([
            queueUpdates(db.collection("documents").where("user", "==", uid)),
            queueUpdates(db.collection("document_chunks").where("user", "==", uid)),
            queueUpdates(db.collection("fascicoli").where("ownerId", "==", uid))
          ]);
        }

        await bulkWriter.close();

        // 8. RISPOSTA AL CLIENT
        const responsePayload: ShareAllTeamDocumentsResponse = { 
          success: true, 
          updatedCount,
          message: "Storico condiviso con successo" 
        };

        res.status(200).json(responsePayload);
        return;

      } catch (err: unknown) {
        // 9. ANTI INFORMATION DISCLOSURE
        const msg = err instanceof Error ? err.message : "Internal Error";
        console.error(`[JURIO-SHARE-DOCS] Errore in shareAllTeamDocuments (Caller: ${req.headers.authorization ? "AuthPresent" : "NoAuth"}):`, msg);

        const lowerMsg = msg.toLowerCase();
        const isAuth = lowerMsg.includes("bearer") || lowerMsg.includes("token") || lowerMsg.includes("unauthorized");
        
        if (isAuth) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        // Risposta blindata senza svelare dettagli interni di Firestore o BulkWriter
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }
    });
  }
);

export const verifyVoucher = onRequest(
  {
    timeoutSeconds: 30,
    memory: "512MiB",
  },
  async (req, res) => {
    // Restituzione esplicita della Promise per evitare timeout di Express
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      // 1. GESTIONE PREFLIGHT E METODO
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

      try {
        // 2. SICUREZZA: APP CHECK E AUTH
        let uid: string;
        try {
          await requireAppCheck(req);
          uid = await requireUidFromAuthHeader(req);
        } catch (authError) {
          console.warn(`[JURIO-VERIFY-VOUCHER] Fallimento Auth/AppCheck per IP: ${req.ip}`);
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        if (!uid) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        // 3. RATE LIMITING (Fondamentale: previene attacchi di forza bruta / enumerazione dei codici voucher)
        const limits = { perMinute: 10, perDay: 50 };
        try {
          await Promise.all([
            consumePerMinuteFeature(uid, "verify_voucher" as any, limits.perMinute),
            consumeDailyFeature(uid, "verify_voucher" as any, limits.perDay)
          ]);
        } catch (rateLimitError: unknown) {
           const msg = rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError);
           if (msg === "rate_limited" || msg === "quota_exceeded") {
              res.status(429).json({ error: "Too Many Requests", details: "Troppi tentativi di verifica. Riprova più tardi." });
              return;
           }
           throw rateLimitError;
        }

        // 4. SANITIZZAZIONE E TYPE-SAFETY INPUT
        const body = (req.body ?? {}) as VerifyVoucherRequestBody;
        const voucherRaw = typeof body.voucher === "string" ? body.voucher : "";

        // Normalizzazione e sanitizzazione rigorosa del voucher
        const cleanVoucher = voucherRaw.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").substring(0, 50);

        if (!cleanVoucher) {
          res.status(400).json({ error: "Bad Request: Missing or invalid 'voucher'" });
          return;
        }

        // 5. RICERCA NELLA COLLECTION 'teams'
        // Nota: Se la collection teams crescerà molto in futuro, valutare un indice o una collection dedicata di lookup voucher.
        // Per ora manteniamo la logica originale leggendo i team attivi.
        const teamsSnap = await db.collection("teams").get();
        
        const matchedTeams: Array<{ id: string; name: string }> = [];

        teamsSnap.forEach((doc) => {
          const data = doc.data() ?? {};
          const teamVouchers = Array.isArray(data.vouchers) ? data.vouchers : [];
          
          const hasFreeVoucher = teamVouchers.some(
            (v: any) => v && typeof v === "object" && v.id === cleanVoucher && v.used === false
          );

          if (hasFreeVoucher) {
            const teamName = typeof data.name === "string" && data.name.trim() ? data.name.trim() : "Workspace senza nome";
            matchedTeams.push({
              id: doc.id,
              name: teamName
            });
          }
        });

        // 6. RISPOSTA AL CLIENT
        const responsePayload: VerifyVoucherResponse = { 
          success: true, 
          teams: matchedTeams 
        };

        res.status(200).json(responsePayload);
        return;

      } catch (err: unknown) {
        // 7. ANTI INFORMATION DISCLOSURE
        const msg = err instanceof Error ? err.message : "Internal Error";
        console.error(`[JURIO-VERIFY-VOUCHER] Errore in verifyVoucher (UID: ${req.headers.authorization ? "AuthPresent" : "NoAuth"}):`, msg);

        const lowerMsg = msg.toLowerCase();
        const isAuth = lowerMsg.includes("bearer") || lowerMsg.includes("token") || lowerMsg.includes("unauthorized");
        
        if (isAuth) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        // Risposta blindata senza svelare dettagli interni o stacktrace
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }
    });
  }
);

export const removeTeamMember = onRequest(
  {
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (req, res) => {
    // Restituzione esplicita della Promise per evitare timeout di Express
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      // 1. GESTIONE PREFLIGHT E METODO
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

      try {
        // 2. SICUREZZA: APP CHECK E AUTH
        let requesterUid: string;
        try {
          await requireAppCheck(req);
          requesterUid = await requireUidFromAuthHeader(req);
        } catch (authError) {
          console.warn(`[JURIO-REMOVE-MEMBER] Fallimento Auth/AppCheck per IP: ${req.ip}`);
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        if (!requesterUid) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        // 3. RATE LIMITING (Prevenzione abusi di rimozione / spam richieste)
        const limits = { perMinute: 15, perDay: 50 };
        try {
          await Promise.all([
            consumePerMinuteFeature(requesterUid, "remove_member" as any, limits.perMinute),
            consumeDailyFeature(requesterUid, "remove_member" as any, limits.perDay)
          ]);
        } catch (rateLimitError: unknown) {
           const msg = rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError);
           if (msg === "rate_limited" || msg === "quota_exceeded") {
              res.status(429).json({ error: "Too Many Requests" });
              return;
           }
           throw rateLimitError;
        }

        // 4. SANITIZZAZIONE E TYPE-SAFETY INPUT
        const body = (req.body ?? {}) as RemoveTeamMemberRequestBody;
        
        const teamIdRaw = typeof body.teamId === "string" ? body.teamId : "";
        const uidDeleteRaw = typeof body.uidDelete === "string" ? body.uidDelete : "";
        const revokeDocumentAccess = typeof body.revokeDocumentAccess === "boolean" ? body.revokeDocumentAccess : false;

        // Sanitizzazione rigorosa degli ID
        const teamId = teamIdRaw.trim().replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 100);
        const uidDelete = uidDeleteRaw.trim().replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 100);

        if (!teamId || !uidDelete) {
          res.status(400).json({ error: "Bad Request: Missing or invalid 'teamId' or 'uidDelete'" });
          return;
        }

        // 5. VERIFICA TEAM E PERMESSI
        const teamRef = db.collection("teams").doc(teamId);
        const teamSnap = await teamRef.get();
        if (!teamSnap.exists) {
          res.status(404).json({ error: "Not Found: Team non trovato" });
          return;
        }

        const teamData = teamSnap.data() as Record<string, any>;
        const owners = Array.isArray(teamData.owners) ? teamData.owners : [];

        const isOwner = owners.includes(requesterUid); 
        const isSelfLeave = requesterUid === uidDelete;

        if (!isOwner && !isSelfLeave) {
          res.status(403).json({ error: "Forbidden: You don't have permission to remove this member" });
          return;
        }

        // Blocco di sicurezza fondamentale contro orphaning dei workspace
        if (isSelfLeave && owners.includes(uidDelete) && owners.length <= 1) {
          res.status(400).json({ error: "Bad Request: You cannot leave the workspace because you are the only owner left." });
          return;
        }

        // 6. RECUPERO DATI MEMBRO (EMAIL)
        const teamMemberRef = teamRef.collection("members").doc(uidDelete);
        const memberSnap = await teamMemberRef.get();
        const targetEmail = memberSnap.exists && typeof memberSnap.data()?.email === "string" 
          ? memberSnap.data()!.email 
          : undefined;

        // 7. GESTIONE ACCESSO DOCUMENTI
        if (revokeDocumentAccess === true) {
          const targetOwnerUid = isSelfLeave ? owners.find((id: string) => id !== uidDelete) : requesterUid;
          if (targetOwnerUid) {
            await updateUserDocuments(uidDelete, targetOwnerUid);
          }
        }
        await removeUserVisibilityFromDocuments(uidDelete);

        // 8. COMMIT DEL BATCH DI CANCELLAZIONE / AGGIORNAMENTO
        const batch = db.batch();
        
        const userRef = db.collection("users").doc(uidDelete);
        batch.update(userRef, { 
          assignedTeamId: FieldValue.delete() 
        });
        
        const regRef = db.collection("register").doc(uidDelete);
        batch.update(regRef, { 
          assignedTeamId: FieldValue.delete(),
          provider: FieldValue.delete()
        });

        batch.update(teamRef, {
          member_ids: FieldValue.arrayRemove(uidDelete),
          owners: FieldValue.arrayRemove(uidDelete),
          co_owners: FieldValue.arrayRemove(uidDelete) // Aggiunto per sicurezza se era co-owner
        });
        
        batch.delete(teamMemberRef);
        await batch.commit();

        // 9. EFFETTI COLLATERALI (INVIO EMAIL DI RIMOZIONE SE NON È AUTO-USCITA)
        if (targetEmail && !isSelfLeave) {
          const teamNameStr = typeof teamData.name === "string" ? teamData.name : "Workspace";
          void enqueueRemoveTeamEmail({ 
            email: targetEmail, 
            teamName: teamNameStr 
          }).catch(mailErr => {
            console.error(`[JURIO-REMOVE-MEMBER] Errore nell'invio email di rimozione a ${targetEmail}:`, mailErr);
          });
        }

        // 10. RISPOSTA AL CLIENT
        const responsePayload: RemoveTeamMemberResponse = { 
          success: true, 
          message: "Team member removed successfully" 
        };

        res.status(200).json(responsePayload);
        return;

      } catch (err: unknown) {
        // 11. ANTI INFORMATION DISCLOSURE
        const msg = err instanceof Error ? err.message : "Internal Error";
        console.error(`[JURIO-REMOVE-MEMBER] Errore critico (Requester: ${req.headers.authorization ? "AuthPresent" : "NoAuth"}):`, msg);

        const lowerMsg = msg.toLowerCase();
        const isAuth = lowerMsg.includes("bearer") || lowerMsg.includes("token") || lowerMsg.includes("unauthorized");          
        
        if (isAuth) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        res.status(500).json({ error: "Internal Server Error" });
        return;
      }
    });
  }
);

export const deleteTeam = onRequest(
  {
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (req, res) => {
    // Restituzione esplicita della Promise per evitare timeout di Express
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      // 1. GESTIONE PREFLIGHT E METODO
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

      try {
        // 2. SICUREZZA: APP CHECK E AUTH
        let requesterUid: string;
        try {
          await requireAppCheck(req);
          requesterUid = await requireUidFromAuthHeader(req);
        } catch (authError) {
          console.warn(`[JURIO-DELETE-TEAM] Fallimento Auth/AppCheck per IP: ${req.ip}`);
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        if (!requesterUid) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        // 3. RATE LIMITING (Fondamentale: previene abusi di cancellazioni massive di team)
        const limits = { perMinute: 3, perDay: 10 };
        try {
          await Promise.all([
            consumePerMinuteFeature(requesterUid, "delete_team" as any, limits.perMinute),
            consumeDailyFeature(requesterUid, "delete_team" as any, limits.perDay)
          ]);
        } catch (rateLimitError: unknown) {
           const msg = rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError);
           if (msg === "rate_limited" || msg === "quota_exceeded") {
              res.status(429).json({ error: "Too Many Requests", details: "Operazione eseguita troppo spesso. Riprova più tardi." });
              return;
           }
           throw rateLimitError;
        }

        // 4. SANITIZZAZIONE E TYPE-SAFETY INPUT
        const body = (req.body ?? {}) as DeleteTeamRequestBody;
        
        const teamIdRaw = typeof body.teamId === "string" ? body.teamId : "";
        const revokeDocumentAccess = typeof body.revokeDocumentAccess === "boolean" ? body.revokeDocumentAccess : false;

        // Sanitizzazione rigorosa dell'ID del team
        const teamId = teamIdRaw.trim().replace(/[^a-zA-Z0-9_-]/g, "").substring(0, 100);

        if (!teamId) {
          res.status(400).json({ error: "Bad Request: Missing or invalid 'teamId'" });
          return;
        }

        // 5. VERIFICA TEAM E PERMESSI (Solo gli owner possono cancellare il team)
        const teamRef = db.collection("teams").doc(teamId);
        const teamSnap = await teamRef.get();

        if (!teamSnap.exists) {
          res.status(404).json({ error: "Not Found: Team non trovato" });
          return;
        }

        const teamData = teamSnap.data() as Record<string, any>;
        const owners = Array.isArray(teamData.owners) ? teamData.owners : [];

        if (!owners.includes(requesterUid)) {
          res.status(403).json({ error: "Forbidden: Only team owners can delete the team" });
          return;
        }

        // 6. RECUPERO MEMBRI ED EMAIL
        const membersSnap = await teamRef.collection("members").get();
        const allMemberIds = membersSnap.docs
          .map(doc => doc.id)
          .filter(id => typeof id === "string" && id.trim().length > 0);
          
        const allMemberEmails = membersSnap.docs
          .map(doc => doc.data()?.email)
          .filter((email): email is string => typeof email === "string" && email.trim().length > 0);

        const membersToReassign = allMemberIds.filter(id => id !== requesterUid);
        
        // 7. RIASSEGNAZIONE O RIMOZIONE VISIBILITÀ DOCUMENTI
        const reassignPromises = membersToReassign.map(async (memberId) => {
          if (revokeDocumentAccess === true) {
             await updateUserDocuments(memberId, requesterUid);
          }
          await removeUserVisibilityFromDocuments(memberId); 
        });
        await Promise.all(reassignPromises);

        // 8. COSTRUZIONE BATCH MULTIPLI (Gestione limite 500 operazioni per batch di Firestore)
        const batches: WriteBatch[] = [];
        let currentBatch = db.batch();
        let operationCount = 0;

        const incrementBatch = () => {
          operationCount++;
          if (operationCount === 500) {
            batches.push(currentBatch);
            currentBatch = db.batch();
            operationCount = 0;
          }
        };

        // A) Pulizia profili utente e register dei membri
        for (const memberId of allMemberIds) {
          const userRef = db.collection("users").doc(memberId);
          currentBatch.update(userRef, {
            assignedTeamId: FieldValue.delete()
          });
          
          const regRef = db.collection("register").doc(memberId);
          currentBatch.update(regRef, { 
            assignedTeamId: FieldValue.delete(),
            provider: FieldValue.delete()
          });
          
          incrementBatch();
        }

        // B) Cancellazione documenti sub-collection members
        membersSnap.docs.forEach(docSnap => {
          currentBatch.delete(docSnap.ref);
          incrementBatch();
        });

        // C) Cancellazione documento principale del team
        currentBatch.delete(teamRef);
        incrementBatch();

        if (operationCount > 0) {
          batches.push(currentBatch);
        }

        // Esecuzione parallela dei batch di Firestore
        await Promise.all(batches.map(batch => batch.commit()));

        // 9. NOTIFICA MASSIVA DI CHIUSURA TEAM
        if (allMemberEmails.length > 0) {
          const teamNameStr = typeof teamData.name === "string" ? teamData.name : "Workspace";
          void enqueueCloseTeamEmail({ 
            email: allMemberEmails, 
            teamName: teamNameStr 
          }).catch(mailErr => {
            console.error(`[JURIO-DELETE-TEAM] Errore nell'invio delle email di chiusura team:`, mailErr);
          });
        }

        // 10. RISPOSTA AL CLIENT
        const responsePayload: DeleteTeamResponse = { 
          success: true, 
          message: "Team deleted successfully and documents reassigned" 
        };

        res.status(200).json(responsePayload);
        return;

      } catch (err: unknown) {
        // 11. ANTI INFORMATION DISCLOSURE
        const msg = err instanceof Error ? err.message : "Internal Error";
        console.error(`[JURIO-DELETE-TEAM] Errore critico (Requester: ${req.headers.authorization ? "AuthPresent" : "NoAuth"}):`, msg);
        
        const lowerMsg = msg.toLowerCase();
        const isAuth = lowerMsg.includes("bearer") || lowerMsg.includes("token") || lowerMsg.includes("unauthorized");
        
        if (isAuth) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        // Risposta blindata senza svelare dettagli interni di Firestore o BatchWriter
        res.status(500).json({ error: "Internal Server Error" });
        return;
      }
    });
  }
);

// ============================================================================
// TASKS
// ============================================================================

export const tasksDowngrade = onRequest(async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).send("Method Not Allowed");
    return;
  }

  try {
    const uid = typeof req.body?.uid === "string" ? req.body.uid.trim() : "";
    const expireSec =
      typeof req.body?.expireSec === "number" && Number.isFinite(req.body.expireSec)
        ? req.body.expireSec
        : null;

    if (!uid) {
      res.status(400).json({ error: "Missing uid" });
      return;
    }
    if (!expireSec) {
      res.status(400).json({ error: "Missing expireSec" });
      return;
    }

    const userRef = db.collection("users").doc(uid);
    const registerRef = db.collection("register").doc(uid);

    // 1) Guard anti-task-obsoleto: confronta expireSec con register.expire attuale
    const regSnap = await registerRef.get();
    if (!regSnap.exists) {
      res.status(200).json({ ok: true, skipped: "register_not_found" });
      return;
    }

    const reg = regSnap.data() as any;
    const currentExpire: Timestamp | null = reg?.expire instanceof Timestamp ? reg.expire : null;

    if (!currentExpire) {
      res.status(200).json({ ok: true, skipped: "no_current_expire" });
      return;
    }

    const currentExpireSec = Math.floor(currentExpire.toMillis() / 1000);
    if (currentExpireSec !== expireSec) {
      res.status(200).json({ ok: true, skipped: "outdated_task" });
      return;
    }

    // 2) Downgrade + claim email in modo consistente (NO side-effects esterni in tx)
    const txOut = await db.runTransaction(async (tx): Promise<DowngradeTxResult> => {
      const userSnap = await tx.get(userRef);
      if (!userSnap.exists) {
        return {
          skipped: "user_not_found",
          alreadyDowngraded: false,
          alreadyEmailed: false,
          shouldSendEmail: false,
        };
      }

      const user = userSnap.data() as any;
      const alreadyDowngraded = user?.status === "nessuno";
      const alreadyEmailed = !!user?.downgradeEmailSentAt;

      if (!alreadyDowngraded) {
        tx.set(userRef, { status: "nessuno", downgradedAt: FieldValue.serverTimestamp() }, { merge: true });
        tx.set(registerRef, { planId: "nessuno", downgradedAt: FieldValue.serverTimestamp() }, { merge: true });
      }

      let shouldSendEmail = false;
      if (!alreadyEmailed) {
        tx.set(userRef, { downgradeEmailSentAt: FieldValue.serverTimestamp() }, { merge: true });
        shouldSendEmail = true;
      }

      return {
        skipped: null,
        alreadyDowngraded,
        alreadyEmailed,
        shouldSendEmail,
      };
    });

    if (txOut.skipped === "user_not_found") {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // 3) side-effect fuori transaction (idempotenza garantita dal claim in tx)
    if (txOut.shouldSendEmail) {
      await enqueueDowngradeEmail({ uid });
    }

    res.status(200).json({
      ok: true,
      skipped: txOut.skipped,
      alreadyDowngraded: txOut.alreadyDowngraded,
      alreadyEmailed: txOut.alreadyEmailed,
    });
    return;
  } catch (e) {
    console.error("[TASKS_DOWNGRADE] error", e);
    res.status(500).json({ error: "Internal error" });
    return;
  }
});

export const processContacts = onDocumentWritten(
  {
    document: "contacts/{docId}", 
    timeoutSeconds: 120,
    memory: "512MiB"
  },
  async (event) => {
    const snapshot = event.data?.after;
    
    // 1. Controllo esistenza snapshot (Admin SDK: .exists è boolean)
    if (!snapshot || !snapshot.exists) {
      console.log("Documento non esistente o rimosso.");
      return;
    }

    const data = snapshot.data();
    const docId = event.params.docId;

    // 2. Controllo robusto sui campi obbligatori
    const hasRequiredFields = 
      data &&
      typeof data.name === "string" && data.name.trim() !== "" &&
      typeof data.email === "string" && data.email.trim() !== "" &&
      typeof data.subject === "string" && data.subject.trim() !== "" &&
      typeof data.message === "string" && data.message.trim() !== "";

    if (!hasRequiredFields) {
      console.warn(`Documento ${docId} ignorato: campi obbligatori mancanti o malformati.`, data);
      return;
    }

    try {
      // 3. Chiamata al metodo solo se tutto è validato
      await enqueueContactEmail({
        nome: data.name.trim(),
        email: data.email.trim().toLowerCase(),
        subject: data.subject.trim(),
        message: data.message.trim(),
        id: docId
      });

      console.log(`Email processata correttamente per il ticket: ${docId}`);
    } catch (error) {
      console.error("Errore critico durante l'esecuzione di enqueueContactEmail:", error);
    }
  }
);

// ============================================================================
// INTEGRAZIONE CLOUD (GOOGLE DRIVE & MICROSOFT GRAPH)
// ============================================================================

export const listCloudFiles = onRequest(
  { 
    timeoutSeconds: 60, 
    memory: "1GiB",
  },
  async (req, res) => {
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      // 1. GESTIONE PREFLIGHT E METODO
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

      try {
        // 2. SICUREZZA: APP CHECK E AUTH
        let uid: string;
        try {
          await requireAppCheck(req);
          uid = await requireUidFromAuthHeader(req);
        } catch (authError) {
          console.warn(`[JURIO-CLOUD-LIST] Fallimento Auth/AppCheck per IP: ${req.ip}`);
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        if (!uid) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        // 3. RATE LIMITING (Prevenzione DoS / Chiamate massive alle API dei Cloud Provider)
        const limits = { perMinute: 15, perDay: 100 };
        try {
          await Promise.all([
            consumePerMinuteFeature(uid, "cloud_files" as any, limits.perMinute),
            consumeDailyFeature(uid, "cloud_files" as any, limits.perDay)
          ]);
        } catch (rateLimitError: unknown) {
           const msg = rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError);
           if (msg === "rate_limited" || msg === "quota_exceeded") {
              res.status(429).json({ error: "Too Many Requests", details: "Troppe richieste. Riprova più tardi." });
              return;
           }
           throw rateLimitError;
        }

        // 4. SANITIZZAZIONE E TYPE-SAFETY INPUT
        const body = (req.body ?? {}) as CloudFilesListRequestBody;
        const providerRaw = typeof body.provider === "string" ? body.provider.trim().toLowerCase() : "";
        const providerTokenRaw = typeof body.providerToken === "string" ? body.providerToken.trim() : "";

        if (!providerTokenRaw) {
          res.status(400).json({ error: "Bad Request: Token del cloud provider mancante o non valido." });
          return;
        }

        if (providerRaw !== "google" && providerRaw !== "microsoft") {
          res.status(400).json({ error: "Bad Request: Provider non supportato (usa 'google' o 'microsoft')." });
          return;
        }

        // 5. INTEGRAZIONE GOOGLE DRIVE
        if (providerRaw === "google") {
          const auth = new google.auth.OAuth2();
          auth.setCredentials({ access_token: providerTokenRaw });
          const drive = google.drive({ version: 'v3', auth });
          
          const driveRes = await drive.files.list({
            q: "mimeType='application/pdf' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document'",
            pageSize: 50,
            fields: "files(id, name, mimeType, modifiedTime)",
          });
          
          res.status(200).json({ files: driveRes.data.files ?? [] });
          return;
        } 
        
        // 6. INTEGRAZIONE MICROSOFT ONEDRIVE
        else if (providerRaw === "microsoft") {
          const msRes = await fetch("https://graph.microsoft.com/v1.0/me/drive/root/search(q='.pdf')?select=id,name,file,lastModifiedDateTime,webUrl", {
            headers: { Authorization: `Bearer ${providerTokenRaw}` }
          });
          
          if (!msRes.ok) {
            console.warn(`[JURIO-CLOUD-LIST] Errore risposto da Microsoft Graph API: ${msRes.status}`);
            res.status(502).json({ error: "Bad Gateway: Errore durante la comunicazione con il provider Microsoft." });
            return;
          }
          
          const data = (await msRes.json()) as { value?: Array<any> };
          const files = (data.value || []).map((f: any) => ({
            id: typeof f.id === "string" ? f.id : "",
            name: typeof f.name === "string" ? f.name : "Senza nome",
            mimeType: f.file?.mimeType ?? "application/octet-stream",
            modifiedTime: f.lastModifiedDateTime ?? null,
            webUrl: typeof f.webUrl === "string" ? f.webUrl : ""
          }));
          
          res.status(200).json({ files });
          return;
        }

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Internal Error";
        const bodyProvider = req.body && typeof req.body === "object" ? (req.body as any).provider : "unknown";
        console.error(`[JURIO-CLOUD-LIST] Errore critico per provider [${bodyProvider}]:`, msg);
        
        const lowerMsg = msg.toLowerCase();
        const isAuth = lowerMsg.includes("bearer") || lowerMsg.includes("token") || lowerMsg.includes("unauthorized") || lowerMsg.includes("invalid_grant");
        
        if (isAuth) {
          res.status(401).json({ error: "Unauthorized: Token del cloud provider scaduto o non valido." });
          return;
        }

        res.status(500).json({ error: "Internal Server Error" });
        return;
      }
    });
  }
);


export const downloadCloudFile = onRequest(
  { 
    timeoutSeconds: 120, 
    memory: "1GiB",
  },
  async (req, res) => {
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      // 1. GESTIONE PREFLIGHT E METODO
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).json({ error: "Method Not Allowed" }); return; }

      try {
        // 2. SICUREZZA: APP CHECK E AUTH
        let uid: string;
        try {
          await requireAppCheck(req);
          uid = await requireUidFromAuthHeader(req);
        } catch (authError) {
          console.warn(`[JURIO-CLOUD-DOWNLOAD] Fallimento Auth/AppCheck per IP: ${req.ip}`);
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        if (!uid) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }

        // 3. RATE LIMITING (Protezione download massivo di file binari pesanti)
        const limits = { perMinute: 10, perDay: 50 };
        try {
          await Promise.all([
            consumePerMinuteFeature(uid, "cloud_files" as any, limits.perMinute),
            consumeDailyFeature(uid, "cloud_files" as any, limits.perDay)
          ]);
        } catch (rateLimitError: unknown) {
           const msg = rateLimitError instanceof Error ? rateLimitError.message : String(rateLimitError);
           if (msg === "rate_limited" || msg === "quota_exceeded") {
              res.status(429).json({ error: "Too Many Requests", details: "Troppi download simultanei. Riprova più tardi." });
              return;
           }
           throw rateLimitError;
        }

        // 4. SANITIZZAZIONE E TYPE-SAFETY INPUT
        const body = (req.body ?? {}) as CloudFileDownloadRequestBody;
        const providerRaw = typeof body.provider === "string" ? body.provider.trim().toLowerCase() : "";
        const providerTokenRaw = typeof body.providerToken === "string" ? body.providerToken.trim() : "";
        const fileIdRaw = typeof body.fileId === "string" ? body.fileId.trim() : "";

        if (!providerTokenRaw || !fileIdRaw) {
          res.status(400).json({ error: "Bad Request: Parametri mancanti ('providerToken' o 'fileId')." });
          return;
        }

        if (providerRaw !== "google" && providerRaw !== "microsoft") {
          res.status(400).json({ error: "Bad Request: Provider non supportato (usa 'google' o 'microsoft')." });
          return;
        }

        // Sanitizzazione rigorosa dell'ID file per prevenire path traversal o injection
        const fileId = fileIdRaw.replace(/[^a-zA-Z0-9_.-]/g, "").substring(0, 250);
        if (!fileId) {
          res.status(400).json({ error: "Bad Request: Formato fileId non valido." });
          return;
        }

        // 5. DOWNLOAD DA GOOGLE DRIVE
        if (providerRaw === "google") {
          const auth = new google.auth.OAuth2();
          auth.setCredentials({ access_token: providerTokenRaw });
          const drive = google.drive({ version: 'v3', auth });
          
          const driveRes = await drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'arraybuffer' }
          );
          
          const contentType = typeof driveRes.headers['content-type'] === "string" 
            ? driveRes.headers['content-type'] 
            : 'application/pdf';
            
          res.setHeader('Content-Type', contentType);
          res.send(Buffer.from(driveRes.data as ArrayBuffer));
          return;
        } 
        
        // 6. DOWNLOAD DA MICROSOFT ONEDRIVE
        else if (providerRaw === "microsoft") {
          const msRes = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`, {
            headers: { Authorization: `Bearer ${providerTokenRaw}` }
          });
          
          if (!msRes.ok) {
            console.warn(`[JURIO-CLOUD-DOWNLOAD] Errore risposto da Microsoft Graph API per file ${fileId}: ${msRes.status}`);
            res.status(502).json({ error: "Bad Gateway: Impossibile scaricare il file da Microsoft." });
            return;
          }
          
          const arrayBuffer = await msRes.arrayBuffer();
          const contentType = msRes.headers.get('content-type') || 'application/pdf';
          
          res.setHeader('Content-Type', contentType);
          res.send(Buffer.from(arrayBuffer));
          return;
        }

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Internal Error";
        const bodyProvider = req.body && typeof req.body === "object" ? (req.body as any).provider : "unknown";
        console.error(`[JURIO-CLOUD-DOWNLOAD] Errore critico per provider [${bodyProvider}]:`, msg);
        
        const lowerMsg = msg.toLowerCase();
        const isAuth = lowerMsg.includes("bearer") || lowerMsg.includes("token") || lowerMsg.includes("unauthorized") || lowerMsg.includes("invalid_grant");
        
        if (isAuth) {
          res.status(401).json({ error: "Unauthorized: Token del cloud provider scaduto o non valido." });
          return;
        }

        res.status(500).json({ error: "Internal Server Error" });
        return;
      }
    });
  }
);

