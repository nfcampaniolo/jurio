import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../../_deps";

export type DeepAnalysisProgressStatus = "running" | "completed" | "error";

const db = getDb();

export async function reportDeepAnalysisProgress(
  sessionId: string | undefined,
  phase: string,
  message: string,
  status: DeepAnalysisProgressStatus = "running"
): Promise<void> {
  if (!sessionId) return;

  try {
    await db
      .collection("deep_analysis_sessions")
      .doc(sessionId)
      .set(
        {
          progress: {
            phase,
            message,
            status,
            updatedAt: FieldValue.serverTimestamp(),
          },
        },
        { merge: true }
      );
  } catch (error) {
    console.error("[DeepAnalysisProgress] Aggiornamento stato non riuscito:", error);
  }
}
