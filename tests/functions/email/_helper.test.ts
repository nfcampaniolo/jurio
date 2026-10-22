import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import type { Timestamp } from "firebase-admin/firestore";

const mocks = vi.hoisted(() => {
  const batchSet = vi.fn();
  const batchCommit = vi.fn().mockResolvedValue(undefined);
  const mailDoc = vi.fn(() => ({ id: "mail-id" }));
  const notificationDoc = vi.fn(() => ({ id: "notification-id" }));
  const collection = vi.fn((name: string) => ({
    doc: name === "mail" ? mailDoc : notificationDoc,
  }));
  const batch = vi.fn(() => ({ set: batchSet, commit: batchCommit }));
  const db = { batch, collection };
  return {
    batchSet,
    batchCommit,
    mailDoc,
    notificationDoc,
    collection,
    batch,
    db,
    getDb: vi.fn(() => db),
  };
});

vi.mock("../../../functions/src/_deps", () => ({ getDb: mocks.getDb }));

const functionRequire = createRequire(resolve(process.cwd(), "functions/src/email/_helper.ts"));
const firestoreModule = functionRequire("firebase-admin/firestore");
let helper: typeof import("../../../functions/src/email/_helper");
let serverTimestampSpy: ReturnType<typeof vi.spyOn>;

describe("email helper", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    serverTimestampSpy = vi.spyOn(firestoreModule.FieldValue, "serverTimestamp").mockImplementation(() => "server-timestamp");
    helper = await import("../../../functions/src/email/_helper");
  });

  describe("dispatchMailAndNotification", () => {
    it("accoda l'email con i soli destinatari forniti e commit del batch", async () => {
      // Arrange
      const args = { to: "utente@example.com", subject: "Oggetto", html: "<p>Test</p>" };

      // Act
      await helper.dispatchMailAndNotification(args);

      // Assert
      expect(mocks.batch).toHaveBeenCalledOnce();
      expect(mocks.collection).toHaveBeenCalledWith("mail");
      expect(mocks.mailDoc).toHaveBeenCalledOnce();
      expect(mocks.batchSet).toHaveBeenCalledWith(
        { id: "mail-id" },
        { message: { subject: "Oggetto", html: "<p>Test</p>" }, from: "Jurio Support <info@jurio.it>", to: "utente@example.com" },
      );
      expect(mocks.batchCommit).toHaveBeenCalledOnce();
      expect(serverTimestampSpy).not.toHaveBeenCalled();
    });

    it("inserisce from, to, cc e bcc personalizzati insieme a una singola notifica", async () => {
      // Arrange
      const args = {
        to: ["a@example.com", "b@example.com"],
        cc: "c@example.com",
        bcc: "d@example.com",
        from: "Support <support@example.com>",
        subject: "Aggiornamento",
        html: "<p>Corpo</p>",
        notifications: { user: "user-1", title: "Titolo", message: "Testo" },
      };

      // Act
      await helper.dispatchMailAndNotification(args);

      // Assert
      expect(mocks.batchSet).toHaveBeenNthCalledWith(1, { id: "mail-id" }, {
        message: { subject: "Aggiornamento", html: "<p>Corpo</p>" },
        from: "Support <support@example.com>",
        to: ["a@example.com", "b@example.com"],
        cc: "c@example.com",
        bcc: "d@example.com",
      });
      expect(mocks.collection).toHaveBeenCalledWith("notification");
      expect(mocks.batchSet).toHaveBeenNthCalledWith(2, { id: "notification-id" }, {
        user: "user-1",
        title: "Titolo",
        message: "Testo",
        type: "system",
        link: "",
        isRead: false,
        createdAt: "server-timestamp",
      });
      expect(serverTimestampSpy).toHaveBeenCalledOnce();
      expect(mocks.batchCommit).toHaveBeenCalledOnce();
    });

    it("accoda più notifiche rispettando i valori espliciti e propagando gli errori di commit", async () => {
      // Arrange
      mocks.batchCommit.mockRejectedValueOnce(new Error("commit fallito"));
      const args = {
        subject: "Report",
        html: "<p>Report</p>",
        notifications: [
          { user: "one", title: "Uno", message: "Messaggio", type: "report" as const, link: "/report" },
          { user: "two", title: "Due", message: "Altro", type: "team" as const, link: "/team" },
        ],
      };

      // Act
      const result = helper.dispatchMailAndNotification(args);

      // Assert
      await expect(result).rejects.toThrow("commit fallito");
      expect(mocks.batchSet).toHaveBeenCalledTimes(3);
      expect(mocks.batchSet).toHaveBeenNthCalledWith(2, { id: "notification-id" }, expect.objectContaining({
        user: "one", type: "report", link: "/report", isRead: false,
      }));
      expect(mocks.batchSet).toHaveBeenNthCalledWith(3, { id: "notification-id" }, expect.objectContaining({
        user: "two", type: "team", link: "/team", isRead: false,
      }));
    });
  });

  describe("calculateReportData", () => {
    it("calcola tutti i conteggi e i minuti salvati", () => {
      // Arrange
      const rawUsage = {
        prompting: 1,
        legal_agent: 4,
        review_agent: 2,
        reasoning: 3,
        speech_to_text: 1,
        research_agent: 2,
        research: 3,
        drafting_agent: 4,
        deep_analysis: 2,
      };

      // Act
      const result = helper.calculateReportData(rawUsage, "settembre 2026");

      // Assert
      expect(result).toEqual({
        mese: "settembre 2026",
        haFattoPrompting: true,
        interazioniCount: 4,
        ricerca: { count: 5, timeSavedMinutes: 50 },
        analisi: { count: 6, timeSavedMinutes: 180 },
        sintesi: { count: 4, timeSavedMinutes: 60 },
        deepAnalysis: { count: 2, timeSavedMinutes: 120 },
        totalTimeSavedMinutes: 410,
      });
    });

    it("usa valori zero per gli utilizzi assenti e ignora prompting non positivo", () => {
      // Arrange
      const rawUsage = { prompting: 0, legal_agent: 0, research: -1 };

      // Act
      const result = helper.calculateReportData(rawUsage, "ottobre 2026");

      // Assert
      expect(result).toEqual({
        mese: "ottobre 2026",
        haFattoPrompting: false,
        interazioniCount: 0,
        ricerca: { count: -1, timeSavedMinutes: -10 },
        analisi: { count: 0, timeSavedMinutes: 0 },
        sintesi: { count: 0, timeSavedMinutes: 0 },
        deepAnalysis: { count: 0, timeSavedMinutes: 0 },
        totalTimeSavedMinutes: -10,
      });
    });
  });

  it("formatta il Timestamp usando il locale italiano e il fuso orario di Roma", () => {
    // Arrange
    const date = new Date("2026-10-19T08:00:00.000Z");
    const timestamp = { toDate: vi.fn(() => date) } as unknown as Timestamp;

    // Act
    const result = helper.fmtRome(timestamp);

    // Assert
    expect(timestamp.toDate).toHaveBeenCalledOnce();
    expect(result).toBe(date.toLocaleString("it-IT", {
      timeZone: "Europe/Rome",
      year: "numeric",
      month: "long",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }));
  });
});
