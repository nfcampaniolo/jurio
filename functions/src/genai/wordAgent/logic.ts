import { Request, Response } from "express";
import {
  consumeMonthlyFeature,
  corsHandlerWordAddin,
  readMonthlyFeatureCount,
  validateUserPlanAndLimits,
  withSecureApiEndpoint,
} from "../../_utils";
import { JurioFeatureType, WORD_AI_MONTHLY_FEATURE, WORD_AI_MONTHLY_LIMITS, wordPlanTier } from "../../_constants";
import { getDb } from "../../_deps";
import { logSafeError } from "../../_logging";
import { wordAskFlow, wordCaseLawFlow, wordQuoteFlow, wordRedraftFlow, wordReviewFlow } from "./flow";
import { SEARCH_MODES, SearchMode, searchJurioDatabase } from "./_search";
import { DICTATION_MAX_BYTES, isSupportedWav, transcribeDictation } from "./_dictation";

const db = getDb();

/** Azioni con modello generativo → feature per i limiti giornalieri. Consumano anche il tetto AI mensile. */
const AI_ACTIONS = {
  research: "research_agent",
  review: "review_agent",
  redraft: "redraft_agent",
  ask: "ask_agent",
  case_law: "case_law_agent",
} as const satisfies Record<string, JurioFeatureType>;

/** Azioni senza modello generativo: non toccano il tetto AI mensile. */
const DATA_ACTIONS = ["usage", "prompts", "search", "transcribe"] as const;

type AiAction = keyof typeof AI_ACTIONS;
type DataAction = (typeof DATA_ACTIONS)[number];

/** Tetti all'input: proteggono costi del modello e tempi di risposta. */
export const WORD_LIMITS = {
  researchContextChars: 10_000,
  reviewTotalChars: 200_000,
  reviewMaxChunks: 200,
  redraftTextChars: 30_000,
  instructionChars: 2_000,
  askQuestionChars: 2_000,
  askDocumentChars: 60_000,
  askHistoryTurns: 10,
  askTurnChars: 4_000,
  caseLawDocumentChars: 120_000,
  searchQueryChars: 1_500,
  criteriaChars: 20_000,
} as const;

const STREAM_ERROR_MESSAGE = "Si è verificato un errore durante l'elaborazione. Riprova tra qualche istante.";
export const MONTHLY_AI_QUOTA_MESSAGE =
  "Hai utilizzato tutte le richieste AI del mese incluse nel tuo piano. Gli strumenti senza AI restano disponibili; per un uso continuativo dell'AI passa al piano Business.";

class BadRequest extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

const has = (obj: object, key: unknown): boolean =>
  typeof key === "string" && Object.prototype.hasOwnProperty.call(obj, key);

function isAiAction(action: unknown): action is AiAction {
  return has(AI_ACTIONS, action);
}

function isDataAction(action: unknown): action is DataAction {
  return typeof action === "string" && (DATA_ACTIONS as readonly string[]).includes(action);
}

function optionalString(value: unknown, field: string, max: number): string {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string") throw new BadRequest(`Il campo '${field}' deve essere una stringa.`);
  if (value.length > max) throw new BadRequest(`Il campo '${field}' supera ${max} caratteri.`, 413);
  return value;
}

function requiredString(value: unknown, field: string, max: number): string {
  const s = optionalString(value, field, max);
  if (!s.trim()) throw new BadRequest(`Il parametro '${field}' è obbligatorio.`);
  return s;
}

function parseChunks(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((c) => typeof c === "string")) {
    throw new BadRequest("Per la review serve un array di chunks.");
  }
  if (value.length > WORD_LIMITS.reviewMaxChunks) {
    throw new BadRequest(`Troppi blocchi di testo (massimo ${WORD_LIMITS.reviewMaxChunks}).`, 413);
  }
  const total = value.reduce((sum, c) => sum + c.length, 0);
  if (total > WORD_LIMITS.reviewTotalChars) {
    throw new BadRequest(`Il documento supera ${WORD_LIMITS.reviewTotalChars} caratteri: analizza una sezione alla volta.`, 413);
  }
  if (!value.some((c) => c.trim())) throw new BadRequest("Il testo da analizzare è vuoto.");
  return value;
}

function parseHistory(value: unknown): { role: "user" | "model"; text: string }[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new BadRequest("La cronologia deve essere un array.");
  return value.slice(-WORD_LIMITS.askHistoryTurns).map((turn) => {
    const role = (turn as { role?: unknown })?.role;
    const text = (turn as { text?: unknown })?.text;
    if ((role !== "user" && role !== "model") || typeof text !== "string") {
      throw new BadRequest("Cronologia non valida.");
    }
    return { role, text: text.slice(0, WORD_LIMITS.askTurnChars) };
  });
}

const PROMPT_ID = /^[A-Za-z0-9_-]{1,128}$/;

/** Criteri di revisione: prima i playbook dell'utente, poi i prompt pubblici di Jurio. */
async function loadReviewCriteria(uid: string, promptId: string): Promise<{ titolo: string; testo: string }> {
  if (!PROMPT_ID.test(promptId)) throw new BadRequest("Identificativo del prompt non valido.");

  const personal = await db.collection("register").doc(uid).collection("prompts").doc(promptId).get();
  const pd = personal.exists ? personal.data() : undefined;
  if (typeof pd?.content === "string" && pd.content.trim()) {
    return { titolo: String(pd.title || "Playbook"), testo: pd.content.slice(0, WORD_LIMITS.criteriaChars) };
  }

  const pub = await db.collection("prompt_list").doc(promptId).get();
  const d = pub.exists ? pub.data() : undefined;
  const testo = typeof d?.chatContent === "string" && d.chatContent.trim() ? d.chatContent : d?.content;
  if (typeof testo === "string" && testo.trim()) {
    return { titolo: String(d?.title || "Prompt Jurio"), testo: testo.slice(0, WORD_LIMITS.criteriaChars) };
  }
  throw new BadRequest("Prompt o playbook non trovato.", 404);
}

/** Verifica che l'utente possa usare il fascicolo come contesto (proprietario o condiviso). */
async function assertFascicoloAccess(fascicoloId: string, uid: string): Promise<void> {
  const snap = await db.collection("fascicoli").doc(fascicoloId).get();
  const data = snap.exists ? snap.data() : undefined;
  const allowed = data && (data.user === uid || (Array.isArray(data.visibleTo) && data.visibleTo.includes(uid)));
  if (!allowed) throw new Error("FORBIDDEN");
}

async function loadUser(uid: string) {
  const userSnap = await db.collection("register").doc(uid).get();
  if (!userSnap.exists) throw new Error("NOT_FOUND");
  return { userSnap, planId: String(userSnap.data()?.planId ?? "") };
}

async function streamFlowResponse<T, Output>(
  startFlow: () => { stream: AsyncIterable<T>; output: Promise<Output> },
  res: Response,
  isClientDisconnected: () => boolean
): Promise<void> {
  try {
    const flowStream = startFlow();
    for await (const chunk of flowStream.stream) {
      if (isClientDisconnected() || res.writableEnded) break;
      res.write(`data: ${JSON.stringify({ message: chunk })}\n\n`);
    }

    if (isClientDisconnected()) return;

    const finalOutput = await flowStream.output;
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ result: finalOutput })}\n\n`);
    }
  } catch (err) {
    // Gli header SSE sono già inviati: l'errore va comunicato come evento, non come status HTTP.
    logSafeError("WORD_AGENT_STREAM_FAILED", err);
    if (!res.writableEnded && !isClientDisconnected()) {
      res.write(`data: ${JSON.stringify({ error: { message: STREAM_ERROR_MESSAGE } })}\n\n`);
    }
  } finally {
    if (!res.writableEnded) {
      res.write("data: [DONE]\n\n");
      res.end();
    }
  }
}

// ─────────────────────────────────────────────
// Azioni senza AI
// ─────────────────────────────────────────────

async function handleDataAction(action: DataAction, body: Record<string, unknown>, uid: string, res: Response) {
  if (action === "usage") {
    const { planId } = await loadUser(uid);
    const limiteMensile = WORD_AI_MONTHLY_LIMITS[planId] ?? null;
    const usateMese = await readMonthlyFeatureCount(uid, WORD_AI_MONTHLY_FEATURE);
    res.status(200).json({ piano: wordPlanTier(planId), ai: { limiteMensile, usateMese } });
    return;
  }

  if (action === "prompts") {
    await loadUser(uid);
    const [pubblici, personali] = await Promise.all([
      db.collection("prompt_list").select("title", "type", "objective", "chatContent", "content").get(),
      db.collection("register").doc(uid).collection("prompts").select("title", "objective", "content").get(),
    ]);
    const hasText = (v: unknown) => typeof v === "string" && v.trim().length > 0;
    const jurio = pubblici.docs
      .filter((d) => hasText(d.data().chatContent) || hasText(d.data().content))
      .map((d) => ({ id: d.id, titolo: String(d.data().title || "Senza titolo"), obiettivo: String(d.data().objective || "") }))
      .sort((a, b) => a.titolo.localeCompare(b.titolo, "it"));
    const playbook = personali.docs
      .filter((d) => hasText(d.data().content))
      .map((d) => ({ id: d.id, titolo: String(d.data().title || "Playbook"), obiettivo: String(d.data().objective || "") }))
      .sort((a, b) => a.titolo.localeCompare(b.titolo, "it"));
    res.status(200).json({ jurio, playbook });
    return;
  }

  if (action === "transcribe") {
    const audio = body.audio;
    if (typeof audio !== "string" || !audio) throw new BadRequest("Registrazione mancante.");
    if (audio.length > Math.ceil(DICTATION_MAX_BYTES / 3) * 4 + 4) {
      throw new BadRequest("La registrazione supera la durata massima di 60 secondi.", 413);
    }
    const wav = Buffer.from(audio, "base64");
    if (!isSupportedWav(wav)) throw new BadRequest("Formato audio non supportato.");
    const { userSnap } = await loadUser(uid);
    await validateUserPlanAndLimits(uid, "word_dictation", userSnap);
    res.status(200).json({ testo: await transcribeDictation(wav) });
    return;
  }

  // search
  const mode = body.mode;
  if (typeof mode !== "string" || !(SEARCH_MODES as readonly string[]).includes(mode)) {
    throw new BadRequest("Modalità di ricerca non valida.");
  }
  const query = requiredString(body.query, "query", WORD_LIMITS.searchQueryChars).trim();
  const { userSnap } = await loadUser(uid);
  await validateUserPlanAndLimits(uid, "research", userSnap);
  const esito = await searchJurioDatabase({ mode: mode as SearchMode, query, userId: uid, limit: 10 });
  res.status(200).json(esito);
}

// ─────────────────────────────────────────────
// Azioni con AI
// ─────────────────────────────────────────────

type FlowStarter = () => { stream: AsyncIterable<unknown>; output: Promise<unknown> };

async function prepareAiAction(action: AiAction, body: Record<string, unknown>, uid: string): Promise<FlowStarter> {
  switch (action) {
    case "research": {
      const contesto = requiredString(body.contesto, "contesto", WORD_LIMITS.researchContextChars);
      const promptIndirizzamento = optionalString(body.promptIndirizzamento, "promptIndirizzamento", WORD_LIMITS.instructionChars);
      const filters = Array.isArray(body.filters) ? body.filters : [];
      return () => wordQuoteFlow.stream({ contesto, promptIndirizzamento, filters, userId: uid });
    }
    case "review": {
      const chunks = parseChunks(body.chunks);
      const promptIndirizzamento = optionalString(body.promptIndirizzamento, "promptIndirizzamento", WORD_LIMITS.instructionChars);
      const promptId = optionalString(body.promptId, "promptId", 128).trim();
      const criteri = promptId ? await loadReviewCriteria(uid, promptId) : null;
      return () => wordReviewFlow.stream({ chunks, promptIndirizzamento, criteri, userId: uid });
    }
    case "redraft": {
      const text = requiredString(body.text, "text", WORD_LIMITS.redraftTextChars);
      const promptDirettiva = optionalString(body.promptDirettiva, "promptDirettiva", WORD_LIMITS.instructionChars);
      const fascicoloId = optionalString(body.fascicoloId, "fascicoloId", 200).trim() || null;
      if (fascicoloId) await assertFascicoloAccess(fascicoloId, uid);
      return () => wordRedraftFlow.stream({ text, promptDirettiva, fascicoloId, userId: uid });
    }
    case "ask": {
      const domanda = requiredString(body.domanda, "domanda", WORD_LIMITS.askQuestionChars);
      const documento = optionalString(body.documento, "documento", WORD_LIMITS.askDocumentChars);
      const cronologia = parseHistory(body.cronologia);
      return () => wordAskFlow.stream({ domanda, documento, cronologia, userId: uid });
    }
    case "case_law": {
      const documento = requiredString(body.documento, "documento", WORD_LIMITS.caseLawDocumentChars);
      return () => wordCaseLawFlow.stream({ documento, userId: uid });
    }
  }
}

export async function executeWordAgent(req: Request, res: Response): Promise<any> {
  return withSecureApiEndpoint(
    req,
    res,
    async (uid): Promise<void> => {
      let clientDisconnected = false;
      req.on("close", () => {
        clientDisconnected = true;
      });

      const body = (req.body ?? {}) as Record<string, unknown>;
      const action = body.action;
      if (!isAiAction(action) && !isDataAction(action)) {
        res.status(400).json({ error: "Bad Request", details: "Parametro 'action' mancante o non valido." });
        return;
      }

      try {
        if (isDataAction(action)) {
          await handleDataAction(action, body, uid, res);
          return;
        }

        // 1. Validazione dell'input PRIMA di consumare quota e di aprire lo stream
        const startStream = await prepareAiAction(action, body, uid);

        // 2. Piano e limiti giornalieri per azione, poi tetto AI mensile (Essential e prova)
        const { userSnap, planId } = await loadUser(uid);
        await validateUserPlanAndLimits(uid, AI_ACTIONS[action], userSnap);
        const limiteMensile = WORD_AI_MONTHLY_LIMITS[planId];
        if (typeof limiteMensile === "number") {
          try {
            await consumeMonthlyFeature(uid, WORD_AI_MONTHLY_FEATURE, limiteMensile);
          } catch (err) {
            if ((err as { code?: string })?.code !== "monthly_quota_exceeded") throw err;
            res.status(429).json({ error: "monthly_ai_quota", details: MONTHLY_AI_QUOTA_MESSAGE });
            return;
          }
        }

        // 3. Stream SSE
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        await streamFlowResponse(startStream, res, () => clientDisconnected);
      } catch (err) {
        if (err instanceof BadRequest) {
          res.status(err.status).json({ error: "Bad Request", details: err.message });
          return;
        }
        throw err;
      }
    },
    corsHandlerWordAddin
  );
}
