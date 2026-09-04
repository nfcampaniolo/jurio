import { onRequest } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2/options";
import { Timestamp, FieldValue, Query, WriteBatch } from "firebase-admin/firestore";
import { getAdmin, getDb, getAdminAuth ,sanitize } from "./deps";
import { MAX_INPUT_CHARS, PROMPT_MASSIMAZIONE, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, PlanDoc, getStripe, getWebhookSecret,normalizePlanId, handleEmbeddingCreation, handleEmbeddingDocumentCreation, handleFascicoloCreation, handleEmbeddingManualCreation } from "./params";
import { enqueueWelcomeEmail, enqueueTrialEmail, queuePurchaseEmailOnceStripe, enqueueDowngradeEmail, enqueueContactEmail, enqueueVoucherEmail, enqueueWelcomeTeamEmail, enqueueRemoveTeamEmail, enqueueCloseTeamEmail } from "./email";
import { corsHandlerDomain, requireAppCheck, requireUidFromAuthHeader, consumePerMinuteFeature, consumeDailyFeature, getKeywordStems, calculateMatchScore, applyHighlightWithRegex, generateHighlightRegex, runUpdateFonte, runUpdateMetadata, runCleanupDuplicates, processFascicoloDocs, processSubscriptionInTx, tryScheduleDowngradeTask, updateUserDocuments, removeUserVisibilityFromDocuments} from "./utils";
import { scheduleDowngradeTask, DowngradeTxResult, computeAndSaveWeeklyStats, computeAndSaveMonthlyUsage } from "./tasks";
import { onDocumentCreated, onDocumentWritten } from "firebase-functions/v2/firestore";
import OpenAI from "openai";
import Stripe from "stripe";
import { SpeechClient } from "@google-cloud/speech";
import { legalAgentFlow, legalAgentSupport, legalGeminiFallbackFlow, reasoningFlow, estraiMetadatiFlow, wordQuoteFlow, wordReviewFlow, promptBuilderFlow } from './genkit';
import { onSchedule } from "firebase-functions/v2/scheduler"; 
// @ts-ignore
import pdfExtract from "pdf-extraction";
import * as busboyModule from "busboy";
import { google } from "googleapis";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {createMcpServer} from "./mcp";

const Busboy = busboyModule.default || busboyModule;
const db = getDb();
const admin = getAdmin();
const MAX_NOTES_CHARS = 2000;

setGlobalOptions({
  region: "europe-west1",
  timeoutSeconds: 300,
  memory: "1GiB",
  invoker: "public"
});


// ============================================================================
// MCP SERVER
// ============================================================================

export const jurioMcpServer = onRequest(
  {
    timeoutSeconds: 300,
    memory: "512MiB",
  },
  async (req: any, res: any): Promise<void> => {
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
      }

      const path = req.path || "";

      if (path === "/favicon.ico" || path === "/favicon.png") {
        res.redirect(302, "https://jurio.it/logo.webp");
        return;
      }

      if (path === "/.well-known/mcp/server-card/" || path === "/.well-known/mcp/server-card") {
        res.status(200).json({
          name: "Jurio MCP Server",
          version: "1.0.0",
          description: "Server MCP per la ricerca nella giurisprudenza italiana",
        });
        return;
      }
      
      if (req.method === "GET" && (path === "" || path === "/")) {
        res.status(200).json({
          name: "Jurio MCP Server",
          status: "active",
        });
        return;
      }
      
      const authHeader =
        typeof req.headers?.authorization === "string"
          ? req.headers.authorization
          : "";

      const server = createMcpServer(authHeader);

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
        enableJsonResponse: true,
      });

      res.on("close", () => {
        void transport.close().catch((error: unknown) => {
          console.error("[JURIO-MCP] Errore chiusura transport:", error);
        });
      });

      try {
        await server.connect(transport);
        console.log(`[JURIO-MCP] ${req.method} ${path}`);
        await transport.handleRequest(req, res, req.body);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error("[JURIO-MCP] Errore MCP:", error);

        if (!res.headersSent) {
          res.status(500).json({
            error: "MCP server error",
            message,
          });
        }
      }
    });
  }
);

// ============================================================================
// AI ENDPOINTS
// ============================================================================

export const vectorSearchJurio = onRequest(
  {
    secrets: ["OPENAI_API_KEY", "GOOGLE_GENAI_API_KEY"],
    timeoutSeconds: 75,
    memory: "1GiB", 
  },
  async (req, res) => {
    return corsHandlerDomain(req, res, async () => {
      if (req.method === "OPTIONS") return res.status(204).end();
      if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

      try {
        // 1) INPUT SANITIZATION
        const body = req.body ?? {};
        const queryText = typeof body.query === "string" ? body.query.trim() : "";

        if (!queryText) {
          return res.status(400).json({ error: "Invalid 'query'" });
        }

        const requestedLimit = Number(body.limit);
        const limit = Number.isFinite(requestedLimit)
          ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100)
          : 50;

        const filters = Array.isArray(body.filters) ? body.filters : [];
        const collectionName =
          typeof body.collection === "string" && body.collection.trim()
            ? body.collection.trim()
            : "sentences";

        // 2) PREPARAZIONE NLP INIZIALE
        let kwObjects = getKeywordStems(queryText);
        let originalKws = kwObjects.map((k) => k.original);
        let stemsList = kwObjects.map((k) => k.stem);

        const totalKeywords = kwObjects.length;
        let minRequiredKeywords = Math.max(1, Math.ceil(totalKeywords * 0.8));

        // 3) AUTH BASE - IBRIDA (Frontend React / OAuth / External Connectors)
        let uid: string = "";
        
        const authHeader = req.headers.authorization || "";
        const token = authHeader.replace("Bearer ", "").trim();

        let isOAuthRequest = false;

        // Controllo token OAuth / Connettori esterni (es. Mistral, ChatGPT)
        if (token) {
          const directUserSnap = await db.collection("register").doc(token).get();
          if (directUserSnap.exists) {
            uid = token;
            isOAuthRequest = true;
            console.log(`[JURIO-SEARCH] Autenticazione diretta via UID riuscita per: ${uid}`);
          }
        }
        if (!isOAuthRequest) {
          // Flusso standard per il tuo Frontend Web (AppCheck + decodifica JWT)
          await requireAppCheck(req);
          uid = await requireUidFromAuthHeader(req);
        }

        // Protezione finale: se per qualsiasi motivo l'UID non è stato valorizzato, blocchiamo
        if (!uid) {
          return res.status(401).json({ error: "Unauthorized: Access denied" });
        }

        // 4) PARALLELIZZAZIONE DB READ + OPENAI
        const oaClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

        const [userSnap, embeddingPromiseResult] = await Promise.all([
          db.collection("register").doc(uid).get(),
          oaClient.embeddings.create({
            model: "text-embedding-3-small",
            input: `Contesto giuridico italiano: ${queryText}`,
            dimensions: 1536,
          })
        ]);

        // 5) VERIFICA PIANO UTENTE
        if (!userSnap.exists) {
          return res.status(404).json({ error: "User not found" });
        }
        const planId = String(userSnap.data()?.planId ?? "");
        const allowedPlans = new Set([
          "prova", "admin", "business", "personale", "business_m", "personale_m",
        ]);

        if (!allowedPlans.has(planId)) {
          return res.status(403).json({ 
            error: "Access denied", 
            message: "È richiesto un piano attivo per utilizzare la ricerca." 
          });
        }

        // --- RATE LIMITING ---
        const limits = { perMinute: 20, perDay: 100 };
        await Promise.all([
          consumePerMinuteFeature(uid, "research" as any, limits.perMinute),
          consumeDailyFeature(uid, "research" as any, limits.perDay)
        ]);
        
        const queryVector = embeddingPromiseResult.data[0].embedding;

        // 🌟 OTTIMIZZAZIONE PROIEZIONE DATABASE: Selezioniamo solo i campi necessari alla UI
        const baseCollection = db.collection(collectionName).select(
          "tipo_documento", "fonte", "logo_fonte", "organo_giudicante", "sezione", 
          "numero_sentenza", "dataSentenza", "data_sentenza", "ecli", "urn",
          "tipo_ordinanza", "efficacia_temporale", "misura_disposta", "fumus_boni_iuris", "periculum_in_mora",
          "tipo_decreto", "contraddittorio", "autorita_monocratica", "contenuto_precettivo",
          "massima", "summary", "fattispecie_rilevante"
        );

        // PREPARAZIONE FILTRI
        const appliedFilters = filters.reduce((q: any, f: any) => {
          if (f && typeof f.field === "string" && typeof f.operator === "string" && "value" in f) {
            let queryValue = f.value;
            // INTERCETTIAMO IL TIMESTAMP SERIALIZZATO DAL FRONTEND
            if (
              f.value && 
              typeof f.value === "object" && 
              (f.value.type === "firestore/timestamp/1.0" || "seconds" in f.value)
            ) {
              const seconds = f.value.seconds;
              const nanoseconds = f.value.nanoseconds || 0;
              
              if (typeof seconds === "number") {
                queryValue = new Timestamp(seconds, nanoseconds);
              }
            }
            return q.where(f.field, f.operator, queryValue);
          }
          return q;
        }, baseCollection as any);

        // FUNZIONE HELPER: Esegue la query vettoriale e lo scoring
        const performSearchAndScoring = async (vector: any, currentKwObjects: any[]) => {
          const candidateLimit = Math.min(Math.max(limit * 2, 50), 100);
          const sSnap = await appliedFilters
            .findNearest("embedding", FieldValue.vector(vector), {
              limit: candidateLimit,
              distanceMeasure: "COSINE",
            })
            .get();

          const maxScoringCandidates = Math.min(limit * 2, 40); 
          const candidateDocs = sSnap.docs.slice(0, maxScoringCandidates);

          return candidateDocs
            .map((doc: any) => {
              const data = doc.data() ?? {};
              const content = [data.summary, data.massima, data.fattispecie_rilevante]
                .filter(Boolean)
                .join(" ");

              const scores = calculateMatchScore(content, currentKwObjects, data);
              const baseDistance = typeof doc.distance === "number" ? doc.distance : 0.8;

              let rankingDistance = scores.textMatchScore === 0
                  ? baseDistance * 1.25
                  : baseDistance * Math.pow(0.96, scores.textMatchScore);

              rankingDistance -= (scores.authorityBonus ?? 0) + (scores.recencyBonus ?? 0);
              rankingDistance = Math.max(0.001, rankingDistance);

              const MAX_CHARS = 10000;
              const safeTruncate = (text: unknown) => text ? text.toString().substring(0, MAX_CHARS) : null;

              // 🌟 MAPPING ESPLICITO: Aggiunto l'URL pubblico per Mistral/Client e mantenuto il resto
              return {
                id: doc.id,
                url: `https://jurio.it/giurisprudenza/${doc.id}`, // <-- QUI GENERA L'URL DINAMICO
                tipo_documento: data.tipo_documento || "sentenza",
                fonte: data.fonte || null,
                logo_fonte: data.logo_fonte || null,
                organo_giudicante: data.organo_giudicante || null,
                sezione: data.sezione || null,
                numero_sentenza: data.numero_sentenza || null,
                dataSentenza: data.dataSentenza || data.data_sentenza || null,
                ecli: data.ecli || null,
                urn: data.urn || null,

                // Campi ordinanze
                tipo_ordinanza: data.tipo_ordinanza || null,
                efficacia_temporale: data.efficacia_temporale || null,
                misura_disposta: data.misura_disposta || null,
                fumus_boni_iuris: data.fumus_boni_iuris || null,
                periculum_in_mora: data.periculum_in_mora || null,

                // Campi decreti
                tipo_decreto: data.tipo_decreto || null,
                contraddittorio: data.contraddittorio !== undefined ? data.contraddittorio : null,
                autorita_monocratica: data.autorita_monocratica !== undefined ? data.autorita_monocratica : null,
                contenuto_precettivo: data.contenuto_precettivo || null,

                // Blocchi di testo troncati
                massima: safeTruncate(data.massima),
                summary: safeTruncate(data.summary),
                fattispecie_rilevante: safeTruncate(data.fattispecie_rilevante),

                // Metadati interni di ranking
                _matchCount: Math.floor(scores.textMatchScore ?? 0),
                _distance: doc.distance ?? baseDistance,
                _rankingDistance: rankingDistance,
                _source: "direct",
              };
            })
            .filter((item: any) => item._matchCount > 0 || item._distance <= 0.75)
            .sort((a: any, b: any) => a._rankingDistance - b._rankingDistance);
        };

        // 6) PRIMA RICERCA VETTORIALE (Originale)
        let scoredItems = await performSearchAndScoring(queryVector, kwObjects);

        // 7) FALLBACK GEMINI TRAMITE GENKIT FLOW (ESCLUSO PER I CONNETTORI ESTERNI)
        let geminiResponsePayload: any = null;
        const FALLBACK_THRESHOLD = 0.7; 
        const needsFallback = scoredItems.length === 0 || scoredItems[0]._rankingDistance > FALLBACK_THRESHOLD;

        console.log(`[JURIO-SEARCH] Valutazione needsFallback: ${needsFallback} (Soglia: ${FALLBACK_THRESHOLD})`);

        // 🌟 Modifica cruciale: Eseguiamo il fallback SOLO se la richiesta NON è un connettore esterno
        if (needsFallback && !isOAuthRequest) {
          try {
            const fallbackResult = await legalGeminiFallbackFlow({ query: queryText });
            
            if (fallbackResult) {
              console.log(`[JURIO-SEARCH] Flow Genkit completato con successo. Query generata: "${fallbackResult.queryAlternativa}"`);
              
              geminiResponsePayload = {
                sintesi: fallbackResult.sintesi,
                queryAlternativa: fallbackResult.queryAlternativa,
              };

              // Ricalcoliamo con la nuova query
              const altQueryText = fallbackResult.queryAlternativa;
              kwObjects = getKeywordStems(altQueryText); 
              originalKws = kwObjects.map((k) => k.original);
              stemsList = kwObjects.map((k) => k.stem);
              minRequiredKeywords = Math.max(1, Math.ceil(kwObjects.length * 0.8));

              const altEmbeddingRes = await oaClient.embeddings.create({
                model: "text-embedding-3-small",
                input: `Contesto giuridico italiano: ${altQueryText}`,
                dimensions: 1536,
              });
              const altQueryVector = altEmbeddingRes.data[0].embedding;

              const altScoredItems = await performSearchAndScoring(altQueryVector, kwObjects);
              console.log(`[JURIO-SEARCH] 2° Ricerca completata. Trovati: ${altScoredItems.length} documenti.`);

              if (altScoredItems.length > 0) {
                scoredItems = altScoredItems.map((item: any) => ({
                  ...item,
                  _source: "gemini_fallback",
                }));
              }
            } else {
              console.warn(`[JURIO-SEARCH] ATTENZIONE: Il Flow Genkit ha restituito un risultato nullo/indefinito.`);
            }
          } catch (geminiErr) {
            console.error(`[JURIO-SEARCH] ERRORE GRAVE nel fallback Genkit:`, geminiErr);
          }
        } else if (needsFallback && isOAuthRequest) {
          console.log(`[JURIO-SEARCH] Fallback Gemini bypassato perché la richiesta è un connettore esterno (MCP/OAuth).`);
        }

        // 8) OUTPUT & LAZY HIGHLIGHTING DETTAGLIATO PER IL COMPONENTE FRONTEND
        const highlightRegex = generateHighlightRegex(originalKws, stemsList);
        const limitedItems = scoredItems.slice(0, limit);

        const finalItems = limitedItems.map((item: any) => ({
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

        const topMatches = finalItems.filter((item: any) => item._matchCount >= minRequiredKeywords);
        const regularMatches = finalItems.filter((item: any) => item._matchCount < minRequiredKeywords);

        return res.status(200).json({
          ids: finalItems.map((d: any) => d.id),
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
      } catch (err: any) {
        console.error("Search Error:", err);
        return res.status(500).json({ error: "Internal Error", details: err.message });
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
        res.end(); // Libera la UI del client immediatamente

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
        console.error("🔥 ERRORE CRITICO LEGAL AGENT:", err);

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
        console.error("🔥 ERRORE CRITICO WORD AGENT:", err);

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
    secrets: ["GOOGLE_GENAI_API_KEY"] 
  },
  async (event) => {
    // ... tutto il resto del codice rimane esattamente com'è ...
    const snapshot = event.data;
    if (!snapshot) return;

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
          const data = doc.data();
          const ruolo = data.role === "model" ? "IA" : "UTENTE";
          return `${ruolo}: ${data.content}`;
        })
        .reverse()
        .join("\n\n");

      const fascicoloRef = db.collection("fascicoli").doc(fascicoloId);
      const fascicoloSnap = await fascicoloRef.get();
      if (!fascicoloSnap.exists) return;
      
      const metadatiAttuali = fascicoloSnap.data()?.metadati || {};

      const result = await estraiMetadatiFlow({
        chatContext,
        metadatiAttuali
      });

      const estratti = result.dati_nuovi_o_aggiornati || [];
      if (estratti.length === 0) return;

      const updatePayload: Record<string, any> = {};
      estratti.forEach((item: any) => {
        const safeKey = item.chiave.trim().replace(/[\.\/]/g, ''); 
        updatePayload[`metadati.${safeKey}`] = item.valore.trim();
      });

      await fascicoloRef.update(updatePayload);
      console.log(`Metadati aggiornati dal messaggio per fascicolo ${fascicoloId}:`, updatePayload);

    } catch (error) {
      console.error("Errore durante l'aggiornamento silente dei metadati:", error);
    }
  }
);

export const support = onRequest(
  { 
    secrets: ["GOOGLE_GENAI_API_KEY"],
    timeoutSeconds: 300,
    memory: "1GiB"
  }, 
  async (req, res) => {
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      if (req.method === "OPTIONS") {
        res.status(204).end();
        return;
      }
      if (req.method !== "POST") {
        res.status(405).send("Method Not Allowed");
        return;
      }

      try {
        await requireAppCheck(req);
       
        const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown_ip";
        const ipIdentifier = `ip_${clientIp}`;
        const publicLimits = { perMinute: 5, perDay: 30 };

        await Promise.all([
          consumePerMinuteFeature(ipIdentifier, "support_public" as any, publicLimits.perMinute),
          consumeDailyFeature(ipIdentifier, "support_public" as any, publicLimits.perDay)
        ]);

        // --- 4. ADEGUAMENTO E VALIDAZIONE INPUT ---
        const body = req.body ?? {};
        const messages = body.messages;

        // Se il frontend manda { messages }, estraiamo l'ultimo per il prompt
        if (!Array.isArray(messages) || messages.length === 0) {
          res.status(400).json({ error: "Missing messages array." });
          return;
        }

        // 1. Estraiamo i dati
        const lastMessage = messages[messages.length - 1];
        const historyRaw = messages.slice(0, -1);

        // 2. Mappatura con casting esplicito per soddisfare TypeScript
        const flowInput = {
          prompt: lastMessage.content as string,
          history: historyRaw.map((m: any) => {
            // Determiniamo il ruolo corretto
            const role: "user" | "model" = m.role === 'assistant' ? 'model' : 'user';
            
            return {
              role: role, // Ora TypeScript sa che è uno dei valori ammessi
              content: m.content as string
            };
          })
        };

        // 5. CONFIGURAZIONE HEADER SSE
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders(); 

        // --- 6. ESECUZIONE DEL FLOW ---
        // Usiamo flowInput invece di body!
        const flowStream = legalAgentSupport.stream(flowInput);

        for await (const chunk of flowStream.stream) {
          res.write(`data: ${JSON.stringify({ message: chunk })}\n\n`);
        }

        const finalOutput = await flowStream.output; 
        res.write(`data: ${JSON.stringify({ result: finalOutput })}\n\n`);
        
        res.write(`data: [DONE]\n\n`);
        res.end();
        return;

      } catch (err: any) {
        const msg = err instanceof Error ? err.message : "Internal error";
        console.error("Errore Support Endpoint:", err);

        if (res.headersSent) {
          res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
          res.end();
        } else {
          const status = (msg === "rate_limited" || msg === "quota_exceeded") ? 429 : 500;
          res.status(status).json({ error: msg });
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
    memory: "1GiB" 
  },
  async (req, res) => {
    return corsHandlerDomain(req, res, async () => {
      // 1. GESTIONE CORS E METODO
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

      try {
        // 2. AUTH E CONTROLLO DATI INGRESSO
        await requireAppCheck(req);
        const uid = await requireUidFromAuthHeader(req);
        const body: any = req.body ?? {};
        
        const question = typeof body?.question === "string" ? body.question.trim() : "";
        // NUOVO: Estraiamo il promptId
        const promptId = typeof body?.promptId === "string" ? body.promptId.trim() : null;

        if (!question) { res.status(400).json({ error: "Invalid 'question'" }); return; }
        if (question.length > MAX_INPUT_CHARS) { res.status(413).json({ error: "Question too large" }); return; }

        // 3. CONTROLLO UTENTE E PIANI
        const snap = await db.collection("register").doc(uid).get();
        if (!snap.exists) { res.status(404).json({ error: "User not found" }); return; }

        const planId = String(snap.data()?.planId ?? "");
        if (!["prova", "admin", "business", "business_m"].includes(planId)) {
          res.status(403).json({ error: "Access denied" }); 
          return; 
        }

        // 4. CONTROLLO LIMITE DI 100 DOCUMENTI
        const docsCountSnap = await db.collection("documents")
          .where("userId", "==", uid)
          .count()
          .get();

        if (docsCountSnap.data().count >= 100) {
          res.status(403).json({ error: "document_limit_reached", details: "Hai già raggiunto il limite massimo di 100 documenti." });
          return;
        }

        // 5. GESTIONE RATE LIMITS
        const limits = planId === "prova" ? { perMinute: 5, perDay: 20 }
                     : planId === "business" ? { perMinute: 20, perDay: 200 }
                     : { perMinute: 120, perDay: 10_000 };

        await consumePerMinuteFeature(uid, "reasoning" as any, limits.perMinute);
        await consumeDailyFeature(uid, "reasoning" as any, limits.perDay);

        // ==========================================
        // NUOVO: RECUPERO DEL PROMPT CUSTOM DA FIRESTORE
        // ==========================================
        let customPromptText: string | undefined = undefined;

        if (promptId && promptId !== "default") {
          // 1. Prima proviamo a cercarlo nei prompt personali dell'utente
          const promptDoc = await db.collection("register").doc(uid).collection("prompts").doc(promptId).get();
          
          if (promptDoc.exists) {
            customPromptText = promptDoc.data()?.content;
          } else {
            // 2. Se non è tra quelli personali, controlliamo nei modelli pubblici globali
            const publicPromptDoc = await db.collection("prompt_list").doc(promptId).get();
            
            if (publicPromptDoc.exists) {
              customPromptText = publicPromptDoc.data()?.content;
            } else {
              console.warn(`[REASONING] Prompt non trovato (ID: ${promptId}) né tra i personali dell'utente ${uid} né nei modelli pubblici. Fallback al prompt standard.`);
            }
          }
        }

        // 6. ESECUZIONE DEL FLOW GENKIT (Passiamo il customPrompt se esiste)
        const parsedJson = await reasoningFlow({ 
          question, 
          customPrompt: customPromptText 
        });

        // 7. RISPOSTA AL CLIENT
        res.status(200).json({
          message: parsedJson,
          status: "SENT_BY_BOT",
          model: "gemini-2.5-flash", 
          provider: "google"
        });
        return;

      } catch (err: any) {
        console.error("Errore nell'endpoint reasoning:", err);
        const msg = err instanceof Error ? err.message : "Internal error";
        
        if (err?.code === "rate_limited" || msg === "rate_limited") { res.status(429).json({ error: "rate_limited" }); return; }
        if (err?.code === "quota_exceeded" || msg === "quota_exceeded") { res.status(429).json({ error: "quota_exceeded" }); return; }
        
        const isAuth = msg.toLowerCase().includes("auth") || msg.toLowerCase().includes("bearer");
        res.status(isAuth ? 401 : 500).json({ error: "Process failed", details: msg });
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
    async (req: any, res: any) => {
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
        // 1. AUTH
        await requireAppCheck(req);
        const uid = await requireUidFromAuthHeader(req);

        // 2. USER / PLAN
        const userSnap = await admin
          .firestore()
          .collection("register")
          .doc(uid)
          .get();

        if (!userSnap.exists) {
          res.status(404).json({ error: "User not found" });
          return;
        }

        const planId = String(userSnap.data()?.planId ?? "");

        if (!["prova", "admin", "business", "business_m"].includes(planId)) {
          res.status(403).json({
            error: "Access denied",
            details: "Il tuo piano non consente la trascrizione.",
          });
          return;
        }

        // 3. LIMITS
        const limits =
          planId === "prova"
            ? { perMinute: 5, perDay: 20 }
            : ["business", "business_m"].includes(planId)
              ? { perMinute: 20, perDay: 200 }
              : { perMinute: 60, perDay: 10_000 };

        await Promise.all([
          consumePerMinuteFeature(
            uid,
            "speech_to_text" as any,
            limits.perMinute
          ),
          consumeDailyFeature(
            uid,
            "speech_to_text" as any,
            limits.perDay
          ),
        ]);

        // 4. MULTIPART
        const contentType = String(
          req.headers["content-type"] ?? ""
        );

        if (!contentType.includes("multipart/form-data")) {
          res.status(400).json({
            error: "INVALID_CONTENT_TYPE",
            details: "Invia il file come multipart/form-data nel campo 'file'.",
          });
          return;
        }

        const rawBody = (req as any).rawBody;

        if (!Buffer.isBuffer(rawBody)) {
          res.status(400).json({
            error: "RAW_BODY_UNAVAILABLE",
          });
          return;
        }

        let fileBuffer: Buffer | undefined;
        let filename = "";
        let mimeType = "";

        await new Promise<void>((resolve, reject) => {
          const busboy = Busboy({
            headers: req.headers,
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

            filename = info.filename;
            mimeType = info.mimeType.toLowerCase();

            const chunks: Buffer[] = [];

            file.on("data", (chunk: Buffer) => {
              chunks.push(chunk);
            });

            file.on("limit", () => {
              reject(new Error("FILE_TOO_LARGE"));
            });

            file.on("end", () => {
              fileBuffer = Buffer.concat(chunks);
            });
          });

          busboy.on("finish", resolve);
          busboy.on("error", reject);

          busboy.end(rawBody);
        });

        // 5. VALIDAZIONE
        if (!fileBuffer || fileBuffer.length === 0) {
          res.status(400).json({
            error: "FILE_MISSING",
            details: "Nessun file audio ricevuto.",
          });
          return;
        }

        if (fileBuffer.length > 25 * 1024 * 1024) {
          res.status(413).json({
            error: "FILE_TOO_LARGE",
          });
          return;
        }

        // 6. FORMATO
        const extension =
          filename.split(".").pop()?.toLowerCase() ?? "";

        const encoding =
          mimeType === "audio/mpeg" ||
          mimeType === "audio/mp3" ||
          extension === "mp3"
            ? "MP3"
            : mimeType.includes("wav") || extension === "wav"
              ? "LINEAR16"
              : mimeType === "audio/ogg" ||
                  mimeType === "audio/opus" ||
                  extension === "ogg" ||
                  extension === "opus"
                ? "OGG_OPUS"
                : mimeType === "audio/webm" || extension === "webm"
                  ? "WEBM_OPUS"
                  : null;

        if (!encoding) {
          res.status(400).json({
            error: "UNSUPPORTED_AUDIO_FORMAT",
            details: "Formato audio non supportato.",
          });
          return;
        }

        // 7. GOOGLE SPEECH
        const speechClient = new SpeechClient();

        const [response] = await speechClient.recognize({
          audio: {
            content: fileBuffer.toString("base64"),
          },
          config: {
            encoding,
            sampleRateHertz: 16000,
            languageCode: "it-IT",
            enableAutomaticPunctuation: true,
          },
        });

        // 8. TESTO
        const text =
          response.results
            ?.map((result) => result.alternatives?.[0]?.transcript ?? "")
            .filter(Boolean)
            .join(" ")
            .trim() ?? "";

        res.status(200).json({
          success: true,
          text,
        });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : String(err);

        console.error("SpeechToText error:", message);

        if (message === "FILE_TOO_LARGE") {
          res.status(413).json({
            error: "FILE_TOO_LARGE",
            details: "Il file supera il limite di 25 MB.",
          });
          return;
        }

        res.status(500).json({
          error: "PROCESS_FAILED",
          details: "Errore durante la trascrizione.",
        });
      }
    });
  }
);

export const promptAgent = onRequest(
  { 
    secrets: ["GOOGLE_GENAI_API_KEY", "OPENAI_API_KEY"],
    timeoutSeconds: 300,
    memory: "1GiB"
  }, 
  async (req, res) => {
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

      try {
        await requireAppCheck(req);
        const uid = await requireUidFromAuthHeader(req);
        const db = admin.firestore();
        // Controllo limitazioni/piani se necessario qui...
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
          consumePerMinuteFeature(uid, "prompting" as any, limits.perMinute),
          consumeDailyFeature(uid, "prompting" as any, limits.perDay)
        ]);

        // 1. Ora estraiamo anche il TITLE dal body
        const { title, objective, notes, fields } = req.body;

        // Validazione aggiornata
        if (!title || !objective || !fields || !Array.isArray(fields)) {
          res.status(400).json({ error: "Bad Request: Dati mancanti." });
          return;
        }

        // PREPARAZIONE STREAMING (SSE)
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        // Avvio del Flow in modalità stream
        const flowStream = promptBuilderFlow.stream({
          objective,
          notes,
          fields,
          userId: uid
        });

        // Inoltro dei Chunk (status) al Frontend in tempo reale
        for await (const chunk of flowStream.stream) {
          res.write(`data: ${JSON.stringify({ message: chunk })}\n\n`);
        }

        // Risoluzione finale del flow
        const finalOutput = await flowStream.output;
        const generatedContent = finalOutput.result;
        
        // ==========================================
        // 2. SALVATAGGIO IN FIRESTORE
        // ==========================================
   
        const promptRef = await db.collection("register").doc(uid).collection("prompts").add({
          title,
          objective,
          notes: notes || "",
          fields,
          content: generatedContent,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // 3. Invio risultato finale (aggiungiamo l'ID del doc se al frontend servisse)
        res.write(`data: ${JSON.stringify({ 
          result: generatedContent,
          promptId: promptRef.id
        })}\n\n`);
        
        res.write(`data: [DONE]\n\n`);
        res.end();

      } catch (err: any) {
        console.error("🔥 ERRORE PROMPT AGENT:", err);
        if (res.headersSent) {
          res.write(`data: ${JSON.stringify({ error: { message: err.message } })}\n\n`);
          res.end();
        } else {
          res.status(500).json({ error: "Process failed", details: err.message });
        }
      }
    });
  }
);

// ============================================================================
// ADMIN TASKS
// ============================================================================

type ProgressCallback = (message: string, progressData: any) => void;

export const adminMaintenanceTask = onRequest(
  { timeoutSeconds: 540, memory: "1GiB" }, 
  (req, res) => {
    return corsHandlerDomain(req, res, async () => {
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

      try {
        // --- 1. SICUREZZA: APP CHECK E AUTH HEADER ---
        await requireAppCheck(req);
        const uid = await requireUidFromAuthHeader(req);

        // --- 2. VERIFICA RUOLO NEL DATABASE (SOLO ADMIN) ---
        const userSnap = await db.collection("register").doc(uid).get();
        if (!userSnap.exists) { 
          res.status(404).json({ error: "User not found" }); 
          return; 
        }

        const planId = String(userSnap.data()?.planId ?? "");
        if (planId !== "admin") { 
          res.status(403).json({ error: "Access denied: Admins only" }); 
          return; 
        }

        // --- 3. RATE LIMITING ---
        const limits = { perMinute: 60, perDay: 10_000 };
        await Promise.all([
          consumePerMinuteFeature(uid, "admin" as any, limits.perMinute),
          consumeDailyFeature(uid, "admin" as any, limits.perDay)
        ]);

        // --- 4. PREPARAZIONE SERVER-SENT EVENTS (SSE) ---
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders(); 

        const sendSseProgress: ProgressCallback = (msg, data) => {
          res.write(`data: ${JSON.stringify({ message: msg, ...data })}\n\n`);
        };

        const body = req.body ?? {};
        
        sendSseProgress("Avvio procedura di manutenzione generale", { status: "started" });

        // --- 5. ESECUZIONE TASK (PRIMA FASE: AGGIORNAMENTO) ---
        sendSseProgress("Avvio aggiornamento fonti e metadati in corso...", { status: "updating" });
        const [resultFonte, resultMetadata] = await Promise.all([
          runUpdateFonte(body, sendSseProgress),
          runUpdateMetadata(sendSseProgress)
        ]);
        sendSseProgress("Aggiornamento completato. Avvio verifica duplicati...", { status: "updating_completed" });

        // --- 6. RILEVAMENTO ED ELIMINAZIONE DUPLICATI DAL DB (SECONDA FASE: PULIZIA) ---
        // Richiamiamo la nuova funzione dedicata che usa il BulkWriter
        const resultCleanup = await runCleanupDuplicates(sendSseProgress);

        // --- 7. CHIUSURA STREAM ---
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

      } catch (err: any) {
        console.error("Errore Task Admin:", err);
        
        const msg = err instanceof Error ? err.message : "Internal error";
        const isRateLimitError = msg === "rate_limited" || msg === "quota_exceeded";
        
        if (res.headersSent) {
          const errorMessage = isRateLimitError 
            ? "Limite di richieste superato." 
            : "Si è verificato un errore interno durante l'elaborazione.";
            
          res.write(`data: ${JSON.stringify({ error: errorMessage })}\n\n`);
          res.end();
        } else {
          const status = isRateLimitError ? 429 : 500;
          res.status(status).json({ error: isRateLimitError ? msg : "Errore interno." });
        }
      }
    });
  }
);

export const adminMergeCategoryTask = onRequest(
  { timeoutSeconds: 300, memory: "2GiB" }, 
  (req, res) => {
    return corsHandlerDomain(req, res, async () => {
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

      try {
        await requireAppCheck(req);
        const uid = await requireUidFromAuthHeader(req);

        const userSnap = await db.collection("register").doc(uid).get();
        if (!userSnap.exists || String(userSnap.data()?.planId ?? "") !== "admin") { 
          res.status(403).json({ error: "Access denied" }); return; 
        }

        const { vecchiaCategoria, nuovaCategoria } = req.body;
        
        // Validation: Ora solo vecchiaCategoria è strettamente obbligatoria
        if (!vecchiaCategoria) {
          res.status(400).json({ error: "Il parametro 'vecchiaCategoria' è obbligatorio." });
          return;
        }

        const vecchiaOriginale = vecchiaCategoria.trim();
        const nuovaOriginale = (nuovaCategoria || "").trim();
        const isSostituzione = nuovaOriginale.length > 0;
        
        const bulkWriter = db.bulkWriter();
        let updatedCount = 0;

        // 1. Troviamo SOLO le sentenze che contengono la vecchia categoria
        const sentenzeQuery = db.collection("sentences").where("sottocategoria", "array-contains", vecchiaOriginale);
        const snap = await sentenzeQuery.get();

        for (const d of snap.docs) {
          const data = d.data();
          let arrayAttuale = Array.isArray(data.sottocategoria) ? data.sottocategoria : [];
          
          // Rimuoviamo la vecchia categoria
          let nuovoArray = arrayAttuale.filter(c => typeof c === 'string' && c.trim() !== vecchiaOriginale);
          
          // Se stiamo unificando, aggiungiamo la nuova categoria
          if (isSostituzione) {
            // Controllo case-insensitive locale per non creare duplicati nello stesso array
            const giaPresente = nuovoArray.some(c => c.trim() === nuovaOriginale);
            if (!giaPresente) {
              nuovoArray.push(nuovaOriginale);
            }
          }

          bulkWriter.update(d.ref, { sottocategoria: nuovoArray });
          updatedCount++;
        }

        // 2. Aggiornamento Sottoraccolta Taxonomy
        const taxSubcatsRef = db.collection('meta').doc('taxonomy').collection('sottocategorie');
        
        // A) Eliminiamo SEMPRE la vecchia categoria
        const checkVecchia = await taxSubcatsRef.where('nome', '==', vecchiaOriginale).limit(1).get();
        if (!checkVecchia.empty) {
          checkVecchia.docs.forEach(doc => bulkWriter.delete(doc.ref));
        }

        // B) Gestiamo la nuova categoria (solo se c'è stata una sostituzione)
        if (isSostituzione && updatedCount > 0) {
          const checkNuova = await taxSubcatsRef.where('nome', '==', nuovaOriginale).limit(1).get();
          if (checkNuova.empty) {
            // Se non esiste ancora, la creiamo inserendo il numero di sentenze appena modificate
            bulkWriter.set(taxSubcatsRef.doc(), { nome: nuovaOriginale, sentences: updatedCount });
          } else {
            // Se esiste già, incrementiamo il suo contatore storico
            bulkWriter.update(checkNuova.docs[0].ref, { sentences: FieldValue.increment(updatedCount) });
          }
        }

        // 3. Pulizia UI: Rimuove la vecchia dall'array delle 'superflue' nel doc principale
        bulkWriter.update(db.collection('meta').doc('taxonomy'), {
          sottocategorie_superflue: FieldValue.arrayRemove(vecchiaCategoria)
        });

        await bulkWriter.close();
        
        // 4. Risposta dinamica
        const azioneMsg = isSostituzione ? "Sostituzione e unificazione" : "Eliminazione";
        res.status(200).json({ 
          success: true, 
          message: `${azioneMsg} completata. Modificate ${updatedCount} sentenze.` 
        });

      } catch (err: any) {
        console.error("Errore Merge/Delete Categoria:", err);
        res.status(500).json({ error: err.message || "Internal error" });
      }
    });
  }
);

export const reasoningAdmin = onRequest(
  { 
    secrets: ["DEEPSEEK_API_KEY", "OPENAI_API_KEY"],
    timeoutSeconds: 300, // Ridotto, non fa più gli embedding
    memory: "1GiB" 
  },
  async (req, res) => {
    corsHandlerDomain(req, res, async () => {
      if (req.method === "OPTIONS") return res.status(204).end();
      if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

      try {
        await requireAppCheck(req);
        const uid = await requireUidFromAuthHeader(req);
        const body: any = req.body ?? {};
        const question = typeof body?.question === "string" ? body.question.trim() : "";

        if (!question) return res.status(400).json({ error: "Invalid 'question'" });
        if (question.length > MAX_INPUT_CHARS) return res.status(413).json({ error: "Question too large" });

        const snap = await db.collection("register").doc(uid).get();
        if (!snap.exists) return res.status(404).json({ error: "User not found" });

        const planId = String(snap.data()?.planId ?? "");
        if (!["prova", "admin", "business", "business_m"].includes(planId)) return res.status(403).json({ error: "Access denied" });
        
        const normalizedText = question.replace(/\s+/g, ' ').toLowerCase();
        if (
          planId === "admin" &&
          (normalizedText.includes("la sentenza richiesta è in fase di valutazione per oscuramento") ||
           normalizedText.includes("la sentenza richiesta è in fase di oscuramento"))
        ) {
          // Restituisce un errore HTTP specifico invece di un 200 OK
          return res.status(403).json({ 
            error: "oscuramento_in_corso", 
            details: "La sentenza è in fase di valutazione per oscuramento e non può essere elaborata." 
          });
        }
        
        const limits = planId === "prova" ? { perMinute: 5, perDay: 20 }
                     : planId === "business" ? { perMinute: 20, perDay: 200 }
                     : { perMinute: 120, perDay: 10_000 };

        await consumePerMinuteFeature(uid, "reasoning" as any, limits.perMinute);
        await consumeDailyFeature(uid, "reasoning" as any, limits.perDay);

        let parsedJson: any = null;
        let providerUsed = "";
        let modelUsed = "";

        // TENTATIVO 1: DEEPSEEK
        try {
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

          const cleanJson = (dsResponse.choices[0].message.content ?? "").replace(/```json/g, "").replace(/```/g, "").trim();
          parsedJson = JSON.parse(cleanJson);
          providerUsed = "deepseek";
          modelUsed = "deepseek-chat";

        } catch (dsError) {
          console.warn("DeepSeek failed. Falling back to OpenAI.", dsError);
          
          // TENTATIVO 2: OPENAI FALLBACK
          const oaClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
          const oaResponse = await oaClient.responses.create({
            model: "gpt-4o-mini", // Aggiornato a un modello esistente (gpt-5-mini non esiste ancora!)
            instructions: "Agisci come un esperto redattore giuridico. Restituisci esclusivamente JSON valido.",
            input: `${PROMPT_MASSIMAZIONE}\n\nTESTO DA ANALIZZARE:\n${question}`,
          });

          parsedJson = JSON.parse((oaResponse.output_text ?? "").trim());
          providerUsed = "openai_fallback";
          modelUsed = "gpt-4o-mini";
        }

        // Risponde SUBITO al client. Niente più embedding qui.
        return res.status(200).json({
          message: parsedJson,
          status: "SENT_BY_BOT",
          model: modelUsed, 
          provider: providerUsed
        });

      } catch (err: any) {
        const msg = err instanceof Error ? err.message : "Internal error";
        if (err?.code === "rate_limited" || msg === "rate_limited") return res.status(429).json({ error: "rate_limited" });
        if (err?.code === "quota_exceeded" || msg === "quota_exceeded") return res.status(429).json({ error: "quota_exceeded" });
        const isAuth = msg.toLowerCase().includes("auth") || msg.toLowerCase().includes("bearer");
        return res.status(isAuth ? 401 : 500).json({ error: "Process failed", details: msg });
      }
    });
  }
);

export const adminUploadManualContentTask = onRequest(
  { timeoutSeconds: 30, memory: "512MiB" }, 
  (req, res) => {
    return corsHandlerDomain(req, res, async () => {
      // Gestione CORS e Metodo
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

      try {
        // 1. Sicurezza e Autenticazione
        await requireAppCheck(req);
        const uid = await requireUidFromAuthHeader(req);

        // Controllo privilegi Admin
        const userSnap = await db.collection("register").doc(uid).get();
        if (!userSnap.exists || String(userSnap.data()?.planId ?? "") !== "admin") { 
          res.status(403).json({ error: "Access denied" }); return; 
        }

        // 2. Estrazione e Validazione Payload
        const { id, text, links, images } = req.body;
        
        if (!id || typeof id !== "string" || !id.trim()) {
          res.status(400).json({ error: "Il parametro 'id' è obbligatorio e deve essere una stringa." });
          return;
        }
        if (!text || typeof text !== "string" || !text.trim()) {
          res.status(400).json({ error: "Il parametro 'text' è obbligatorio." });
          return;
        }
        if (!Array.isArray(links) || links.length === 0) {
          res.status(400).json({ error: "Il parametro 'links' deve essere un array con almeno un link." });
          return;
        }
        if (!images || typeof images !== "string" || !images.trim()) {
          res.status(400).json({ error: "Il parametro 'images' è obbligatorio." });
          return;
        }

        const cleanId = id.trim();

        // 3. Scrittura su Firestore (Collection 'manual')
        const docRef = db.collection("manual").doc(cleanId);
        
        await docRef.set({
          text: text.trim(),
          // Assicuriamoci che l'array contenga solo stringhe pulite (sicurezza aggiuntiva backend)
          links: links.map(l => typeof l === 'string' ? l.trim() : String(l)),
          images: images.trim(),
          
          // Metadati utili per l'amministrazione
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
          authorId: uid 
        });

        // 4. Risposta al Client
        res.status(200).json({ 
          success: true, 
          message: `Documento '${cleanId}' salvato correttamente.` 
        });

      } catch (err: any) {
        console.error("Errore Upload Contenuto Manuale:", err);
        res.status(500).json({ error: err.message || "Internal error" });
      }
    });
  }
);

export const submitFeedback = onRequest(
  { 
    timeoutSeconds: 60,
    memory: "512MiB" 
  },
  async (req, res) => {
    corsHandlerDomain(req, res, async () => {
      if (req.method === "OPTIONS") return res.status(204).end();
      if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

      try {
        await requireAppCheck(req);
        const uid = await requireUidFromAuthHeader(req);
        
        const body: any = req.body ?? {};
        const isThumbsUp = typeof body?.isThumbsUp === "boolean" ? body.isThumbsUp : null;
        const notes = typeof body?.notes === "string" ? body.notes.trim() : "";
        
        // Qui facciamo solo una pulizia base degli ID arrivati
        const rawIds: any[] = Array.isArray(body?.ids) ? body.ids : [];
        const ids = rawIds.map(id => String(id || "").trim()).filter(id => id.length > 0);

        if (isThumbsUp === null) return res.status(400).json({ error: "Missing or invalid 'isThumbsUp'" });
        
        if (ids.length === 0) {
          return res.status(200).json({ success: true, message: "Nessun ID valido fornito." });
        }

        // ==========================================
        // 3. LOGICA FEEDBACK POSITIVO
        // ==========================================
        if (isThumbsUp) {
          // CRITICO: Qui scartiamo i link web! Firestore crasherebbe e non possiamo 
          // aggiornare documenti che non risiedono nel nostro DB.
          const validDbIds = ids.filter(id => !id.includes("/"));
          
          if (validDbIds.length === 0) {
             return res.status(200).json({ success: true, message: "Feedback ignorato: erano solo link esterni." });
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

          if (updatedCount > 0) await batch.commit();

          return res.status(200).json({ success: true, message: `Feedback positivo per ${updatedCount} doc.` });
        } 
        
        // ==========================================
        // 4. LOGICA FEEDBACK NEGATIVO
        // ==========================================
        else {
          if (notes.length > MAX_NOTES_CHARS) {
            return res.status(413).json({ error: "Notes length exceeds maximum limit" });
          }

          // Qui INCLUDIAMO anche i link web! Così nel pannello di amministrazione
          // vedi esattamente quale URL ha fatto arrabbiare l'utente.
          await db.collection("complaints").add({
            uid: uid,
            urls: ids, // Passiamo tutto, URL compresi
            reason: notes,    
            status: "pending",  
            createdAt: FieldValue.serverTimestamp()
          });

          return res.status(200).json({ success: true, message: "Reclamo registrato con successo." });
        }

      } catch (err: any) {
        const msg = err instanceof Error ? err.message : "Internal error";
        console.error("Error in submitFeedback:", msg);
        
        const isAuth = msg.toLowerCase().includes("auth") || msg.toLowerCase().includes("bearer");
        if (isAuth) {
          return res.status(401).json({ error: "Unauthorized", details: msg });
        }
        
        // Fallback silenzioso per non rompere la UI utente
        return res.status(200).json({ success: false, message: "Feedback scartato per anomalia." });
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
    timeoutSeconds: 60, // Bastano 60 secondi, l'embedding è molto veloce
    memory: "512MiB"    // Richiede pochissima memoria rispetto al LLM
  },
  async (req, res) => {
    corsHandlerDomain(req, res, async () => {
      if (req.method === "OPTIONS") return res.status(204).end();
      if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

      try {
        await requireAppCheck(req); 
        const uid = await requireUidFromAuthHeader(req);
        const snap = await db.collection("register").doc(uid).get();
        if (!snap.exists) return res.status(404).json({ error: "User not found" });
        // 2. Validazione Input
        const body: any = req.body ?? {};
        const textToEmbed = body?.text;
        if (typeof textToEmbed !== "string" || !textToEmbed.trim()) {
          return res.status(400).json({ error: "Invalid or missing 'text' field" });
        }
        // 3. Chiamata a OpenAI per l'embedding
        const oaApiKey = process.env.OPENAI_API_KEY;
        if (!oaApiKey) throw new Error("Missing OPENAI_API_KEY");
        const oaClient = new OpenAI({ apiKey: oaApiKey });
        const embeddingResponse = await oaClient.embeddings.create({
          model: "text-embedding-3-small", 
          input: textToEmbed.trim(),
          dimensions: 1536 // Manteniamo la coerenza con i 1536 per Firestore
        });
        const vectorArray = embeddingResponse.data[0].embedding;
        // 4. Ritorno del risultato (JSON format)
        return res.status(200).json({
          vector: vectorArray,
          status: "SUCCESS"
        });
      } catch (err: any) {
        console.error("Admin Embedding Error:", err);
        const msg = err instanceof Error ? err.message : "Internal error";
        const lower = msg.toLowerCase();
        const isAuth = lower.includes("auth") || lower.includes("bearer") || lower.includes("token");
        return res.status(isAuth ? 401 : 500).json({ 
          error: "Process failed", 
          details: msg 
        });
      }
    });
  }
);

export const extractDocumentText = onRequest(
  { 
    timeoutSeconds: 120,
    memory: "1GiB",
    invoker: "public"
  }, 
  async (req, res) => {
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

      try {
        await requireAppCheck(req);
        const uid = await requireUidFromAuthHeader(req);

        const { storagePath } = req.body;
        
        if (!storagePath || typeof storagePath !== 'string') {
          res.status(400).json({ error: "Percorso del file (storagePath) mancante o invalido." });
          return;
        }

        // Controllo di sicurezza
        if (!uid) {
          res.status(403).json({ error: "Accesso negato a questo documento." });
          return;
        }

        const admin = getAdmin();
        const bucket = admin.storage().bucket();
        const file = bucket.file(storagePath);

        const [exists] = await file.exists();
        if (!exists) {
          res.status(404).json({ error: "Il file non esiste nello storage." });
          return;
        }

        // Scarica il buffer in memoria
        const [buffer] = await file.download();

        const pdfData = await pdfExtract(buffer);

        let cleanedText = pdfData.text || "";

        // 🧹 PULIZIA AVANZATA DEL TESTO
        cleanedText = cleanedText
          // Sostituisce i ritorni a capo singoli (ma mantiene i paragrafi doppi)
          // Molti PDF mettono un \n a fine riga anche se la frase continua.
          .replace(/([^\n])\n(?=[^\n])/g, "$1 ")
          // Rimuove spazi multipli consecutivi
          .replace(/[ \t]+/g, " ")
          // Rimuove linee vuote eccessive (più di due)
          .replace(/\n\s*\n\s*\n/g, "\n\n")
          .trim();

        res.status(200).json({ 
          success: true,
          text: cleanedText,
          pages: pdfData.numpages 
        });

      } catch (error: any) {
        console.error("🔥 ERRORE EXTRACT DOCUMENT TEXT:", error);
        res.status(500).json({ 
          error: "Si è verificato un errore durante l'estrazione del testo.",
          details: error instanceof Error ? error.message : "Errore sconosciuto"
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

export const getRegister = onRequest(async (req, res) => {
  corsHandlerDomain(req, res, async () => {
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    try {
      // 1) verifica utente loggato e AppCheck
      await requireAppCheck(req);
      const uid = await requireUidFromAuthHeader(req);

      // --- INIZIO NUOVI CONTROLLI SICUREZZA TELEFONO ---
      
      // A. Ottieni i dati reali dell'utente da Firebase Auth
      const userRecord = await getAdminAuth().getUser(uid);
      
      if (!userRecord.phoneNumber) {
        return res.status(403).json({ 
          error: "Operazione negata: Nessun numero di telefono verificato associato a questo account." 
        });
      }

      // B. (Opzionale ma super consigliato) Verifica anti-farming
      // Controlla se il numero è già presente nel DB per scongiurare che 
      // qualcuno elimini l'account e lo ricrei per avere infinite prove gratuite.
      const existingPhoneUsers = await db.collection("users")
        .where("phoneNumber", "==", userRecord.phoneNumber)
        .where("__name__", "!=", uid) // Cerca tutti tranne l'utente corrente
        .limit(1)
        .get();

      if (!existingPhoneUsers.empty) {
        return res.status(403).json({ 
          error: "Questo numero di telefono ha già usufruito di una prova gratuita in passato." 
        });
      }
      
      // --- FINE NUOVI CONTROLLI ---

      const ref = db.collection("register").doc(uid);
      
      // 2) crea/legge in modo atomico (NO side-effects qui dentro)
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
        
        // 1) crea register/{uid}
        tx.set(
          ref,
          { uid, start, expire, expireSec, planId: "prova" },
          { merge: true }
        );

        // 2) aggiorna users/{uid}.status = "prova"
        const userRef = db.collection("users").doc(uid);
        tx.set(userRef, { status: "prova" }, { merge: true });

        return { created: true, uid, start, expireSec };
      });

      // Esegui i task asincroni solo se la prova è stata effettivamente creata ora
      if (out.created) {
        void enqueueWelcomeEmail({ uid });
        void enqueueTrialEmail({ uid });
      }

      // Task downgrade: schedula solo quando appena creato
      if (out.created && typeof out.expireSec === "number") {
        await scheduleDowngradeTask({
          projectId: "jurio-it",
          location: "europe-west1",
          queue: "subscription-expire",
          targetUrl: "https://europe-west1-jurio-it.cloudfunctions.net/tasksDowngrade",
          serviceAccountEmail: "130993418358-compute@developer.gserviceaccount.com",
          uid,
          expireSec: out.expireSec,
        });
      }

      return res.status(200).json(out);
      
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unauthorized";
      const isAuth =
        String(msg).toLowerCase().includes("bearer") ||
        String(msg).toLowerCase().includes("token");
      return res.status(isAuth ? 401 : 500).json({ error: msg });
    }
  });
});

export const getPrice = onRequest(async (req, res) => {
  corsHandlerDomain(req, res, async () => {
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    try {
      await requireAppCheck(req);
      const { id } = req.body;

      if (!id || typeof id !== "string") {
        res.status(400).json({ error: "Missing or invalid 'id'" });
        return;
      }

      const planId = id.toLowerCase(); // sicurezza extra

      const snap = await db.collection("plans").doc(planId).get();

      if (!snap.exists) {
        res.status(404).json({ error: "Plan not found" });
        return;
      }

      const data = snap.data() as {
        price: number;
        currency?: string;
      };

      if (typeof data.price !== "number") {
        res.status(500).json({ error: "Invalid price format in DB" });
        return;
      }

      res.status(200).json({
        id: planId,
        price: data.price,
        currency: data.currency ?? "EUR",
      });
    } catch (err) {
      console.error("getPrice error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

export const payWithStripeCreateCheckoutSession = onRequest(
  { invoker: "public", secrets: [STRIPE_SECRET_KEY] },
  async (req, res) => {
    corsHandlerDomain(req, res, async () => {
      if (req.method === "OPTIONS") return res.status(204).end();
      if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

      try {
        await requireAppCheck(req);
        const stripe = getStripe();
        const uid = await requireUidFromAuthHeader(req);

        const planId = normalizePlanId(req.body?.id);
        if (!planId) return res.status(400).json({ error: "Missing/invalid 'id' (planId)" });

        const snap = await db.collection("plans").doc(planId).get();
        if (!snap.exists) return res.status(404).json({ error: "Plan not found" });

        const plan = snap.data() as PlanDoc;
        const currency = String(plan.currency ?? "EUR").toLowerCase();

        if (!plan.stripePriceId || typeof plan.stripePriceId !== "string") {
          return res.status(500).json({ error: "Missing stripePriceId in plans/{planId}" });
        }

        // Il tuo codice originale cercava stripeCustomerId in 'users'
        const userRef = db.collection("users").doc(uid);
        const userSnap = await userRef.get();
        let customerId = userSnap.get("stripeCustomerId") as string | undefined;

        if (!customerId) {
          const customer = await stripe.customers.create({ metadata: { uid } });
          customerId = customer.id;
          await userRef.set({ stripeCustomerId: customerId }, { merge: true });
        }

        const appUrl = "https://jurio.it";

        const sessionConfig: any = {
          mode: "payment",
          customer: customerId,
          line_items: [{ price: plan.stripePriceId, quantity: 1 }],
          success_url: `${appUrl}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${appUrl}/billing/cancel`,
          metadata: { uid, planId },
        };

        // -------------------------------------------------------------
        // LETTURA COUPON DA REGISTER PER STRIPE (USIAMO L'ID)
        // -------------------------------------------------------------
        const registerSnap = await db.collection("register").doc(uid).get();
        let appliedStripeCoupon = false;

        if (registerSnap.exists) {
          const coupon = registerSnap.get("coupon");
          
          if (coupon && coupon.id) {
            let isValid = true;
            if (coupon.expire) {
              const expireDate = typeof coupon.expire.toDate === 'function' ? coupon.expire.toDate() : new Date(coupon.expire);
              if (expireDate < new Date()) isValid = false;
            }

            if (isValid) {
              // Stripe differenzia "coupon" (regola base) e "promotion_code" (codice riscattabile)
              if (String(coupon.id).startsWith("promo_")) {
                sessionConfig.discounts = [{ promotion_code: coupon.id }];
              } else {
                sessionConfig.discounts = [{ coupon: coupon.id }];
              }
              appliedStripeCoupon = true;
            }
          }
        }

        if (!appliedStripeCoupon) {
          sessionConfig.allow_promotion_codes = true; // Fallback se non ci sono sconti
        }
        // -------------------------------------------------------------

        const session = await stripe.checkout.sessions.create(sessionConfig);

        await db.collection("stripeSessions").doc(session.id).set({
          uid,
          planId,
          expectedCurrency: currency.toUpperCase(),
          expectedPriceId: plan.stripePriceId,
          status: "CREATED",
          createdAt: Timestamp.now(),
          customerId,
        });

        return res.status(200).json({ url: session.url, sessionId: session.id });
      } catch (err) {
        console.error("payWithStripeCreateCheckoutSession error:", err);
        const msg = err instanceof Error ? err.message : "Internal error";
        return res.status(msg.toLowerCase().includes("unauthorized") ? 401 : 500).json({ error: msg });
      }
    });
  }
);

export const stripeWebhook = onRequest(
  { invoker: "public", secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] },
  async (req, res): Promise<void> => {
    if (req.method === "OPTIONS") { res.status(204).end(); return; }

    try {
      const stripe = getStripe();
      const webhookSecret = getWebhookSecret();
      const sig = req.headers["stripe-signature"];
      if (!sig || typeof sig !== "string") { res.status(400).send("Missing stripe-signature"); return; }

      let event: Stripe.Event;
      try { event = stripe.webhooks.constructEvent(req.rawBody, sig, webhookSecret); } 
      catch (err) { res.status(400).send("Invalid signature"); return; }

      const eventRef = db.collection("stripeEvents").doc(event.id);
      const already = await eventRef.get();
      if (already.exists) { res.status(200).json({ received: true, already: true }); return; }

      if (event.type !== "checkout.session.completed") {
        await eventRef.set({ type: event.type, ignored: true, createdAt: Timestamp.now() }, { merge: true });
        res.status(200).json({ received: true, ignored: event.type }); return;
      }

      const session = event.data.object as Stripe.Checkout.Session;
      const uid = session.metadata?.uid;
      const planId = String(session.metadata?.planId);

      if (!uid || !planId) {
        await eventRef.set({ type: event.type, missing: true, createdAt: Timestamp.now() }, { merge: true });
        res.status(200).json({ received: true, skipped: "missing_metadata" }); return;
      }

      // 5) Firestore transaction
      const out = await db.runTransaction(async (tx) => {
        
        // ---> USO DELL'HELPER CONDIVISO <---
        const providerData = { 
          provider: "stripe", 
          stripeSessionId: session.id, 
          stripePaymentIntentId: session.payment_intent ?? null 
        };
        const { expireSec, needsTask } = await processSubscriptionInTx(tx, db, uid, planId, providerData, session.amount_total);

        tx.set(eventRef, { type: event.type, createdAt: Timestamp.now() }, { merge: true });
        tx.set(
          db.collection("stripeSessions").doc(session.id),
          { status: "COMPLETED", completedAt: Timestamp.now(), paidCurrency: session.currency, paidAmountMinor: session.amount_total },
          { merge: true }
        );

        return { status: "COMPLETED", expireSec, needsTask };
      });

      // 6) Side-effects
      if (out.needsTask && typeof out.expireSec === "number") {
        await tryScheduleDowngradeTask(uid, out.expireSec);
      }

      const planSnap = await db.collection("plans").doc(planId).get();
      const plan = planSnap.data() as PlanDoc;
      const amountTotal = session.amount_total;
      const expectedCurrency = String(plan.currency ?? "EUR").toUpperCase();
      
      const paidValue = typeof amountTotal === "number" ? amountTotal / 100 : (typeof plan.price === "number" ? plan.price : 0);

      void queuePurchaseEmailOnceStripe({
        requestId: event.id.slice(0, 8), uid, sessionId: session.id, paidValue, paidCurrency: session.currency || expectedCurrency,
      });

      res.status(200).json({ received: true, out: { status: out.status } });
    } catch (err) {
      console.error("stripeWebhook handler error:", err);
      res.status(500).send("Webhook handler failed");
    }
  }
);

export const applyDiscountCoupon = onRequest(
  {
    timeoutSeconds: 30, 
    memory: "512MiB"
  },
  async (req, res) => {
    corsHandlerDomain(req, res, async () => {
      if (req.method === "OPTIONS") return res.status(204).end();
      if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

      try {
        await requireAppCheck(req);
        const uid = await requireUidFromAuthHeader(req);
        
        // 1. Validazione Input
        const body: any = req.body ?? {};
        const couponCode = body?.couponCode;
        if (typeof couponCode !== "string" || !couponCode.trim()) {
          return res.status(400).json({ error: "Codice coupon mancante o non valido" });
        }
        
        const normalizedCode = couponCode.trim().toUpperCase();
        const db = admin.firestore();

        // 2. Controllo Utente
        const userRef = db.collection("register").doc(uid);
        const userSnap = await userRef.get();
        
        if (!userSnap.exists) {
          return res.status(404).json({ error: "Utente non trovato" });
        }

        // Verifica se l'utente ha già un coupon leggendo direttamente il campo mappa "coupon"
        const existingCoupon = userSnap.get("coupon");
       
        if (existingCoupon) {
          return res.status(400).json({ error: "Hai già un coupon attivo sul tuo account." });
        }

        // 3. Controllo Esistenza Coupon
        const couponRef = db.collection("discount").doc(normalizedCode);
        const couponSnap = await couponRef.get();

        if (!couponSnap.exists) {
          return res.status(404).json({ error: "Codice promozionale non valido." });
        }

        const couponData = couponSnap.data();

        // 4. Controllo Scadenza
        const expireField = couponData?.expire;
        if (expireField) {
          const expireDate = typeof expireField.toDate === 'function' 
            ? expireField.toDate() 
            : new Date(expireField);
            
          if (expireDate < new Date()) {
            return res.status(400).json({ error: "Questo coupon è scaduto." });
          }
        }

        // 5. Creazione della mappa coupon
        // Assicurati che nel documento del coupon su Firestore ci sia il campo con l'id di Stripe (es. 'id' o 'stripeId')
        const couponMapToSave: any = {
          id: couponData?.stripeCustomerId,
          name: normalizedCode,
          discount: couponData?.discount || 0,
        };
        
        if (expireField) {
          couponMapToSave.expire = expireField;
        }

        // 6. Salvataggio della mappa sull'utente (singola operazione di update)
        await userRef.update({
          coupon: couponMapToSave
        });

        // 7. Risposta di Successo
        return res.status(200).json({
          status: "SUCCESS",
          coupon: {
            code: normalizedCode,
            percentage: couponData?.discount || 0,
            durationLabel: couponData?.durationLabel || "Applicato con successo"
          }
        });

      } catch (err) {
        console.error("Apply Coupon Error:", err);
        const msg = err instanceof Error ? err.message : "Internal error";
        const lower = msg.toLowerCase();
        const isAuth = lower.includes("auth") || lower.includes("bearer") || lower.includes("token");
        
        return res.status(isAuth ? 401 : 500).json({ 
          error: "Process failed", 
          details: msg 
        });
      }
    });
  }
);

export const syncUserSession = onRequest(async (req, res) => {
  corsHandlerDomain(req, res, async () => {
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    try {
      // 1. Sicurezza: Blocca richieste senza AppCheck
      await requireAppCheck(req);

      // 2. Auth Obbligatoria
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Unauthorized: Missing authentication token" });
        return;
      }

      const idToken = authHeader.split("Bearer ")[1];
      let uid: string;
      try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        uid = decodedToken.uid;
      } catch (authErr) {
        console.warn("Token invalido in syncUserSession", authErr);
        res.status(401).json({ error: "Unauthorized: Invalid token" });
        return;
      }

      // 3. Generazione e Salvataggio Atomico
      const sessionId = crypto.randomUUID();

      await db.collection("users").doc(uid).set({
        currentSessionId: sessionId
      }, { merge: true });

      res.status(200).json({ success: true, sessionId });
    } catch (err) {
      console.error("syncUserSession error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

export const forceTakeoverSession = onRequest(async (req, res) => {
  corsHandlerDomain(req, res, async () => {
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }

    try {
      await requireAppCheck(req);

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        res.status(401).json({ error: "Unauthorized: Missing authentication token" });
        return;
      }

      const idToken = authHeader.split("Bearer ")[1];
      let uid: string;
      try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        uid = decodedToken.uid;
      } catch (authErr) {
        res.status(401).json({ error: "Unauthorized: Invalid token" });
        return;
      }

      const newSessionId = crypto.randomUUID();

      // REVOCA DEI TOKEN (il vero kick-out di sicurezza)
      await admin.auth().revokeRefreshTokens(uid);

      // Aggiornamento database
      await db.collection("users").doc(uid).set({
        currentSessionId: newSessionId
      }, { merge: true });

      res.status(200).json({ success: true, newSessionId });
    } catch (err) {
      console.error("forceTakeoverSession error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  });
});

// ============================================================================
// TEAM FUNCTIONS
// ============================================================================

export const assignTeamSeat = onRequest(async (req, res) => {
  corsHandlerDomain(req, res, async () => {
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    try {
      await requireAppCheck(req);
      const callerUid = await requireUidFromAuthHeader(req);

      const { teamId, email, voucher } = req.body;
      
      if (!teamId || typeof teamId !== "string") {
        return res.status(400).json({ error: "Missing or invalid 'teamId'" });
      }

      if (!email && !voucher) {
        return res.status(400).json({ error: "Devi fornire 'email' o 'voucher'" });
      }

      // Normalizzazione sicura del voucher
      const cleanVoucher = voucher ? voucher.trim().toUpperCase() : "";
      const isInviteFlow = !!email;
      let targetUid: string;
      let targetEmail: string;

      // 1) Determina UID ed Email
      if (isInviteFlow) {
        targetEmail = email.trim().toLowerCase();
        try {
          const userRecord = await getAdminAuth().getUserByEmail(targetEmail);
          targetUid = userRecord.uid;
        } catch (err: any) {
          if (err.code === 'auth/user-not-found') {
            return res.status(404).json({ errorCode: "user-not-found", error: "L'utente non è ancora registrato." });
          }
          throw err;
        }
      } else {
        targetUid = callerUid;
        const userRecord = await getAdminAuth().getUser(callerUid);
        targetEmail = userRecord.email || ""; 
      }

      // 2) TRANSAZIONE
      const out = await db.runTransaction(async (tx) => {
        const teamRef = db.collection("teams").doc(teamId);
        const registerRef = db.collection("register").doc(targetUid);

        const teamSnap = await tx.get(teamRef);
        const registerSnap = await tx.get(registerRef);

        if (!teamSnap.exists) throw new Error("NOT_FOUND: Team non trovato");
        const teamData = teamSnap.data() as any;
        const registerData = registerSnap.exists ? registerSnap.data() : {};

        if (isInviteFlow) {
          const isOwner = teamData.owners?.includes(callerUid);
          const isCoOwner = teamData.co_owners?.includes(callerUid);
          if (!isOwner && !isCoOwner) {
            throw new Error("FORBIDDEN: Solo i proprietari o co-proprietari possono assegnare i posti");
          }
        }

        if (teamData.member_ids?.includes(targetUid)) {
          throw new Error("CONFLICT: L'utente fa già parte del Workspace");
        }

        const isAlreadyBusiness = registerData?.planId === "business";
        let vouchers = teamData.vouchers || [];
        let updatedVouchers = [...vouchers];
        
        let grantBusiness = false;
        let expireTimestamp: any;
        const now = admin.firestore.Timestamp.now();

        if (isAlreadyBusiness) {
          expireTimestamp = registerData?.expire ?? admin.firestore.Timestamp.fromMillis(now.toMillis() + (365 * 24 * 60 * 60 * 1000));
          if (!isInviteFlow) {
            const vIndex = vouchers.findIndex((v: any) => v.id === cleanVoucher);
            if (vIndex === -1) throw new Error("EXHAUSTED: Il voucher fornito non è valido o non appartiene a questo team");
          }
        } else {
          let voucherIndex = -1;
          if (isInviteFlow) {
            voucherIndex = vouchers.findIndex((v: any) => v.used === false);
          } else {
            voucherIndex = vouchers.findIndex((v: any) => v.id === cleanVoucher && v.used === false); 
          }

          if (voucherIndex === -1) {
            if (isInviteFlow) throw new Error("EXHAUSTED: Nessun posto disponibile nel team");
            else throw new Error("EXHAUSTED: Il voucher fornito è già stato utilizzato o non è valido");
          }

          const usedVoucher = vouchers[voucherIndex];
          updatedVouchers[voucherIndex] = {
            ...usedVoucher,
            used: true,
            assignedTo: targetUid,
            assignedAt: now
          };
          grantBusiness = true;
          expireTimestamp = admin.firestore.Timestamp.fromMillis(now.toMillis() + (usedVoucher.duration * 24 * 60 * 60 * 1000));
        }

        // SCRITTURE
        tx.update(teamRef, {
          vouchers: updatedVouchers,
          member_ids: admin.firestore.FieldValue.arrayUnion(targetUid) 
        });

        tx.set(teamRef.collection("members").doc(targetUid), {
          role: isInviteFlow ? "editor" : "editor",
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

        // Passiamo i dati per l'email all'esterno della transazione
        return { 
          success: true, 
          targetUid, 
          targetEmail,
          teamName: teamData.name || "Workspace",
          voucherUsed: grantBusiness 
        };
      });

      // 3) Effetti collaterali (Fuori dalla transazione)
      await enqueueWelcomeTeamEmail({ 
        email: out.targetEmail, 
        teamName: out.teamName 
      });

      return res.status(200).json(out);

    } catch (err: any) {
      const msg = err instanceof Error ? err.message : "Internal Error";
      if (msg.startsWith("NOT_FOUND:")) return res.status(404).json({ error: msg.split(":")[1] });
      if (msg.startsWith("FORBIDDEN:")) return res.status(403).json({ error: msg.split(":")[1] });
      if (msg.startsWith("CONFLICT:")) return res.status(409).json({ errorCode: "already-exists", error: msg.split(":")[1] });
      if (msg.startsWith("EXHAUSTED:")) return res.status(409).json({ error: msg.split(":")[1] });
      if (msg.startsWith("ALREADY_ASSIGNED:")) return res.status(409).json({ errorCode: "already-assigned", error: msg.split(":")[1] });

      const isAuth = msg.toLowerCase().includes("bearer") || msg.toLowerCase().includes("token") || msg.toLowerCase().includes("unauthorized");
      return res.status(isAuth ? 401 : 500).json({ error: msg });
    }
  });
});

export const sendTeamInviteEmail = onRequest(async (req, res) => {
  corsHandlerDomain(req, res, async () => {
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    try {
      await requireAppCheck(req);
      const callerUid = await requireUidFromAuthHeader(req);

      const { teamId, email, voucher } = req.body;
      
      // 1. Validazione input
      if (!teamId || typeof teamId !== "string") {
        return res.status(400).json({ error: "Missing or invalid 'teamId'" });
      }
      if (!email || typeof email !== "string") {
        return res.status(400).json({ error: "Missing or invalid 'email'" });
      }
      if (!voucher || typeof voucher !== "string") {
        return res.status(400).json({ error: "Missing or invalid 'voucher'" });
      }

      const targetEmail = email.trim().toLowerCase();

      // 2. Lettura Team e Controlli
      const teamRef = db.collection("teams").doc(teamId);
      const teamSnap = await teamRef.get();

      if (!teamSnap.exists) {
        throw new Error("NOT_FOUND: Team non trovato");
      }

      const teamData = teamSnap.data() as any;

      // A. Controlla che chi chiama sia owner o co-owner
      const isOwner = teamData.owners?.includes(callerUid);
      const isCoOwner = teamData.co_owners?.includes(callerUid);
      
      if (!isOwner && !isCoOwner) {
        throw new Error("FORBIDDEN: Solo i proprietari o co-proprietari possono inviare inviti");
      }

      // B. Controlla che il voucher richiesto esista e sia libero
      const vouchers = teamData.vouchers || [];
      const voucherIndex = vouchers.findIndex((v: any) => v.id === voucher && v.used === false);

      if (voucherIndex === -1) {
        throw new Error("EXHAUSTED: Il codice invito fornito non è valido o è già stato utilizzato");
      }

      // 3. Accodamento Email
      // Usa la funzione che abbiamo creato precedentemente per scrivere nella collection 'mail'
      await enqueueVoucherEmail({
        email: targetEmail,
        voucherCode: voucher,
        teamName: teamData.name || "un Workspace"
      });

      return res.status(200).json({ 
        success: true, 
        message: "Email di invito accodata con successo",
        email: targetEmail
      });

    } catch (err: any) {
      const msg = err instanceof Error ? err.message : "Internal Error";
      
      if (msg.startsWith("NOT_FOUND:")) return res.status(404).json({ error: msg.split(":")[1].trim() });
      if (msg.startsWith("FORBIDDEN:")) return res.status(403).json({ error: msg.split(":")[1].trim() });
      if (msg.startsWith("EXHAUSTED:")) return res.status(409).json({ error: msg.split(":")[1].trim() });

      const isAuth = msg.toLowerCase().includes("bearer") || msg.toLowerCase().includes("token") || msg.toLowerCase().includes("unauthorized");
      return res.status(isAuth ? 401 : 500).json({ error: msg });
    }
  });
});

export const shareAllTeamDocuments = onRequest(async (req, res) => {
  corsHandlerDomain(req, res, async () => {
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    try {
      await requireAppCheck(req);
      const callerUid = await requireUidFromAuthHeader(req);

      const { teamId } = req.body;
      if (!teamId || typeof teamId !== "string") {
        return res.status(400).json({ error: "Missing or invalid 'teamId'" });
      }

      const teamRef = db.collection("teams").doc(teamId);
      const teamSnap = await teamRef.get();

      if (!teamSnap.exists) {
        throw new Error("NOT_FOUND: Team non trovato");
      }

      const teamData = teamSnap.data() as any;
      const isOwner = teamData.owners?.includes(callerUid);
      const isCoOwner = teamData.co_owners?.includes(callerUid);
      
      if (!isOwner && !isCoOwner) {
        throw new Error("FORBIDDEN: Solo i manager possono forzare la condivisione dello storico");
      }

      const membersSnap = await teamRef.collection("members").get();
      const memberIds = membersSnap.docs.map(doc => doc.id);

      if (memberIds.length === 0) {
        return res.status(200).json({ success: true, updatedCount: 0, message: "Nessun membro nel team" });
      }

      const bulkWriter = db.bulkWriter();
      let updatedCount = 0;

      // Usa FieldValue importato direttamente
      const updateData = {
        visibleTo: FieldValue.arrayUnion(...memberIds)
      };

      // Usa Query come tipo importato direttamente
      const queueUpdates = async (query: Query) => {
        const snap = await query.get();
        snap.docs.forEach((doc) => {
          bulkWriter.update(doc.ref, updateData);
          updatedCount++;
        });
      };

      for (const uid of memberIds) {
        await queueUpdates(db.collection("documents").where("user", "==", uid));
        await queueUpdates(db.collection("document_chunks").where("user", "==", uid));
        await queueUpdates(db.collection("fascicoli").where("ownerId", "==", uid));
      }

      await bulkWriter.close();

      return res.status(200).json({ 
        success: true, 
        updatedCount,
        message: "Storico condiviso con successo" 
      });

    } catch (err: any) {
      console.error("[shareAllTeamDocuments] Error:", err);
      const msg = err instanceof Error ? err.message : "Internal Error";
      
      if (msg.startsWith("NOT_FOUND:")) return res.status(404).json({ error: msg.split(":")[1].trim() });
      if (msg.startsWith("FORBIDDEN:")) return res.status(403).json({ error: msg.split(":")[1].trim() });

      const isAuth = msg.toLowerCase().includes("bearer") || msg.toLowerCase().includes("token") || msg.toLowerCase().includes("unauthorized");
      return res.status(isAuth ? 401 : 500).json({ error: msg });
    }
  });
});

export const verifyVoucher = onRequest(async (req, res) => {
  corsHandlerDomain(req, res, async () => {
    // 1. Gestione CORS e Metodo HTTP
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    try {
      // 2. Controlli di sicurezza
      await requireAppCheck(req);
      await requireUidFromAuthHeader(req); // Assicuriamoci che l'utente sia loggato per prevenire abusi

      const { voucher } = req.body;
      
      // 3. Validazione Input
      if (!voucher || typeof voucher !== "string" || voucher.trim() === "") {
        return res.status(400).json({ error: "Missing or invalid 'voucher'" });
      }

      const cleanVoucher = voucher.trim().toUpperCase(); // Normalizziamo il codice per sicurezza

      // 4. Lettura della collection Teams
      const teamsSnap = await db.collection("teams").get();
      
      const matchedTeams: { id: string, name: string }[] = [];

      // 5. Ricerca del voucher libero
      teamsSnap.forEach((doc) => {
        const data = doc.data();
        const teamVouchers = data.vouchers || [];
        
        // Verifica se il team possiede questo preciso voucher e se è NON usato
        const hasFreeVoucher = teamVouchers.some(
          (v: any) => v.id === cleanVoucher && v.used === false
        );

        if (hasFreeVoucher) {
          matchedTeams.push({
            id: doc.id,
            name: data.name || "Workspace senza nome"
          });
        }
      });

      // 6. Risposta al client
      return res.status(200).json({ 
        success: true, 
        teams: matchedTeams 
      });

    } catch (err: any) {
      console.error("[verifyVoucher] Error:", err);
      const msg = err instanceof Error ? err.message : "Internal Error";
      
      const isAuth = msg.toLowerCase().includes("bearer") || 
                     msg.toLowerCase().includes("token") || 
                     msg.toLowerCase().includes("unauthorized");
                     
      return res.status(isAuth ? 401 : 500).json({ error: msg });
    }
  });
});

export const removeTeamMember = onRequest(async (req, res) => {
  corsHandlerDomain(req, res, async () => {
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
    
    try {
      await requireAppCheck(req);
      const requesterUid = await requireUidFromAuthHeader(req);
      const { teamId, uidDelete, revokeDocumentAccess } = req.body;
      
      if (!teamId || typeof teamId !== "string" || !uidDelete || typeof uidDelete !== "string") {
        return res.status(400).json({ error: "Missing or invalid 'teamId' or 'uidDelete'" });
      }
      
      const teamRef = db.collection("teams").doc(teamId);
      const teamSnap = await teamRef.get();
      if (!teamSnap.exists) {
        return res.status(404).json({ error: "Team not found" });
      }
      
      const teamData = teamSnap.data();
      const owners: string[] = teamData?.owners || [];

      const isOwner = owners.includes(requesterUid); 
      const isSelfLeave = requesterUid === uidDelete;

      if (!isOwner && !isSelfLeave) {
        return res.status(403).json({ error: "Forbidden: You don't have permission to remove this member" });
      }

      // Blocco di sicurezza fondamentale
      if (isSelfLeave && owners.includes(uidDelete) && owners.length <= 1) {
        return res.status(400).json({ error: "Action denied: You cannot leave the workspace because you are the only owner left." });
      }

      // Recuperiamo l'email del target per notificargli la rimozione
      const teamMemberRef = teamRef.collection("members").doc(uidDelete);
      const memberSnap = await teamMemberRef.get();
      const targetEmail = memberSnap.data()?.email;

      // Supporto: Adeguamento visibilità documenti
      if (revokeDocumentAccess === true) {
        const targetOwnerUid = isSelfLeave ? owners.find(id => id !== uidDelete) : requesterUid;
        if (targetOwnerUid) await updateUserDocuments(uidDelete, targetOwnerUid);
      }
      await removeUserVisibilityFromDocuments(uidDelete);
      
      const batch = db.batch();
      
      const userRef = db.collection("users").doc(uidDelete);
      batch.update(userRef, { 
        assignedTeamId: admin.firestore.FieldValue.delete() 
      });
      
      const regRef = db.collection("register").doc(uidDelete);
      batch.update(regRef, { 
        assignedTeamId: admin.firestore.FieldValue.delete(),
        provider: admin.firestore.FieldValue.delete()
      });

      batch.update(teamRef, {
        member_ids: admin.firestore.FieldValue.arrayRemove(uidDelete),
        owners: admin.firestore.FieldValue.arrayRemove(uidDelete)
      });
      
      batch.delete(teamMemberRef);
      await batch.commit();

      // Invio notifica (Solo se rimuovo qualcun altro, l'auto-uscita la ignoro)
      if (targetEmail && !isSelfLeave) {
        await enqueueRemoveTeamEmail({ email: targetEmail, teamName: teamData?.name || "Workspace" });
      }

      return res.status(200).json({ 
        success: true, 
        message: "Team member removed successfully" 
      });

    } catch (err: any) {
      console.error("[removeTeamMember] Error:", err);
      const msg = err instanceof Error ? err.message : "Internal Error";
      const isAuth = msg.toLowerCase().includes("bearer") || msg.toLowerCase().includes("token") || msg.toLowerCase().includes("unauthorized");          
      return res.status(isAuth ? 401 : 500).json({ error: msg });
    }
  });
});

export const deleteTeam = onRequest(async (req, res) => {
  corsHandlerDomain(req, res, async () => {
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") return res.status(405).send("Method Not Allowed");

    try {
      await requireAppCheck(req);
      const requesterUid = await requireUidFromAuthHeader(req);

      const { teamId, revokeDocumentAccess } = req.body;
      
      if (!teamId || typeof teamId !== "string") {
        return res.status(400).json({ error: "Missing or invalid 'teamId'" });
      }

      const teamRef = db.collection("teams").doc(teamId);
      const teamSnap = await teamRef.get();

      if (!teamSnap.exists) {
        return res.status(404).json({ error: "Team not found" });
      }

      const teamData = teamSnap.data();
      const owners: string[] = teamData?.owners || [];

      if (!owners.includes(requesterUid)) {
        return res.status(403).json({ error: "Forbidden: Only team owners can delete the team" });
      }

      // Recupero membri ed email per l'invio massivo
      const membersSnap = await teamRef.collection("members").get();
      const allMemberIds = membersSnap.docs.map(doc => doc.id);
      const allMemberEmails = membersSnap.docs.map(doc => doc.data()?.email).filter(Boolean);

      const membersToReassign = allMemberIds.filter(id => id !== requesterUid);
      
      const reassignPromises = membersToReassign.map(async (memberId) => {
        if (revokeDocumentAccess === true) {
           await updateUserDocuments(memberId, requesterUid);
        }
        await removeUserVisibilityFromDocuments(memberId); 
      });
      await Promise.all(reassignPromises);

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

      // Pulizia profili
      for (const memberId of allMemberIds) {
        const userRef = db.collection("users").doc(memberId);
        currentBatch.update(userRef, {
          assignedTeamId: admin.firestore.FieldValue.delete()
        });
        
        const regRef = db.collection("register").doc(memberId);
        currentBatch.update(regRef, { 
          assignedTeamId: admin.firestore.FieldValue.delete(),
          provider: admin.firestore.FieldValue.delete()
        });
        
        incrementBatch();
      }

      membersSnap.docs.forEach(docSnap => {
        currentBatch.delete(docSnap.ref);
        incrementBatch();
      });

      currentBatch.delete(teamRef);
      incrementBatch();

      if (operationCount > 0) batches.push(currentBatch);
      await Promise.all(batches.map(batch => batch.commit()));

      // Notifica massiva di chiusura
      if (allMemberEmails.length > 0) {
        await enqueueCloseTeamEmail({ 
          email: allMemberEmails, 
          teamName: teamData?.name || "Workspace" 
        });
      }

      return res.status(200).json({ 
        success: true, 
        message: "Team deleted successfully and documents reassigned" 
      });

    } catch (err: any) {
      console.error("[deleteTeam] Error:", err);
      const msg = err instanceof Error ? err.message : "Internal Error";
      const isAuth = msg.toLowerCase().includes("bearer") || msg.toLowerCase().includes("token") || msg.toLowerCase().includes("unauthorized");
      return res.status(isAuth ? 401 : 500).json({ error: msg });
    }
  });
});

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
  { timeoutSeconds: 60, memory: "1GiB" },
  async (req, res) => {
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

      try {
        await requireAppCheck(req);
        await requireUidFromAuthHeader(req);

        // providerToken è il token OAuth di Google o Microsoft (NON quello di Firebase)
        const { provider, providerToken } = req.body; 
        
        if (!providerToken) {
          res.status(400).json({ error: "Token del cloud provider mancante." });
          return;
        }

        if (provider === "google") {
          const auth = new google.auth.OAuth2();
          auth.setCredentials({ access_token: providerToken });
          const drive = google.drive({ version: 'v3', auth });
          
          // Filtriamo per PDF e Word
          const driveRes = await drive.files.list({
            q: "mimeType='application/pdf' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document'",
            pageSize: 50,
            fields: "files(id, name, mimeType, modifiedTime)",
          });
          
          res.status(200).json({ files: driveRes.data.files });
          return;
        } 
        
        else if (provider === "microsoft") {
          // MS Graph: Cerca PDF e DOCX in OneDrive/SharePoint
          const msRes = await fetch("https://graph.microsoft.com/v1.0/me/drive/root/search(q='.pdf')?select=id,name,file,lastModifiedDateTime,webUrl", {
            headers: { Authorization: `Bearer ${providerToken}` }
          });
          
          if (!msRes.ok) throw new Error("Errore API Microsoft");
          
          const data = await msRes.json();
          const files = (data.value || []).map((f: any) => ({
            id: f.id,
            name: f.name,
            mimeType: f.file?.mimeType,
            modifiedTime: f.lastModifiedDateTime,
            webUrl: f.webUrl // Utile da salvare nel DB per aprire il link originale
          }));
          
          res.status(200).json({ files });
          return;
        } 
        
        else {
          res.status(400).json({ error: "Provider non supportato (usa 'google' o 'microsoft')." });
          return;
        }

      } catch (error: any) {
        console.error(`Errore listCloudFiles [${req.body.provider}]:`, error);
        res.status(500).json({ error: error.message || "Errore interno" });
      }
    });
  }
);

export const downloadCloudFile = onRequest(
  { timeoutSeconds: 120, memory: "1GiB" },
  async (req, res) => {
    return corsHandlerDomain(req, res, async (): Promise<void> => {
      if (req.method === "OPTIONS") { res.status(204).end(); return; }
      if (req.method !== "POST") { res.status(405).send("Method Not Allowed"); return; }

      try {
        await requireAppCheck(req);
        await requireUidFromAuthHeader(req);

        const { provider, providerToken, fileId } = req.body;

        if (!providerToken || !fileId) {
          res.status(400).json({ error: "Parametri mancanti." });
          return;
        }

        if (provider === "google") {
          const auth = new google.auth.OAuth2();
          auth.setCredentials({ access_token: providerToken });
          const drive = google.drive({ version: 'v3', auth });
          
          // Scarica il file in formato buffer
          const driveRes = await drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'arraybuffer' }
          );
          const contentType = driveRes.headers['content-type'] || 'application/pdf';
          res.setHeader('Content-Type', contentType);
          res.send(Buffer.from(driveRes.data as ArrayBuffer));
          return;
        } 
        
        else if (provider === "microsoft") {
          const msRes = await fetch(`https://graph.microsoft.com/v1.0/me/drive/items/${fileId}/content`, {
            headers: { Authorization: `Bearer ${providerToken}` }
          });
          
          if (!msRes.ok) throw new Error("Impossibile scaricare il file da Microsoft");
          
          const arrayBuffer = await msRes.arrayBuffer();
          res.setHeader('Content-Type', msRes.headers.get('content-type') || 'application/pdf');
          res.send(Buffer.from(arrayBuffer));
          return;
        }

      } catch (error: any) {
        console.error(`Errore downloadCloudFile [${req.body.provider}]:`, error);
        res.status(500).json({ error: error.message || "Errore interno" });
      }
    });
  }
);

