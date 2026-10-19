import { beforeEach, describe, expect, expectTypeOf, it, vi } from "vitest";
import type {
  AdminNotificationRequestBody,
  ManualContentRequestBody,
  MaintenanceTaskBody,
  MergeCategoryRequestBody,
  ProgressCallback,
  ReasoningAdminRequestBody,
  ReasoningAdminResponse,
  SentenceDoc,
} from "@functions/admin/_interfaces";

describe("research interface contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("models optional content, maintenance, and category request fields", () => {
    // Arrange
    const content: ManualContentRequestBody = { id: "doc-1", text: "Testo", links: [], images: "" };
    const maintenance: MaintenanceTaskBody = { limit: 0, collectionName: "sentenze", dryRun: true };
    const merge: MergeCategoryRequestBody = { vecchiaCategoria: null, nuovaCategoria: "civile" };

    // Act
    const results = [content.links?.length, maintenance.dryRun, merge.nuovaCategoria];

    // Assert
    expectTypeOf(content).toMatchTypeOf<ManualContentRequestBody>();
    expectTypeOf(maintenance).toMatchTypeOf<MaintenanceTaskBody>();
    expect(results).toEqual([0, true, "civile"]);
  });

  it("supports sentence metadata, administrative notices, and reasoning responses", () => {
    // Arrange
    const sentence: SentenceDoc = {
      tipo_documento: "sentenza",
      numero_sentenza: 42,
      sottocategoria: null,
    };
    const notification: AdminNotificationRequestBody = {
      targetMode: "all",
      consentFilter: null,
      uid: "user-1",
      sendInApp: true,
      sendEmail: false,
      title: "Avviso",
      message: "Messaggio",
      emailHtml: "",
      link: "/avvisi",
      type: "system",
    };
    const question: ReasoningAdminRequestBody = { question: "Qual è la regola?" };
    const response: ReasoningAdminResponse = {
      message: { answer: "Risposta" },
      status: "success",
      model: "model",
      provider: "provider",
    };
    const progress: ProgressCallback = (message, progressData) => {
      expect(message).toBe("Caricamento");
      expect(progressData).toEqual({ percent: 50 });
    };

    // Act
    progress("Caricamento", { percent: 50 });

    // Assert
    expectTypeOf(sentence.numero_sentenza).toMatchTypeOf<string | number | undefined>();
    expectTypeOf(notification).toMatchTypeOf<AdminNotificationRequestBody>();
    expectTypeOf(question).toMatchTypeOf<ReasoningAdminRequestBody>();
    expect(response.status).toBe("success");
  });
});
