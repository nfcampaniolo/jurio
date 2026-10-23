import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  type Handler = (...args: unknown[]) => unknown;
  const handlerNames = [
    "executeVectorSearchJurio",
    "executeVectorSearchDoctrine",
    "executeLegalAgent",
    "executeDeepAnalysis",
    "executeSupport",
    "executeUpdateMetadataFromChat",
    "executeGenerateEmbedding",
    "executeReasoning",
    "executeAdminDoctrineUpload",
    "executePromptAgent",
    "executeEnhancePromptAgent",
    "executeWordAgent",
    "executeSpeechToTextAgent",
    "executeExtractDocumentText",
    "executeSubmitFeedback",
    "executeAdminMaintenanceTask",
    "executeAdminMergeCategoryTask",
    "executeAdminUploadManualContentTask",
    "executeSendAdminNotification",
    "executeReasoningAdmin",
    "executeAssignTeamSeat",
    "executeRemoveTeamMember",
    "executeVerifyVoucher",
    "executeSendTeamInviteEmail",
    "executeDeleteTeam",
    "executeShareAllTeamDocuments",
    "executeListCloudFiles",
    "executeDownloadCloudFile",
    "handleEmbeddingCreation",
    "handleEmbeddingDocumentCreation",
    "handleEmbeddingManualCreation",
    "handleGenerateStaticStatsJson",
    "handleFileCreation",
    "handleProcessContacts",
    "executeTasksDowngrade",
    "computeAndSaveWeeklyStats",
    "computeAndSaveMonthlyUsage",
    "executePayWithStripeCreateCheckoutSession",
    "executeStripeWebhook",
    "executeGetRegister",
    "executeGetPrice",
    "executeApplyDiscountCoupon",
  ];
  const handlers = Object.fromEntries(handlerNames.map((name) => [name, vi.fn()]));
  const app = vi.fn();
  const registrations: Array<{ kind: string; options: unknown; handler: Handler }> = [];
  const globalOptions = { value: undefined as unknown };

  function register(kind: string, args: unknown[]) {
    const options = typeof args[0] === "function" ? {} : args[0];
    const handler = (typeof args[0] === "function" ? args[0] : args[1]) as Handler;
    const registration = { kind, options, handler };
    registrations.push(registration);
    return registration;
  }

  return { handlers, app, registrations, globalOptions, register };
});

vi.mock("../../functions/node_modules/firebase-functions/lib/esm/v2/providers/https.mjs", () => ({
  onRequest: vi.fn((...args: unknown[]) => mocks.register("request", args)),
}));
vi.mock("../../functions/node_modules/firebase-functions/lib/esm/v2/options.mjs", () => ({
  setGlobalOptions: vi.fn((options: unknown) => { mocks.globalOptions.value = options; }),
}));
vi.mock("../../functions/node_modules/firebase-functions/lib/esm/v2/providers/firestore.mjs", () => ({
  onDocumentCreated: vi.fn((...args: unknown[]) => mocks.register("document", args)),
  onDocumentWritten: vi.fn((...args: unknown[]) => mocks.register("document", args)),
}));
vi.mock("../../functions/node_modules/firebase-functions/lib/esm/v2/providers/scheduler.mjs", () => ({
  onSchedule: vi.fn((...args: unknown[]) => mocks.register("schedule", args)),
}));

vi.mock("../../functions/src/mpc/app", () => ({ app: mocks.app }));
vi.mock("../../functions/src/research/sentences.logic", () => ({
  executeVectorSearchJurio: mocks.handlers.executeVectorSearchJurio,
}));
vi.mock("../../functions/src/research/doctrine.logic", () => ({
  executeVectorSearchDoctrine: mocks.handlers.executeVectorSearchDoctrine,
}));
vi.mock("../../functions/src/genai/legalAgent/logic", () => ({
  executeLegalAgent: mocks.handlers.executeLegalAgent,
}));
vi.mock("../../functions/src/genai/deepAnalysisAgent/logic", () => ({
  executeDeepAnalysis: mocks.handlers.executeDeepAnalysis,
}));
vi.mock("../../functions/src/genai/supportAgent/logic", () => ({
  executeSupport: mocks.handlers.executeSupport,
  executeUpdateMetadataFromChat: mocks.handlers.executeUpdateMetadataFromChat,
  executeGenerateEmbedding: mocks.handlers.executeGenerateEmbedding,
}));
vi.mock("../../functions/src/genai/documentAnalysisAgent/logic", () => ({
  executeReasoning: mocks.handlers.executeReasoning,
  executeAdminDoctrineUpload: mocks.handlers.executeAdminDoctrineUpload,
}));
vi.mock("../../functions/src/genai/promptAgent/logic", () => ({
  executePromptAgent: mocks.handlers.executePromptAgent,
  executeEnhancePromptAgent: mocks.handlers.executeEnhancePromptAgent,
}));
vi.mock("../../functions/src/genai/wordAgent/logic", () => ({
  executeWordAgent: mocks.handlers.executeWordAgent,
}));
vi.mock("../../functions/src/support/textAgents.logic", () => ({
  executeSpeechToTextAgent: mocks.handlers.executeSpeechToTextAgent,
  executeExtractDocumentText: mocks.handlers.executeExtractDocumentText,
}));
vi.mock("../../functions/src/support/feedback.logic", () => ({
  executeSubmitFeedback: mocks.handlers.executeSubmitFeedback,
}));
vi.mock("../../functions/src/admin/admin.logic", () => ({
  executeAdminMaintenanceTask: mocks.handlers.executeAdminMaintenanceTask,
  executeAdminMergeCategoryTask: mocks.handlers.executeAdminMergeCategoryTask,
  executeAdminUploadManualContentTask: mocks.handlers.executeAdminUploadManualContentTask,
  executeSendAdminNotification: mocks.handlers.executeSendAdminNotification,
}));
vi.mock("../../functions/src/admin/reason.logic", () => ({
  executeReasoningAdmin: mocks.handlers.executeReasoningAdmin,
}));
vi.mock("../../functions/src/team/teammembers.logic", () => ({
  executeAssignTeamSeat: mocks.handlers.executeAssignTeamSeat,
  executeRemoveTeamMember: mocks.handlers.executeRemoveTeamMember,
}));
vi.mock("../../functions/src/team/teamsharing.logic", () => ({
  executeVerifyVoucher: mocks.handlers.executeVerifyVoucher,
  executeSendTeamInviteEmail: mocks.handlers.executeSendTeamInviteEmail,
}));
vi.mock("../../functions/src/team/teammanagement.logic", () => ({
  executeDeleteTeam: mocks.handlers.executeDeleteTeam,
  executeShareAllTeamDocuments: mocks.handlers.executeShareAllTeamDocuments,
}));
vi.mock("../../functions/src/cloud/googledrive.logic", () => ({
  executeListCloudFiles: mocks.handlers.executeListCloudFiles,
  executeDownloadCloudFile: mocks.handlers.executeDownloadCloudFile,
}));
vi.mock("../../functions/src/triggers/embedding.logic", () => ({
  handleEmbeddingCreation: mocks.handlers.handleEmbeddingCreation,
  handleEmbeddingDocumentCreation: mocks.handlers.handleEmbeddingDocumentCreation,
  handleEmbeddingManualCreation: mocks.handlers.handleEmbeddingManualCreation,
}));
vi.mock("../../functions/src/triggers/triggers.logic", () => ({
  handleGenerateStaticStatsJson: mocks.handlers.handleGenerateStaticStatsJson,
  handleFileCreation: mocks.handlers.handleFileCreation,
  handleProcessContacts: mocks.handlers.handleProcessContacts,
}));
vi.mock("../../functions/src/schedules/tasks.logic", () => ({
  executeTasksDowngrade: mocks.handlers.executeTasksDowngrade,
  computeAndSaveWeeklyStats: mocks.handlers.computeAndSaveWeeklyStats,
  computeAndSaveMonthlyUsage: mocks.handlers.computeAndSaveMonthlyUsage,
}));
vi.mock("../../functions/src/subscriptions/payments.logic", () => ({
  executePayWithStripeCreateCheckoutSession: mocks.handlers.executePayWithStripeCreateCheckoutSession,
  executeStripeWebhook: mocks.handlers.executeStripeWebhook,
}));
vi.mock("../../functions/src/subscriptions/subscription.logic", () => ({
  executeGetRegister: mocks.handlers.executeGetRegister,
  executeGetPrice: mocks.handlers.executeGetPrice,
  executeApplyDiscountCoupon: mocks.handlers.executeApplyDiscountCoupon,
}));

let functions: typeof import("@functions/index");

beforeAll(async () => {
  functions = await import("@functions/index");
});

const requestDispatches: Array<[keyof typeof functions, keyof typeof mocks.handlers]> = [
  ["vectorSearchJurio", "executeVectorSearchJurio"],
  ["vectorSearchDoctrine", "executeVectorSearchDoctrine"],
  ["legalAgent", "executeLegalAgent"],
  ["deepAnalysisAgent", "executeDeepAnalysis"],
  ["support", "executeSupport"],
  ["reasoning", "executeReasoning"],
  ["promptAgent", "executePromptAgent"],
  ["enhancePromptAgent", "executeEnhancePromptAgent"],
  ["wordAgent", "executeWordAgent"],
  ["adminDoctrineUpload", "executeAdminDoctrineUpload"],
  ["generateEmbedding", "executeGenerateEmbedding"],
  ["speechToTextAgent", "executeSpeechToTextAgent"],
  ["extractDocumentText", "executeExtractDocumentText"],
  ["submitFeedback", "executeSubmitFeedback"],
  ["adminMaintenanceTask", "executeAdminMaintenanceTask"],
  ["adminMergeCategoryTask", "executeAdminMergeCategoryTask"],
  ["adminUploadManualContentTask", "executeAdminUploadManualContentTask"],
  ["sendAdminNotification", "executeSendAdminNotification"],
  ["reasoningAdmin", "executeReasoningAdmin"],
  ["tasksDowngrade", "executeTasksDowngrade"],
  ["getRegister", "executeGetRegister"],
  ["getPrice", "executeGetPrice"],
  ["applyDiscountCoupon", "executeApplyDiscountCoupon"],
  ["payWithStripeCreateCheckoutSession", "executePayWithStripeCreateCheckoutSession"],
  ["stripeWebhook", "executeStripeWebhook"],
  ["assignTeamSeat", "executeAssignTeamSeat"],
  ["verifyVoucher", "executeVerifyVoucher"],
  ["removeTeamMember", "executeRemoveTeamMember"],
  ["deleteTeam", "executeDeleteTeam"],
  ["sendTeamInviteEmail", "executeSendTeamInviteEmail"],
  ["shareAllTeamDocuments", "executeShareAllTeamDocuments"],
  ["listCloudFiles", "executeListCloudFiles"],
  ["downloadCloudFile", "executeDownloadCloudFile"],
];

describe("functions/src/index", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sets the expected Firebase Functions global deployment options", () => {
    // Arrange / Act
    const options = mocks.globalOptions.value;

    // Assert
    expect(options).toEqual({
      region: "europe-west1",
      timeoutSeconds: 300,
      memory: "1GiB",
      invoker: "public",
    });
  });

  it("registers every exported Firebase function with a valid trigger handler", () => {
    // Arrange
    const exportedRegistrations = Object.entries(functions).filter(([name]) => name !== "default");

    // Act / Assert
    expect(exportedRegistrations).toHaveLength(46);
    for (const [name, registration] of exportedRegistrations) {
      const registrationDetails = registration as unknown as { kind: string; handler: unknown };
      expect(registrationDetails, `${name} is registered`).toMatchObject({
        kind: expect.stringMatching(/^(request|document|schedule)$/),
      });
      expect(typeof registrationDetails.handler, `${name} has a handler`).toBe("function");
    }
  });

  it("registers the MCP app as the HTTP handler with the dedicated resource options", () => {
    // Arrange
    const registration = functions.jurioMcpServer as unknown as { options: unknown; handler: unknown };

    // Act
    const { options, handler } = registration;

    // Assert
    expect(options).toEqual({ timeoutSeconds: 300, memory: "512MiB" });
    expect(handler).toBe(mocks.app);
  });

  it.each(requestDispatches)("forwards %s requests to %s", async (exportName, mockName) => {
    // Arrange
    const req = { method: "POST" };
    const res = {};
    const handlerMock = mocks.handlers[mockName];
    handlerMock.mockResolvedValueOnce("completed");
    const registration = functions[exportName] as unknown as { handler: (req: unknown, res: unknown) => unknown };

    // Act
    const result = await registration.handler(req, res);

    // Assert
    expect(result).toBe("completed");
    expect(handlerMock).toHaveBeenCalledWith(req, res);
  });

  it.each([
    ["processDocumentEmbedding", "handleEmbeddingDocumentCreation"],
    ["processSentenceEmbedding", "handleEmbeddingCreation"],
    ["processDoctrineEmbedding", "handleEmbeddingCreation"],
    ["processManualEmbedding", "handleEmbeddingManualCreation"],
    ["processFileCreation", "handleFileCreation"],
  ] as const)("dispatches %s document events to %s", async (exportName, mockName) => {
    // Arrange
    const event = { id: "event-1" };
    const handlerMock = mocks.handlers[mockName];
    handlerMock.mockResolvedValueOnce("processed");
    const registration = functions[exportName] as unknown as { handler: (event: unknown) => unknown };

    // Act
    const result = await registration.handler(event);

    // Assert
    expect(result).toBe("processed");
    expect(handlerMock).toHaveBeenCalledWith(event);
  });

  it.each([
    ["generateStaticStatsJson", "handleGenerateStaticStatsJson"],
    ["processContacts", "handleProcessContacts"],
    ["updateMetadataFromChat", "executeUpdateMetadataFromChat"],
  ] as const)("dispatches %s events to %s", async (exportName, mockName) => {
    // Arrange
    const event = { params: { id: "event-2" } };
    const handlerMock = mocks.handlers[mockName];
    handlerMock.mockResolvedValueOnce("processed");
    const registration = functions[exportName] as unknown as { handler: (event: unknown) => unknown };

    // Act
    const result = await registration.handler(event);

    // Assert
    expect(result).toBe("processed");
    expect(handlerMock).toHaveBeenCalledWith(event);
  });

  it("schedules weekly and monthly jobs with their timezone and retry configuration", () => {
    // Arrange
    const weekly = functions.weeklySentencesStatsCron as unknown as { options: Record<string, unknown> };
    const monthly = functions.monthlyUsageStatsCron as unknown as { options: Record<string, unknown> };

    // Act / Assert
    expect(weekly.options).toMatchObject({
      schedule: "0 2 * * 0",
      timeZone: "Europe/Rome",
      timeoutSeconds: 60,
      retryCount: 3,
    });
    expect(monthly.options).toMatchObject({
      schedule: "0 2 1 * *",
      timeZone: "Europe/Rome",
      timeoutSeconds: 300,
      retryCount: 3,
    });
  });

  it("runs the weekly aggregation and logs the successful document count", async () => {
    // Arrange
    mocks.handlers.computeAndSaveWeeklyStats.mockResolvedValueOnce({ totale_documenti: 23 });
    const registration = functions.weeklySentencesStatsCron as unknown as { handler: (event: unknown) => Promise<void> };
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    // Act
    await registration.handler({ scheduleTime: "2026-10-18T02:00:00Z" });

    // Assert
    expect(mocks.handlers.computeAndSaveWeeklyStats).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("23"));
  });

  it("logs and rethrows weekly aggregation failures", async () => {
    // Arrange
    const failure = new Error("weekly failed");
    mocks.handlers.computeAndSaveWeeklyStats.mockRejectedValueOnce(failure);
    const registration = functions.weeklySentencesStatsCron as unknown as { handler: (event: unknown) => Promise<void> };
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Act
    const result = registration.handler({});

    // Assert
    await expect(result).rejects.toBe(failure);
    expect(errorLog).toHaveBeenCalledWith("WEEKLY_SENTENCE_STATS_FAILED", { errorType: "Error" });
  });

  it("runs the monthly usage aggregation and logs the processed user count", async () => {
    // Arrange
    mocks.handlers.computeAndSaveMonthlyUsage.mockResolvedValueOnce({ utenti_processati: 8 });
    const registration = functions.monthlyUsageStatsCron as unknown as { handler: (event: unknown) => Promise<void> };
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    // Act
    await registration.handler({ scheduleTime: "2026-10-01T02:00:00Z" });

    // Assert
    expect(mocks.handlers.computeAndSaveMonthlyUsage).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith(expect.stringContaining("8"));
  });

  it("logs and rethrows monthly aggregation failures", async () => {
    // Arrange
    const failure = new Error("monthly failed");
    mocks.handlers.computeAndSaveMonthlyUsage.mockRejectedValueOnce(failure);
    const registration = functions.monthlyUsageStatsCron as unknown as { handler: (event: unknown) => Promise<void> };
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);

    // Act
    const result = registration.handler({ scheduleTime: "2026-10-01T02:00:00Z" });

    // Assert
    await expect(result).rejects.toBe(failure);
    expect(errorLog).toHaveBeenCalledWith("MONTHLY_USAGE_CONSOLIDATION_FAILED", { errorType: "Error" });
  });
});
