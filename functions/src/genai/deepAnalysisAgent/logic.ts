import { Request, Response } from "express";
import * as admin from "firebase-admin";
import { assertResourceOwner } from "../_utils";
import { validateUserPlanAndLimits, withSecureApiEndpoint } from "../../_utils";
import { getDb, sanitize } from "../../_deps";
import { DeepAnalysisRequestBody, DeepAnalysisConfig, DEFAULT_CONFIG } from "../_interfaces";
import { InquadramentoSchema, MappaDialetticaSchema  } from "./_schema";
import { researchAnalysisFlow, refineResearchFlow, generateSynthesisReportFlow  } from "./flow";
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
      typeof (source as any).sourceDoctrine === "boolean"
        ? (source as any).sourceDoctrine
        : true,
    webLimit: clampInteger(source.webLimit, DEFAULT_CONFIG.webLimit, 1, 10),
  } as DeepAnalysisConfig;
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

export async function executeDeepAnalysis(req: Request, res: Response): Promise<any> {
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

    // --- AZIONE: START RESEARCH ---
    if (action === "start_research") {
      if (typeof prompt !== "string" || !prompt.trim()) {
        res.status(400).json({ error: "Bad Request", details: "Prompt mancante per start_research." });
        return;
      }

      const normalizedPrompt = prompt.trim();
      const normalizedDocs = normalizeDeepAnalysisDocs(docs);
      const resolvedConfig = resolveDeepAnalysisConfig(config);

      const output = await researchAnalysisFlow({
        prompt: normalizedPrompt,
        docs: normalizedDocs,
        userId: uid,
        config: resolvedConfig,
      });

      const now = admin.firestore.FieldValue.serverTimestamp();
      const sessionPayload: Record<string, any> = {
        user: uid,
        ownerId: uid,
        title: createDeepAnalysisTitle(normalizedPrompt),
        status: "review",
        promptOriginale: normalizedPrompt,
        documentiAllegati: normalizedDocs,
        configurazione: resolvedConfig,
        inquadramento: output.inquadramento,
        mappaDialettica: output.mappaDialettica,
        mappaConcettuale: output.mappaConcettuale,
        fontiUsate: output.mappaConcettuale?.sourceIds ?? [],
        updatedAt: now,
        ...(sessionSnap.exists ? {} : { createdAt: now }),
      };

      await sessionRef.set(sanitize(sessionPayload), { merge: true });

      res.status(200).json({
        success: true,
        status: "review",
        mappaDialettica: output.mappaDialettica,
        mappaConcettuale: output.mappaConcettuale,
        inquadramento: output.inquadramento,
      });
      return;
    }

    if (!sessionSnap.exists) {
      res.status(404).json({ error: "Session not found." });
      return;
    }

    // --- AZIONE: REFINE RESEARCH ---
    if (action === "refine_research") {
      const currentSessionData = sessionSnap.data()!;
      assertResourceOwner(currentSessionData, uid, "Accesso alla sessione negato.");

      const normalizedHitl = typeof direttivaHitl === "string" && direttivaHitl.trim().length > 0
        ? direttivaHitl.trim()
        : "Ricerca approfondimenti";

      const savedConfig = currentSessionData.configurazione && typeof currentSessionData.configurazione === "object"
        ? currentSessionData.configurazione
        : {};

      const resolvedConfig: DeepAnalysisConfig = {
        ...DEFAULT_CONFIG,
        ...(savedConfig as Partial<DeepAnalysisConfig>),
      };

      const output = await refineResearchFlow({
        originalPrompt: typeof currentSessionData.promptOriginale === "string" ? currentSessionData.promptOriginale : "",
        direttivaHitl: normalizedHitl,
        currentInquadramento: InquadramentoSchema.parse(currentSessionData.inquadramento ?? {}),
        currentMappaDialettica: MappaDialetticaSchema.parse(currentSessionData.mappaDialettica ?? {}),
        currentMappaConcettuale: currentSessionData.mappaConcettuale ?? null,
        docs: Array.isArray(currentSessionData.documentiAllegati) ? currentSessionData.documentiAllegati : [],
        userId: uid,
        config: resolvedConfig,
      });

      const now = admin.firestore.FieldValue.serverTimestamp();
      await sessionRef.set(
        sanitize({
          inquadramento: output.inquadramento,
          mappaDialettica: output.mappaDialettica,
          mappaConcettuale: output.mappaConcettuale,
          fontiUsate: output.mappaConcettuale?.sourceIds ?? [],
          status: "review",
          updatedAt: now,
        }),
        { merge: true }
      );

      res.status(200).json({
        success: true,
        status: "review",
        inquadramento: output.inquadramento,
        mappaDialettica: output.mappaDialettica,
        mappaConcettuale: output.mappaConcettuale,
        fontiUsate: output.mappaConcettuale?.sourceIds ?? [],
      });
      return;
    }

    // --- AZIONE: GENERATE SYNTHESIS ---
    if (action === "generate_synthesis") {
      const output = await generateSynthesisReportFlow({
        quesitoOriginale: String(sessionData?.promptOriginale ?? ""),
        inquadramento: sessionData?.inquadramento ?? {},
        mappaDialettica: sessionData?.mappaDialettica ?? {},
        mappaConcettuale: sessionData?.mappaConcettuale ?? undefined,
        userId: uid,
      });

      await sessionRef.update(
        sanitize({
          sintesiStrategica: output,
          status: "completed",
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        })
      );

      res.status(200).json({
        success: true,
        status: "completed",
        sintesiStrategica: output,
        mappaConcettuale: sessionData?.mappaConcettuale ?? null,
      });
      return;
    }

    res.status(400).json({ error: "Unsupported action." });
  });
}