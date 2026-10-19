import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import type { MonthlyUsageReportData } from "../../../../functions/src/email/_interfaces";

const mocks = vi.hoisted(() => {
  const sessionGet = vi.fn();
  const sessionSet = vi.fn().mockResolvedValue(undefined);
  const registerGet = vi.fn();
  const userGet = vi.fn();
  const doc = vi.fn((id: string) => {
    if (id === "uid") return { get: registerGet };
    if (id === "downgrade-uid" || id === "welcome-uid") return { get: userGet };
    return { get: sessionGet, set: sessionSet };
  });
  const collection = vi.fn(() => ({ doc }));
  const txGet = vi.fn(async () => sessionGet());
  const txSet = vi.fn();
  const runTransaction = vi.fn(async (callback: (tx: { get: typeof txGet; set: typeof txSet }) => unknown) =>
    callback({ get: txGet, set: txSet }));
  const db = { collection, runTransaction };
  return {
    sessionGet,
    sessionSet,
    registerGet,
    userGet,
    doc,
    collection,
    txGet,
    txSet,
    runTransaction,
    db,
    getDb: vi.fn(() => db),
    getUser: vi.fn(),
    getUserByEmail: vi.fn(),
    dispatch: vi.fn().mockResolvedValue(undefined),
    fmtRome: vi.fn((timestamp: { toDate(): Date }) => timestamp.toDate().toISOString()),
    purchaseHtml: vi.fn((...args: string[]) => `<purchase>${args.join("|")}</purchase>`),
    downgradeHtml: vi.fn((name: string) => `<downgrade>${name}</downgrade>`),
    reportHtml: vi.fn((data: MonthlyUsageReportData) => `<report>${data.mese}</report>`),
  };
});

vi.mock("../../../../functions/src/_deps", () => ({
  getDb: mocks.getDb,
  getAdminAuth: () => ({ getUser: mocks.getUser, getUserByEmail: mocks.getUserByEmail }),
}));
vi.mock("../../../../functions/src/email/_helper", () => ({
  dispatchMailAndNotification: mocks.dispatch,
  fmtRome: mocks.fmtRome,
}));
vi.mock("../../../../functions/src/email/plans/html", () => ({
  generatePurchaseEmail: mocks.purchaseHtml,
  generateDowngradeEmail: mocks.downgradeHtml,
  generateMonthlyReportEmail: mocks.reportHtml,
}));

const functionRequire = createRequire(resolve(process.cwd(), "functions/src/email/plans/logic.ts"));
const firestoreModule = functionRequire("firebase-admin/firestore");
let logic: typeof import("../../../../functions/src/email/plans/logic");

describe("plans email logic", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(firestoreModule.FieldValue, "serverTimestamp").mockImplementation(() => "server-timestamp");
    logic = await import("../../../../functions/src/email/plans/logic");
  });

  describe("queuePurchaseEmailOnceStripe", () => {
    const args = {
      requestId: "req-1",
      uid: "uid",
      sessionId: "session-1",
      paidValue: 12.5,
      paidCurrency: "EUR",
    };

    it("non procede quando la sessione non esiste o l'email è già stata accodata", async () => {
      // Arrange
      mocks.sessionGet.mockResolvedValueOnce({ exists: false });
      mocks.sessionGet.mockResolvedValueOnce({ exists: true, data: () => ({ purchaseEmailQueuedAt: "queued" }) });

      // Act
      await logic.queuePurchaseEmailOnceStripe(args);
      await logic.queuePurchaseEmailOnceStripe(args);

      // Assert
      expect(mocks.txSet).not.toHaveBeenCalled();
      expect(mocks.getUser).not.toHaveBeenCalled();
      expect(mocks.dispatch).not.toHaveBeenCalled();
      expect(mocks.sessionSet).not.toHaveBeenCalled();
    });

    it("marca la sessione e invia la conferma con dati registrazione e date Timestamp", async () => {
      // Arrange
      const start = firestoreModule.Timestamp.fromDate(new Date("2026-01-01T10:00:00.000Z"));
      const expire = firestoreModule.Timestamp.fromDate(new Date("2027-01-01T10:00:00.000Z"));
      mocks.sessionGet.mockResolvedValue({ exists: true, data: () => ({ purchaseEmailQueuedAt: null }) });
      mocks.getUser.mockResolvedValue({ email: "buyer@example.com" });
      mocks.registerGet.mockResolvedValue({
        exists: true,
        data: () => ({ planId: "premium", start, expire }),
      });

      // Act
      await logic.queuePurchaseEmailOnceStripe(args);

      // Assert
      expect(mocks.txSet).toHaveBeenCalledWith(
        expect.anything(),
        { purchaseEmailQueuedAt: "server-timestamp" },
        { merge: true },
      );
      expect(mocks.getUser).toHaveBeenCalledWith("uid");
      expect(mocks.collection).toHaveBeenCalledWith("register");
      expect(mocks.fmtRome).toHaveBeenNthCalledWith(1, start);
      expect(mocks.fmtRome).toHaveBeenNthCalledWith(2, expire);
      expect(mocks.purchaseHtml).toHaveBeenCalledWith(
        "buyer@example.com", "premium", "12.50 EUR",
        start.toDate().toISOString(), expire.toDate().toISOString(), "session-1",
      );
      expect(mocks.dispatch).toHaveBeenCalledWith({
        to: "buyer@example.com",
        subject: "Conferma Ordine Jurio - session-1",
        html: `<purchase>buyer@example.com|premium|12.50 EUR|${start.toDate().toISOString()}|${expire.toDate().toISOString()}|session-1</purchase>`,
        notifications: {
          uid: "uid",
          title: "Acquisto Confermato",
          message: "Grazie! Il tuo ordine session-1 è andato a buon fine.",
          type: "billing",
          link: "/profilo/piani",
        },
      });
      expect(mocks.sessionSet).toHaveBeenCalledWith({ purchaseEmailSentAt: "server-timestamp" }, { merge: true });
    });

    it("salta l'email senza indirizzo ma segna come inviata, e gestisce dati di piano mancanti", async () => {
      // Arrange
      mocks.sessionGet.mockResolvedValue({ exists: true, data: () => ({}) });
      mocks.getUser.mockResolvedValue({ email: null });
      mocks.registerGet.mockResolvedValue({ exists: false, data: () => undefined });

      // Act
      await logic.queuePurchaseEmailOnceStripe(args);

      // Assert
      expect(mocks.purchaseHtml).not.toHaveBeenCalled();
      expect(mocks.dispatch).not.toHaveBeenCalled();
      expect(mocks.sessionSet).toHaveBeenCalledWith({ purchaseEmailSentAt: "server-timestamp" }, { merge: true });
    });

    it("registra gli errori di transazione o invio senza propagare eccezioni", async () => {
      // Arrange
      const error = new Error("transazione non riuscita");
      mocks.runTransaction.mockRejectedValueOnce(error);
      const log = vi.spyOn(console, "error").mockImplementation(() => undefined);

      // Act
      await logic.queuePurchaseEmailOnceStripe(args);

      // Assert
      expect(log).toHaveBeenCalledWith("[STRIPE] queuePurchaseEmailOnceStripe failed", expect.objectContaining({
        requestId: "req-1", uid: "uid", sessionId: "session-1", err: error,
      }));
      expect(mocks.sessionSet).not.toHaveBeenCalled();

      // Arrange
      mocks.sessionGet.mockResolvedValue({ exists: true, data: () => ({}) });
      mocks.getUser.mockResolvedValue({ email: "buyer@example.com" });
      mocks.registerGet.mockResolvedValue({ exists: false, data: () => undefined });
      mocks.dispatch.mockRejectedValueOnce(new Error("mail error"));

      // Act
      await logic.queuePurchaseEmailOnceStripe(args);

      // Assert
      expect(log).toHaveBeenCalledTimes(2);
      expect(mocks.sessionSet).not.toHaveBeenCalled();
    });
  });

  describe("enqueueDowngradeEmail", () => {
    it("non invia quando Auth fallisce o l'utente non ha email", async () => {
      // Arrange
      mocks.getUser.mockRejectedValueOnce(new Error("auth error"));
      const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

      // Act
      await logic.enqueueDowngradeEmail({ uid: "downgrade-uid" });
      mocks.getUser.mockResolvedValueOnce({ email: null });
      await logic.enqueueDowngradeEmail({ uid: "downgrade-uid" });

      // Assert
      expect(warn).toHaveBeenCalledOnce();
      expect(mocks.userGet).not.toHaveBeenCalled();
      expect(mocks.dispatch).not.toHaveBeenCalled();
    });

    it.each([
      [{ exists: true, data: () => ({ name: "  Ada  " }) }, "Ada"],
      [{ exists: false, data: () => ({ name: "Ignored" }) }, "utente"],
      [{ exists: true, data: () => ({ name: 42 }) }, "utente"],
      [{ exists: true, data: () => ({ name: "  " }) }, "utente"],
    ])("invia avviso con nome ripulito o predefinito", async (profile, expectedName) => {
      // Arrange
      mocks.getUser.mockResolvedValue({ email: "user@example.com" });
      mocks.userGet.mockResolvedValue(profile);

      // Act
      await logic.enqueueDowngradeEmail({ uid: "downgrade-uid" });

      // Assert
      expect(mocks.downgradeHtml).toHaveBeenCalledWith(expectedName);
      expect(mocks.dispatch).toHaveBeenCalledWith({
        to: "user@example.com",
        subject: "Piano Jurio scaduto",
        html: `<downgrade>${expectedName}</downgrade>`,
        notifications: {
          uid: "downgrade-uid",
          title: "Piano Scaduto",
          message: "Il tuo abbonamento è scaduto. Controlla il tuo piano per continuare a utilizzare le funzionalità avanzate.",
          type: "billing",
          link: "/profilo/piani",
        },
      });
    });

    it("propaga gli errori lettura profilo e accodamento", async () => {
      // Arrange
      mocks.getUser.mockResolvedValue({ email: "user@example.com" });
      mocks.userGet.mockRejectedValueOnce(new Error("db error"));

      // Act
      const profileResult = logic.enqueueDowngradeEmail({ uid: "downgrade-uid" });

      // Assert
      await expect(profileResult).rejects.toThrow("db error");

      // Arrange
      mocks.userGet.mockResolvedValueOnce({ exists: false, data: () => undefined });
      mocks.dispatch.mockRejectedValueOnce(new Error("queue error"));

      // Act
      const dispatchResult = logic.enqueueDowngradeEmail({ uid: "downgrade-uid" });

      // Assert
      await expect(dispatchResult).rejects.toThrow("queue error");
    });
  });

  describe("enqueueMonthlyUsageEmail", () => {
    const reportData: MonthlyUsageReportData = {
      mese: "settembre 2026",
      haFattoPrompting: false,
      interazioniCount: 1,
      ricerca: { count: 1, timeSavedMinutes: 10 },
      analisi: { count: 0, timeSavedMinutes: 0 },
      sintesi: { count: 0, timeSavedMinutes: 0 },
      deepAnalysis: { count: 0, timeSavedMinutes: 0 },
      totalTimeSavedMinutes: 10,
    };

    it("ignora email vuota o lista destinatari vuota", async () => {
      // Arrange
      const args = { reportData };

      // Act
      await logic.enqueueMonthlyUsageEmail({ ...args, email: "" });
      await logic.enqueueMonthlyUsageEmail({ ...args, email: [] });

      // Assert
      expect(mocks.getUserByEmail).not.toHaveBeenCalled();
      expect(mocks.reportHtml).not.toHaveBeenCalled();
      expect(mocks.dispatch).not.toHaveBeenCalled();
    });

    it("invia report a più destinatari, notifica gli utenti registrati e ignora gli altri", async () => {
      // Arrange
      mocks.getUserByEmail.mockResolvedValueOnce({ uid: "uid-a" })
        .mockRejectedValueOnce(new Error("unknown"))
        .mockResolvedValueOnce({ uid: "uid-c" });
      const recipients = ["a@example.com", "unknown@example.com", "c@example.com"];

      // Act
      await logic.enqueueMonthlyUsageEmail({ email: recipients, reportData });

      // Assert
      expect(mocks.reportHtml).toHaveBeenCalledWith(reportData);
      expect(mocks.getUserByEmail).toHaveBeenCalledTimes(3);
      expect(mocks.dispatch).toHaveBeenCalledWith({
        to: recipients,
        subject: "Il tuo resoconto mensile su Jurio: hai risparmiato 10 minuti!",
        html: "<report>settembre 2026</report>",
        notifications: expect.arrayContaining([
          expect.objectContaining({ uid: "uid-a", type: "report", link: "/profilo/utilizzi" }),
          expect.objectContaining({ uid: "uid-c", type: "report", link: "/profilo/utilizzi" }),
        ]),
      });
      expect(mocks.dispatch.mock.calls[0][0].notifications).toHaveLength(2);
    });

    it("usa l'oggetto senza risparmio quando il totale è zero e omette notifiche se non registrati", async () => {
      // Arrange
      const zeroReport = { ...reportData, totalTimeSavedMinutes: 0 };
      mocks.getUserByEmail.mockRejectedValue(new Error("unknown"));

      // Act
      await logic.enqueueMonthlyUsageEmail({ email: "unknown@example.com", reportData: zeroReport });

      // Assert
      expect(mocks.dispatch).toHaveBeenCalledWith({
        to: ["unknown@example.com"],
        subject: "Il tuo resoconto mensile su Jurio",
        html: "<report>settembre 2026</report>",
        notifications: undefined,
      });
    });

    it("propaga gli errori del servizio di accodamento", async () => {
      // Arrange
      mocks.getUserByEmail.mockResolvedValue({ uid: "uid-report" });
      mocks.dispatch.mockRejectedValueOnce(new Error("queue error"));

      // Act
      const result = logic.enqueueMonthlyUsageEmail({ email: "report@example.com", reportData });

      // Assert
      await expect(result).rejects.toThrow("queue error");
    });
  });
});
