import { Request, Response } from "express";
import * as admin from "firebase-admin";
import { randomUUID } from "node:crypto";
import { assertResourceOwner } from "../_utils";
import { validateUserPlanAndLimits, withSecureApiEndpoint } from "../../_utils";
import { getDb, sanitize } from "../../_deps";
import { DeepAnalysisRequestBody, DeepAnalysisConfig, DeepAnalysisJob, DEFAULT_CONFIG } from "../_interfaces";
import { InquadramentoSchema, MappaDialetticaSchema } from "./_schema";
import { researchAnalysisFlow, refineResearchFlow, generateSynthesisReportFlow } from "./flow";
import { reportDeepAnalysisProgress } from "./_progress";
import { logSafeError } from "../../_logging";
const db = getDb();

/**
 * Normalizza e pulisce la lista dei documenti allegati.
 */
export function normalizeDeepAnalysisDocs(docs: unknown): string[] {
  if (!Array.isArray(docs)) {
    return [];
  }

  return Array.from(
    new Set(
      docs
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object" && "id" in item) {
            return String((item as { id: unknown }).id);
          }
          return "";
        })
        .map((value) => value.trim())
        .filter(Boolean)
    )
  ).slice(0, 50);
}

/**
 * Risolve e valida la configurazione della Deep Analysis con fallback sicuri.
 */
export function resolveDeepAnalysisConfig(
  config: Partial<DeepAnalysisConfig> | null | undefined
): DeepAnalysisConfig {
  const source = config ?? {};

  return {
    ...DEFAULT_CONFIG,
    confidenceLevel: clampNumber(
      source.confidenceLevel,
      DEFAULT_CONFIG.confidenceLevel,
      0,
      100
    ),
    sourceWeb:
      typeof source.sourceWeb === "boolean"
        ? source.sourceWeb
        : DEFAULT_CONFIG.sourceWeb,
    sourceInternalDB:
      typeof source.sourceInternalDB === "boolean"
        ? source.sourceInternalDB
        : DEFAULT_CONFIG.sourceInternalDB,
    sourceDoctrine:
      typeof source.sourceDoctrine === "boolean"
        ? source.sourceDoctrine
        : true,
    webLimit: clampInteger(source.webLimit, DEFAULT_CONFIG.webLimit, 1, 10),
  };
}

function clampNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(Math.max(parsed, min), max);
}

function clampInteger(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  return Math.round(clampNumber(value, fallback, min, max));
}

/**
 * Genera un titolo pulito e troncato partendo dal prompt originale.
 */
export function createDeepAnalysisTitle(prompt: string): string {
  const clean = prompt.replace(/\s+/g, " ").trim();
  if (clean.length <= 60) {
    return clean;
  }
  return `${clean.slice(0, 57)}...`;
}

export async function executeDeepAnalysis(req: Request, res: Response): Promise<void> {
  return withSecureApiEndpoint(req, res, async (uid): Promise<void> => {
    const body = req.body as DeepAnalysisRequestBody;
    const { action, sessionId, prompt, direttivaHitl, docs, config } = body;

    const validActions = new Set<DeepAnalysisRequestBody["action"]>([
      "start_research",
      "refine_research",
      "generate_synthesis",
    ]);

    if (!action || !validActions.has(action)) {
      res.status(400).json({ error: "Bad Request", details: "Action non valida." });
      return;
    }

    if (typeof sessionId !== "string" || !sessionId.trim()) {
      res.status(400).json({ error: "Bad Request", details: "SessionId mancante o non valido." });
      return;
    }

    const normalizedSessionId = sessionId.trim();
    const sessionRef = db.collection("deep_analysis_sessions").doc(normalizedSessionId);

    // Recupero parallelo di utente e dati di sessione
    const [userSnap, sessionSnap] = await Promise.all([
      db.collection("register").doc(uid).get(),
      sessionRef.get(),
    ]);

    if (!userSnap.exists) {
      throw new Error("NOT_FOUND");
    }

    // Validazione unificata del piano utente e dei limiti tramite l'helper centralizzato
    await validateUserPlanAndLimits(uid, "deep_analysis", userSnap);

    const sessionData = sessionSnap.exists ? sessionSnap.data() ?? {} : null;
    if (sessionSnap.exists) {
      assertResourceOwner(sessionData, uid, "Accesso alla sessione negato.");
    }

    if (action === "start_research") {
      if (typeof prompt !== "string" || !prompt.trim()) {
        res.status(400).json({ error: "Bad Request", details: "Prompt mancante per start_research." });
        return;
      }
    } else if (!sessionSnap.exists) {
      res.status(404).json({ error: "Session not found." });
      return;
    }

    const normalizedPrompt = action === "start_research" ? prompt?.trim() : undefined;
    const job: DeepAnalysisJob = {
      id: randomUUID(),
      userId: uid,
      action,
      status: "queued",
      ...(normalizedPrompt ? { prompt: normalizedPrompt } : {}),
      ...(typeof direttivaHitl === "string" ? { direttivaHitl: direttivaHitl.trim() } : {}),
      ...(action === "start_research" ? {
        docs: normalizeDeepAnalysisDocs(docs),
        config: resolveDeepAnalysisConfig(config),
      } : {}),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    try {
      await db.runTransaction(async (transaction) => {
        const latestSnap = await transaction.get(sessionRef);
        const latestSession = latestSnap.exists ? latestSnap.data() ?? {} : null;
        if (latestSession) {
          assertResourceOwner(latestSession, uid, "Accesso alla sessione negato.");
          const currentJob = latestSession.job as DeepAnalysisJob | undefined;
          if (currentJob?.status === "queued" || currentJob?.status === "processing") {
            throw new Error("ANALYSIS_ALREADY_RUNNING");
          }
        }

        const now = admin.firestore.FieldValue.serverTimestamp();
        const queuedSession: Record<string, unknown> = {
          user: uid,
          job,
          progress: {
            phase: action,
            message: "Analisi in coda. Puoi chiudere questa pagina: ti avviseremo quando sarà pronta.",
            status: "running",
            updatedAt: now,
          },
          updatedAt: now,
          ...(latestSnap.exists ? {} : {
            title: createDeepAnalysisTitle(normalizedPrompt ?? "Nuova indagine"),
            status: "draft",
            promptOriginale: normalizedPrompt,
            documentiAllegati: job.docs ?? [],
            configurazione: job.config ?? resolveDeepAnalysisConfig(undefined),
            createdAt: now,
          }),
        };
        transaction.set(sessionRef, sanitize(queuedSession), { merge: true });
      });
    } catch (error) {
      if (error instanceof Error && error.message === "ANALYSIS_ALREADY_RUNNING") {
        res.status(409).json({ error: "Analysis already running", details: "È già in corso un'elaborazione per questa indagine." });
        return;
      }
      throw error;
    }

    res.status(202).json({
      success: true,
      status: "queued",
      jobId: job.id,
      sessionId: normalizedSessionId,
    });
  });
}

export async function processDeepAnalysisJob(sessionId: string): Promise<void> {
  const sessionRef = db.collection("deep_analysis_sessions").doc(sessionId);
  const job = await db.runTransaction(async (transaction) => {
    const sessionSnap = await transaction.get(sessionRef);
    if (!sessionSnap.exists) return null;

    const session = sessionSnap.data() ?? {};
    const currentJob = session.job as DeepAnalysisJob | undefined;
    if (!currentJob || (currentJob.status !== "queued" && currentJob.status !== "processing")) return null;
    if (currentJob.status === "processing") {
      const startedAt = currentJob.startedAt as admin.firestore.Timestamp | undefined;
      if (!startedAt || Date.now() - startedAt.toMillis() < 10 * 60 * 1000) return null;
    }
    if ((currentJob.attemptCount ?? 0) >= 3) {
      return { ...currentJob, terminal: true, session };
    }

    transaction.update(sessionRef, {
      "job.status": "processing",
      "job.startedAt": admin.firestore.FieldValue.serverTimestamp(),
      "job.attemptCount": (currentJob.attemptCount ?? 0) + 1,
      "progress.status": "running",
      "progress.message": "Analisi avviata. Stiamo esaminando il quesito e le fonti selezionate.",
      "progress.updatedAt": admin.firestore.FieldValue.serverTimestamp(),
    });
    return { ...currentJob, status: "processing" as const, terminal: false, session };
  });

  if (!job) return;
  const uid = job.userId;
  if (job.terminal) {
    await finishDeepAnalysisJob(sessionRef, uid, sessionId, job.id, "failed");
    return;
  }
  if (job.resultReady) {
    await finishDeepAnalysisJob(sessionRef, uid, sessionId, job.id, "completed");
    return;
  }

  let status: "completed" | "failed" = "completed";
  try {
    assertResourceOwner(job.session, uid, "Accesso alla sessione negato.");

    if (job.action === "start_research") {
      const normalizedPrompt = job.prompt?.trim();
      if (!normalizedPrompt) throw new Error("Prompt mancante per start_research.");
      const normalizedDocs = normalizeDeepAnalysisDocs(job.docs);
      const resolvedConfig = resolveDeepAnalysisConfig(job.config);
      const output = await researchAnalysisFlow({
        prompt: normalizedPrompt,
        docs: normalizedDocs,
        userId: uid,
        config: resolvedConfig,
        sessionId,
      });
      const now = admin.firestore.FieldValue.serverTimestamp();
      await sessionRef.set(sanitize({
        title: createDeepAnalysisTitle(normalizedPrompt),
        status: "review",
        promptOriginale: normalizedPrompt,
        documentiAllegati: normalizedDocs,
        configurazione: resolvedConfig,
        inquadramento: output.inquadramento,
        mappaDialettica: output.mappaDialettica,
        mappaConcettuale: output.mappaConcettuale,
        fontiUsate: output.mappaConcettuale?.sourceIds ?? [],
        "job.resultReady": true,
        updatedAt: now,
      }), { merge: true });
    } else if (job.action === "refine_research") {
      const sessionSnap = await sessionRef.get();
      const currentSessionData = sessionSnap.data() ?? {};
      const savedConfig = currentSessionData.configurazione && typeof currentSessionData.configurazione === "object"
        ? currentSessionData.configurazione
        : {};
      const resolvedConfig: DeepAnalysisConfig = {
        ...DEFAULT_CONFIG,
        ...(savedConfig as Partial<DeepAnalysisConfig>),
      };
      const output = await refineResearchFlow({
        originalPrompt: typeof currentSessionData.promptOriginale === "string" ? currentSessionData.promptOriginale : "",
        direttivaHitl: job.direttivaHitl?.trim() || "Ricerca approfondimenti",
        currentInquadramento: InquadramentoSchema.parse(currentSessionData.inquadramento ?? {}),
        currentMappaDialettica: MappaDialetticaSchema.parse(currentSessionData.mappaDialettica ?? {}),
        currentMappaConcettuale: currentSessionData.mappaConcettuale ?? null,
        docs: Array.isArray(currentSessionData.documentiAllegati) ? currentSessionData.documentiAllegati : [],
        userId: uid,
        config: resolvedConfig,
        sessionId,
      });
      await sessionRef.set(sanitize({
        inquadramento: output.inquadramento,
        mappaDialettica: output.mappaDialettica,
        mappaConcettuale: output.mappaConcettuale,
        fontiUsate: output.mappaConcettuale?.sourceIds ?? [],
        status: "review",
        "job.resultReady": true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }), { merge: true });
    } else {
      const sessionSnap = await sessionRef.get();
      const session = sessionSnap.data() ?? {};
      const output = await generateSynthesisReportFlow({
        quesitoOriginale: String(session.promptOriginale ?? ""),
        inquadramento: session.inquadramento ?? {},
        mappaDialettica: session.mappaDialettica ?? {},
        mappaConcettuale: session.mappaConcettuale ?? undefined,
        userId: uid,
        sessionId,
      });
      await sessionRef.update(sanitize({
        sintesiStrategica: output,
        status: "completed",
        "job.resultReady": true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }));
    }
  } catch (error) {
    logSafeError("DEEP_ANALYSIS_JOB_FAILED", error);
    status = "failed";
    await reportDeepAnalysisProgress(
      sessionId,
      job.action,
      "L'elaborazione non è riuscita. Puoi riprovare dall'indagine.",
      "error"
    );
  }
  await finishDeepAnalysisJob(sessionRef, uid, sessionId, job.id, status);
}

async function finishDeepAnalysisJob(
  sessionRef: FirebaseFirestore.DocumentReference,
  uid: string,
  sessionId: string,
  jobId: string,
  status: "completed" | "failed"
): Promise<void> {
  const batch = db.batch();
  const completed = status === "completed";

  batch.update(sessionRef, {
    "job.status": status,
    "job.completedAt": admin.firestore.FieldValue.serverTimestamp(),
    "progress.phase": completed ? "completed" : "error",
    "progress.message": completed
      ? "Risultato pronto. Apri l'indagine per consultare l'analisi."
      : "Elaborazione non riuscita. Apri l'indagine per riprovare.",
    "progress.status": completed ? "completed" : "error",
    "progress.updatedAt": admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  writeDeepAnalysisNotification(uid, sessionId, jobId, status, batch);
  await batch.commit();
}

async function writeDeepAnalysisNotification(
  uid: string,
  sessionId: string,
  jobId: string,
  status: "completed" | "failed",
  batch?: FirebaseFirestore.WriteBatch
): Promise<void> {
  const completed = status === "completed";
  const targetBatch = batch ?? db.batch();
  const notificationRef = db.collection("notification").doc(`deep-analysis-${jobId}`);
  targetBatch.set(notificationRef, {
    user: uid,
    title: completed ? "Analisi giurisprudenziale pronta" : "Analisi giurisprudenziale non completata",
    message: completed
      ? "Il risultato della tua indagine è pronto per la revisione."
      : "Non è stato possibile completare l'indagine. Puoi riavviarla dalla sessione.",
    type: "report",
    link: `/analisi/${sessionId}`,
    isRead: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    jobId,
  });
  if (!batch) await targetBatch.commit();
}