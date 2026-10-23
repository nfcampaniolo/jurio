import { onRequest } from "firebase-functions/v2/https";
import { logSafeError } from "./_logging";
import { setGlobalOptions } from "firebase-functions/v2/options";
import { onDocumentCreated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler"; 

import { app } from "./mpc/app";
import { executeVectorSearchJurio } from "./research/sentences.logic";
import { executeVectorSearchDoctrine } from "./research/doctrine.logic";
import { executeLegalAgent } from "./genai/legalAgent/logic";
import { executeDeepAnalysis, processDeepAnalysisJob } from "./genai/deepAnalysisAgent/logic";
import { getDb } from "./_deps";
import { executeSupport, executeUpdateMetadataFromChat, executeGenerateEmbedding } from "./genai/supportAgent/logic";
import { executeReasoning, executeAdminDoctrineUpload } from "./genai/documentAnalysisAgent/logic";
import { executePromptAgent, executeEnhancePromptAgent } from "./genai/promptAgent/logic";
import { executeWordAgent } from "./genai/wordAgent/logic";
import { executeSpeechToTextAgent, executeExtractDocumentText } from "./support/textAgents.logic";
import { executeSubmitFeedback } from  "./support/feedback.logic";
import { executeAdminMaintenanceTask, executeAdminMergeCategoryTask, executeAdminUploadManualContentTask, executeSendAdminNotification } from  "./admin/admin.logic";
import { executeReasoningAdmin } from  "./admin/reason.logic";
import { executeAssignTeamSeat, executeRemoveTeamMember } from  "./team/teammembers.logic";
import { executeVerifyVoucher, executeSendTeamInviteEmail } from  "./team/teamsharing.logic";
import { executeDeleteTeam, executeShareAllTeamDocuments } from  "./team/teammanagement.logic";
import { executeListCloudFiles, executeDownloadCloudFile } from "./cloud/googledrive.logic";
import { handleEmbeddingCreation, handleEmbeddingDocumentCreation, handleEmbeddingManualCreation } from "./triggers/embedding.logic";
import { handleGenerateStaticStatsJson, handleFileCreation, handleProcessContacts } from "./triggers/triggers.logic";
import { executeTasksDowngrade, computeAndSaveWeeklyStats, computeAndSaveMonthlyUsage } from "./schedules/tasks.logic";
import { executePayWithStripeCreateCheckoutSession, executeStripeWebhook } from "./subscriptions/payments.logic";
import { executeGetRegister, executeGetPrice, executeApplyDiscountCoupon} from "./subscriptions/subscription.logic";

setGlobalOptions({
  region: "europe-west1",
  timeoutSeconds: 300,
  memory: "1GiB",
  invoker: "public"
});

// ============================================================================
// MCP
// ============================================================================

export const jurioMcpServer = onRequest(
  { timeoutSeconds: 300, memory: "512MiB" },
  app
);

// ============================================================================
// RESEARCH
// ============================================================================

export const vectorSearchJurio = onRequest(
  {
    secrets: ["OPENAI_API_KEY", "GOOGLE_GENAI_API_KEY"],
    timeoutSeconds: 75,
    memory: "2GiB",
    cpu: 1,
    concurrency: 80
  },
  executeVectorSearchJurio
);

export const vectorSearchDoctrine = onRequest(
  {
    secrets: ["OPENAI_API_KEY"], 
    timeoutSeconds: 75,
    memory: "1GiB",
    cpu: 1,
    concurrency: 80
  },
  executeVectorSearchDoctrine
);

// ============================================================================
// GENAI 
// ============================================================================

export const legalAgent = onRequest(
  {
    secrets: ["GOOGLE_GENAI_API_KEY", "OPENAI_API_KEY", "TAVILY_API_KEY"],
    memory: "2GiB",
    concurrency: 80,
  },
  async (req, res) => {
    return executeLegalAgent(req, res);
  }
);

export const deepAnalysisAgent = onRequest(
  {
    secrets: [
      "GOOGLE_GENAI_API_KEY",
      "OPENAI_API_KEY",
      "TAVILY_API_KEY",
    ],
    timeoutSeconds: 540,
    memory: "2GiB",
    concurrency: 80,
  },
   async (req, res) => {
    return executeDeepAnalysis(req, res);
  }
);

export const processDeepAnalysis = onDocumentWritten(
  {
    document: "deep_analysis_sessions/{sessionId}",
    secrets: ["GOOGLE_GENAI_API_KEY", "OPENAI_API_KEY", "TAVILY_API_KEY"],
    timeoutSeconds: 540,
    memory: "2GiB",
    retry: false,
  },
  async (event) => {
    const job = event.data?.after.data()?.job;
    if (!job || job.status !== "queued") return;
    await processDeepAnalysisJob(event.params.sessionId);
  }
);

export const recoverDeepAnalysisJobs = onSchedule(
  {
    schedule: "every 5 minutes",
    timeoutSeconds: 540,
    memory: "1GiB",
  },
  async () => {
    const db = getDb();
    const [queued, processing] = await Promise.all([
      db.collection("deep_analysis_sessions")
        .where("job.status", "==", "queued")
        .limit(10)
        .get(),
      db.collection("deep_analysis_sessions")
        .where("job.status", "==", "processing")
        .limit(10)
        .get(),
    ]);
    const candidates = [
      ...queued.docs,
      ...processing.docs.filter((snapshot) => {
        const startedAt = snapshot.data().job?.startedAt;
        return !startedAt || Date.now() - startedAt.toMillis() >= 10 * 60 * 1000;
      }),
    ];
    for (const session of candidates) {
      await processDeepAnalysisJob(session.id);
    }
  }
);

export const support = onRequest(
  { 
    secrets: ["GOOGLE_GENAI_API_KEY", "OPENAI_API_KEY"],
    timeoutSeconds: 300,
    memory: "1GiB",
    concurrency: 80,
  }, 
  async (req, res) => {
    return executeSupport(req, res);
  }
);

export const reasoning = onRequest(
  { 
    secrets: ["GOOGLE_GENAI_API_KEY"],
    timeoutSeconds: 300, 
    memory: "1GiB",
  },
  async (req, res) => {
    return executeReasoning(req, res);
  }
);

export const promptAgent = onRequest(
  { 
    secrets: ["GOOGLE_GENAI_API_KEY", "OPENAI_API_KEY"],
    timeoutSeconds: 300,
    memory: "1GiB",
  }, 
  async (req, res) => {
    return executePromptAgent(req, res);
  }
);

export const enhancePromptAgent = onRequest(
  { 
    secrets: ["GOOGLE_GENAI_API_KEY"],
    timeoutSeconds: 60,
    memory: "512MiB",
  }, 
  async (req, res) => {
    return executeEnhancePromptAgent(req, res);
  }
);

export const wordAgent = onRequest(
  { 
    secrets: ["GOOGLE_GENAI_API_KEY", "OPENAI_API_KEY", "TAVILY_API_KEY"],
    timeoutSeconds: 300,
    memory: "1GiB"
  }, 
  async (req, res) => {
    return executeWordAgent(req, res);
  }
);

export const adminDoctrineUpload = onRequest(
  {
    secrets: ["GOOGLE_GENAI_API_KEY", "OPENAI_API_KEY"],
    timeoutSeconds: 1200,
    memory: "4GiB",
    invoker: "public",
  },
  async (req, res) => {
    return executeAdminDoctrineUpload(req, res);
  }
);

export const generateEmbedding = onRequest(
  { 
    secrets: ["OPENAI_API_KEY"],
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (req, res) => {
    return executeGenerateEmbedding(req, res);
  }
);

// ============================================================================
// SUPPORT
// ============================================================================

export const speechToTextAgent = onRequest(
  {
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (req, res) => {
    return executeSpeechToTextAgent(req, res);
  }
);

export const extractDocumentText = onRequest(
  { 
    timeoutSeconds: 120,
    memory: "1GiB",
  }, 
  async (req, res) => {
    return executeExtractDocumentText(req, res);
  }
);

export const submitFeedback = onRequest(
  { 
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (req, res) => {
    return executeSubmitFeedback(req, res);
  }
);

// ============================================================================
// ADMIN
// ============================================================================

export const adminMaintenanceTask = onRequest(
  { 
    timeoutSeconds: 540,
    memory: "1GiB",
  }, 
  async (req, res) => {
    return executeAdminMaintenanceTask(req, res);
  }
);

export const adminMergeCategoryTask = onRequest(
  { 
    timeoutSeconds: 300, 
    memory: "2GiB",
  }, 
  async (req, res) => {
    return executeAdminMergeCategoryTask(req, res);
  }
);

export const adminUploadManualContentTask = onRequest(
  { 
    timeoutSeconds: 30, 
    memory: "512MiB",
  }, 
  async (req, res) => {
    return executeAdminUploadManualContentTask(req, res);
  }
);

export const sendAdminNotification = onRequest(
  { 
    timeoutSeconds: 300, 
    memory: "1GiB",
  },
  async (req, res) => {
    return executeSendAdminNotification(req, res);
  }
);

export const reasoningAdmin = onRequest(
  { 
    secrets: ["DEEPSEEK_API_KEY", "OPENAI_API_KEY"],
    timeoutSeconds: 300, 
    memory: "1GiB",
  },
  async (req, res) => {
    return executeReasoningAdmin(req, res);
  }
);

// ============================================================================
// TRIGGERS
// ============================================================================

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

export const processDoctrineEmbedding = onDocumentCreated(
  {
    document: "doctrine/{docId}", 
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

export const processFileCreation = onDocumentWritten(
  {
    document: "fascicoli/{fascicoloId}", 
    timeoutSeconds: 60,
    memory: "512MiB"
  },
  handleFileCreation
);

export const generateStaticStatsJson = onDocumentCreated(
  {
    document: "metadocument/{docId}",
    memory: "512MiB",
  },
  async (event) => {
    return handleGenerateStaticStatsJson(event);
  }
);

export const processContacts = onDocumentCreated(
  {
    document: "contacts/{docId}", 
    timeoutSeconds: 120,
    memory: "512MiB"
  },
  async (event) => {
    return handleProcessContacts(event);
  }
);

export const updateMetadataFromChat = onDocumentCreated(
  {
    document: "fascicoli/{fascicoloId}/threads/{threadId}/messages/{messageId}",
    timeoutSeconds: 300,
    memory: "512MiB",
    secrets: ["GOOGLE_GENAI_API_KEY"],
  },
  async (event) => {
    return executeUpdateMetadataFromChat(event);
  }
);

// ============================================================================
// SCHEDULES & TASKS
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
      logSafeError("WEEKLY_SENTENCE_STATS_FAILED", error);
      throw error; 
    }
  }
);

export const monthlyUsageStatsCron = onSchedule(
  {
    schedule: "0 2 1 * *",
    timeZone: "Europe/Rome",
    timeoutSeconds: 300,
    memory: "512MiB",
    retryCount: 3,
  },
  async (event) => {
    console.log(`⏰ Inizio task schedulato: consolidamento usage mensile: ${event.scheduleTime}`);
    try {
      const stats = await computeAndSaveMonthlyUsage();
      console.log(`✅ Consolidamento usage completato. Utenti processati: ${stats.utenti_processati}`);
    } catch (error) {
      logSafeError("MONTHLY_USAGE_CONSOLIDATION_FAILED", error);
      throw error;
    }
  }
);

export const tasksDowngrade = onRequest(async (req, res) => {
  return executeTasksDowngrade(req, res);
});

// ============================================================================
// SUBSCRIPTION & PAYMENTS
// ============================================================================

export const getRegister = onRequest(
  { 
    secrets: ["PROJECT_ID", "TASK_SERVICE_ACCOUNT"],
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (req, res) => {
    return executeGetRegister(req, res);
  }
);

export const getPrice = onRequest(
  {
    timeoutSeconds: 30,
    memory: "512MiB",
  },
  async (req, res) => {
    return executeGetPrice(req, res);
  }
);

export const applyDiscountCoupon = onRequest(
  {
    timeoutSeconds: 30, 
    memory: "512MiB",
  },
  async (req, res) => {
    return executeApplyDiscountCoupon(req, res);
  }
);

export const payWithStripeCreateCheckoutSession = onRequest(
  { 
    invoker: "public", 
    secrets: ["STRIPE_SECRET_KEY"],
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (req, res) => {
    return executePayWithStripeCreateCheckoutSession(req, res);
  }
);

export const stripeWebhook = onRequest(
  { 
    invoker: "public", 
    secrets: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "PROJECT_ID", "TASK_SERVICE_ACCOUNT"],
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (req, res): Promise<void> => {
    return executeStripeWebhook(req, res);
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
    return executeAssignTeamSeat(req, res);
  }
);

export const verifyVoucher = onRequest(
  {
    timeoutSeconds: 30,
    memory: "512MiB",
  },
  async (req, res) => {
    return executeVerifyVoucher(req, res);
  }
);

export const removeTeamMember = onRequest(
  {
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (req, res) => {
    return executeRemoveTeamMember(req, res);
  }
);

export const deleteTeam = onRequest(
  {
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (req, res) => {
    return executeDeleteTeam(req, res);
  }
);

export const sendTeamInviteEmail = onRequest(
  {
    timeoutSeconds: 30,
    memory: "512MiB",
  },
  async (req, res) => {
    return executeSendTeamInviteEmail(req, res);
  }
);

export const shareAllTeamDocuments = onRequest(
  {
    timeoutSeconds: 300,
    memory: "1GiB", 
  },
  async (req, res) => {
    return executeShareAllTeamDocuments(req, res);
  }
);

// ============================================================================
// CLOUD INTEGRATIONS
// ============================================================================

export const listCloudFiles = onRequest(
  { 
    timeoutSeconds: 60, 
    memory: "1GiB",
  },
  async (req, res) => {
    return executeListCloudFiles(req, res);
  }
);

export const downloadCloudFile = onRequest(
  { 
    timeoutSeconds: 120, 
    memory: "1GiB",
  },
  async (req, res) => {
    return executeDownloadCloudFile(req, res);
  }
);