import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  db: { collection: vi.fn() },
  secure: vi.fn((_req: unknown, _res: unknown, handler: (uid: string) => unknown) => handler("u1")),
  validate: vi.fn(),
  research: vi.fn(),
  refine: vi.fn(),
  synthesis: vi.fn(),
}));
vi.mock("@functions/_deps", () => ({ getDb: () => mocks.db, sanitize: (value: unknown) => value }));
vi.mock("@functions/_utils", () => ({
  validateUserPlanAndLimits: mocks.validate, withSecureApiEndpoint: mocks.secure,
}));
vi.mock("@functions/genai/_utils", () => ({ assertResourceOwner: vi.fn() }));
vi.mock("firebase-admin", () => ({ firestore: { FieldValue: { serverTimestamp: vi.fn(() => "timestamp") } } }));
vi.mock("@functions/genai/deepAnalysisAgent/flow", () => ({
  researchAnalysisFlow: mocks.research, refineResearchFlow: mocks.refine, generateSynthesisReportFlow: mocks.synthesis,
}));

import {
  createDeepAnalysisTitle, executeDeepAnalysis, normalizeDeepAnalysisDocs, resolveDeepAnalysisConfig,
} from "@functions/genai/deepAnalysisAgent/logic";

describe("deep-analysis request helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validate.mockResolvedValue(undefined);
    mocks.research.mockResolvedValue({
      inquadramento: { qualificazioneGiuridica: "Q" },
      mappaDialettica: { puntiAperti: [] },
      mappaConcettuale: { sourceIds: ["source-1"] },
    });
    mocks.refine.mockResolvedValue({
      inquadramento: {}, mappaDialettica: { puntiAperti: [] }, mappaConcettuale: { sourceIds: [] },
    });
    mocks.synthesis.mockResolvedValue({ titoloReport: "Report" });
  });

  it("normalizes and deduplicates string and object document references", () => {
    expect(normalizeDeepAnalysisDocs([" a ", { id: "b" }, { id: 4 }, "a", null]))
      .toEqual(["a", "b", "4"]);
    expect(normalizeDeepAnalysisDocs("not an array")).toEqual([]);
  });

  it("clamps numeric configuration and falls back for invalid types", () => {
    expect(resolveDeepAnalysisConfig({ confidenceLevel: 120, webLimit: 1.2, sourceWeb: false }))
      .toMatchObject({ confidenceLevel: 100, webLimit: 1, sourceWeb: false, sourceDoctrine: true });
    expect(resolveDeepAnalysisConfig({ confidenceLevel: "bad" as never }).confidenceLevel).toBe(80);
  });

  it("normalizes and truncates generated titles", () => {
    expect(createDeepAnalysisTitle("  Una\n richiesta  ")).toBe("Una richiesta");
    expect(createDeepAnalysisTitle("x".repeat(70))).toBe(`${"x".repeat(57)}...`);
  });

  it("validates action and session ID before loading session data", async () => {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await executeDeepAnalysis({ body: { action: "invalid", sessionId: "s1" } } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: "Bad Request", details: "Action non valida." });
    expect(mocks.db.collection).not.toHaveBeenCalled();
    await executeDeepAnalysis({ body: { action: "start_research", sessionId: " " } } as never, res as never);
    expect(res.json).toHaveBeenLastCalledWith({ error: "Bad Request", details: "SessionId mancante o non valido." });
  });

  it("enqueues research as a job and returns 202", async () => {
    const userSnap = { exists: true };
    const tx = {
      get: vi.fn().mockResolvedValue({ exists: false, data: () => undefined }),
      set: vi.fn(),
    };
    const sessionRef = { get: vi.fn().mockResolvedValue({ exists: false }) };
    mocks.db.runTransaction = vi.fn(async (fn: (t: typeof tx) => Promise<void>) => fn(tx));
    mocks.db.collection.mockImplementation((name: string) => name === "register"
      ? { doc: () => ({ get: vi.fn().mockResolvedValue(userSnap) }) }
      : { doc: () => sessionRef });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await executeDeepAnalysis({
      body: { action: "start_research", sessionId: " session-1 ", prompt: "  question ", docs: [" d1 ", { id: "d2" }] },
    } as never, res as never);
    expect(mocks.validate).toHaveBeenCalledWith("u1", "deep_analysis", userSnap);
    expect(mocks.research).not.toHaveBeenCalled();
    expect(tx.set).toHaveBeenCalledWith(sessionRef, expect.objectContaining({
      user: "u1", promptOriginale: "question", documentiAllegati: ["d1", "d2"],
      job: expect.objectContaining({ status: "queued", action: "start_research" }),
    }), { merge: true });
    expect(res.status).toHaveBeenCalledWith(202);
  });

  it("returns a not-found response when refinement targets an absent session", async () => {
    mocks.db.collection.mockImplementation((name: string) => name === "register"
      ? { doc: () => ({ get: vi.fn().mockResolvedValue({ exists: true }) }) }
      : { doc: () => ({ get: vi.fn().mockResolvedValue({ exists: false }) }) });
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    await executeDeepAnalysis({
      body: { action: "refine_research", sessionId: "missing" },
    } as never, res as never);
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ error: "Session not found." });
    expect(mocks.refine).not.toHaveBeenCalled();
  });
});
