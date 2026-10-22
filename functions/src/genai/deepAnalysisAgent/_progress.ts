import { FieldValue } from "firebase-admin/firestore";
import { getDb } from "../../_deps";
import { logSafeError } from "../../_logging";

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
    logSafeError("DEEP_ANALYSIS_PROGRESS_UPDATE_FAILED", error);
  }
}
