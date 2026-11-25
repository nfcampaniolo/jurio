import { onRequest } from "firebase-functions/v2/https";
import { logSafeError } from "./_logging";
import { setGlobalOptions } from "firebase-functions/v2/options";
import { onDocumentCreated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { onSchedule } from "firebase-functions/v2/scheduler";

// Ogni funzione viene distribuita come servizio Cloud Run separato, ma tutti caricano questo file.
// Per questo i moduli della logica si importano dentro l'handler (import dinamico): ogni container
// carica solo ciò che gli serve, invece di genai, pdf, Stripe ecc. per tutte le funzioni.
// Accorcia l'avvio a freddo; Node mette in cache il modulo dopo il primo import.

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
  async (req, res) => {
    const { app } = await import("./mpc/app.js");
    app(req, res);
  }
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
  async (req, res) => {
    const { executeVectorSearchJurio } = await import("./research/sentences.logic.js");
    return executeVectorSearchJurio(req, res);
  }
);

export const vectorSearchDoctrine = onRequest(
  {
    secrets: ["OPENAI_API_KEY"], 
    timeoutSeconds: 75,
    memory: "1GiB",
    cpu: 1,
    concurrency: 80
  },
  async (req, res) => {
    const { executeVectorSearchDoctrine } = await import("./research/doctrine.logic.js");
    return executeVectorSearchDoctrine(req, res);
  }
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
    const { executeLegalAgent } = await import("./genai/legalAgent/logic.js");
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
    const { executeDeepAnalysis } = await import("./genai/deepAnalysisAgent/logic.js");
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
    const { processDeepAnalysisJob } = await import("./genai/deepAnalysisAgent/logic.js");
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
    const [{ getDb }, { processDeepAnalysisJob }] = await Promise.all([
      import("./_deps.js"),
      import("./genai/deepAnalysisAgent/logic.js"),
    ]);
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
    const { executeSupport } = await import("./genai/supportAgent/logic.js");
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
    const { executeReasoning } = await import("./genai/documentAnalysisAgent/logic.js");
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
    const { executePromptAgent } = await import("./genai/promptAgent/logic.js");
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
    const { executeEnhancePromptAgent } = await import("./genai/promptAgent/logic.js");
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
    const { executeWordAgent } = await import("./genai/wordAgent/logic.js");
    return executeWordAgent(req, res);
  }
);

// Accesso all'add-in Word tramite jurio.it (autorizzazione dal browser + token personalizzato)
export const wordAuth = onRequest(
  {
    timeoutSeconds: 30,
    // Prima del caricamento su richiesta dei moduli ogni funzione caricava l'intero index (~280 MiB) e sotto
    // 512 MiB il container non partiva. Ora carica solo wordLogin.logic: si può riprovare a ridurre la memoria.
    memory: "512MiB",
    concurrency: 80,
  },
  async (req, res) => {
    const { executeWordAuth } = await import("./auth/wordLogin.logic.js");
    return executeWordAuth(req, res);
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
    const { executeAdminDoctrineUpload } = await import("./genai/documentAnalysisAgent/logic.js");
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
    const { executeGenerateEmbedding } = await import("./genai/supportAgent/logic.js");
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
    const { executeSpeechToTextAgent } = await import("./support/textAgents.logic.js");
    return executeSpeechToTextAgent(req, res);
  }
);

export const extractDocumentText = onRequest(
  { 
    timeoutSeconds: 120,
    memory: "1GiB",
  }, 
  async (req, res) => {
    const { executeExtractDocumentText } = await import("./support/textAgents.logic.js");
    return executeExtractDocumentText(req, res);
  }
);

export const submitFeedback = onRequest(
  { 
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (req, res) => {
    const { executeSubmitFeedback } = await import("./support/feedback.logic.js");
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
    const { executeAdminMaintenanceTask } = await import("./admin/admin.logic.js");
    return executeAdminMaintenanceTask(req, res);
  }
);

export const adminMergeCategoryTask = onRequest(
  { 
    timeoutSeconds: 300, 
    memory: "2GiB",
  }, 
  async (req, res) => {
    const { executeAdminMergeCategoryTask } = await import("./admin/admin.logic.js");
    return executeAdminMergeCategoryTask(req, res);
  }
);

export const adminUploadManualContentTask = onRequest(
  { 
    timeoutSeconds: 30, 
    memory: "512MiB",
  }, 
  async (req, res) => {
    const { executeAdminUploadManualContentTask } = await import("./admin/admin.logic.js");
    return executeAdminUploadManualContentTask(req, res);
  }
);

export const sendAdminNotification = onRequest(
  { 
    timeoutSeconds: 300, 
    memory: "1GiB",
  },
  async (req, res) => {
    const { executeSendAdminNotification } = await import("./admin/admin.logic.js");
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
    const { executeReasoningAdmin } = await import("./admin/reason.logic.js");
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
  async (event) => {
    const { handleEmbeddingDocumentCreation } = await import("./triggers/embedding.logic.js");
    return handleEmbeddingDocumentCreation(event);
  }
);

export const processSentenceEmbedding = onDocumentCreated(
  {
    document: "sentences/{docId}", 
    secrets: ["OPENAI_API_KEY", "DEEPSEEK_API_KEY"],
    timeoutSeconds: 120,
    memory: "512MiB"
  },
  async (event) => {
    const { handleEmbeddingCreation } = await import("./triggers/embedding.logic.js");
    return handleEmbeddingCreation(event);
  }
);

export const processDoctrineEmbedding = onDocumentCreated(
  {
    document: "doctrine/{docId}", 
    secrets: ["OPENAI_API_KEY", "DEEPSEEK_API_KEY"],
    timeoutSeconds: 120,
    memory: "512MiB"
  },
  async (event) => {
    const { handleEmbeddingCreation } = await import("./triggers/embedding.logic.js");
    return handleEmbeddingCreation(event);
  }
);

export const processManualEmbedding = onDocumentCreated(
  {
    document: "manual/{docId}", 
    secrets: ["OPENAI_API_KEY", "DEEPSEEK_API_KEY"],
    timeoutSeconds: 120,
    memory: "512MiB"
  },
  async (event) => {
    const { handleEmbeddingManualCreation } = await import("./triggers/embedding.logic.js");
    return handleEmbeddingManualCreation(event);
  }
);

export const processFileCreation = onDocumentWritten(
  {
    document: "fascicoli/{fascicoloId}", 
    timeoutSeconds: 60,
    memory: "512MiB"
  },
  async (event) => {
    const { handleFileCreation } = await import("./triggers/triggers.logic.js");
    return handleFileCreation(event);
  }
);

export const generateStaticStatsJson = onDocumentCreated(
  {
    document: "metadocument/{docId}",
    memory: "512MiB",
  },
  async (event) => {
    const { handleGenerateStaticStatsJson } = await import("./triggers/triggers.logic.js");
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
    const { handleProcessContacts } = await import("./triggers/triggers.logic.js");
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
    const { executeUpdateMetadataFromChat } = await import("./genai/supportAgent/logic.js");
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
      const { computeAndSaveWeeklyStats } = await import("./schedules/tasks.logic.js");
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
    timeoutSeconds: 540,
    memory: "1GiB",
    retryCount: 3,
  },
  async (event) => {
    console.log(`⏰ Inizio task schedulato: consolidamento usage mensile: ${event.scheduleTime}`);
    try {
      const { computeAndSaveMonthlyUsage } = await import("./schedules/tasks.logic.js");
      const stats = await computeAndSaveMonthlyUsage();
      console.log(`✅ Consolidamento usage completato. Utenti processati: ${stats.utenti_processati}`);
    } catch (error) {
      logSafeError("MONTHLY_USAGE_CONSOLIDATION_FAILED", error);
      throw error;
    }

    // Report di attività (chat/fascicoli e deep analysis): un loro errore non rilancia,
    // altrimenti il retry ripeterebbe il consolidamento e rimanderebbe le email agli utenti
    try {
      const { computeAndSaveMonthlyActivityReports } = await import("./schedules/activityReports.logic.js");
      const reports = await computeAndSaveMonthlyActivityReports();
      console.log(`✅ Report attività ${reports.mese_id} salvati: ${reports.conversazioni.path}, ${reports.deep_analysis.path}`);
    } catch (error) {
      logSafeError("MONTHLY_ACTIVITY_REPORTS_FAILED", error);
    }
  }
);

export const tasksDowngrade = onRequest(async (req, res) => {
  const { executeTasksDowngrade } = await import("./schedules/tasks.logic.js");
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
    const { executeGetRegister } = await import("./subscriptions/subscription.logic.js");
    return executeGetRegister(req, res);
  }
);

export const getPrice = onRequest(
  {
    timeoutSeconds: 30,
    memory: "512MiB",
  },
  async (req, res) => {
    const { executeGetPrice } = await import("./subscriptions/subscription.logic.js");
    return executeGetPrice(req, res);
  }
);

export const applyDiscountCoupon = onRequest(
  {
    timeoutSeconds: 30, 
    memory: "512MiB",
  },
  async (req, res) => {
    const { executeApplyDiscountCoupon } = await import("./subscriptions/subscription.logic.js");
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
    const { executePayWithStripeCreateCheckoutSession } = await import("./subscriptions/payments.logic.js");
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
    const { executeStripeWebhook } = await import("./subscriptions/payments.logic.js");
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
    const { executeAssignTeamSeat } = await import("./team/teammembers.logic.js");
    return executeAssignTeamSeat(req, res);
  }
);

export const verifyVoucher = onRequest(
  {
    timeoutSeconds: 30,
    memory: "512MiB",
  },
  async (req, res) => {
    const { executeVerifyVoucher } = await import("./team/teamsharing.logic.js");
    return executeVerifyVoucher(req, res);
  }
);

export const removeTeamMember = onRequest(
  {
    timeoutSeconds: 60,
    memory: "512MiB",
  },
  async (req, res) => {
    const { executeRemoveTeamMember } = await import("./team/teammembers.logic.js");
    return executeRemoveTeamMember(req, res);
  }
);

export const deleteTeam = onRequest(
  {
    timeoutSeconds: 300,
    memory: "1GiB",
  },
  async (req, res) => {
    const { executeDeleteTeam } = await import("./team/teammanagement.logic.js");
    return executeDeleteTeam(req, res);
  }
);

export const sendVerificationEmail = onRequest(
  {
    timeoutSeconds: 30,
    memory: "512MiB",
  },
  async (req, res) => {
    const { executeSendVerificationEmail } = await import("./auth/emailVerification.logic.js");
    return executeSendVerificationEmail(req, res);
  }
);

export const sendPasswordResetEmail = onRequest(
  {
    timeoutSeconds: 30,
    memory: "512MiB",
  },
  async (req, res) => {
    const { executeSendPasswordResetEmail } = await import("./auth/passwordReset.logic.js");
    return executeSendPasswordResetEmail(req, res);
  }
);

export const sendTeamInviteEmail = onRequest(
  {
    timeoutSeconds: 30,
    memory: "512MiB",
  },
  async (req, res) => {
    const { executeSendTeamInviteEmail } = await import("./team/teamsharing.logic.js");
    return executeSendTeamInviteEmail(req, res);
  }
);

export const shareAllTeamDocuments = onRequest(
  {
    timeoutSeconds: 300,
    memory: "1GiB", 
  },
  async (req, res) => {
    const { executeShareAllTeamDocuments } = await import("./team/teammanagement.logic.js");
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
    const { executeListCloudFiles } = await import("./cloud/googledrive.logic.js");
    return executeListCloudFiles(req, res);
  }
);

export const downloadCloudFile = onRequest(
  { 
    timeoutSeconds: 120, 
    memory: "1GiB",
  },
  async (req, res) => {
    const { executeDownloadCloudFile } = await import("./cloud/googledrive.logic.js");
    return executeDownloadCloudFile(req, res);
  }
);